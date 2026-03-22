import json
import random
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from apps.courses.models import (
    TestSubmission, TestSubmissionAnswer, BatchWeeklyTest, 
    BatchEnrollment
)
from apps.courses.serializers.test_submission_serializers import (
    TestSubmissionSerializer, TestSubmissionUpdateSerializer, TestSubmissionAnswerSerializer
)
from utils.pagination import CustomPageNumberPagination
from django.contrib.contenttypes.models import ContentType
from apps.users.models import Notification
from utils.common import format_success_response, ServiceError
from drf_spectacular.utils import extend_schema
import logging

logger = logging.getLogger(__name__)


WEEKLY_TEST_STUDENT_ANSWER_EXTENSIONS = frozenset(('ipynb', 'pdf'))


def _validate_weekly_test_answer_upload(uploaded_file):
    name = (getattr(uploaded_file, 'name', '') or '').strip()
    if not name or '.' not in name:
        raise ServiceError(
            detail='Answer uploads must be a .ipynb or .pdf file.',
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    ext = name.rsplit('.', 1)[-1].lower()
    if ext not in WEEKLY_TEST_STUDENT_ANSWER_EXTENSIONS:
        raise ServiceError(
            detail=f'Only .ipynb and .pdf files are allowed for answer uploads. Received: .{ext}',
            status_code=status.HTTP_400_BAD_REQUEST,
        )


def _get_enrollment(batch_id, user):
    return BatchEnrollment.objects.filter(
        batch_id=batch_id, 
        student=user, 
        status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED]
    ).first()


@extend_schema(tags=["Test Submissions"], summary="Create a new test submission", description="Allows a student to submit their weekly test.")
class TestSubmissionCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer

    def post(self, request, batch_id, week_id):
        try:
            user = request.user
            
            # 1. Verify Enrollment
            enrollment = _get_enrollment(batch_id, user)
            if not enrollment:
                raise ServiceError(detail="You are not a enrolled student in this batch.", status_code=status.HTTP_403_FORBIDDEN)

            # 2. Get Test
            try:
                test = BatchWeeklyTest.objects.get(batch_week_id=week_id, batch_week__batch_id=batch_id)
            except BatchWeeklyTest.DoesNotExist:
                raise ServiceError(detail="Test not found for this week.", status_code=status.HTTP_404_NOT_FOUND)

            # 3. Check Attempt
            latest_attempt = TestSubmission.objects.filter(
                batch_weekly_test=test, enrollment=enrollment
            ).order_by('-attempt_number').first()
            
            # If the latest attempt is already PUBLISHED and passed, they shouldn't resubmit
            if latest_attempt and latest_attempt.status == TestSubmission.Status.PUBLISHED and latest_attempt.is_passed:
                raise ServiceError(detail="You have already passed this test.", status_code=status.HTTP_400_BAD_REQUEST)

            attempt_number = (latest_attempt.attempt_number + 1) if latest_attempt else 1

            for key, uploaded in request.FILES.items():
                if key.startswith('file_q_'):
                    _validate_weekly_test_answer_upload(uploaded)

            # 4. Create Submission
            submission = TestSubmission.objects.create(
                batch_weekly_test=test,
                enrollment=enrollment,
                attempt_number=attempt_number,
                status=TestSubmission.Status.PENDING
            )

            # 5. Handle Answers
            answers_data = {}
            if 'answers' in request.data:
                try:
                    answers_data = json.loads(request.data.get('answers'))
                except json.JSONDecodeError:
                    pass

            questions = test.questions.all()
            for question in questions:
                answer_text = answers_data.get(str(question.id), "")
                answer_file = request.FILES.get(f'file_q_{question.id}')
                
                if answer_text or answer_file:
                    TestSubmissionAnswer.objects.create(
                        submission=submission,
                        question=question,
                        answer_text=answer_text,
                        answer_file=answer_file
                    )

            return format_success_response(
                message="Test submitted successfully",
                data=TestSubmissionSerializer(submission).data,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error submitting test: {str(e)}")
            raise ServiceError(detail="An error occurred while submitting the test.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Test Submissions"], summary="List all test submissions for a specific batch", description="Allows a teacher to list all test submissions for a specific batch.")
class BatchTestSubmissionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        batch_id = self.kwargs.get('batch_id')
        user = self.request.user
        
        enrollment = _get_enrollment(batch_id, user)
        if not enrollment:
            raise ServiceError(detail="You are not a enrolled student in this batch.", status_code=status.HTTP_403_FORBIDDEN)

        qs = TestSubmission.objects.filter(enrollment=enrollment)
        
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        week_number = self.request.query_params.get('week_number')
        if week_number and week_number != 'all':
            try:
                week_int = int(week_number)
                qs = qs.filter(batch_weekly_test__batch_week__week_number=week_int)
            except (ValueError, TypeError):
                pass
            
        return qs.order_by('-submitted_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        stats = {
            "total": queryset.count(),
            "pending": queryset.filter(status__in=[
                TestSubmission.Status.PENDING, 
                TestSubmission.Status.EVALUATING, 
                TestSubmission.Status.PENDING_REVIEW
            ]).count(),
            "published": queryset.filter(status=TestSubmission.Status.PUBLISHED).count(),
        }

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['stats'] = stats
            return response

        serializer = self.get_serializer(queryset, many=True)
        return format_success_response(data=serializer.data, extra_params={"stats": stats})

@extend_schema(tags=["Test Submissions"], summary="Retrieve or update a specific test submission", description="Allows a teacher to retrieve or update a specific test submission.")
class TestSubmissionDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = TestSubmission.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return TestSubmissionUpdateSerializer
        return TestSubmissionSerializer

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except TestSubmission.DoesNotExist:
            raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(instance)
        return format_success_response(data=serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        try:
            instance = self.get_object()
        except TestSubmission.DoesNotExist:
            raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)
        
        old_status = instance.status
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Admin is reviewing/updating
        new_status = serializer.validated_data.get('status')
        if new_status and new_status != old_status:
            # Updating status dynamically
            if new_status in [TestSubmission.Status.PUBLISHED, TestSubmission.Status.RETURNED]:
                instance.graded_at = timezone.now()
                instance.graded_by = request.user
                
        self.perform_update(serializer)
        
        # Fire notifications
        if new_status and new_status != old_status:
            student = instance.enrollment.student
            ct = ContentType.objects.get_for_model(TestSubmission)
            
            if new_status == TestSubmission.Status.PUBLISHED:
                Notification.objects.create(
                    user=student,
                    title="Test Results Published",
                    message=f"Your result for Test Attempt {instance.attempt_number} has been published by the instructor. Marks: {instance.marks_obtained}%",
                    notification_type=Notification.NotificationType.SUCCESS,
                    content_type=ct,
                    object_id=instance.id,
                    action_url=f"/progress" # Example URL
                )
            elif new_status == TestSubmission.Status.RETURNED:
                Notification.objects.create(
                    user=student,
                    title="Test Returned for Revision",
                    message=f"Your Test Attempt {instance.attempt_number} was returned. Please review the grader's remarks.",
                    notification_type=Notification.NotificationType.WARNING,
                    content_type=ct,
                    object_id=instance.id,
                    action_url=f"/progress"
                )
                
        return Response({
            "success": True,
            "message": "Test submission updated successfully",
            "data": TestSubmissionSerializer(instance).data
        }, status=status.HTTP_200_OK)

@extend_schema(tags=["Test Submissions"], summary="Trigger AI evaluation for a specific test submission", description="Allows a teacher to trigger AI evaluation for a specific test submission.")
class TriggerAIEvaluationView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer

    def post(self, request, submission_pk):
        try:
            submission = TestSubmission.objects.get(pk=submission_pk)
        except TestSubmission.DoesNotExist:
            raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)

        if submission.status not in [TestSubmission.Status.PENDING, TestSubmission.Status.RETURNED]:
            raise ServiceError(detail=f"Cannot evaluate submission in '{submission.status}' state.", status_code=status.HTTP_400_BAD_REQUEST)

        # Switch status to EVALUATING
        submission.status = TestSubmission.Status.EVALUATING
        submission.save(update_fields=['status'])

        # Notify the student
        ct = ContentType.objects.get_for_model(TestSubmission)
        student = submission.enrollment.student
        
        Notification.objects.create(
            user=student,
            title="AI Evaluation Started",
            message=f"Your Test Attempt {submission.attempt_number} is currently being evaluated by our AI grader.",
            notification_type=Notification.NotificationType.INFO,
            content_type=ct,
            object_id=submission.id,
            action_url=f"/progress"
        )
        
        # Notify whoever triggered it (if not the student)
        if request.user != student:
            Notification.objects.create(
                user=request.user,
                title="AI Evaluation Initiated",
                message=f"AI evaluation started for {student.fullname}'s Test Attempt {submission.attempt_number}.",
                notification_type=Notification.NotificationType.INFO,
                content_type=ct,
                object_id=submission.id
            )

        # Trigger actual evaluation
        try:
            from apps.courses.ai_services import AIEvaluationService
            ai_service = AIEvaluationService()
            ai_service.evaluate_submission(submission.id)
        except Exception as e:
            # Safety fallback if ai_service itself crashes or fails to import
            submission.status = TestSubmission.Status.PENDING_REVIEW
            submission.ai_feedback = f"Catastrophic failure: {str(e)}"
            submission.save()
            
        # Refresh submission from DB after AI evaluation
        submission.refresh_from_db()
        
        return format_success_response(
            message="AI evaluation completed." if submission.status == TestSubmission.Status.PENDING_REVIEW else "AI evaluation initiated.",
            data=TestSubmissionSerializer(submission).data
        )

