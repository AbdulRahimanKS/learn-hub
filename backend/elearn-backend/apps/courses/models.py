import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from utils.common import get_current_local_date


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

    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_courses'
    )
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_courses'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Course')
        verbose_name_plural = _('Courses')
        ordering            = ['-created_at']
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

    @staticmethod
    def _gen_code():
        while True:
            code = f"CRS{uuid.uuid4().hex[:6].upper()}"
            if not Course.objects.filter(course_code=code).exists():
                return code

    @property
    def total_weeks(self):
        return self.course_weeks.count()


# Batch
class Batch(models.Model):
    class Status(models.TextChoices):
        ACTIVE    = 'ACTIVE', _('Active')
        COMPLETED = 'COMPLETED', _('Completed')

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

    start_date     = models.DateField(_('Start Date'))

    status = models.CharField(
        _('Status'), max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )

    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_batches'
    )
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_batches'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Batch')
        verbose_name_plural = _('Batches')
        ordering            = ['start_date']
        indexes             = [
            models.Index(fields=['status'],   name='batch_status_idx'),
            models.Index(fields=['course'],      name='batch_course_idx'),
            models.Index(fields=['teacher'],     name='batch_teacher_idx'),
            models.Index(fields=['start_date'],  name='batch_start_date_idx'),
        ]

    def __str__(self):
        return f"{self.name} [{self.batch_code}]"

    def clean(self):
        super().clean()
        if self.start_date and self.start_date.weekday() != 0:
            raise ValidationError({'start_date': _('All batches must start on a Monday.')})

    def save(self, *args, **kwargs):
        self.clean()
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
        return self.enrollments.all().count()

    @property
    def is_full(self):
        return self.enrolled_count >= self.max_students


