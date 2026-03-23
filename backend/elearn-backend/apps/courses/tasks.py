from celery import shared_task

from apps.courses.ai_services import AIEvaluationService
from apps.courses.models import TestSubmission


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def run_ai_evaluation_for_submission(self, submission_id: int) -> None:
    """
    Execute AI evaluation in Celery worker context.
    Retries transient errors and persists terminal failures explicitly.
    """
    try:
        AIEvaluationService().evaluate_submission(submission_id)
    except Exception as exc:
        try:
            submission = TestSubmission.objects.get(pk=submission_id)
            submission.status = TestSubmission.Status.PENDING_REVIEW
            submission.ai_job_status = TestSubmission.AIJobStatus.FAILED
            submission.ai_error_message = str(exc)
            submission.ai_feedback = f"AI Evaluation Error: {str(exc)}"
            submission.grader_remarks = "System error during background AI evaluation."
            submission.save(
                update_fields=[
                    "status",
                    "ai_job_status",
                    "ai_error_message",
                    "ai_feedback",
                    "grader_remarks",
                ]
            )
        except TestSubmission.DoesNotExist:
            return
        raise
