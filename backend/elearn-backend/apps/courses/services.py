import logging
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from apps.courses.models import (
    Batch, BatchWeek, BatchClassSession, CourseClassSession, CourseWeek,
    BatchWeeklyTest, BatchTestQuestion, BatchTestQuestionAttachment,
    BatchPostSessionQuestion, BatchPostSessionChoice
)
from apps.courses.views.upload_views import get_s3_client
from utils.common import ServiceError
from rest_framework import status

logger = logging.getLogger(__name__)


@transaction.atomic
def push_content_to_batch(source_batch_id=None, source_course_id=None, target_batch_id=None):
    """
    Clones content from a source (Course or Batch) to a target Batch.
    """
    target_batch = Batch.objects.get(id=target_batch_id)
    
    if source_batch_id:
        source_batch = Batch.objects.get(id=source_batch_id)
        if source_batch.course_id != target_batch.course_id:
            raise ServiceError(detail="Source batch must belong to the same course as target batch.", status_code=status.HTTP_400_BAD_REQUEST)
        source_weeks = BatchWeek.objects.filter(batch_id=source_batch_id)
    elif source_course_id:
        if int(source_course_id) != target_batch.course_id:
            raise ServiceError(detail="Source course must be the same as target batch course.", status_code=status.HTTP_400_BAD_REQUEST)
        source_weeks = CourseWeek.objects.filter(course_id=source_course_id)
    else:
        raise ServiceError(detail="Missing source source_course_id or source_batch_id", status_code=status.HTTP_400_BAD_REQUEST)

    for sw in source_weeks:
        # 1. Create/Update BatchWeek
        days_to_add = (sw.week_number - 1) * 7
        unlock_date = timezone.make_aware(
            timezone.datetime.combine(target_batch.start_date + timedelta(days=days_to_add), timezone.datetime.min.time())
        )
        
        bw, created = BatchWeek.objects.get_or_create(
            batch=target_batch,
            week_number=sw.week_number,
            defaults={
                'title': sw.title,
                'description': sw.description,
                'unlock_date': unlock_date,
                'is_published': sw.is_published
            }
        )

        # 2. Clone ClassSessions (from CourseClassSession → BatchClassSession)
        source_sessions = sw.class_sessions.all()
        for ss in source_sessions:
            # Check existence using the model's uniqueness tuple:
            # (batch_week, weekday, session_number)
            if not BatchClassSession.objects.filter(
                batch_week=bw,
                weekday=ss.weekday,
                session_number=ss.session_number
            ).exists():
                batch_session = BatchClassSession.objects.create(
                    batch_week=bw,
                    session_number=ss.session_number,
                    title=ss.title,
                    description=ss.description,
                    weekday=ss.weekday,
                    video_file=ss.video_file,
                    thumbnail=ss.thumbnail,
                    duration_seconds=ss.duration_seconds,
                    uploaded_by=ss.uploaded_by
                )
                
                # Clone MCQ questions from source session to target batch session
                if hasattr(ss, 'mcq_questions'):
                    for sq in ss.mcq_questions.all():
                        bq = BatchPostSessionQuestion.objects.create(
                            batch_session=batch_session,
                            text=sq.text,
                            is_fill_in_the_blank=sq.is_fill_in_the_blank,
                            order=sq.order
                        )
                        for sc in sq.choices.all():
                            BatchPostSessionChoice.objects.create(
                                question=bq,
                                text=sc.text,
                                is_correct=sc.is_correct
                            )

        # 3. Clone WeeklyTest → independent BatchWeeklyTest
        if hasattr(sw, 'weekly_test') and sw.weekly_test:
            st = sw.weekly_test  # CourseWeeklyTest (or BatchWeeklyTest if cloning from batch)
            tt, test_created = BatchWeeklyTest.objects.get_or_create(
                batch_week=bw,
                defaults={
                    'title': st.title,
                    'instructions': st.instructions,
                    'pass_percentage': st.pass_percentage,
                    'answer_key': st.answer_key,  # carry the answer key file reference
                    'created_by': st.created_by
                }
            )

            # Clone Questions + their supporting attachments into batch
            # Only clone if the test was just created to avoid duplicates on re-push
            if test_created:
                for sq in st.questions.all():
                    bq = BatchTestQuestion.objects.create(
                        test=tt,
                        text=sq.text,
                        question_file=sq.question_file,
                        image=sq.image,
                        marks=sq.marks,
                        order=sq.order,
                    )

                    # Clone all attachments for this question
                    for attachment in sq.attachments.all():
                        BatchTestQuestionAttachment.objects.create(
                            question=bq,
                            file=attachment.file,
                            name=attachment.name,
                        )

    return True

def extend_batch_timeline(batch_id, days):
    """
    Extends the timeline for all NOT YET UNLOCKED weeks of a batch.

    Caller should pass ``days`` as a multiple of 7 so unlock cadence stays consistent
    with week-based scheduling (validated in the API view).
    """
    now = timezone.now()
    weeks_to_update = BatchWeek.objects.filter(
        batch_id=batch_id,
        unlock_date__gt=now
    )
    
    for week in weeks_to_update:
        week.unlock_date += timedelta(days=days)
        week.is_extended = True
        week.save()
    
    return True

def delete_unused_video_from_storage(video_key):
    """
    Checks if a video file key is used anywhere else in CourseClassSession or BatchClassSession.
    If it is not used, it deletes the object from the AWS/R2 storage bucket.
    """
    if not video_key:
        return

    # Check references across both models
    is_used_in_course = CourseClassSession.objects.filter(video_file=video_key).exists()
    is_used_in_batch = BatchClassSession.objects.filter(video_file=video_key).exists()

    if not is_used_in_course and not is_used_in_batch:
        try:
            s3_client = get_s3_client()
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=video_key
            )
            logger.info(f"Successfully deleted unused video from storage: {video_key}")
        except Exception as e:
            logger.error(f"Failed to delete video {video_key} from storage: {str(e)}")
