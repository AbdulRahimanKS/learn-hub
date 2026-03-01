import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


# Tag
class Tag(models.Model):
    name = models.CharField(_('Tag Name'), max_length=100, unique=True)

    class Meta:
        verbose_name        = _('Tag')
        verbose_name_plural = _('Tags')
        ordering            = ['name']

    def __str__(self):
        return self.name


# Course
class Course(models.Model):
    class DifficultyLevel(models.TextChoices):
        BEGINNER     = 'beginner',     _('Beginner')
        INTERMEDIATE = 'intermediate', _('Intermediate')
        ADVANCED     = 'advanced',     _('Advanced')

    course_code = models.CharField(max_length=20, unique=True, editable=False)
    title       = models.CharField(_('Course Title'), max_length=255)
    description = models.TextField(_('Description'), blank=True)

    difficulty_level = models.CharField(
        _('Difficulty Level'), max_length=20,
        choices=DifficultyLevel.choices,
        default=DifficultyLevel.BEGINNER
    )
    tags = models.ManyToManyField(
        Tag, blank=True,
        related_name='courses',
        help_text=_('Searchable labels, e.g. python, data-science')
    )

    thumbnail = models.ImageField(
        _('Course Thumbnail'), upload_to='course_thumbnails/',
        null=True, blank=True,
        help_text=_('Cover image for the course card')
    )

    is_active  = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_courses'
    )
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_courses'
    )
    deleted_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deleted_courses'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name        = _('Course')
        verbose_name_plural = _('Courses')
        ordering            = ['title']
        indexes             = [
            models.Index(fields=['is_active'],         name='course_is_active_idx'),
            models.Index(fields=['difficulty_level'],  name='course_difficulty_idx'),
            models.Index(fields=['course_code'],       name='course_code_idx'),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.course_code:
            self.course_code = self._gen_code()
        super().save(*args, **kwargs)

    def soft_delete(self, user):
        self.is_deleted = True
        if user:
            self.deleted_by = user
        self.deleted_at = timezone.now()
        self.save()

    @staticmethod
    def _gen_code():
        while True:
            code = f"CRS{uuid.uuid4().hex[:6].upper()}"
            if not Course.objects.filter(course_code=code).exists():
                return code


# Batch
class Batch(models.Model):
    class Status(models.TextChoices):
        UPCOMING  = 'upcoming',  _('Upcoming')
        ACTIVE    = 'active',    _('Active')
        COMPLETED = 'completed', _('Completed')
        CANCELLED = 'cancelled', _('Cancelled')

    batch_code  = models.CharField(max_length=20, unique=True, editable=False)
    name        = models.CharField(_('Batch Name'), max_length=255)
    description = models.TextField(_('Description'), blank=True)

    course = models.ForeignKey(
        Course, on_delete=models.PROTECT,
        related_name='batches', null=True, blank=True,
        help_text=_('The single course/module this batch delivers')
    )

    teacher = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='teaching_batches',
        help_text=_('Primary instructor. A teacher may be primary for multiple batches.')
    )
    co_teachers = models.ManyToManyField(
        'users.User', blank=True,
        related_name='co_teaching_batches',
        help_text=_('Additional instructors or teaching assistants for this batch.')
    )

    max_students = models.PositiveSmallIntegerField(
        _('Max Students'), default=30, validators=[MinValueValidator(1)]
    )

    start_date     = models.DateField(_('Start Date'), null=True, blank=True)
    end_date       = models.DateField(_('End Date'),   null=True, blank=True)

    status     = models.CharField(
        _('Status'), max_length=20,
        choices=Status.choices, default=Status.UPCOMING
    )
    
    is_deleted = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_batches'
    )
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_batches'
    )
    deleted_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deleted_batches'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name        = _('Batch')
        verbose_name_plural = _('Batches')
        ordering            = ['-created_at']
        indexes             = [
            models.Index(fields=['status'],      name='batch_status_idx'),
            models.Index(fields=['is_deleted'],  name='batch_is_deleted_idx'),
            models.Index(fields=['course'],      name='batch_course_idx'),
            models.Index(fields=['teacher'],     name='batch_teacher_idx'),
            models.Index(fields=['start_date'],  name='batch_start_date_idx'),
        ]

    def __str__(self):
        return f"{self.name} [{self.batch_code}]"

    def save(self, *args, **kwargs):
        if not self.batch_code:
            self.batch_code = self._gen_code()
        super().save(*args, **kwargs)

    @staticmethod
    def _gen_code():
        while True:
            code = f"BAT{uuid.uuid4().hex[:6].upper()}"
            if not Batch.objects.filter(batch_code=code).exists():
                return code

    @property
    def enrolled_count(self):
        return self.enrollments.filter(status=BatchEnrollment.Status.ACTIVE).count()

    @property
    def is_full(self):
        return self.enrolled_count >= self.max_students