@extend_schema(tags=["Test Submissions"], summary="Trigger AI evaluation for a specific test answer", description="Allows a teacher to trigger AI evaluation for a specific test answer.")
class TriggerAnswerAIEvaluationView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionAnswerSerializer

    def post(self, request, submission_pk, answer_pk):
        try:
            answer = TestSubmissionAnswer.objects.get(pk=answer_pk, submission_id=submission_pk)
        except TestSubmissionAnswer.DoesNotExist:
            raise ServiceError(detail="Answer not found.", status_code=status.HTTP_404_NOT_FOUND)

        from apps.courses.ai_services import AIEvaluationService
        ai_service = AIEvaluationService()
        ai_service.evaluate_single_answer(answer.id)
        
        answer.refresh_from_db()
        
        return format_success_response(
            message="AI analysis for this question complete.",
            data=TestSubmissionAnswerSerializer(answer).data
        )

@extend_schema(tags=["Test Submissions"], summary="Simulate AI evaluation complete", description="Allows a teacher to simulate AI evaluation complete.")
class SimulateAIEvaluationCompleteView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer

    def post(self, request, submission_pk):
        try:
            submission = TestSubmission.objects.get(pk=submission_pk)
        except TestSubmission.DoesNotExist:
            raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)

        if submission.status != TestSubmission.Status.EVALUATING:
            raise ServiceError(detail="Submission is not currently evaluating.", status_code=status.HTTP_400_BAD_REQUEST)

        # Simulate Grade
        submission.status = TestSubmission.Status.PENDING_REVIEW
        submission.marks_obtained = random.randint(40, 100)
        submission.is_passed = submission.marks_obtained >= 50
        submission.grader_remarks = "AI analysis: Good understanding, needs refinement in concepts."
        submission.save()

        # Notify teacher/admin of the batch
        ct = ContentType.objects.get_for_model(TestSubmission)
        batch = submission.enrollment.batch
        teacher = batch.teacher
        
        if teacher:
            Notification.objects.create(
                user=teacher,
                title="AI Evaluation Complete - Pending Review",
                message=f"AI has completed grading for {submission.enrollment.student.fullname}. Review required.",
                notification_type=Notification.NotificationType.WARNING,
                content_type=ct,
                object_id=submission.id,
                action_url=f"/admin/batches/{batch.id}/content" # Or a dedicated submissions page
            )

        return format_success_response(
            message="AI evaluation completed and is pending review.",
            data=TestSubmissionSerializer(submission).data
        )

@extend_schema(tags=["Test Submissions"], summary="List all test submissions for the authenticated student", description="Allows a student to list all test submissions for the authenticated student.")
class MyTestSubmissionsListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        user = self.request.user
        batch_id = self.kwargs.get('batch_id')
        enrollment = _get_enrollment(batch_id, user)
        if not enrollment:
            raise ServiceError(detail="You are not a enrolled student in this batch.", status_code=status.HTTP_403_FORBIDDEN)
            
        return TestSubmission.objects.filter(enrollment=enrollment).order_by('-submitted_at')

    def list(self, request, batch_id):
        queryset = self.get_queryset()

        stats = {
            "total": queryset.count(),
            "pending": queryset.filter(status__in=[
                TestSubmission.Status.PENDING, 
                TestSubmission.Status.EVALUATING, 
                TestSubmission.Status.PENDING_REVIEW
            ]).count(),
            "published": queryset.filter(status=TestSubmission.Status.PUBLISHED).count(),
        }

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return format_success_response(data=serializer.data, message="Test submissions retrieved successfully", extra_params={"stats": stats}, status_code=status.HTTP_200_OK)
        serializer = self.get_serializer(queryset, many=True)
        return format_success_response(data=serializer.data, message="Test submissions retrieved successfully", status_code=status.HTTP_200_OK)