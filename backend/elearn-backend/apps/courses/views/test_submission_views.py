import json
import random
from rest_framework import generics, status
from utils.permissions import IsSuperAdminAdminOrTeacher, IsAuthenticated
from rest_framework.views import APIView
from django.conf import settings
from django.utils import timezone
from django.db.models import Sum
from apps.courses.models import (
    TestSubmission,
    TestSubmissionAnswer,
    BatchWeeklyTest,
    BatchEnrollment,
    Batch,
)
from apps.courses.serializers.test_submission_serializers import (
    TestSubmissionSerializer, TestSubmissionUpdateSerializer, TestSubmissionAnswerSerializer
)
from apps.courses.ai_services import AIEvaluationService
from utils.pagination import CustomPageNumberPagination
from django.contrib.contenttypes.models import ContentType
from apps.users.models import Notification
from utils.common import format_success_response, ServiceError, handle_serializer_errors
from utils.constants import UserTypeConstants
from drf_spectacular.utils import extend_schema
from apps.courses.tasks import run_ai_evaluation_for_submission
import logging

logger = logging.getLogger(__name__)


WEEKLY_TEST_STUDENT_ANSWER_EXTENSIONS = frozenset(('ipynb', 'pdf'))

_STATS_PENDING_STATUSES = (
    TestSubmission.Status.PENDING,
    TestSubmission.Status.EVALUATING,
    TestSubmission.Status.PENDING_REVIEW,
)


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
    return (
        BatchEnrollment.objects.select_related('batch', 'batch__teacher')
        .prefetch_related('batch__co_teachers')
        .filter(
            batch_id=batch_id,
            student=user,
            status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED],
        )
        .first()
    )


def _notify_batch_teachers_new_weekly_submission(submission, student_user, test, enrollment):
    """Notify primary teacher and co-teachers that a student submitted a weekly test."""
    try:
        batch = enrollment.batch
        recipients = []
        seen = set()
        if batch.teacher_id and batch.teacher:
            recipients.append(batch.teacher)
            seen.add(batch.teacher.id)
        for co in batch.co_teachers.all():
            if co.id not in seen:
                recipients.append(co)
                seen.add(co.id)
        if not recipients:
            return

        week_num = test.batch_week.week_number
        student_label = (getattr(student_user, 'fullname', None) or '').strip() or student_user.email
        test_title = test.title
        message = (
            f'{student_label} submitted "{test_title}" for week {week_num} '
            f'in batch "{batch.name}" (attempt {submission.attempt_number}).'
        )

        Notification.objects.bulk_create(
            [
                Notification(
                    user=teacher_user,
                    title='New weekly test submission',
                    message=message,
                    notification_type=Notification.NotificationType.INFO,
                )
                for teacher_user in recipients
            ]
        )
    except Exception as exc:
        logger.exception(
            'Failed to notify teachers about test submission %s: %s',
            getattr(submission, 'pk', None),
            exc,
        )


def _get_batch_or_404(batch_id):
    try:
        return Batch.objects.get(pk=batch_id)
    except Batch.DoesNotExist:
        raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)


def _can_list_all_submissions_for_batch(user, batch):
    """
    Teachers, co-teachers, and global admins may list every submission in a batch.
    (Students use my-submissions or are limited to their own enrollment below.)
    """
    if getattr(user, "is_superuser", False):
        return True
    ut = getattr(user, "user_type", None)
    role = getattr(ut, "name", None) if ut else None
    if role in (UserTypeConstants.SUPERADMIN, UserTypeConstants.ADMIN):
        return True
    if batch.teacher_id and batch.teacher_id == user.id:
        return True
    if batch.co_teachers.filter(pk=user.pk).exists():
        return True
    return False


