import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.courses.models import Batch, BatchWeek, ClassSession, WeeklyTest, WeeklyTestQuestion
from apps.courses.serializers.course_module_serializers import (
    BatchWeekSerializer,
    BatchWeekCreateUpdateSerializer,
    ClassSessionSerializer,
    ClassSessionCreateUpdateSerializer,
    WeeklyTestSerializer,
    WeeklyTestCreateUpdateSerializer,
    WeeklyTestQuestionSerializer,
)
from utils.permissions import IsAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.constants import UserTypeConstants

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
        week.delete()
        return format_success_response(message="Batch week deleted successfully")

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
        sessions = ClassSession.objects.filter(batch_week=week)
        serializer = ClassSessionSerializer(sessions, many=True, context={'request': request})
        return format_success_response(message="Batch sessions retrieved successfully", data=serializer.data)

    @extend_schema(summary="Create a session for a batch week", request=ClassSessionCreateUpdateSerializer)
    def post(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
        serializer = ClassSessionCreateUpdateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        ClassSession.objects.create(
            batch_week=week,
            uploaded_by=request.user,
            **serializer.validated_data
        )
        return format_success_response(message="Batch session created successfully", status_code=status.HTTP_201_CREATED)

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
        serializer = WeeklyTestSerializer(week.weekly_test, context={'request': request})
        return format_success_response(message="Batch weekly test retrieved", data=serializer.data)
@extend_schema(tags=["Batch Content"])
class BatchClassSessionDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, batch_id, week_id, session_id):
        try:
            return ClassSession.objects.get(id=session_id, batch_week_id=week_id, batch_week__batch_id=batch_id)
        except ClassSession.DoesNotExist:
            raise ServiceError(detail="Batch session not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Update a batch session", request=ClassSessionCreateUpdateSerializer)
    def patch(self, request, batch_id, week_id, session_id):
        session = self.get_object(batch_id, week_id, session_id)
        serializer = ClassSessionCreateUpdateSerializer(session, data=request.data, partial=True)
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
        session.delete()
        return format_success_response(message="Batch session deleted successfully")

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestManageView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_week(self, batch_id, week_id):
        try:
            return BatchWeek.objects.get(id=week_id, batch_id=batch_id)
        except BatchWeek.DoesNotExist:
            raise ServiceError(detail="Batch week not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Create or update batch weekly test", request=WeeklyTestCreateUpdateSerializer)
    def post(self, request, batch_id, week_id):
        week = self.get_week(batch_id, week_id)
        if hasattr(week, 'weekly_test'):
            serializer = WeeklyTestCreateUpdateSerializer(week.weekly_test, data=request.data)
        else:
            serializer = WeeklyTestCreateUpdateSerializer(data=request.data)
            
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
        if hasattr(week, 'weekly_test'):
            serializer.save()
            message = "Batch test updated successfully"
        else:
            WeeklyTest.objects.create(batch_week=week, created_by=request.user, **serializer.validated_data)
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

    @extend_schema(summary="List/Add questions to batch weekly test", request=WeeklyTestQuestionSerializer)
    def get(self, request, batch_id, week_id):
        test = self.get_test(batch_id, week_id)
        serializer = WeeklyTestQuestionSerializer(test.questions.all(), many=True)
        return format_success_response(message="Questions retrieved", data=serializer.data)

    def post(self, request, batch_id, week_id):
        test = self.get_test(batch_id, week_id)
        serializer = WeeklyTestQuestionSerializer(data=request.data)
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        WeeklyTestQuestion.objects.create(test=test, **serializer.validated_data)
        return format_success_response(message="Question added to batch test")

@extend_schema(tags=["Batch Content"])
class BatchWeeklyTestQuestionDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_object(self, batch_id, week_id, question_id):
        try:
            return WeeklyTestQuestion.objects.get(
                id=question_id, 
                test__batch_week_id=week_id, 
                test__batch_week__batch_id=batch_id
            )
        except WeeklyTestQuestion.DoesNotExist:
            raise ServiceError(detail="Question not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve/Update/Delete batch test question")
    def get(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        serializer = WeeklyTestQuestionSerializer(question)
        return format_success_response(message="Question retrieved", data=serializer.data)

    def patch(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        serializer = WeeklyTestQuestionSerializer(question, data=request.data, partial=True)
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        return format_success_response(message="Question updated")

    def delete(self, request, batch_id, week_id, question_id):
        question = self.get_object(batch_id, week_id, question_id)
        question.delete()
        return format_success_response(message="Question deleted")
