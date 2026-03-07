import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema
from django.db import IntegrityError

from apps.courses.models import Course, CourseWeek, CourseClassSession, CourseWeeklyTest, CourseTestQuestion, CourseTestQuestionAttachment, BatchEnrollment
from apps.courses.serializers.course_module_serializers import (
    CourseWeekSerializer,
    CourseWeekCreateUpdateSerializer,
    CourseClassSessionSerializer,
    CourseClassSessionCreateUpdateSerializer,
    CourseWeeklyTestSerializer,
    CourseWeeklyTestCreateUpdateSerializer,
    CourseTestQuestionSerializer,
    CourseTestQuestionAttachmentSerializer,
)
from utils.permissions import IsSuperAdminAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.constants import UserTypeConstants
from apps.courses.services import delete_unused_video_from_storage

logger = logging.getLogger(__name__)


@extend_schema(tags=["Course Weeks"])
class CourseWeekListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_course(self, pk):
        try:
            return Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List course weeks for a course", responses={200: CourseWeekSerializer(many=True)})
    def get(self, request, course_id):
        course = self.get_course(course_id)
        weeks = CourseWeek.objects.filter(course=course)
        
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            weeks = weeks.filter(is_published=True)

        serializer = CourseWeekSerializer(weeks, many=True, context={'request': request})
        return format_success_response(message="Course weeks retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Create a new course week (Admin/Teacher only)", 
        request=CourseWeekCreateUpdateSerializer, 
        responses={201: CourseWeekSerializer}
    )
    def post(self, request, course_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        course = self.get_course(course_id)
        serializer = CourseWeekCreateUpdateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            week_number = serializer.validated_data.get('week_number')
            if week_number:
                # Sequential validation: all weeks 1..N-1 must exist
                existing_numbers = set(
                    CourseWeek.objects.filter(course=course).values_list('week_number', flat=True)
                )
                missing = [i for i in range(1, week_number) if i not in existing_numbers]
                if missing:
                    missing_str = ', '.join(str(m) for m in missing)
                    raise ServiceError(
                        detail=f"Week {missing_str} must be created first before adding Week {week_number}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
            CourseWeek.objects.create(
                course=course,
                created_by=user,
                **serializer.validated_data
            )
            return format_success_response(
                message="Course week created successfully", 
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


@extend_schema(tags=["Course Weeks"])
class CourseWeekDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    def get_object(self, course_id, week_id):
        try:
            return CourseWeek.objects.get(id=week_id, course_id=course_id)
        except CourseWeek.DoesNotExist:
            raise ServiceError(detail="Course week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Update a course week", 
        request=CourseWeekCreateUpdateSerializer, 
        responses={200: CourseWeekSerializer}
    )
    def patch(self, request, course_id, week_id):
        week = self.get_object(course_id, week_id)
        serializer = CourseWeekCreateUpdateSerializer(week, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            # Smart reorder by swap when week_number is being changed
            new_week_number = serializer.validated_data.get('week_number')
            old_week_number = week.week_number
            occupying_week = None

            if new_week_number and new_week_number != old_week_number:
                max_existing = CourseWeek.objects.filter(course=week.course).exclude(id=week.id).count()
                # The new number must be within 1..max_existing to stay sequential (or max+1 if the week is the last one)
                if new_week_number > max_existing + 1 or new_week_number < 1:
                    raise ServiceError(
                        detail=f"Week number must be between 1 and {max_existing + 1}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
                # Park the occupying week at a safe temp number before the swap.
                # Use queryset update() to bypass PositiveSmallIntegerField validation.
                # Temp = current max week_number + 9999, guaranteed to not conflict.
                try:
                    occupying_week = CourseWeek.objects.get(
                        course=week.course,
                        week_number=new_week_number
                    )
                    from django.db.models import Max as _Max
                    current_max = CourseWeek.objects.filter(course=week.course).aggregate(m=_Max('week_number'))['m'] or 0
                    safe_temp = current_max + 9999
                    # Step 1: park occupying_week at safe_temp to free the target slot
                    CourseWeek.objects.filter(id=occupying_week.id).update(week_number=safe_temp)
                except CourseWeek.DoesNotExist:
                    pass  # Target slot is free — no swap needed

            # Step 2: save the main week to its new number (target slot is now free)
            for attr, value in serializer.validated_data.items():
                setattr(week, attr, value)
            week.updated_by = request.user
            week.save()

            # Step 3: move the displaced week into the old slot
            if occupying_week is not None:
                CourseWeek.objects.filter(id=occupying_week.id).update(week_number=old_week_number)
            
            return format_success_response(message="Course week updated successfully", data=None)
        except IntegrityError:
            raise ServiceError(detail="A week with this number already exists for this course.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating course week: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the course week.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a course week", responses={200: None})
    def delete(self, request, course_id, week_id):
        try:
            week = self.get_object(course_id, week_id)
            course = week.course
            deleted_week_number = week.week_number

            # Delete the current week
            week.delete()

            # Re-order the subsequent weeks to fill the gap left by the deleted week.
            # E.g., if Week 2 is deleted from [1, 2, 3, 4], Week 3 becomes 2, and 4 becomes 3.
            subsequent_weeks = CourseWeek.objects.filter(
                course=course,
                week_number__gt=deleted_week_number
            ).order_by('week_number')

            for subsequent_week in subsequent_weeks:
                # Direct update to avoid unique constraint issues if we did it out of order
                CourseWeek.objects.filter(id=subsequent_week.id).update(
                    week_number=subsequent_week.week_number - 1
                )

            return format_success_response(message="Course week deleted and order adjusted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting course week: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the course week.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Class Sessions"])
class ClassSessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_week(self, course_id, week_id):
        try:
            return CourseWeek.objects.get(id=week_id, course_id=course_id)
        except CourseWeek.DoesNotExist:
            raise ServiceError(detail="Course week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List class sessions for a week", responses={200: CourseClassSessionSerializer(many=True)})
    def get(self, request, course_id, week_id):
        week = self.get_week(course_id, week_id)
        
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not week.is_published:
                raise ServiceError(detail="This week is not published yet.", status_code=status.HTTP_403_FORBIDDEN)

        sessions = CourseClassSession.objects.filter(course_week=week)
        serializer = CourseClassSessionSerializer(sessions, many=True, context={'request': request})
        return format_success_response(message="Class sessions retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Create a new class session (Admin/Teacher only)", 
        request=CourseClassSessionCreateUpdateSerializer, 
        responses={201: CourseClassSessionSerializer}
    )
    def post(self, request, course_id, week_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            week = self.get_week(course_id, week_id)
            serializer = CourseClassSessionCreateUpdateSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            session_number = serializer.validated_data.get('session_number')
            weekday = serializer.validated_data.get('weekday')
            if session_number and weekday:
                # Sequential validation: all sessions 1..N-1 must exist for the given weekday
                existing_numbers = set(
                    CourseClassSession.objects.filter(course_week=week, weekday=weekday).values_list('session_number', flat=True)
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

            session = CourseClassSession.objects.create(
                course_week=week,
                uploaded_by=request.user,
                **serializer.validated_data
            )
            response_serializer = CourseClassSessionSerializer(session, context={'request': request})
            return format_success_response(
                message="Class session created successfully", 
                data=response_serializer.data, 
                status_code=status.HTTP_201_CREATED
            )
        except IntegrityError:
            raise ServiceError(detail="A session with this number already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating class session: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the class session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Class Sessions"])
class ClassSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, course_id, week_id, session_id):
        try:
            return CourseClassSession.objects.get(id=session_id, course_week_id=week_id, course_week__course_id=course_id)
        except CourseClassSession.DoesNotExist:
            raise ServiceError(detail="Class session not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a class session", responses={200: CourseClassSessionSerializer})
    def get(self, request, course_id, week_id, session_id):
        session = self.get_object(course_id, week_id, session_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not session.course_week.is_published:
                raise ServiceError(detail="This session is not available.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = CourseClassSessionSerializer(session, context={'request': request})
        return format_success_response(message="Class session retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Update a class session", 
        request=CourseClassSessionCreateUpdateSerializer, 
        responses={200: CourseClassSessionSerializer}
    )
    def patch(self, request, course_id, week_id, session_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        session = self.get_object(course_id, week_id, session_id)
        serializer = CourseClassSessionCreateUpdateSerializer(session, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            new_session_number = serializer.validated_data.get('session_number')
            old_session_number = session.session_number
            new_weekday = serializer.validated_data.get('weekday')
            old_weekday = session.weekday
            final_weekday = new_weekday if new_weekday else old_weekday
            
            occupying_session = None

            if (new_session_number and new_session_number != old_session_number) or (new_weekday and new_weekday != old_weekday):
                max_existing = CourseClassSession.objects.filter(course_week=session.course_week, weekday=final_weekday).exclude(id=session.id).count()
                if new_session_number and (new_session_number > max_existing + 1 or new_session_number < 1):
                    raise ServiceError(
                        detail=f"Session number must be between 1 and {max_existing + 1} for {final_weekday.capitalize()}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
                try:
                    target_session_number = new_session_number if new_session_number else old_session_number
                    occupying_session = CourseClassSession.objects.get(
                        course_week=session.course_week,
                        weekday=final_weekday,
                        session_number=target_session_number
                    )
                    from django.db.models import Max as _Max
                    current_max = CourseClassSession.objects.filter(course_week=session.course_week, weekday=final_weekday).aggregate(m=_Max('session_number'))['m'] or 0
                    safe_temp = current_max + 9999
                    CourseClassSession.objects.filter(id=occupying_session.id).update(session_number=safe_temp)
                except CourseClassSession.DoesNotExist:
                    pass

            for attr, value in serializer.validated_data.items():
                setattr(session, attr, value)
                
            if request.data.get('remove_thumbnail') == 'true':
                if session.thumbnail:
                    session.thumbnail.delete(save=False)
                session.thumbnail = None
                
            session.save()

            if occupying_session is not None:
                CourseClassSession.objects.filter(id=occupying_session.id).update(session_number=old_session_number)
            
            response_serializer = CourseClassSessionSerializer(session, context={'request': request})
            return format_success_response(message="Class session updated successfully", data=response_serializer.data)
        except IntegrityError:
            raise ServiceError(detail="A session with this number already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating class session: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the class session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a class session", responses={204: None})
    def delete(self, request, course_id, week_id, session_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
            
        try:
            session = self.get_object(course_id, week_id, session_id)
            course_week = session.course_week
            deleted_session_number = session.session_number
            video_file_key = session.video_file

            session.delete()

            # Re-order subsequent sessions to fill the gap left by the deleted session.
            # E.g., if Session 2 is deleted from [1, 2, 3], Session 3 becomes 2.
            subsequent_sessions = CourseClassSession.objects.filter(
                course_week=course_week,
                weekday=session.weekday,
                session_number__gt=deleted_session_number
            ).order_by('session_number')

            for subsequent_session in subsequent_sessions:
                # Direct update to bypass save signals/unique constraints during the loop
                CourseClassSession.objects.filter(id=subsequent_session.id).update(
                    session_number=subsequent_session.session_number - 1
                )

            if video_file_key:
                delete_unused_video_from_storage(video_file_key)

            return format_success_response(message="Class session deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting class session: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the class session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Weekly Tests"])
class WeeklyTestView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_week(self, course_id, week_id):
        try:
            return CourseWeek.objects.get(id=week_id, course_id=course_id)
        except CourseWeek.DoesNotExist:
            raise ServiceError(detail="Course week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve the weekly test for a course week", responses={200: CourseWeeklyTestSerializer})
    def get(self, request, course_id, week_id):
        week = self.get_week(course_id, week_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not week.is_published:
                raise ServiceError(detail="This week's test is not available yet.", status_code=status.HTTP_403_FORBIDDEN)
        
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this week.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CourseWeeklyTestSerializer(week.weekly_test, context={'request': request})
        return format_success_response(message="Weekly test retrieved", data=serializer.data)

    @extend_schema(
        summary="Create a weekly test (Admin/Teacher only)", 
        request=CourseWeeklyTestCreateUpdateSerializer, 
        responses={201: CourseWeeklyTestSerializer}
    )
    def post(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        week = self.get_week(course_id, week_id)
        
        if hasattr(week, 'weekly_test'):
            raise ServiceError(detail="A test already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)

        serializer = CourseWeeklyTestCreateUpdateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            test = CourseWeeklyTest.objects.create(
                course_week=week,
                created_by=user,
                **serializer.validated_data
            )
            return format_success_response(
                message="Weekly test created successfully", 
                data=None, 
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating weekly test: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the weekly test.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Update a weekly test (Admin/Teacher only)", 
        request=CourseWeeklyTestCreateUpdateSerializer, 
        responses={200: CourseWeeklyTestSerializer}
    )
    def patch(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        week = self.get_week(course_id, week_id)
        
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this week.", status_code=status.HTTP_404_NOT_FOUND)
            
        test = week.weekly_test
        serializer = CourseWeeklyTestCreateUpdateSerializer(test, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            for attr, value in serializer.validated_data.items():
                setattr(test, attr, value)
            test.updated_by = user
            test.save()
            
            return format_success_response(message="Weekly test updated successfully", data=None)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating weekly test: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the weekly test.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a weekly test (Admin/Teacher only)", responses={200: None})
    def delete(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        week = self.get_week(course_id, week_id)
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this week.", status_code=status.HTTP_404_NOT_FOUND)
            
        try:
            week.weekly_test.delete()
            return format_success_response(message="Weekly test deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting weekly test: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the weekly test.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Weekly Tests"])
class WeeklyTestQuestionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_test(self, course_id, week_id):
        try:
            week = CourseWeek.objects.get(id=week_id, course_id=course_id)
            if not hasattr(week, 'weekly_test'):
                raise ServiceError(detail="No test configured for this week.", status_code=status.HTTP_404_NOT_FOUND)
            return week.weekly_test
        except CourseWeek.DoesNotExist:
            raise ServiceError(detail="Course week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List questions for a course weekly test", responses={200: CourseTestQuestionSerializer(many=True)})
    def get(self, request, course_id, week_id):
        test = self.get_test(course_id, week_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not test.course_week.is_published:
                raise ServiceError(detail="This test's questions are not available yet.", status_code=status.HTTP_403_FORBIDDEN)

        questions = test.questions.all()
        serializer = CourseTestQuestionSerializer(questions, many=True, context={'request': request})
        return format_success_response(message="Questions retrieved", data=serializer.data)

    @extend_schema(
        summary="Create a new question (Admin/Teacher only)", 
        request=CourseTestQuestionSerializer, 
        responses={201: CourseTestQuestionSerializer}
    )
    def post(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        test = self.get_test(course_id, week_id)
        serializer = CourseTestQuestionSerializer(data=request.data, context={'request': request})
        
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            question = CourseTestQuestion.objects.create(
                test=test,
                **serializer.validated_data
            )
            return format_success_response(
                message="Question created successfully", 
                data=None, 
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating question: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Weekly Tests"])
class WeeklyTestQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, course_id, week_id, question_id):
        try:
            return CourseTestQuestion.objects.get(
                id=question_id, 
                test__course_week_id=week_id, 
                test__course_week__course_id=course_id
            )
        except CourseTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a single question", responses={200: CourseTestQuestionSerializer})
    def get(self, request, course_id, week_id, question_id):
        question = self.get_object(course_id, week_id, question_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not question.test.course_week.is_published:
                raise ServiceError(detail="This question is not available yet.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = CourseTestQuestionSerializer(question, context={'request': request})
        return format_success_response(message="Question retrieved", data=serializer.data)

    @extend_schema(
        summary="Update a question (Admin/Teacher only)", 
        request=CourseTestQuestionSerializer, 
        responses={200: CourseTestQuestionSerializer}
    )
    def patch(self, request, course_id, week_id, question_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        question = self.get_object(course_id, week_id, question_id)
        serializer = CourseTestQuestionSerializer(question, data=request.data, partial=True, context={'request': request})
        
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            for attr, value in serializer.validated_data.items():
                setattr(question, attr, value)
            question.save()
            
            return format_success_response(message="Question updated successfully", data=None)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating question: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a question (Admin/Teacher only)", responses={200: None})
    def delete(self, request, course_id, week_id, question_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        question = self.get_object(course_id, week_id, question_id)
        
        try:
            question.delete()
            return format_success_response(message="Question deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting question: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Weekly Tests"])
class WeeklyTestQuestionAttachmentView(APIView):
    """POST one file to add an attachment to a question."""
    permission_classes = [IsSuperAdminAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser]

    def get_question(self, course_id, week_id, question_id):
        try:
            return CourseTestQuestion.objects.get(
                id=question_id,
                test__course_week_id=week_id,
                test__course_week__course_id=course_id
            )
        except CourseTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Add an attachment to a question")
    def post(self, request, course_id, week_id, question_id):
        question = self.get_question(course_id, week_id, question_id)
        file = request.FILES.get('file')
        if not file:
            raise ServiceError(detail="No file provided.", status_code=status.HTTP_400_BAD_REQUEST)
        name = request.data.get('name', file.name)
        attachment = CourseTestQuestionAttachment.objects.create(
            question=question, file=file, name=name
        )
        serializer = CourseTestQuestionAttachmentSerializer(attachment, context={'request': request})
        return format_success_response(
            message="Attachment added successfully",
            data=serializer.data,
            status_code=status.HTTP_201_CREATED
        )


@extend_schema(tags=["Weekly Tests"])
class WeeklyTestQuestionAttachmentDetailView(APIView):
    """DELETE a single attachment by its id."""
    permission_classes = [IsSuperAdminAdminOrTeacher]

    def get_object(self, course_id, week_id, question_id, attachment_id):
        try:
            return CourseTestQuestionAttachment.objects.get(
                id=attachment_id,
                question_id=question_id,
                question__test__course_week_id=week_id,
                question__test__course_week__course_id=course_id
            )
        except CourseTestQuestionAttachment.DoesNotExist:
            raise ServiceError(detail="Attachment not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Delete a question attachment")
    def delete(self, request, course_id, week_id, question_id, attachment_id):
        attachment = self.get_object(course_id, week_id, question_id, attachment_id)
        try:
            attachment.delete()
            return format_success_response(message="Attachment deleted successfully")
        except Exception as e:
            logger.error(f"Error deleting attachment: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the attachment.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