# Batch Enrollment
class BatchEnrollment(models.Model):
    class Status(models.TextChoices):
        ACTIVE    = 'active',    _('Active')
        COMPLETED = 'completed', _('Completed')
        DROPPED   = 'dropped',   _('Dropped')
        SUSPENDED = 'suspended', _('Suspended')

    batch   = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(
        'users.User', on_delete=models.PROTECT, related_name='batch_enrollments'
    )
    status      = models.CharField(
        _('Status'), max_length=20,
        choices=Status.choices, default=Status.ACTIVE
    )
    enrolled_at  = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    dropped_at   = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    notes        = models.TextField(blank=True)

    enrolled_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='enrollment_actions'
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Batch Enrollment')
        verbose_name_plural = _('Batch Enrollments')
        unique_together     = ('batch', 'student')
        ordering            = ['-enrolled_at']

    def __str__(self):
        return f"{self.student.fullname} → {self.batch.name} [{self.status}]"


# Course Week
class CourseWeek(models.Model):
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name='course_weeks'
    )
    week_number = models.PositiveSmallIntegerField(_('Week Number'))
    title       = models.CharField(_('Week Title'), max_length=255, blank=True)
    description = models.TextField(_('Week Description'), blank=True)

    is_published = models.BooleanField(
        _('Published'), default=False,
        help_text=_('Teacher must publish a week before students can see its content')
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='course_weeks_created'
    )
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='course_weeks_updated'
    )

    class Meta:
        verbose_name        = _('Course Week')
        verbose_name_plural = _('Course Weeks')
        unique_together     = ('course', 'week_number')
        ordering            = ['week_number']
        indexes             = [
            models.Index(fields=['course'],        name='weeklymod_course_idx'),
            models.Index(fields=['is_published'], name='weeklymod_published_idx'),
        ]

    def __str__(self):
        return f"{self.course.title} – Week {self.week_number}: {self.title}"


# Class Session
class ClassSession(models.Model):
    course_week  = models.ForeignKey(
        CourseWeek, on_delete=models.CASCADE, related_name='class_sessions'
    )
    session_number = models.PositiveSmallIntegerField(
        _('Session Number within Week'), default=1
    )
    title          = models.CharField(_('Session Title'), max_length=255)
    description    = models.TextField(_('Description / Notes'), blank=True)

    video_file     = models.FileField(
        upload_to='class_videos/',
        null=True, blank=True,
        help_text=_('MP4 / WebM class recording uploaded by teacher')
    )
    video_url      = models.URLField(
        _('External Video URL'), blank=True, null=True,
        help_text=_('YouTube / Vimeo / CDN URL if not directly uploaded')
    )
    duration_mins  = models.PositiveSmallIntegerField(
        _('Video Duration (mins)'), default=0
    )

    uploaded_by    = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_sessions'
    )

    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Class Session')
        verbose_name_plural = _('Class Sessions')
        unique_together     = ('course_week', 'session_number')
        ordering            = ['course_week__week_number', 'session_number']
        indexes             = [
            models.Index(fields=['course_week'], name='classsess_module_idx'),
        ]

    def __str__(self):
        return (
            f"Week {self.course_week.week_number} | "
            f"S{self.session_number}: {self.title}"
        )


