import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema
from django.db import IntegrityError

from apps.courses.models import Course, CourseWeek, ClassSession, WeeklyTest, WeeklyTestQuestion
from apps.courses.serializers.course_module_serializers import (
    CourseWeekSerializer,
    CourseWeekCreateUpdateSerializer,
    ClassSessionSerializer,
    ClassSessionCreateUpdateSerializer,
    WeeklyTestSerializer,
    WeeklyTestCreateUpdateSerializer,
    WeeklyTestQuestionSerializer,
)
from utils.permissions import IsSuperAdminAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.constants import UserTypeConstants

logger = logging.getLogger(__name__)


@extend_schema(tags=["Course Weeks"])
class CourseWeekListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_course(self, pk):
        try:
            return Course.objects.filter(is_deleted=False).get(pk=pk)
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

            # Publish guard: must have ≥1 video (ClassSession) AND a WeeklyTest
            publishing = serializer.validated_data.get('is_published')
            if publishing and not week.is_published:
                has_sessions = week.class_sessions.exists()
                has_test = hasattr(week, 'weekly_test') and week.weekly_test is not None
                if not has_sessions:
                    raise ServiceError(
                        detail="Cannot publish this week: at least one video session must be added first.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
                if not has_test:
                    raise ServiceError(
                        detail="Cannot publish this week: a weekly test must be configured first.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

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

            # Block deletion if any active students are enrolled in batches of this course
            from apps.courses.models import Batch, BatchEnrollment
            active_enrollments = BatchEnrollment.objects.filter(
                batch__course=week.course,
                status=BatchEnrollment.Status.ACTIVE
            ).exists()
            if active_enrollments:
                raise ServiceError(
                    detail="Cannot delete this week: there are active students enrolled in batches for this course.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            week.delete()
            return format_success_response(message="Course week deleted successfully")
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

    @extend_schema(summary="List class sessions for a week", responses={200: ClassSessionSerializer(many=True)})
    def get(self, request, course_id, week_id):
        week = self.get_week(course_id, week_id)
        
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not week.is_published:
                raise ServiceError(detail="This week is not published yet.", status_code=status.HTTP_403_FORBIDDEN)

        sessions = ClassSession.objects.filter(course_week=week)
        serializer = ClassSessionSerializer(sessions, many=True, context={'request': request})
        return format_success_response(message="Class sessions retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Create a new class session (Admin/Teacher only)", 
        request=ClassSessionCreateUpdateSerializer, 
        responses={201: ClassSessionSerializer}
    )
    def post(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        week = self.get_week(course_id, week_id)
        serializer = ClassSessionCreateUpdateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            session_number = serializer.validated_data.get('session_number')
            if session_number:
                # Sequential validation: all sessions 1..N-1 must exist
                existing_numbers = set(
                    ClassSession.objects.filter(course_week=week).values_list('session_number', flat=True)
                )
                missing = [i for i in range(1, session_number) if i not in existing_numbers]
                if missing:
                    missing_str = ', '.join(str(m) for m in missing)
                    raise ServiceError(
                        detail=f"Session {missing_str} must be created first before adding Session {session_number}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )


            session = ClassSession.objects.create(
                course_week=week,
                uploaded_by=request.user,
                **serializer.validated_data
            )
            response_serializer = ClassSessionSerializer(session, context={'request': request})
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
            return ClassSession.objects.get(id=session_id, course_week_id=week_id, course_week__course_id=course_id)
        except ClassSession.DoesNotExist:
            raise ServiceError(detail="Class session not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a class session", responses={200: ClassSessionSerializer})
    def get(self, request, course_id, week_id, session_id):
        session = self.get_object(course_id, week_id, session_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not session.course_week.is_published:
                raise ServiceError(detail="This session is not available.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = ClassSessionSerializer(session, context={'request': request})
        return format_success_response(message="Class session retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Update a class session", 
        request=ClassSessionCreateUpdateSerializer, 
        responses={200: ClassSessionSerializer}
    )
    def patch(self, request, course_id, week_id, session_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        session = self.get_object(course_id, week_id, session_id)
        serializer = ClassSessionCreateUpdateSerializer(session, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            new_session_number = serializer.validated_data.get('session_number')
            old_session_number = session.session_number
            occupying_session = None

            if new_session_number and new_session_number != old_session_number:
                max_existing = ClassSession.objects.filter(course_week=session.course_week).exclude(id=session.id).count()
                if new_session_number > max_existing + 1 or new_session_number < 1:
                    raise ServiceError(
                        detail=f"Session number must be between 1 and {max_existing + 1}.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
                try:
                    occupying_session = ClassSession.objects.get(
                        course_week=session.course_week,
                        session_number=new_session_number
                    )
                    from django.db.models import Max as _Max
                    current_max = ClassSession.objects.filter(course_week=session.course_week).aggregate(m=_Max('session_number'))['m'] or 0
                    safe_temp = current_max + 9999
                    ClassSession.objects.filter(id=occupying_session.id).update(session_number=safe_temp)
                except ClassSession.DoesNotExist:
                    pass

            for attr, value in serializer.validated_data.items():
                setattr(session, attr, value)
                
            if request.data.get('remove_thumbnail') == 'true':
                if session.thumbnail:
                    session.thumbnail.delete(save=False)
                session.thumbnail = None
                
            session.save()

            if occupying_session is not None:
                ClassSession.objects.filter(id=occupying_session.id).update(session_number=old_session_number)
            
            response_serializer = ClassSessionSerializer(session, context={'request': request})
            return format_success_response(message="Class session updated successfully", data=response_serializer.data)
        except IntegrityError:
            raise ServiceError(detail="A session with this number already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating class session: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the class session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a class session", responses={200: None})
    def delete(self, request, course_id, week_id, session_id):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            session = self.get_object(course_id, week_id, session_id)
            session.delete()
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

    @extend_schema(summary="Retrieve the weekly test for a course week", responses={200: WeeklyTestSerializer})
    def get(self, request, course_id, week_id):
        week = self.get_week(course_id, week_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not week.is_published:
                raise ServiceError(detail="This week's test is not available yet.", status_code=status.HTTP_403_FORBIDDEN)
        
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this week.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = WeeklyTestSerializer(week.weekly_test, context={'request': request})
        return format_success_response(message="Weekly test retrieved", data=serializer.data)

    @extend_schema(
        summary="Create a weekly test (Admin/Teacher only)", 
        request=WeeklyTestCreateUpdateSerializer, 
        responses={201: WeeklyTestSerializer}
    )
    def post(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        week = self.get_week(course_id, week_id)
        
        if hasattr(week, 'weekly_test'):
            raise ServiceError(detail="A test already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)

        serializer = WeeklyTestCreateUpdateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            test = WeeklyTest.objects.create(
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
        request=WeeklyTestCreateUpdateSerializer, 
        responses={200: WeeklyTestSerializer}
    )
    def patch(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        week = self.get_week(course_id, week_id)
        
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this week.", status_code=status.HTTP_404_NOT_FOUND)
            
        test = week.weekly_test
        serializer = WeeklyTestCreateUpdateSerializer(test, data=request.data, partial=True, context={'request': request})
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

    @extend_schema(summary="List questions for a weekly test", responses={200: WeeklyTestQuestionSerializer(many=True)})
    def get(self, request, course_id, week_id):
        test = self.get_test(course_id, week_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not test.course_week.is_published:
                raise ServiceError(detail="This test's questions are not available yet.", status_code=status.HTTP_403_FORBIDDEN)

        questions = test.questions.all()
        serializer = WeeklyTestQuestionSerializer(questions, many=True, context={'request': request})
        return format_success_response(message="Questions retrieved", data=serializer.data)

    @extend_schema(
        summary="Create a new question (Admin/Teacher only)", 
        request=WeeklyTestQuestionSerializer, 
        responses={201: WeeklyTestQuestionSerializer}
    )
    def post(self, request, course_id, week_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        test = self.get_test(course_id, week_id)
        serializer = WeeklyTestQuestionSerializer(data=request.data, context={'request': request})
        
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            question = WeeklyTestQuestion.objects.create(
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
            return WeeklyTestQuestion.objects.get(
                id=question_id, 
                test__course_week_id=week_id, 
                test__course_week__course_id=course_id
            )
        except WeeklyTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a single question", responses={200: WeeklyTestQuestionSerializer})
    def get(self, request, course_id, week_id, question_id):
        question = self.get_object(course_id, week_id, question_id)
        user = request.user
        
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            if not question.test.course_week.is_published:
                raise ServiceError(detail="This question is not available yet.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = WeeklyTestQuestionSerializer(question, context={'request': request})
        return format_success_response(message="Question retrieved", data=serializer.data)

    @extend_schema(
        summary="Update a question (Admin/Teacher only)", 
        request=WeeklyTestQuestionSerializer, 
        responses={200: WeeklyTestQuestionSerializer}
    )
    def patch(self, request, course_id, week_id, question_id):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        question = self.get_object(course_id, week_id, question_id)
        serializer = WeeklyTestQuestionSerializer(question, data=request.data, partial=True, context={'request': request})
        
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
