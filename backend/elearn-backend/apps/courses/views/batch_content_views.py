import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema

from apps.courses.models import Batch, BatchWeek, BatchClassSession, BatchWeeklyTest, BatchTestQuestion
from apps.courses.serializers.course_module_serializers import (
    BatchWeekSerializer,
    BatchWeekCreateUpdateSerializer,
    BatchClassSessionSerializer,
    BatchClassSessionCreateUpdateSerializer,
    BatchWeeklyTestSerializer,
    BatchWeeklyTestCreateUpdateSerializer,
    BatchTestQuestionSerializer,
)
from utils.permissions import IsAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.constants import UserTypeConstants
from apps.courses.services import delete_unused_video_from_storage

logger = logging.getLogger(__name__)

@extend_schema(tags=["Batch Content"])
class BatchWeekListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="List weeks for a specific batch")
    def get(self, request, batch_id):
        weeks = BatchWeek.objects.filter(batch_id=batch_id).order_by('week_number')
        
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.STUDENT:
            # For students, only show published weeks
            weeks = weeks.filter(is_published=True)

        serializer = BatchWeekSerializer(weeks, many=True, context={'request': request})
        return format_success_response(message="Batch weeks retrieved successfully", data=serializer.data)

@extend_schema(tags=["Batch Content"])
class BatchWeekDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_object(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Update a batch week", request=BatchWeekCreateUpdateSerializer)
    def patch(self, request, batch_id, week_id):
        week = self.get_object(batch_id, week_id)
        serializer = BatchWeekCreateUpdateSerializer(week, data=request.data, partial=True)
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        return format_success_response(message="Batch week updated successfully")

    @extend_schema(summary="Delete a batch week")
    def delete(self, request, batch_id, week_id):
        week = self.get_object(batch_id, week_id)
        if not week.can_modify_content():
            raise ServiceError(detail="Cannot delete a week that has already been unlocked.", status_code=status.HTTP_400_BAD_REQUEST)
        
        batch = week.batch
        deleted_week_number = week.week_number

        week.delete()

        # Re-order subsequent batch weeks
        subsequent_weeks = BatchWeek.objects.filter(
            batch=batch,
            week_number__gt=deleted_week_number
        ).order_by('week_number')

        for subsequent_week in subsequent_weeks:
            # Direct update
            BatchWeek.objects.filter(id=subsequent_week.id).update(
                week_number=subsequent_week.week_number - 1
            )

        return format_success_response(message="Batch week deleted and order adjusted successfully")

@extend_schema(tags=["Batch Content"])
class BatchClassSessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List sessions for a batch week")
    def get(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
        sessions = BatchClassSession.objects.filter(batch_week=week)
        serializer = BatchClassSessionSerializer(sessions, many=True, context={'request': request})
        return format_success_response(message="Batch sessions retrieved successfully", data=serializer.data)

    @extend_schema(summary="Create a session for a batch week", request=BatchClassSessionCreateUpdateSerializer)
    def post(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
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

        try:
            BatchClassSession.objects.create(
                batch_week=week,
                uploaded_by=request.user,
                **serializer.validated_data
            )
            return format_success_response(message="Batch session created successfully", status_code=status.HTTP_201_CREATED)
        except IntegrityError:
            raise ServiceError(detail="A session with this number already exists for this week.", status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            raise ServiceError(detail="An error occurred while creating the batch session.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestView(APIView):
    permission_classes = [IsAuthenticated]

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve/Create/Update batch weekly test")
    def get(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test configured for this batch week.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = BatchWeeklyTestSerializer(week.weekly_test, context={'request': request})
        return format_success_response(message="Batch weekly test retrieved", data=serializer.data)
@extend_schema(tags=["Batch Content"])
class BatchClassSessionDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, batch_id, week_id, session_id):
        try:
            return BatchClassSession.objects.get(id=session_id, batch_week_id=week_id, batch_week__batch_id=batch_id)
        except BatchClassSession.DoesNotExist:
            raise ServiceError(detail="Batch session not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Update a batch session", request=BatchClassSessionCreateUpdateSerializer)
    def patch(self, request, batch_id, week_id, session_id):
        session = self.get_object(batch_id, week_id, session_id)
        serializer = BatchClassSessionCreateUpdateSerializer(session, data=request.data, partial=True)
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        return format_success_response(message="Batch session updated successfully")

    @extend_schema(summary="Delete a batch session")
    def delete(self, request, batch_id, week_id, session_id):
        session = self.get_object(batch_id, week_id, session_id)
        if not session.batch_week.can_modify_content():
            raise ServiceError(detail="Cannot delete content from an unlocked week.", status_code=status.HTTP_400_BAD_REQUEST)
        
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

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestManageView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Create or update batch weekly test", request=BatchWeeklyTestCreateUpdateSerializer)
    def post(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
        if hasattr(week, 'weekly_test'):
            serializer = BatchWeeklyTestCreateUpdateSerializer(week.weekly_test, data=request.data)
        else:
            serializer = BatchWeeklyTestCreateUpdateSerializer(data=request.data)
            
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
        if hasattr(week, 'weekly_test'):
            serializer.save()
            message = "Batch test updated successfully"
        else:
            BatchWeeklyTest.objects.create(batch_week=week, created_by=request.user, **serializer.validated_data)
            message = "Batch test created successfully"
            
        return format_success_response(message=message)

    @extend_schema(summary="Delete batch weekly test")
    def delete(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
        if not hasattr(week, 'weekly_test'):
            raise ServiceError(detail="No test found.", status_code=status.HTTP_404_NOT_FOUND)
        
        if not week.can_modify_content():
            raise ServiceError(detail="Cannot delete test from an unlocked week.", status_code=status.HTTP_400_BAD_REQUEST)
            
        week.weekly_test.delete()
        return format_success_response(message="Batch test deleted successfully")

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionListCreateView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_test(self, batch_id, week_id):
        try:
            week = BatchWeek.objects.get(id=week_id, batch_id=batch_id)
            if not hasattr(week, 'weekly_test'):
                raise ServiceError(detail="No test configured for this batch week.", status_code=status.HTTP_404_NOT_FOUND)
            return week.weekly_test
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="List/Add questions to batch weekly test", request=BatchTestQuestionSerializer)
    def get(self, request, batch_id, week_id):
        test = self.get_test(batch_id, week_id)
        serializer = BatchTestQuestionSerializer(test.questions.all(), many=True)
        return format_success_response(message="Questions retrieved", data=serializer.data)

    def post(self, request, batch_id, week_id):
        test = self.get_test(batch_id, week_id)
        serializer = BatchTestQuestionSerializer(data=request.data)
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        BatchTestQuestion.objects.create(test=test, **serializer.validated_data)
        return format_success_response(message="Question added to batch test")

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_object(self, batch_id, week_id, question_id):
        try:
            return BatchTestQuestion.objects.get(
                id=question_id, 
                test__batch_week_id=week_id, 
                test__batch_week__batch_id=batch_id
            )
        except BatchTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve/Update/Delete batch test question")
    def get(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        serializer = BatchTestQuestionSerializer(question)
        return format_success_response(message="Question retrieved", data=serializer.data)

    def patch(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        serializer = BatchTestQuestionSerializer(question, data=request.data, partial=True)
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        return format_success_response(message="Question updated")

    def delete(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        question.delete()
        return format_success_response(message="Question deleted")