# WeeklyTest
class WeeklyTest(models.Model):
    course_week  = models.OneToOneField(
        CourseWeek, on_delete=models.CASCADE, related_name='weekly_test',
        help_text=_('Exactly one test per week')
    )
    title          = models.CharField(_('Test Title'), max_length=255)
    instructions   = models.TextField(_('Instructions'), blank=True)

    question_file  = models.FileField(
        upload_to='test_questions/',
        null=True, blank=True,
        help_text=_('Supported: .ipynb, .pdf, .doc, .docx, .jpg, .jpeg, .png')
    )
    question_text  = models.TextField(
        _('Inline Question Text'), blank=True,
        help_text=_('Text-only questions can be written here instead of uploading')
    )
    
    created_by     = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_tests'
    )
    updated_by     = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_tests'
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Weekly Test')
        verbose_name_plural = _('Weekly Tests')
        ordering            = ['course_week__week_number']
        indexes             = [
            models.Index(fields=['course_week'], name='weeklytest_module_idx'),
        ]

    def __str__(self):
        return f"{self.course_week.course.title} – Week {self.course_week.week_number} Test"


# ─────────────────────────────────────────────────────────────────────────────
# StudentSessionView  (tracks which videos a student has watched)
# ─────────────────────────────────────────────────────────────────────────────

class StudentSessionView(models.Model):
    """
    Records when and how much of a ClassSession video a student has watched.
    Used to compute attendance / engagement metrics without a test requirement.
    """

    enrollment   = models.ForeignKey(
        BatchEnrollment, on_delete=models.CASCADE,
        related_name='session_views'
    )
    class_session = models.ForeignKey(
        ClassSession, on_delete=models.CASCADE,
        related_name='student_views'
    )
    watched_percent   = models.FloatField(
        _('Watched (%)'), default=0.0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    is_completed      = models.BooleanField(
        _('Marked Complete'), default=False,
        help_text=_('Auto-set when watched_percent >= 90')
    )
    first_watched_at  = models.DateTimeField(auto_now_add=True)
    last_watched_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('enrollment', 'class_session')
        verbose_name    = _('Student Session View')

    def __str__(self):
        return (
            f"{self.enrollment.student.fullname} | "
            f"{self.class_session.title} | {self.watched_percent:.0f}%"
        )


# ─────────────────────────────────────────────────────────────────────────────
# LiveSession  (real-time class with screen-sharing + whiteboard)
# ─────────────────────────────────────────────────────────────────────────────

class LiveSession(models.Model):
    """
    A LIVE interactive class session within a WeeklyModule.
    Supports screen-sharing and whiteboard (handled at the WS/WebRTC layer).
    A recording URL can be attached after the session ends.
    """

    class Status(models.TextChoices):
        SCHEDULED   = 'scheduled',   _('Scheduled')
        LIVE        = 'live',        _('Ongoing / Live')
        ENDED       = 'ended',       _('Ended')
        CANCELLED   = 'cancelled',   _('Cancelled')
        RESCHEDULED = 'rescheduled', _('Rescheduled')

    course_week = models.ForeignKey(
        CourseWeek, on_delete=models.CASCADE, related_name='live_sessions'
    )
    title          = models.CharField(_('Title'), max_length=255)
    description    = models.TextField(blank=True)
    scheduled_at   = models.DateTimeField(_('Scheduled Start'))
    duration_mins  = models.PositiveSmallIntegerField(
        _('Planned Duration (mins)'), default=60
    )

    # Features
    enable_screen_share = models.BooleanField(_('Screen Sharing Enabled'), default=True)
    enable_whiteboard   = models.BooleanField(_('Whiteboard Enabled'), default=True)

    # After session ends
    actual_start    = models.DateTimeField(null=True, blank=True)
    actual_end      = models.DateTimeField(null=True, blank=True)
    recording_url   = models.URLField(_('Recording URL'), blank=True, null=True)
    session_notes   = models.TextField(_('Session Notes / Summary'), blank=True)

    status          = models.CharField(
        _('Status'), max_length=20,
        choices=Status.choices, default=Status.SCHEDULED
    )
    hosted_by       = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hosted_live_sessions'
    )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Live Session')
        verbose_name_plural = _('Live Sessions')
        ordering            = ['scheduled_at']

    def __str__(self):
        return f"LIVE: {self.title} @ {self.scheduled_at:%Y-%m-%d %H:%M}"