# Batch Enrollment
class BatchEnrollment(models.Model):
    class Status(models.TextChoices):
        ACTIVE    = 'active',    _('Active')
        COMPLETED = 'completed', _('Completed')
        DROPPED   = 'dropped',   _('Dropped')

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

        indexes = [
            models.Index(fields=["batch"]),
            models.Index(fields=["student"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.student.fullname} → {self.batch.name} [{self.status}]"


# StudentSessionView
class StudentSessionView(models.Model):
    enrollment   = models.ForeignKey(
        BatchEnrollment, on_delete=models.CASCADE,
        related_name='session_views'
    )
    batch_session = models.ForeignKey(
        'BatchClassSession', on_delete=models.CASCADE,
        related_name='student_views',
        null=True, blank=True
    )
    watched_percent   = models.FloatField(
        _('Watched (%)'), default=0.0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    is_completed      = models.BooleanField(
        _('Marked Complete'), default=False,
    )
    first_watched_at  = models.DateTimeField(auto_now_add=True)
    last_watched_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('enrollment', 'batch_session')
        verbose_name    = _('Student Session View')
        indexes = [
            models.Index(fields=["enrollment"]),
            models.Index(fields=["batch_session"]),
        ]

    def __str__(self):
        return (
            f"{self.enrollment.student.fullname} | "
            f"{self.batch_session.title} | {self.watched_percent:.0f}%"
        )


# Manual Student Week Unlock
class ManualStudentWeekUnlock(models.Model):
    """A granular manual unlock for a specific week and student."""
    enrollment = models.ForeignKey(
        BatchEnrollment, on_delete=models.CASCADE, related_name='manual_unlocks'
    )
    batch_week = models.ForeignKey(
        'BatchWeek', on_delete=models.CASCADE, related_name='manual_unlocks'
    )
    unlocked_at = models.DateTimeField(auto_now_add=True)
    unlocked_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='weeks_unlocked_by'
    )

    class Meta:
        verbose_name = _('Manual Student Week Unlock')
        verbose_name_plural = _('Manual Student Week Unlocks')
        unique_together = ('enrollment', 'batch_week')
        indexes = [
            models.Index(fields=['enrollment', 'batch_week']),
        ]

    def __str__(self):
        return f"{self.enrollment.student.fullname} | Week {self.batch_week.week_number} Manual Unlock"


# Course Week
class CourseWeek(models.Model):
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name='course_weeks'
    )
    week_number = models.PositiveSmallIntegerField(_('Week Number'))
    title       = models.CharField(_('Week Title'), max_length=255, blank=True)
    description = models.TextField(_('Week Description'), blank=True)

    is_published = models.BooleanField(
        _('Published'), default=True,
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


# Batch Week
class BatchWeek(models.Model):
    batch = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name='batch_weeks'
    )
    week_number = models.PositiveSmallIntegerField(_('Week Number'))
    title       = models.CharField(_('Week Title'), max_length=255, blank=True)
    description = models.TextField(_('Week Description'), blank=True)

    unlock_date  = models.DateTimeField(_('Unlock Date'), null=True, blank=True)
    is_extended  = models.BooleanField(_('Extended'), default=False)
    
    is_published = models.BooleanField(
        _('Published'), default=True,
        help_text=_('Teacher must publish a week before students can see its content')
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Batch Week')
        verbose_name_plural = _('Batch Weeks')
        unique_together     = ('batch', 'week_number')
        ordering            = ['week_number']
        indexes             = [
            models.Index(fields=['batch'],        name='batchweek_batch_idx'),
            models.Index(fields=['unlock_date'],  name='batchweek_unlock_idx'),
        ]

    def __str__(self):
        return f"{self.batch.name} – Week {self.week_number}: {self.title}"

    @property
    def is_unlocked(self):
        if not self.unlock_date:
            return True
        return get_current_local_date() >= self.unlock_date.date()

    @property
    def can_modify_content(self):
        """Content cannot be deleted or re-added if it has already been unlocked."""
        return not self.is_unlocked

    def is_unlocked_for_student(self, student):
        """
        Check if the week is unlocked for a specific student.
        1. Current time >= unlock_date.
        2. Previous week's test is passed (if week > 1).
        """
        if not self.is_unlocked:
            return False
            
        if self.week_number == 1:
            return True
            
        prev_week = BatchWeek.objects.filter(
            batch=self.batch, 
            week_number=self.week_number - 1
        ).first()
        
        if not prev_week:
            return True
            
        if not hasattr(prev_week, 'weekly_test'):
            return True
            
        last_submission = TestSubmission.objects.filter(
            batch_weekly_test=prev_week.weekly_test,
            enrollment__student=student,
            enrollment__batch=self.batch
        ).order_by('-attempt_number').first()
        
        if not last_submission:
            return False
            
        return last_submission.status == TestSubmission.Status.PUBLISHED and last_submission.is_passed


# Shared weekday choices (both session models use the same values)
WEEKDAY_CHOICES = [
    ('monday',    _('Monday')),
    ('tuesday',   _('Tuesday')),
    ('wednesday', _('Wednesday')),
    ('thursday',  _('Thursday')),
    ('friday',    _('Friday')),
    ('saturday',  _('Saturday')),
    ('sunday',    _('Sunday')),
]


# Course Class Session (template content, attached to a CourseWeek)
class CourseClassSession(models.Model):
    """A recorded session that belongs to a course week (the content template)."""

    course_week = models.ForeignKey(
        CourseWeek, on_delete=models.CASCADE, related_name='class_sessions'
    )
    session_number = models.PositiveSmallIntegerField(
        _('Session Number within Week'), default=1
    )
    title          = models.CharField(_('Session Title'), max_length=255)
    description    = models.TextField(_('Description / Notes'), blank=True)
    weekday        = models.CharField(
        _('Weekday Tag'), max_length=15,
        choices=WEEKDAY_CHOICES,
        help_text=_('Weekday tag for this session')
    )

    video_file     = models.CharField(
        _('Video Object Key'),
        max_length=1024,
        null=True, blank=True,
        help_text=_('Cloudflare R2 object key for the video')
    )
    thumbnail      = models.ImageField(
        upload_to='course_sessions/thumbnails/',
        null=True, blank=True,
        help_text=_('Thumbnail image for the class session')
    )
    duration_seconds = models.PositiveIntegerField(
        _('Video Duration (seconds)'), default=0
    )

    uploaded_by    = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_course_sessions'
    )
    updated_by     = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_course_sessions'
    )

    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Course Class Session')
        verbose_name_plural = _('Course Class Sessions')
        ordering            = ['course_week__week_number', 'session_number']
        unique_together     = ('course_week', 'weekday', 'session_number')
        indexes             = [
            models.Index(fields=['course_week'], name='crsess_week_idx'),
        ]

    def __str__(self):
        return f"Week {self.course_week.week_number} | S{self.session_number}: {self.title}"


