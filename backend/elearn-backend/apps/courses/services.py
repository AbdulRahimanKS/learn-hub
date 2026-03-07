import logging
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from apps.courses.models import Batch, BatchWeek, BatchClassSession, CourseClassSession, WeeklyTest, WeeklyTestQuestion, CourseWeek
from apps.courses.views.upload_views import get_s3_client

logger = logging.getLogger(__name__)

def initialize_batch_weeks(batch):
    """
    Initializes BatchWeeks based on CourseWeeks of the related course.
    Calculates unlock dates based on batch start_date.
    """
    if not batch.start_date or not batch.course:
        return

    course_weeks = CourseWeek.objects.filter(course=batch.course).order_by('week_number')
    
    for cw in course_weeks:
        # Calculate Monday of that week
        # Assuming start_date is the start of Week 1
        # If start_date is Monday, Week 2 unlock is start_date + 7 days
        days_to_add = (cw.week_number - 1) * 7
        unlock_date = timezone.make_aware(
            timezone.datetime.combine(batch.start_date + timedelta(days=days_to_add), timezone.datetime.min.time())
        )
        
        BatchWeek.objects.get_or_create(
            batch=batch,
            week_number=cw.week_number,
            defaults={
                'title': cw.title,
                'description': cw.description,
                'unlock_date': unlock_date,
                'is_published': cw.is_published
            }
        )

@transaction.atomic
def push_content_to_batch(source_batch_id=None, source_course_id=None, target_batch_id=None):
    """
    Clones content from a source (Course or Batch) to a target Batch.
    """
    target_batch = Batch.objects.get(id=target_batch_id)
    
    if source_batch_id:
        source_batch = Batch.objects.get(id=source_batch_id)
        if source_batch.course_id != target_batch.course_id:
            raise ValueError("Source batch must belong to the same course as target batch.")
        source_weeks = BatchWeek.objects.filter(batch_id=source_batch_id)
    elif source_course_id:
        if int(source_course_id) != target_batch.course_id:
             raise ValueError("Source course must be the same as target batch course.")
        source_weeks = CourseWeek.objects.filter(course_id=source_course_id)
    else:
        return False

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
            # Check if session already exists in target batch week
            if not BatchClassSession.objects.filter(batch_week=bw, session_number=ss.session_number).exists():
                BatchClassSession.objects.create(
                    batch_week=bw,
                    session_number=ss.session_number,
                    title=ss.title,
                    description=ss.description,
                    video_file=ss.video_file,
                    thumbnail=ss.thumbnail,
                    duration_seconds=ss.duration_seconds,
                    uploaded_by=ss.uploaded_by
                )

        # 3. Clone WeeklyTest
        if hasattr(sw, 'weekly_test') and sw.weekly_test:
            st = sw.weekly_test
            tt, created = WeeklyTest.objects.get_or_create(
                batch_week=bw,
                defaults={
                    'title': st.title,
                    'instructions': st.instructions,
                    'pass_percentage': st.pass_percentage,
                    'created_by': st.created_by
                }
            )
            
            # Clone Questions
            for sq in st.questions.all():
                if not WeeklyTestQuestion.objects.filter(test=tt, order=sq.order, text=sq.text).exists():
                    WeeklyTestQuestion.objects.create(
                        test=tt,
                        text=sq.text,
                        question_file=sq.question_file,
                        image=sq.image,
                        order=sq.order,
                        marks=sq.marks
                    )
    
    return True

def extend_batch_timeline(batch_id, days):
    """
    Extends the timeline for all NOT YET UNLOCKED weeks of a batch.
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