# ─────────────────────────────────────────────────────────────────────────────
# ScheduledWebinar  (separate from weekly flow — does NOT affect progress)
# ─────────────────────────────────────────────────────────────────────────────

class ScheduledWebinar(models.Model):
    """
    A special / bonus session (guest lecture, Q&A, recorded webinar).
    RULE: Does NOT affect weekly progress or content-unlocking rules.
    Attached to a Batch directly (not to a WeeklyModule).
    """

    class Status(models.TextChoices):
        UPCOMING  = 'upcoming',  _('Upcoming')
        ONGOING   = 'ongoing',   _('Ongoing')
        COMPLETED = 'completed', _('Completed')
        CANCELLED = 'cancelled', _('Cancelled')

    batch         = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name='webinars'
    )
    title         = models.CharField(_('Webinar Title'), max_length=255)
    description   = models.TextField(blank=True)
    speaker_name  = models.CharField(_('Speaker / Presenter'), max_length=255, blank=True)
    scheduled_at  = models.DateTimeField(_('Scheduled At'))
    duration_mins = models.PositiveSmallIntegerField(
        _('Duration (mins)'), default=60
    )
    meeting_link  = models.URLField(_('Meeting / Join Link'), blank=True, null=True)
    recording_url = models.URLField(_('Recording URL'), blank=True, null=True)
    status        = models.CharField(
        _('Status'), max_length=20,
        choices=Status.choices, default=Status.UPCOMING
    )
    is_mandatory     = models.BooleanField(
        _('Mandatory Attendance'), default=False,
        help_text=_('Mark if attendance is required (tracking only, no unlock effect)')
    )
    affects_progress = models.BooleanField(
        _('Affects Weekly Progress'), default=False,
        help_text=_('ALWAYS False per platform rules. Field kept for future flexibility.')
    )
    created_by    = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_webinars'
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Scheduled Webinar')
        verbose_name_plural = _('Scheduled Webinars')
        ordering            = ['scheduled_at']

    def __str__(self):
        return f"Webinar: {self.title} [{self.batch.name}]"

# ─────────────────────────────────────────────────────────────────────────────
# TestSubmission  (student answers)
# ─────────────────────────────────────────────────────────────────────────────