@extend_schema(tags=["Test Submissions"], summary="Create a new test submission", description="Allows a student to submit their weekly test.")
class TestSubmissionCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer

    def post(self, request, batch_id, week_id):
        try:
            user = request.user
            
            enrollment = _get_enrollment(batch_id, user)
            if not enrollment:
                raise ServiceError(detail="You are not a enrolled student in this batch.", status_code=status.HTTP_403_FORBIDDEN)

            try:
                test = (
                    BatchWeeklyTest.objects.select_related('batch_week')
                    .get(batch_week_id=week_id, batch_week__batch_id=batch_id)
                )
            except BatchWeeklyTest.DoesNotExist:
                raise ServiceError(detail="Test not found for this week.", status_code=status.HTTP_404_NOT_FOUND)

            latest_attempt = TestSubmission.objects.filter(
                batch_weekly_test=test, enrollment=enrollment
            ).order_by('-attempt_number').first()
            
            if latest_attempt and latest_attempt.status == TestSubmission.Status.PUBLISHED and latest_attempt.is_passed:
                raise ServiceError(detail="You have already passed this test.", status_code=status.HTTP_400_BAD_REQUEST)

            attempt_number = (latest_attempt.attempt_number + 1) if latest_attempt else 1

            for key, uploaded in request.FILES.items():
                if key.startswith('file_q_'):
                    _validate_weekly_test_answer_upload(uploaded)

            submission = TestSubmission.objects.create(
                batch_weekly_test=test,
                enrollment=enrollment,
                attempt_number=attempt_number,
                status=TestSubmission.Status.PENDING
            )

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

            _notify_batch_teachers_new_weekly_submission(submission, user, test, enrollment)

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

    def _base_queryset(self):
        """Batch (or student enrollment) + optional week — no status/scope filter (used for stats)."""
        batch_id = self.kwargs.get('batch_id')
        user = self.request.user
        batch = _get_batch_or_404(batch_id)

        if _can_list_all_submissions_for_batch(user, batch):
            qs = TestSubmission.objects.filter(enrollment__batch_id=batch_id)
        else:
            enrollment = _get_enrollment(batch_id, user)
            if not enrollment:
                raise ServiceError(
                    detail="You are not allowed to view submissions for this batch.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            qs = TestSubmission.objects.filter(enrollment=enrollment)

        week_number = self.request.query_params.get('week_number')
        if week_number and week_number != 'all':
            try:
                week_int = int(week_number)
                qs = qs.filter(batch_weekly_test__batch_week__week_number=week_int)
            except (ValueError, TypeError):
                pass

        return qs

    def get_queryset(self):
        qs = (
            self._base_queryset()
            .select_related('enrollment__student__profile', 'batch_weekly_test__batch_week')
            .order_by('-submitted_at')
        )
        scope = (self.request.query_params.get('scope') or '').strip().lower()
        if scope == TestSubmission.Status.PENDING:
            return qs.filter(status__in=[TestSubmission.Status.PENDING, TestSubmission.Status.EVALUATING, TestSubmission.Status.PENDING_REVIEW])
        elif scope == TestSubmission.Status.PUBLISHED:
            return qs.filter(status=TestSubmission.Status.PUBLISHED)
        else:
            return qs

    def list(self, request, *args, **kwargs):
        base_for_stats = self._base_queryset()
        stats = {
            "total": base_for_stats.count(),
            "pending": base_for_stats.filter(status__in=_STATS_PENDING_STATUSES).count(),
            "published": base_for_stats.filter(status=TestSubmission.Status.PUBLISHED).count(),
            "evaluating": base_for_stats.filter(status=TestSubmission.Status.EVALUATING).count(),
            "pending_review": base_for_stats.filter(status=TestSubmission.Status.PENDING_REVIEW).count(),
        }

        queryset = self.filter_queryset(self.get_queryset())

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

    def get_queryset(self):
        return (
            TestSubmission.objects.filter(enrollment__batch_id=self.kwargs.get('batch_id'))
            .select_related('batch_weekly_test', 'enrollment__student', 'enrollment__student__profile', 'graded_by')
        )

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return TestSubmissionUpdateSerializer
        return TestSubmissionSerializer

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except TestSubmission.DoesNotExist:
            raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(instance, context={'request': request})
        return format_success_response(data=serializer.data)

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            try:
                instance = self.get_object()
            except TestSubmission.DoesNotExist:
                raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)
            
            old_status = instance.status
            if old_status == TestSubmission.Status.PUBLISHED:
                raise ServiceError(
                    detail="Published submissions are locked and cannot be modified.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
            if not serializer.is_valid():
                raise ServiceError(detail=handle_serializer_errors(serializer), status_code=status.HTTP_400_BAD_REQUEST)

            new_status = serializer.validated_data.get('status')
            if new_status and new_status != old_status and new_status == TestSubmission.Status.PUBLISHED:
                instance.graded_at = timezone.now()
                instance.graded_by = request.user

            instance = serializer.save()

            if new_status and new_status != old_status and new_status == TestSubmission.Status.PUBLISHED:
                student = instance.enrollment.student
                test_title = instance.batch_weekly_test.title if instance.batch_weekly_test else "your test"
                Notification.objects.create(
                    user=student,
                    title="Test results published",
                    message=(
                        f"Your instructor published results for {test_title} "
                        f"(attempt {instance.attempt_number}). Score: {instance.marks_obtained}% — "
                        f"{'Passed' if instance.is_passed else 'Not passed'}."
                    ),
                    notification_type=Notification.NotificationType.SUCCESS,
                )

            return format_success_response(
                message="Test submission updated successfully",
                data=TestSubmissionSerializer(instance, context={'request': request}).data
            )
            
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating test submission: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the test submission.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Test Submissions"], summary="Trigger AI evaluation for a specific test submission", description="Allows a teacher to trigger AI evaluation for a specific test submission.")
class TriggerAIEvaluationView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    def post(self, request, batch_id, pk):
        try:
            batch = _get_batch_or_404(batch_id)
            if not _can_list_all_submissions_for_batch(request.user, batch):
                raise ServiceError(detail="You are not allowed to trigger AI evaluation for this batch.", status_code=status.HTTP_403_FORBIDDEN)

            try:
                submission = TestSubmission.objects.get(pk=pk, enrollment__batch_id=batch_id)
            except TestSubmission.DoesNotExist:
                raise ServiceError(detail="Test submission not found.", status_code=status.HTTP_404_NOT_FOUND)
            
            if submission.status != TestSubmission.Status.PENDING:
                raise ServiceError(detail=f"Cannot evaluate submission in '{submission.status}' state.", status_code=status.HTTP_400_BAD_REQUEST)
            
            submission.status = TestSubmission.Status.EVALUATING
            submission.ai_job_status = TestSubmission.AIJobStatus.QUEUED
            submission.ai_error_message = ""
            submission.ai_feedback = ""
            submission.save(update_fields=['status', 'ai_job_status', 'ai_error_message', 'ai_feedback'])

            run_ai_evaluation_for_submission.delay(submission.id)

            submission.refresh_from_db()
            return format_success_response(
                message="AI evaluation queued.",
                data=TestSubmissionSerializer(submission).data,
                status_code=status.HTTP_202_ACCEPTED,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error triggering AI evaluation for test answer: {str(e)}")
            raise ServiceError(detail="An error occurred while triggering AI evaluation for the test answer.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Test Submissions"], summary="Trigger AI evaluation for a specific test answer", description="Allows a teacher to trigger AI evaluation for a specific test answer.")
class TriggerAnswerAIEvaluationView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = TestSubmissionAnswerSerializer

    def post(self, request, batch_id, submission_pk, answer_pk):
        try:
            batch = _get_batch_or_404(batch_id)
            if not _can_list_all_submissions_for_batch(request.user, batch):
                raise ServiceError(detail="You are not allowed to trigger AI evaluation for this batch.", status_code=status.HTTP_403_FORBIDDEN)

            try:
                answer = TestSubmissionAnswer.objects.get(
                    pk=answer_pk,
                    submission_id=submission_pk,
                    submission__enrollment__batch_id=batch_id,
                )
            except TestSubmissionAnswer.DoesNotExist:
                raise ServiceError(detail="Answer not found.", status_code=status.HTTP_404_NOT_FOUND)

            submission = answer.submission
            if submission.status == TestSubmission.Status.EVALUATING:
                raise ServiceError(
                    detail="Full submission AI is currently running. Please wait and try again.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if submission.status == TestSubmission.Status.PUBLISHED:
                raise ServiceError(
                    detail="Cannot run per-question AI after results are published.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            ai_service = AIEvaluationService()
            ai_result = ai_service.evaluate_single_answer(answer.id)
            if not ai_result or not ai_result.get("ok", False):
                raise ServiceError(
                    detail=(ai_result or {}).get("error", "AI evaluation failed for this question."),
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            answer.refresh_from_db()
            # Keep submission-level AI aggregate in sync with per-question re-runs.
            aggregate_ai = (
                submission.answers.exclude(ai_score__isnull=True)
                .aggregate(total=Sum('ai_score'))
                .get('total')
                or 0
            )
            submission.ai_score = aggregate_ai
            submission.ai_evaluated_at = timezone.now()
            submission.save(update_fields=['ai_score', 'ai_evaluated_at'])

            return format_success_response(
                message="AI analysis for this question complete.",
                data=TestSubmissionAnswerSerializer(answer).data
            )
        
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error triggering AI evaluation for test answer: {str(e)}")
            raise ServiceError(detail="An error occurred while triggering AI evaluation for the test answer.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Test Submissions"],
    summary="Simulate AI evaluation complete (DEBUG only)",
    description="Development-only. Fakes completion of AI evaluation; disabled when DEBUG=False.",
)
class SimulateAIEvaluationCompleteView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer

    def post(self, request, batch_id, pk):
        if not settings.DEBUG:
            raise ServiceError(
                detail="Simulate AI complete is only available in development.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        try:
            submission = TestSubmission.objects.get(pk=pk, enrollment__batch_id=batch_id)
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

    def _base_queryset(self):
        user = self.request.user
        batch_id = self.kwargs.get('batch_id')
        enrollment = _get_enrollment(batch_id, user)
        if not enrollment:
            raise ServiceError(detail="You are not a enrolled student in this batch.", status_code=status.HTTP_403_FORBIDDEN)

        qs = TestSubmission.objects.filter(enrollment=enrollment)
        week_number = self.request.query_params.get('week_number')
        if week_number and week_number != 'all':
            try:
                week_int = int(week_number)
                qs = qs.filter(batch_weekly_test__batch_week__week_number=week_int)
            except (ValueError, TypeError):
                pass
        return qs

    def get_queryset(self):
        qs = (
            self._base_queryset()
            .select_related('enrollment__student__profile', 'batch_weekly_test__batch_week')
            .order_by('-submitted_at')
        )
        scope = (self.request.query_params.get('scope') or '').strip().lower()
        if scope == TestSubmission.Status.PENDING:
            return qs.filter(status__in=[TestSubmission.Status.PENDING, TestSubmission.Status.EVALUATING, TestSubmission.Status.PENDING_REVIEW])
        return qs

    def list(self, request, batch_id):
        base_for_stats = self._base_queryset()
        stats = {
            "total": base_for_stats.count(),
            "pending": base_for_stats.filter(status__in=_STATS_PENDING_STATUSES).count(),
            "published": base_for_stats.filter(status=TestSubmission.Status.PUBLISHED).count(),
            "evaluating": base_for_stats.filter(status=TestSubmission.Status.EVALUATING).count(),
            "pending_review": base_for_stats.filter(status=TestSubmission.Status.PENDING_REVIEW).count(),
        }

        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['stats'] = stats
            return response
        serializer = self.get_serializer(queryset, many=True)
        return format_success_response(
            data=serializer.data,
            message="Test submissions retrieved successfully",
            extra_params={"stats": stats},
            status_code=status.HTTP_200_OK,
        )