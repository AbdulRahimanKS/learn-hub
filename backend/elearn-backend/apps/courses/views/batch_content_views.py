import logging
from django.db import IntegrityError, transaction
from django.db.models import Max
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema

from apps.courses.models import (
    Batch, BatchWeek, BatchClassSession, BatchWeeklyTest, BatchTestQuestion,
    BatchTestQuestionAttachment, BatchEnrollment, StudentSessionView
)
from apps.courses.serializers.course_module_serializers import (
    BatchWeekSerializer,
    BatchWeekCreateUpdateSerializer,
    BatchClassSessionSerializer,
    BatchClassSessionCreateUpdateSerializer,
    BatchWeeklyTestSerializer,
    BatchWeeklyTestCreateUpdateSerializer,
    BatchTestQuestionSerializer,
    BatchTestQuestionAttachmentSerializer,
)
from utils.permissions import IsAuthenticated, IsSuperAdminAdminOrTeacher
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.constants import UserTypeConstants
from apps.courses.services import delete_unused_video_from_storage
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


def ensure_week_is_modifiable(week, action):
    """Centralized guard to prevent writes after unlock date."""
    if not week.can_modify_content:
        raise ServiceError(
            detail=f"Cannot {action} in an unlocked week.",
            status_code=status.HTTP_400_BAD_REQUEST
        )