# Batch Class Session (live/batch-specific content, attached to a BatchWeek)
class BatchClassSession(models.Model):
    """A recorded session that belongs to a batch week (the actual delivery)."""

    batch_week = models.ForeignKey(
        BatchWeek, on_delete=models.CASCADE, related_name='class_sessions'
    )
    session_number = models.PositiveSmallIntegerField(
        _('Session Number within Week'), default=1
    )
    title          = models.CharField(_('Session Title'), max_length=255)
    description    = models.TextField(_('Description / Notes'), blank=True)
    weekday        = models.CharField(
        _('Weekday Tag'), max_length=15,
        choices=WEEKDAY_CHOICES,
        help_text=_('Weekday tag for this session')
    )

    video_file     = models.CharField(
        _('Video Object Key'),
        max_length=1024,
        null=True, blank=True,
        help_text=_('Cloudflare R2 object key for the video')
    )
    thumbnail      = models.ImageField(
        upload_to='batch_sessions/thumbnails/',
        null=True, blank=True,
        help_text=_('Thumbnail image for the class session')
    )
    duration_seconds = models.PositiveIntegerField(
        _('Video Duration (seconds)'), default=0
    )

    uploaded_by    = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_batch_sessions'
    )
    updated_by     = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_batch_sessions'
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Batch Class Session')
        verbose_name_plural = _('Batch Class Sessions')
        ordering            = ['batch_week__week_number', 'session_number']
        unique_together     = ('batch_week', 'weekday', 'session_number')
        indexes             = [
            models.Index(fields=['batch_week'], name='bsess_week_idx'),
        ]

    def __str__(self):
        return f"Week {self.batch_week.week_number} | S{self.session_number}: {self.title}"



# Course-level Weekly Test
class CourseWeeklyTest(models.Model):
    """
    Template test attached to a CourseWeek.
    This is the master copy. When content is pushed to a batch,
    a fully independent BatchWeeklyTest is created from this template.
    """
    course_week = models.OneToOneField(
        CourseWeek, on_delete=models.CASCADE, related_name='weekly_test'
    )
    title           = models.CharField(_('Test Title'), max_length=255)
    instructions    = models.TextField(_('Instructions'), blank=True)
    answer_key      = models.FileField(
        _('Answer Key'), upload_to='test_answer_keys/',
        null=True, blank=True,
        help_text=_('Upload answer key (PDF or .ipynb) for evaluation')
    )
    pass_percentage = models.FloatField(default=70.0)
    created_by      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_course_tests'
    )
    updated_by      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_course_tests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Course Weekly Test')
        verbose_name_plural = _('Course Weekly Tests')
        ordering            = ['course_week__week_number']
        indexes             = [
            models.Index(fields=['course_week'], name='cwtest_week_idx'),
        ]

    def __str__(self):
        return f"{self.course_week.course.title} – Week {self.course_week.week_number} Test (Template)"


# Course Test Question
class CourseTestQuestion(models.Model):
    """
    A question belonging to a CourseWeeklyTest template.
    """
    test           = models.ForeignKey(
        CourseWeeklyTest, on_delete=models.CASCADE, related_name='questions'
    )
    text           = models.TextField(_('Question Text'), blank=True)
    question_file  = models.FileField(
        upload_to='test_questions/course/files/',
        null=True, blank=True,
        help_text=_('Supported: .ipynb, .pdf, .doc, .docx, .jpg, .jpeg, .png')
    )
    image = models.ImageField(
        upload_to='test_questions/course/images/',
        null=True, blank=True
    )
    order = models.PositiveIntegerField(_('Order'), default=1)
    marks = models.FloatField(_('Marks'), default=1.0)

    class Meta:
        ordering        = ['order', 'id']
        verbose_name        = _('Course Test Question')
        verbose_name_plural = _('Course Test Questions')

    def __str__(self):
        return f"Course Q{self.order} for Test {self.test.id}"