class TestSubmission(models.Model):
    """
    A student's answer submission for a WeeklyTest.
    The answer file can be any of: .ipynb, .pdf, .doc, .docx, .jpg, .jpeg.
    """

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', _('Submitted')
        GRADING   = 'grading',   _('Being Graded')
        GRADED    = 'graded',    _('Graded')
        RETURNED  = 'returned',  _('Returned for Revision')

    weekly_test  = models.ForeignKey(
        WeeklyTest, on_delete=models.CASCADE, related_name='submissions'
    )
    enrollment   = models.ForeignKey(
        BatchEnrollment, on_delete=models.CASCADE, related_name='test_submissions'
    )
    attempt_number = models.PositiveSmallIntegerField(_('Attempt #'), default=1)

    # Student uploads their answer file
    answer_file  = models.FileField(
        upload_to='test_submissions/',
        null=True, blank=True,
        help_text=_('Supported: .ipynb, .pdf, .doc, .docx, .jpg, .jpeg, .png')
    )
    answer_text  = models.TextField(
        _('Inline Answer Text'), blank=True,
        help_text=_('For text-only answers; used alongside or instead of file')
    )

    submitted_at = models.DateTimeField(auto_now_add=True)

    # Grading
    marks_obtained = models.FloatField(
        _('Marks Obtained (%)'), null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    is_passed      = models.BooleanField(default=False)
    grader_remarks = models.TextField(blank=True)
    graded_at      = models.DateTimeField(null=True, blank=True)
    graded_by      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='graded_submissions'
    )

    status         = models.CharField(
        _('Status'), max_length=20,
        choices=Status.choices, default=Status.SUBMITTED
    )

    class Meta:
        verbose_name        = _('Test Submission')
        verbose_name_plural = _('Test Submissions')
        unique_together     = ('weekly_test', 'enrollment', 'attempt_number')
        ordering            = ['-submitted_at']
        indexes             = [
            models.Index(fields=['status'],       name='testsub_status_idx'),
            models.Index(fields=['is_passed'],    name='testsub_passed_idx'),
            models.Index(fields=['enrollment'],   name='testsub_enrollment_idx'),
        ]

    def __str__(self):
        return (
            f"{self.enrollment.student.fullname} | "
            f"Test W{self.weekly_test.weekly_module.week_number} | "
            f"Attempt {self.attempt_number}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# BatchChatMessage  (per-batch chat with file attachments)
# ─────────────────────────────────────────────────────────────────────────────

class BatchChatMessage(models.Model):
    """
    A message in the batch group chat.
    Attachments support: ppt, pptx, pdf, doc, docx, ipynb, jpg, jpeg.
    Used during both async study and live sessions.
    """

    ALLOWED_ATTACHMENT_EXTENSIONS = [
        '.ppt', '.pptx',
        '.pdf',
        '.doc', '.docx',
        '.ipynb',
        '.jpg', '.jpeg',
    ]

    batch     = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name='chat_messages'
    )
    sender    = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='batch_chat_messages'
    )
    # Optional: link message to a specific live session
    live_session = models.ForeignKey(
        LiveSession, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='chat_messages',
        help_text=_('If sent during a live session, reference it here')
    )

    message    = models.TextField(_('Message'), blank=True)

    # File attachment (ppt, pdf, doc, ipynb, jpg, jpeg)
    attachment      = models.FileField(
        upload_to='chat_attachments/', null=True, blank=True,
        help_text=_('Allowed: ppt, pptx, pdf, doc, docx, ipynb, jpg, jpeg')
    )
    attachment_name = models.CharField(max_length=255, blank=True)

    is_deleted  = models.BooleanField(default=False)
    sent_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = _('Batch Chat Message')
        verbose_name_plural = _('Batch Chat Messages')
        ordering            = ['sent_at']

    def __str__(self):
        sender_name = self.sender.fullname if self.sender else 'Unknown'
        preview = (self.message[:40] + '…') if len(self.message) > 40 else self.message
        return f"{sender_name} → {self.batch.name}: {preview}"


# ─────────────────────────────────────────────────────────────────────────────
# StudentProgress  (aggregated scorecard per enrollment)
# ─────────────────────────────────────────────────────────────────────────────

class StudentProgress(models.Model):
    """
    Aggregated performance record for one student across their entire Batch.
    Updated by signals whenever TestSubmission or StudentSessionView is saved.
    """

    enrollment = models.OneToOneField(
        BatchEnrollment, on_delete=models.CASCADE, related_name='progress'
    )

    # Video engagement
    videos_watched   = models.PositiveSmallIntegerField(default=0)
    videos_total     = models.PositiveSmallIntegerField(default=0)

    # Test performance
    tests_attempted  = models.PositiveSmallIntegerField(default=0)
    tests_passed     = models.PositiveSmallIntegerField(default=0)
    average_score    = models.FloatField(
        _('Average Test Score (%)'), default=0.0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )

    # Weeks unlocked (tracks how far the student has progressed)
    current_week_unlocked = models.PositiveSmallIntegerField(
        _('Highest Week Unlocked'), default=1
    )

    # Overall batch completion
    progress_percent   = models.FloatField(
        _('Batch Completion (%)'), default=0.0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    is_passed          = models.BooleanField(default=False)
    certificate_issued = models.BooleanField(default=False)
    certificate_url    = models.URLField(blank=True, null=True)

    teacher_remarks   = models.TextField(blank=True)
    last_activity_at  = models.DateTimeField(null=True, blank=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Student Progress')
        verbose_name_plural = _('Student Progress Records')

    def __str__(self):
        return (
            f"{self.enrollment.student.fullname} | "
            f"{self.enrollment.batch.name} | {self.progress_percent:.0f}%"
        )

    @property
    def video_completion_percent(self):
        if not self.videos_total:
            return 0
        return round((self.videos_watched / self.videos_total) * 100, 1)