@extend_schema(tags=["Batch Content"])
class BatchWeekListView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BatchWeekSerializer

    @extend_schema(summary="List weeks for a specific batch", responses={200: BatchWeekSerializer(many=True)})
    def get(self, request, batch_id):
        weeks = BatchWeek.objects.filter(batch_id=batch_id).order_by('week_number')
        
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            # Check if student is active in this batch
            if not BatchEnrollment.objects.filter(batch_id=batch_id, student=user, status=BatchEnrollment.Status.ACTIVE).exists():
                raise ServiceError(detail="Access denied. You are not an active student in this batch.", status_code=status.HTTP_403_FORBIDDEN)
            # For students, only show published weeks
            weeks = weeks.filter(is_published=True)

        serializer = BatchWeekSerializer(weeks, many=True, context={'request': request})
        return format_success_response(message="Batch weeks retrieved successfully", data=serializer.data)

    @extend_schema(summary="Create a new week for a specific batch", request=BatchWeekCreateUpdateSerializer)
    def post(self, request, batch_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
            
            try:
                batch = Batch.objects.get(id=batch_id)
            except Batch.DoesNotExist:
                raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

            serializer = BatchWeekCreateUpdateSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            week_number = serializer.validated_data.get('week_number', 1)
            if week_number:
                # Sequential validation: all weeks 1..N-1 must exist
                existing_numbers = set(
                    BatchWeek.objects.filter(batch=batch).values_list('week_number', flat=True)
                )
                missing = [i for i in range(1, week_number) if i not in existing_numbers]
                if missing:
                    missing_str = ', '.join(str(m) for m in missing)
                    raise ServiceError(
                        detail=f"Week {missing_str} must be created first before adding Week {week_number}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

            unlock_date = None
            if batch.start_date:
                # Follow latest configured week date (handles extended timelines).
                last_week = BatchWeek.objects.filter(batch=batch).order_by('-week_number').first()
                if last_week:
                    if last_week.unlock_date:
                        base_date = last_week.unlock_date.date()
                    else:
                        # Fallback for older rows without unlock_date.
                        base_date = batch.start_date + timedelta(days=(last_week.week_number - 1) * 7)
                    step_weeks = week_number - last_week.week_number
                    days_to_add = step_weeks * 7
                    target_date = base_date + timedelta(days=days_to_add)
                else:
                    days_to_add = (week_number - 1) * 7
                    target_date = batch.start_date + timedelta(days=days_to_add)

                unlock_date = timezone.make_aware(
                    timezone.datetime.combine(target_date, timezone.datetime.min.time())
                )

            week = BatchWeek.objects.create(
                batch=batch,
                unlock_date=unlock_date,
                **serializer.validated_data
            )
            return format_success_response(
                message="Batch week created successfully",
                data=None,
                status_code=status.HTTP_201_CREATED
            )
        except IntegrityError:
            raise ServiceError(detail="A week with this number already exists for this course.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating course week: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the course week.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batch Content"])
class BatchWeekDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = BatchWeekSerializer

    def get_object(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Update a batch week", request=BatchWeekCreateUpdateSerializer)
    def patch(self, request, batch_id, week_id):
        try:
            week = self.get_object(batch_id, week_id)
            ensure_week_is_modifiable(week, "update week")
            
            serializer = BatchWeekCreateUpdateSerializer(week, data=request.data, partial=True, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            update_data = dict(serializer.validated_data)
            new_week_number = update_data.pop('week_number', None)
            old_week_number = week.week_number

            if new_week_number is not None and new_week_number != old_week_number:
                total_weeks = BatchWeek.objects.filter(batch=week.batch).count()
                if new_week_number < 1 or new_week_number > total_weeks:
                    if total_weeks == 1:
                        message = "Only Week 1 exists. Create more weeks before moving to a higher week number."
                    else:
                        message = f"Week number must be between 1 and {total_weeks}."
                    raise ServiceError(
                        detail=message,
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

                # Prevent renumbering that would shift already unlocked weeks.
                locked_weeks_qs = BatchWeek.objects.filter(batch=week.batch).exclude(id=week.id)
                if new_week_number < old_week_number:
                    affected_weeks = locked_weeks_qs.filter(
                        week_number__gte=new_week_number,
                        week_number__lt=old_week_number
                    )
                else:
                    affected_weeks = locked_weeks_qs.filter(
                        week_number__gt=old_week_number,
                        week_number__lte=new_week_number
                    )

                if any(affected_week.is_unlocked for affected_week in affected_weeks):
                    raise ServiceError(
                        detail="Cannot change week number across unlocked weeks. Choose a position within locked/future weeks only.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

                # Move semantics with collision-safe ordered updates.
                with transaction.atomic():
                    weeks_qs = BatchWeek.objects.select_for_update().filter(batch=week.batch)
                    safe_temp = total_weeks + 1000
                    range_start = min(old_week_number, new_week_number)
                    range_end = max(old_week_number, new_week_number)
                    weeks_qs.filter(id=week.id).update(week_number=safe_temp)

                    if new_week_number < old_week_number:
                        affected_weeks = weeks_qs.filter(
                            week_number__gte=new_week_number,
                            week_number__lt=old_week_number
                        ).order_by('-week_number')
                        for affected_week in affected_weeks:
                            weeks_qs.filter(id=affected_week.id).update(week_number=affected_week.week_number + 1)
                    else:
                        affected_weeks = weeks_qs.filter(
                            week_number__gt=old_week_number,
                            week_number__lte=new_week_number
                        ).order_by('week_number')
                        for affected_week in affected_weeks:
                            weeks_qs.filter(id=affected_week.id).update(week_number=affected_week.week_number - 1)

                    weeks_qs.filter(id=week.id).update(week_number=new_week_number)
                    week.week_number = new_week_number

                    # Keep unlock dates aligned with the new week order for affected locked weeks.
                    previous_week = weeks_qs.filter(week_number=range_start - 1).first()
                    if previous_week and previous_week.unlock_date:
                        next_date = previous_week.unlock_date.date() + timedelta(days=7)
                    elif week.batch.start_date:
                        next_date = week.batch.start_date + timedelta(days=(range_start - 1) * 7)
                    else:
                        next_date = None

                    if next_date:
                        reordered_weeks = weeks_qs.filter(
                            week_number__gte=range_start,
                            week_number__lte=range_end
                        ).order_by('week_number')
                        for index, reordered_week in enumerate(reordered_weeks):
                            recalculated_date = next_date + timedelta(days=index * 7)
                            recalculated_unlock = timezone.make_aware(
                                timezone.datetime.combine(recalculated_date, timezone.datetime.min.time())
                            )
                            weeks_qs.filter(id=reordered_week.id).update(unlock_date=recalculated_unlock)

            for attr, value in update_data.items():
                setattr(week, attr, value)
            week.save()
            
            return format_success_response(message="Batch week updated successfully", data=None)
        except IntegrityError:
            raise ServiceError(detail="A week with this number already exists for this course.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating course week: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the course week.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a batch week", responses={200: None})
    def delete(self, request, batch_id, week_id):
        try:
            week = self.get_object(batch_id, week_id)
            ensure_week_is_modifiable(week, "delete week")
            
            batch = week.batch
            deleted_week_number = week.week_number

            with transaction.atomic():
                week.delete()

                weeks_qs = BatchWeek.objects.select_for_update().filter(batch=batch)
                previous_week = weeks_qs.filter(week_number=deleted_week_number - 1).first()
                if previous_week and previous_week.unlock_date:
                    base_date = previous_week.unlock_date.date() + timedelta(days=7)
                elif batch.start_date:
                    base_date = batch.start_date + timedelta(days=(deleted_week_number - 1) * 7)
                else:
                    base_date = None

                # Re-order subsequent batch weeks and keep unlock dates aligned.
                subsequent_weeks = weeks_qs.filter(
                    week_number__gt=deleted_week_number
                ).order_by('week_number')

                for index, subsequent_week in enumerate(subsequent_weeks):
                    update_data = {'week_number': subsequent_week.week_number - 1}
                    if base_date:
                        recalculated_date = base_date + timedelta(days=index * 7)
                        update_data['unlock_date'] = timezone.make_aware(
                            timezone.datetime.combine(recalculated_date, timezone.datetime.min.time())
                        )
                    weeks_qs.filter(id=subsequent_week.id).update(**update_data)

            return format_success_response(message="Batch week deleted and order adjusted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting course week: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the course week.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batch Content"])
class BatchClassSessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = BatchClassSessionSerializer

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List sessions for a batch week")
    def get(self, request, batch_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not BatchEnrollment.objects.filter(batch_id=batch_id, student=user, status=BatchEnrollment.Status.ACTIVE).exists():
                raise ServiceError(detail="Access denied. You are not an active student in this batch.", status_code=status.HTTP_403_FORBIDDEN)
                
        week = self.get_week(batch_id, week_id)
        sessions = BatchClassSession.objects.filter(batch_week=week)
        serializer = BatchClassSessionSerializer(sessions, many=True, context={'request': request})
        return format_success_response(message="Batch sessions retrieved successfully", data=serializer.data)

    @extend_schema(summary="Create a session for a batch week", request=BatchClassSessionCreateUpdateSerializer)
    def post(self, request, batch_id, week_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
            
            week = self.get_week(batch_id, week_id)
            ensure_week_is_modifiable(week, "create session")
            
            serializer = BatchClassSessionCreateUpdateSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            session_number = serializer.validated_data.get('session_number')
            weekday = serializer.validated_data.get('weekday')
            if session_number and weekday:
                existing_numbers = set(
                    BatchClassSession.objects.filter(batch_week=week, weekday=weekday).values_list('session_number', flat=True)
                )
                if session_number in existing_numbers:
                    raise ServiceError(
                        detail=f"Session {session_number} already exists for {weekday.capitalize()}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
                missing = [i for i in range(1, session_number) if i not in existing_numbers]
                if missing:
                    missing_str = ', '.join(str(m) for m in missing)
                    raise ServiceError(
                        detail=f"Session {missing_str} for {weekday.capitalize()} must be created first before adding Session {session_number}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

            BatchClassSession.objects.create(
                batch_week=week,
                uploaded_by=request.user,
                **serializer.validated_data
            )
            return format_success_response(message="Batch session created successfully", data=None, status_code=status.HTTP_201_CREATED)
        except IntegrityError:
            raise ServiceError(detail="A session with this number already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating batch session: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the batch session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BatchWeeklyTestSerializer

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve/Create/Update batch weekly test")
    def get(self, request, batch_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not BatchEnrollment.objects.filter(batch_id=batch_id, student=user, status=BatchEnrollment.Status.ACTIVE).exists():
                raise ServiceError(detail="Access denied. You are not an active student in this batch.", status_code=status.HTTP_403_FORBIDDEN)
                
        week = self.get_week(batch_id, week_id)
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this batch week.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = BatchWeeklyTestSerializer(week.weekly_test, context={'request': request})
        return format_success_response(message="Batch weekly test retrieved", data=serializer.data)


@extend_schema(tags=["Batch Content"])
class BatchClassSessionDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = BatchClassSessionSerializer

    def get_object(self, batch_id, week_id, session_id):
        try:
            return BatchClassSession.objects.get(id=session_id, batch_week_id=week_id, batch_week__batch_id=batch_id)
        except BatchClassSession.DoesNotExist:
            raise ServiceError(detail="Batch session not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Update a batch session", request=BatchClassSessionCreateUpdateSerializer)
    def patch(self, request, batch_id, week_id, session_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            session = self.get_object(batch_id, week_id, session_id)
            ensure_week_is_modifiable(session.batch_week, "update session")
            
            serializer = BatchClassSessionCreateUpdateSerializer(session, data=request.data, partial=True, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            new_session_number = serializer.validated_data.get('session_number')
            old_session_number = session.session_number
            new_weekday = serializer.validated_data.get('weekday')
            old_weekday = session.weekday
            final_weekday = new_weekday if new_weekday else old_weekday

            occupying_session = None

            if (new_session_number and new_session_number != old_session_number) or (new_weekday and new_weekday != old_weekday):
                max_existing = BatchClassSession.objects.filter(
                    batch_week=session.batch_week,
                    weekday=final_weekday
                ).exclude(id=session.id).count()

                if new_session_number and (new_session_number > max_existing + 1 or new_session_number < 1):
                    allowed_max = max_existing + 1
                    if allowed_max == 1:
                        message = (
                            f"Only Session 1 exists for {final_weekday.capitalize()}. "
                            "Create more sessions before moving to a higher session number."
                        )
                    else:
                        message = f"Session number must be between 1 and {allowed_max} for {final_weekday.capitalize()}."
                    raise ServiceError(detail=message, status_code=status.HTTP_400_BAD_REQUEST)

                try:
                    target_session_number = new_session_number if new_session_number else old_session_number
                    occupying_session = BatchClassSession.objects.get(
                        batch_week=session.batch_week,
                        weekday=final_weekday,
                        session_number=target_session_number
                    )
                    current_max = BatchClassSession.objects.filter(
                        batch_week=session.batch_week,
                        weekday=final_weekday
                    ).aggregate(m=Max('session_number'))['m'] or 0
                    safe_temp = current_max + 9999
                    BatchClassSession.objects.filter(id=occupying_session.id).update(session_number=safe_temp)
                except BatchClassSession.DoesNotExist:
                    pass

            for attr, value in serializer.validated_data.items():
                setattr(session, attr, value)

            session.save()

            if occupying_session is not None:
                BatchClassSession.objects.filter(id=occupying_session.id).update(session_number=old_session_number)

            return format_success_response(message="Batch session updated successfully")
        except IntegrityError:
            raise ServiceError(detail="A session with this number already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating class session: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the class session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a batch session")
    def delete(self, request, batch_id, week_id, session_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
            
        try:
            session = self.get_object(batch_id, week_id, session_id)
            ensure_week_is_modifiable(session.batch_week, "delete session")
            
            batch_week = session.batch_week
            deleted_session_number = session.session_number
            video_file_key = session.video_file

            session.delete()

            # Re-order subsequent sessions to fill the gap left by the deleted session.
            subsequent_sessions = BatchClassSession.objects.filter(
                batch_week=batch_week,
                weekday=session.weekday,
                session_number__gt=deleted_session_number
            ).order_by('session_number')

            for subsequent_session in subsequent_sessions:
                # Direct update to bypass constraints/signals
                BatchClassSession.objects.filter(id=subsequent_session.id).update(
                    session_number=subsequent_session.session_number - 1
                )

            if video_file_key:
                delete_unused_video_from_storage(video_file_key)

                return format_success_response(message="Batch session deleted and order adjusted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting class session: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the class session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    
@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestManageView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = BatchWeeklyTestSerializer

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Create or update batch weekly test", request=BatchWeeklyTestCreateUpdateSerializer)
    def post(self, request, batch_id, week_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            week = self.get_week(batch_id, week_id)
            ensure_week_is_modifiable(week, "create or update weekly test")
            
            if hasattr(week, 'weekly_test'):
                serializer = BatchWeeklyTestCreateUpdateSerializer(week.weekly_test, data=request.data, partial=True, context={'request': request})
            else:
                serializer = BatchWeeklyTestCreateUpdateSerializer(data=request.data, context={'request': request})
                
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
                
            if hasattr(week, 'weekly_test'):
                serializer.save(updated_by=user)
                test_obj = week.weekly_test
                message = "Batch test updated successfully"
            else:
                test_obj = BatchWeeklyTest.objects.create(batch_week=week, created_by=request.user, **serializer.validated_data)
                message = "Batch test created successfully"
                
            return format_success_response(message=message, data=None, status_code=status.HTTP_200_OK)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating or updating weekly test: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the weekly test.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete batch weekly test", responses={200: None})
    def delete(self, request, batch_id, week_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            week = self.get_week(batch_id, week_id)
            if not hasattr(week, 'weekly_test'):
                raise ServiceError(detail="No test found.", status_code=status.HTTP_404_NOT_FOUND)
            
            ensure_week_is_modifiable(week, "delete weekly test")
                
            week.weekly_test.delete()
            return format_success_response(message="Batch test deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting weekly test: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the weekly test.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BatchTestQuestionSerializer

    def get_test(self, batch_id, week_id):
        try:
            week = BatchWeek.objects.get(id=week_id, batch_id=batch_id)
            if not hasattr(week, 'weekly_test'):
                raise ServiceError(detail="No test configured for this batch week.", status_code=status.HTTP_404_NOT_FOUND)
            return week.weekly_test
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List/Add questions to batch weekly test", operation_id="batch_weekly_test_question_list", request=BatchTestQuestionSerializer)
    def get(self, request, batch_id, week_id):
        test = self.get_test(batch_id, week_id)
        user = request.user

        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not test.batch_week.is_published:
                raise ServiceError(detail="This test's questions are not available yet.", status_code=status.HTTP_403_FORBIDDEN)
        
        serializer = BatchTestQuestionSerializer(test.questions.all(), many=True, context={'request': request})
        return format_success_response(message="Questions retrieved", data=serializer.data)

    @extend_schema(summary="Add a question to batch weekly test", request=BatchTestQuestionSerializer)
    def post(self, request, batch_id, week_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            test = self.get_test(batch_id, week_id)
            ensure_week_is_modifiable(test.batch_week, "add test question")

            serializer = BatchTestQuestionSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
            question = BatchTestQuestion.objects.create(test=test, **serializer.validated_data)
            response_serializer = BatchTestQuestionSerializer(question, context={'request': request})
            return format_success_response(message="Question added to batch test", data=response_serializer.data, status_code=status.HTTP_201_CREATED)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error adding question to batch test: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = BatchTestQuestionSerializer

    def get_object(self, batch_id, week_id, question_id):
        try:
            return BatchTestQuestion.objects.get(
                id=question_id, 
                test__batch_week_id=week_id, 
                test__batch_week__batch_id=batch_id
            )
        except BatchTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve/Update/Delete batch test question", responses={200: BatchTestQuestionSerializer})
    def get(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not question.test.batch_week.is_published:
                raise ServiceError(detail="This question is not available yet.", status_code=status.HTTP_403_FORBIDDEN)
        
        serializer = BatchTestQuestionSerializer(question, context={'request': request})
        return format_success_response(message="Question retrieved", data=serializer.data)

    @extend_schema(summary="Update a batch test question", request=BatchTestQuestionSerializer)
    def patch(self, request, batch_id, week_id, question_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            question = self.get_object(batch_id, week_id, question_id)
            ensure_week_is_modifiable(question.test.batch_week, "update test question")

            serializer = BatchTestQuestionSerializer(question, data=request.data, partial=True, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            for attr, value in serializer.validated_data.items():
                setattr(question, attr, value)

            new_question_file = 'question_file' in request.FILES
            new_image = 'image' in request.FILES
            if request.data.get('remove_question_file') == 'true' and not new_question_file:
                if question.question_file:
                    question.question_file.delete(save=False)
                question.question_file = None
            if request.data.get('remove_image') == 'true' and not new_image:
                if question.image:
                    question.image.delete(save=False)
                question.image = None

            question.save()
            response_serializer = BatchTestQuestionSerializer(question, context={'request': request})
            return format_success_response(message="Question updated", data=response_serializer.data)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating question: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a batch test question", responses={200: None})
    def delete(self, request, batch_id, week_id, question_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            question = self.get_object(batch_id, week_id, question_id)
            ensure_week_is_modifiable(question.test.batch_week, "delete test question")
            
            question.delete()
            return format_success_response(message="Question deleted")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting question: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionAttachmentView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = BatchTestQuestionAttachmentSerializer

    def get_question(self, batch_id, week_id, question_id):
        try:
            return BatchTestQuestion.objects.get(
                id=question_id,
                test__batch_week_id=week_id,
                test__batch_week__batch_id=batch_id
            )
        except BatchTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Add an attachment to a batch test question", request=BatchTestQuestionAttachmentSerializer)
    def post(self, request, batch_id, week_id, question_id):
        try:
            question = self.get_question(batch_id, week_id, question_id)
            ensure_week_is_modifiable(question.test.batch_week, "add question attachment")
            
            file = request.FILES.get('file')
            if not file:
                raise ServiceError(detail="No file provided.", status_code=status.HTTP_400_BAD_REQUEST)
            name = request.data.get('name', file.name)
            attachment = BatchTestQuestionAttachment.objects.create(
                question=question, file=file, name=name
            )
            serializer = BatchTestQuestionAttachmentSerializer(attachment, context={'request': request})
            return format_success_response(
                message="Attachment added successfully",
                data=serializer.data,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error adding attachment: {str(e)}")
            raise ServiceError(detail="An error occurred while adding the attachment.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionAttachmentDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = BatchTestQuestionAttachmentSerializer

    def get_object(self, batch_id, week_id, question_id, attachment_id):
        try:
            return BatchTestQuestionAttachment.objects.get(
                id=attachment_id,
                question_id=question_id,
                question__test__batch_week_id=week_id,
                question__test__batch_week__batch_id=batch_id
            )
        except BatchTestQuestionAttachment.DoesNotExist:
            raise ServiceError(detail="Attachment not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Delete a batch question attachment", responses={200: None})
    def delete(self, request, batch_id, week_id, question_id, attachment_id):
        try:
            attachment = self.get_object(batch_id, week_id, question_id, attachment_id)
            ensure_week_is_modifiable(attachment.question.test.batch_week, "delete question attachment")
            
            attachment.delete()
            return format_success_response(message="Attachment deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting attachment: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the attachment.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batch Content"])
class BatchClassSessionCompletionView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BatchClassSessionSerializer

    @extend_schema(summary="Mark a batch session as completed", responses={200: None})
    def post(self, request, batch_id, week_id, session_id):
        try:
            session = BatchClassSession.objects.get(
                id=session_id, 
                batch_week_id=week_id, 
                batch_week__batch_id=batch_id
            )
        except BatchClassSession.DoesNotExist:
            raise ServiceError(detail="Batch session not found.", status_code=status.HTTP_404_NOT_FOUND)

        enrollment = BatchEnrollment.objects.filter(student=request.user, batch_id=batch_id, status=BatchEnrollment.Status.ACTIVE).first()
        if not enrollment:
            raise ServiceError(detail="You are not an active student in this batch.", status_code=status.HTTP_403_FORBIDDEN)

        view, created = StudentSessionView.objects.get_or_create(
            enrollment=enrollment,
            batch_session=session
        )
        
        is_completed = request.data.get('is_completed', True)
        view.is_completed = is_completed
        if is_completed:
            view.watched_percent = 100.0
        view.save()

        return format_success_response(
            message=f"Session marked as {'completed' if is_completed else 'incomplete'}",
            data={'is_completed': view.is_completed}
        )