# Batch-level Weekly Test
class BatchWeeklyTest(models.Model):
    """
    Independent test copy attached to a BatchWeek.
    Created by cloning a CourseWeeklyTest template (or built from scratch).
    Changes here NEVER affect the course template and vice-versa.
    """
    batch_week      = models.OneToOneField(
        BatchWeek, on_delete=models.CASCADE, related_name='weekly_test'
    )
    title           = models.CharField(_('Test Title'), max_length=255)
    instructions    = models.TextField(_('Instructions'), blank=True)
    answer_key      = models.FileField(
        _('Answer Key'), upload_to='batch_test_answer_keys/',
        null=True, blank=True,
        help_text=_('Upload answer key (PDF or .ipynb) for evaluation')
    )
    pass_percentage = models.FloatField(default=70.0)
    created_by      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_batch_tests'
    )
    updated_by      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_batch_tests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Batch Weekly Test')
        verbose_name_plural = _('Batch Weekly Tests')
        ordering            = ['batch_week__week_number']
        indexes             = [
            models.Index(fields=['batch_week'], name='bwtest_week_idx'),
        ]

    def __str__(self):
        return f"{self.batch_week.batch.name} – Week {self.batch_week.week_number} Test"


# Batch Test Question
class BatchTestQuestion(models.Model):
    """
    A question belonging to a BatchWeeklyTest.
    Fully independent from CourseTestQuestion.
    """
    test           = models.ForeignKey(
        BatchWeeklyTest, on_delete=models.CASCADE, related_name='questions'
    )
    text           = models.TextField(_('Question Text'), blank=True)
    question_file  = models.FileField(
        upload_to='test_questions/batch/files/',
        null=True, blank=True,
        help_text=_('Supported: .ipynb, .pdf, .doc, .docx, .jpg, .jpeg, .png')
    )
    image = models.ImageField(
        upload_to='test_questions/batch/images/',
        null=True, blank=True
    )
    order = models.PositiveIntegerField(_('Order'), default=1)
    marks = models.FloatField(_('Marks'), default=1.0)

    class Meta:
        ordering        = ['order', 'id']
        verbose_name        = _('Batch Test Question')
        verbose_name_plural = _('Batch Test Questions')

    def __str__(self):
        return f"Batch Q{self.order} for Test {self.test.id}"


# Course Test Question Attachment
class CourseTestQuestionAttachment(models.Model):
    """
    Allows multiple file attachments per course template question.
    Used when designing the master test (e.g. uploading datasets, PDFs).
    """
    question = models.ForeignKey(
        CourseTestQuestion, on_delete=models.CASCADE, related_name='attachments'
    )
    file = models.FileField(
        upload_to='test_questions/course/attachments/',
        help_text=_('Supported: .ipynb, .pdf, .xlsx, .csv, .doc, etc.')
    )
    name = models.CharField(max_length=255, blank=True, help_text=_('Optional file name/label'))

    class Meta:
        verbose_name        = _('Course Test Question Attachment')
        verbose_name_plural = _('Course Test Question Attachments')

    def __str__(self):
        return self.name or f"Attachment {self.id} for Course Q{self.question.id}"


# Batch Test Question Attachment
class BatchTestQuestionAttachment(models.Model):
    """
    Allows multiple file attachments per batch test question.
    Independent from CourseTestQuestionAttachment — edits here don't affect the template.
    """
    question = models.ForeignKey(
        BatchTestQuestion, on_delete=models.CASCADE, related_name='attachments'
    )
    file = models.FileField(
        upload_to='test_questions/batch/attachments/',
        help_text=_('Supported: .ipynb, .pdf, .xlsx, .csv, .doc, etc.')
    )
    name = models.CharField(max_length=255, blank=True, help_text=_('Optional file name/label'))

    class Meta:
        verbose_name        = _('Batch Test Question Attachment')
        verbose_name_plural = _('Batch Test Question Attachments')

    def __str__(self):
        return self.name or f"Attachment {self.id} for Batch Q{self.question.id}"


# Batch Test Submission
class TestSubmission(models.Model):
    class Status(models.TextChoices):
        PENDING         = 'pending',         _('Pending')
        EVALUATING      = 'evaluating',      _('Evaluating via AI')
        PENDING_REVIEW  = 'pending_review',  _('Pending Review')
        PUBLISHED       = 'published',       _('Published')
        RETURNED        = 'returned',        _('Returned')

    batch_weekly_test = models.ForeignKey(
        BatchWeeklyTest,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    enrollment   = models.ForeignKey(
        BatchEnrollment, on_delete=models.CASCADE, related_name='test_submissions'
    )
    attempt_number = models.PositiveSmallIntegerField(_('Attempt #'), default=1)

    submitted_at = models.DateTimeField(auto_now_add=True)

    # AI Evaluation
    ai_score = models.FloatField(null=True, blank=True)
    ai_feedback = models.TextField(blank=True)
    ai_response = models.JSONField(
        null=True,
        blank=True,
        help_text=_('Raw AI evaluation response')
    )
    ai_evaluated_at = models.DateTimeField(null=True, blank=True)

    # Grading
    marks_obtained = models.FloatField(
        _('Marks Obtained'), null=True, blank=True
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
        choices=Status.choices, default=Status.PENDING
    )

    class Meta:
        verbose_name        = _('Test Submission')
        verbose_name_plural = _('Test Submissions')
        unique_together     = ('batch_weekly_test', 'enrollment', 'attempt_number')
        ordering            = ['-submitted_at']
        indexes             = [
            models.Index(fields=['status'],            name='testsub_status_idx'),
            models.Index(fields=['is_passed'],         name='testsub_passed_idx'),
            models.Index(fields=['enrollment'],        name='testsub_enrollment_idx'),
            models.Index(fields=['batch_weekly_test'], name='testsub_bwtest_idx'),
        ]

    def __str__(self):
        return (
            f"{self.enrollment.student.fullname} | "
            f"Batch {self.batch_weekly_test.batch_week.batch.name} "
            f"W{self.batch_weekly_test.batch_week.week_number} | "
            f"Attempt {self.attempt_number}"
        )


# Batch Test Submission Answer
class TestSubmissionAnswer(models.Model):
    submission = models.ForeignKey(
        TestSubmission, on_delete=models.CASCADE, related_name='answers'
    )
    question = models.ForeignKey(
        BatchTestQuestion, on_delete=models.CASCADE, related_name='student_answers'
    )
    answer_file = models.FileField(
        upload_to='test_submissions/answers/',
        null=True, blank=True,
        help_text=_('Student upload: .ipynb or .pdf only (same as answer key).')
    )
    answer_text = models.TextField(
        _('Answer Text'), blank=True,
        help_text=_('For text-based answers')
    )
    
    # Per-question marking
    marks_obtained = models.FloatField(_('Marks Obtained'), null=True, blank=True)
    ai_score = models.FloatField(null=True, blank=True)
    ai_feedback = models.TextField(blank=True)
    ai_response = models.JSONField(
        null=True,
        blank=True,
        help_text=_('Raw AI evaluation response for this specific question')
    )

    class Meta:
        verbose_name = _('Test Submission Answer')
        verbose_name_plural = _('Test Submission Answers')
        unique_together = ('submission', 'question')

    def __str__(self):
        return f"Answer for Q{self.question.order} by {self.submission.enrollment.student.fullname}"


# Post-Session MCQ (In-Lesson Assessment)
class CoursePostSessionQuestion(models.Model):
    course_session = models.ForeignKey(
        CourseClassSession, on_delete=models.CASCADE, related_name='mcq_questions',
        null=True, blank=True
    )
    text = models.TextField(_('Question Text'))
    is_fill_in_the_blank = models.BooleanField(
        _('Fill in the Blank'), default=False,
        help_text=_('If True, it is a text match. If False, it uses Choices.')
    )
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order', 'id']
        verbose_name = _('Course Post-Session Question')
        verbose_name_plural = _('Course Post-Session Questions')

    def __str__(self):
        return f"Course MCQ Q{self.order} for Session {self.course_session_id}"


# Course Post-Session Choice
class CoursePostSessionChoice(models.Model):
    question = models.ForeignKey(
        CoursePostSessionQuestion, on_delete=models.CASCADE, related_name='choices'
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text


# Batch Post-Session Question
class BatchPostSessionQuestion(models.Model):
    batch_session = models.ForeignKey(
        BatchClassSession, on_delete=models.CASCADE, related_name='mcq_questions',
        null=True, blank=True
    )
    text = models.TextField(_('Question Text'))
    is_fill_in_the_blank = models.BooleanField(
        _('Fill in the Blank'), default=False,
        help_text=_('If True, it is a text match. If False, it uses Choices.')
    )
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order', 'id']
        verbose_name = _('Batch Post-Session Question')
        verbose_name_plural = _('Batch Post-Session Questions')

    def __str__(self):
        return f"Batch MCQ Q{self.order} for Session {self.batch_session_id}"


# Batch Post-Session Choice
class BatchPostSessionChoice(models.Model):
    question = models.ForeignKey(
        BatchPostSessionQuestion, on_delete=models.CASCADE, related_name='choices'
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text


# LiveSession
class LiveSession(models.Model):

    batch = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name='live_sessions',
        null=True, blank=True
    )

    title          = models.CharField(_('Title'), max_length=255)
    description    = models.TextField(blank=True)
    scheduled_at   = models.DateTimeField(_('Scheduled Start'))
    duration_mins  = models.PositiveSmallIntegerField(
        _('Planned Duration (mins)'), default=60
    )

    meeting_room = models.CharField(
        max_length=255,
        blank=True,
        help_text="Jitsi room name (auto-generated if empty)"
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

    def save(self, *args, **kwargs):
        if not self.meeting_room:
            import uuid
            batch_id = self.batch.id if self.batch else 'nobatch'
            unique_id = uuid.uuid4().hex[:8]
            self.meeting_room = f"batch-{batch_id}-{unique_id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"LIVE: {self.title} @ {self.scheduled_at:%Y-%m-%d %H:%M}"

    @property
    def end_time(self):
        return self.scheduled_at + timezone.timedelta(minutes=self.duration_mins)


# ScheduledWebinar
class ScheduledWebinar(models.Model):
    class SessionType(models.TextChoices):
        WEBINAR = "webinar", _("Webinar")
        SPECIAL_SESSION = "special_session", _("Special Session")

    batch         = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name='webinars'
    )
    title         = models.CharField(_('Webinar Title'), max_length=255)

    session_type  = models.CharField(
        _('Session Type'), max_length=20,
        choices=SessionType.choices, default=SessionType.WEBINAR
    )

    description   = models.TextField(blank=True)
    unlock_at  = models.DateTimeField(_('Unlock At'))
    duration_secs = models.PositiveIntegerField(
        _('Duration (secs)'), default=3600
    )
    video_file = models.CharField(
        _('Video Object Key'),
        max_length=1024,
        null=True, blank=True,
        help_text=_('Cloudflare R2 object key for the video')
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
        ordering            = ['unlock_at']

    def __str__(self):
        return f"Webinar: {self.title} [{self.batch.name}]"


# BatchChatMessage
class BatchChatMessage(models.Model):
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

    attachment      = models.FileField(
        upload_to='chat_attachments/', null=True, blank=True,
        help_text=_('Allowed: ppt, pptx, pdf, doc, docx, ipynb, jpg, jpeg')
    )
    attachment_name = models.CharField(max_length=255, blank=True)

    reply_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)

    sent_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = _('Batch Chat Message')
        verbose_name_plural = _('Batch Chat Messages')
        ordering            = ['sent_at']

    def __str__(self):
        sender_name = self.sender.fullname if self.sender else 'Unknown'
        preview = (self.message[:40] + '…') if len(self.message) > 40 else self.message
        return f"{sender_name} → {self.batch.name}: {preview}"


# Batch Chat Read Receipt
class BatchChatReadReceipt(models.Model):
    batch = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name='read_receipts'
    )
    user = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='chat_read_receipts'
    )
    last_read_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Batch Chat Read Receipt')
        verbose_name_plural = _('Batch Chat Read Receipts')
        unique_together     = ('batch', 'user')

    def __str__(self):
        return f"{self.user.fullname} read {self.batch.name} at {self.last_read_at}"

