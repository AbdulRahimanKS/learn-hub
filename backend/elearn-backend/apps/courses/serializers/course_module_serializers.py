from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from apps.courses.models import (
    CourseWeek, CourseClassSession, BatchClassSession,
    CourseWeeklyTest, CourseTestQuestion, CourseTestQuestionAttachment,
    BatchWeeklyTest, BatchTestQuestion, BatchTestQuestionAttachment,
    BatchWeek,
    CoursePostSessionQuestion, CoursePostSessionChoice,
    BatchPostSessionQuestion, BatchPostSessionChoice
)
from utils.common import ServiceError
from rest_framework import status

ALLOWED_ANSWER_KEY_EXTENSIONS = ('.pdf', '.ipynb')


class CoursePostSessionChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoursePostSessionChoice
        fields = ['id', 'question', 'text', 'is_correct']
        read_only_fields = ['question']

class CoursePostSessionQuestionSerializer(serializers.ModelSerializer):
    choices = CoursePostSessionChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = CoursePostSessionQuestion
        fields = ['id', 'course_session', 'text', 'is_fill_in_the_blank', 'order', 'choices']
        read_only_fields = ['course_session']

class CourseClassSessionSerializer(serializers.ModelSerializer):
    video_presigned_url = serializers.SerializerMethodField()
    mcq_questions = CoursePostSessionQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CourseClassSession
        fields = [
            'id', 'course_week', 'session_number', 'title', 'description', 'weekday',
            'video_file', 'video_presigned_url', 'thumbnail', 'duration_seconds',
            'mcq_questions', 'uploaded_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uploaded_by', 'updated_by', 'created_at', 'updated_at']

    @extend_schema_field(OpenApiTypes.URI)
    def get_video_presigned_url(self, obj):
        if not obj.video_file:
            return None
        try:
            from django.conf import settings
            import boto3
            s3_client = boto3.client(
                's3',
                endpoint_url=settings.AWS_S3_ENDPOINT_URL,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'auto'),
            )
            url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': obj.video_file
                },
                ExpiresIn=14400  # 4 hours
            )
            return url
        except Exception:
            return None


class BatchPostSessionChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchPostSessionChoice
        fields = ['id', 'question', 'text', 'is_correct']
        read_only_fields = ['question']

class BatchPostSessionQuestionSerializer(serializers.ModelSerializer):
    choices = BatchPostSessionChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = BatchPostSessionQuestion
        fields = ['id', 'batch_session', 'text', 'is_fill_in_the_blank', 'order', 'choices']
        read_only_fields = ['batch_session']

class BatchClassSessionSerializer(serializers.ModelSerializer):
    video_presigned_url = serializers.SerializerMethodField()
    mcq_questions = BatchPostSessionQuestionSerializer(many=True, read_only=True)
    is_completed = serializers.SerializerMethodField()
    has_mcq = serializers.SerializerMethodField()

    class Meta:
        model = BatchClassSession
        fields = [
            'id', 'batch_week', 'session_number', 'title', 'description', 'weekday',
            'video_file', 'video_presigned_url', 'thumbnail', 'duration_seconds',
            'mcq_questions', 'is_completed', 'has_mcq', 'uploaded_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uploaded_by', 'updated_by', 'created_at', 'updated_at']

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        from apps.courses.models import BatchEnrollment, StudentSessionView
        enrollment = BatchEnrollment.objects.filter(student=request.user, batch=obj.batch_week.batch).first()
        if not enrollment:
            return False
            
        view = StudentSessionView.objects.filter(enrollment=enrollment, batch_session=obj).first()
        return view.is_completed if view else False

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_has_mcq(self, obj):
        return obj.mcq_questions.exists()

    @extend_schema_field(OpenApiTypes.URI)
    def get_video_presigned_url(self, obj):
        if not obj.video_file:
            return None
        try:
            from django.conf import settings
            import boto3
            s3_client = boto3.client(
                's3',
                endpoint_url=settings.AWS_S3_ENDPOINT_URL,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'auto'),
            )
            url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': obj.video_file
                },
                ExpiresIn=14400
            )
            return url
        except Exception:
            return None


class CourseWeekSerializer(serializers.ModelSerializer):
    class_sessions = CourseClassSessionSerializer(many=True, read_only=True)
    weekly_test = serializers.SerializerMethodField()

    class Meta:
        model = CourseWeek
        fields = [
            'id', 'course', 'week_number', 'title', 'description', 
            'is_published', 'class_sessions', 'weekly_test', 'created_by', 'updated_by', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'updated_by', 'created_at', 'updated_at']

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_weekly_test(self, obj):
        if hasattr(obj, 'weekly_test') and obj.weekly_test:
            return CourseWeeklyTestSerializer(obj.weekly_test, context=self.context).data
        return None


class BatchWeekSerializer(serializers.ModelSerializer):
    class_sessions = BatchClassSessionSerializer(many=True, read_only=True)
    weekly_test = serializers.SerializerMethodField()
    is_unlocked = serializers.SerializerMethodField()
    can_modify_content = serializers.SerializerMethodField()
    student_lock_status = serializers.SerializerMethodField()

    class Meta:
        model = BatchWeek
        fields = [
            'id', 'batch', 'week_number', 'title', 'description', 
            'unlock_date', 'is_extended', 'is_unlocked', 'student_lock_status', 'is_published', 
            'can_modify_content', 'class_sessions', 'weekly_test', 'created_at', 'updated_at'
        ]

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_unlocked(self, obj):
        return obj.is_unlocked

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_can_modify_content(self, obj):
        return obj.can_modify_content

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_weekly_test(self, obj):
        if hasattr(obj, 'weekly_test') and obj.weekly_test:
            return BatchWeeklyTestSerializer(obj.weekly_test, context=self.context).data
        return None

    @extend_schema_field(serializers.DictField())
    def get_student_lock_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {'is_locked': True, 'reason': 'authentication_required'}
            
        from apps.users.models import User
        from apps.courses.models import BatchEnrollment, TestSubmission
        
        # Admin or Teacher can see everything
        if request.user.user_type.name in ('ADMIN', 'TEACHER'):
            return {'is_locked': False, 'reason': None}

        enrollment = BatchEnrollment.objects.filter(student=request.user, batch=obj.batch).first()
        if not enrollment:
            return {'is_locked': True, 'reason': 'not_enrolled'}

        # 1. Manual Unlock Override
        # Check if this specific week is manually unlocked for this student
        from apps.courses.models import ManualStudentWeekUnlock
        if ManualStudentWeekUnlock.objects.filter(enrollment=enrollment, batch_week=obj).exists():
            return {'is_locked': False, 'reason': 'manual_unlock'}

        # 2. Calendar Check
        if not obj.is_unlocked:
            return {'is_locked': True, 'reason': 'date_locked', 'unlock_date': obj.unlock_date}

        # 2. Previous Week Completion Check (All preceding weeks)
        if obj.week_number > 1:
            # Check all preceding weeks
            prev_weeks = obj.batch.batch_weeks.filter(
                week_number__lt=obj.week_number
            ).order_by('week_number')
            
            from apps.courses.models import BatchClassSession, StudentSessionView
            
            for pw in prev_weeks:
                # A. Check Video Sessions
                total_sessions = BatchClassSession.objects.filter(batch_week=pw).count()
                if total_sessions > 0:
                    completed_sessions = StudentSessionView.objects.filter(
                        enrollment=enrollment,
                        batch_session__batch_week=pw,
                        is_completed=True
                    ).count()
                    
                    if completed_sessions < total_sessions:
                        return {'is_locked': True, 'reason': 'previous_sessions_not_completed'}

                # B. Check Assessment (if exists)
                if hasattr(pw, 'weekly_test') and pw.weekly_test:
                    passed = TestSubmission.objects.filter(
                        enrollment=enrollment,
                        batch_weekly_test=pw.weekly_test,
                        status='published',
                        is_passed=True
                    ).exists()
                    
                    if not passed:
                        return {'is_locked': True, 'reason': 'previous_test_not_passed'}

        return {'is_locked': False, 'reason': None}


class BatchWeekCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchWeek
        fields = [
            'id', 'week_number', 'title', 'description', 'unlock_date', 'is_extended'
        ]


class CourseWeekCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseWeek
        fields = [
            'id', 'week_number', 'title', 'description'
        ]

    def validate_week_number(self, value):
        if value <= 0:
            raise ServiceError(detail="Week number must be greater than 0.", status_code=status.HTTP_400_BAD_REQUEST)
        return value


class CourseClassSessionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseClassSession
        fields = [
            'id', 'session_number', 'title', 'description', 'weekday',
            'video_file', 'thumbnail', 'duration_seconds'
        ]

    def validate_session_number(self, value):
        if value <= 0:
            raise ServiceError(detail="Session number must be greater than 0.", status_code=status.HTTP_400_BAD_REQUEST)
        return value


class BatchClassSessionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchClassSession
        fields = [
            'id', 'session_number', 'title', 'description', 'weekday',
            'video_file', 'thumbnail', 'duration_seconds'
        ]

    def validate_session_number(self, value):
        if value <= 0:
            raise ServiceError(detail="Session number must be greater than 0.", status_code=status.HTTP_400_BAD_REQUEST)
        return value


class CourseTestQuestionAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseTestQuestionAttachment
        fields = ['id', 'question', 'file', 'name']
        read_only_fields = ['question']


class BatchTestQuestionAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchTestQuestionAttachment
        fields = ['id', 'question', 'file', 'name']
        read_only_fields = ['question']


# Legacy alias
TestQuestionAttachmentSerializer = CourseTestQuestionAttachmentSerializer


class CourseTestQuestionSerializer(serializers.ModelSerializer):
    attachments = CourseTestQuestionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = CourseTestQuestion
        fields = [
            'id', 'test', 'text', 'question_file', 'image', 'order', 'marks', 'attachments'
        ]
        read_only_fields = ['test']


class CourseWeeklyTestSerializer(serializers.ModelSerializer):
    questions = CourseTestQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CourseWeeklyTest
        fields = [
            'id', 'course_week', 'title', 'instructions', 'pass_percentage',
            'answer_key', 'questions', 'created_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['course_week', 'created_by', 'updated_by', 'created_at', 'updated_at']


class CourseWeeklyTestCreateUpdateSerializer(serializers.ModelSerializer):
    def validate_answer_key(self, value):
        if not value:
            return value

        file_name = getattr(value, 'name', '') or ''
        lower_name = file_name.lower()
        if not lower_name.endswith(ALLOWED_ANSWER_KEY_EXTENSIONS):
            raise ServiceError(detail="Answer key must be a PDF or .ipynb file.", status_code=status.HTTP_400_BAD_REQUEST)
        return value

    class Meta:
        model = CourseWeeklyTest
        fields = ['id', 'title', 'instructions', 'pass_percentage', 'answer_key']


# ── Batch-level ──────────────────────────────────────────────────────────────

class BatchTestQuestionSerializer(serializers.ModelSerializer):
    attachments = BatchTestQuestionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = BatchTestQuestion
        fields = [
            'id', 'test', 'text', 'question_file', 'image', 'order', 'marks', 'attachments'
        ]
        read_only_fields = ['test']


class BatchWeeklyTestSerializer(serializers.ModelSerializer):
    questions = BatchTestQuestionSerializer(many=True, read_only=True)
    is_passed = serializers.SerializerMethodField()
    has_attempted = serializers.SerializerMethodField()
    latest_submission = serializers.SerializerMethodField()

    class Meta:
        model = BatchWeeklyTest
        fields = [
            'id', 'batch_week', 'title', 'instructions', 'pass_percentage',
            'answer_key', 'questions', 'is_passed', 'has_attempted', 'latest_submission',
            'created_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['batch_week', 'created_by', 'updated_by', 'created_at', 'updated_at']

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_latest_submission(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
            
        from apps.courses.models import BatchEnrollment, TestSubmission
        from apps.courses.serializers.test_submission_serializers import TestSubmissionSerializer

        enrollment = BatchEnrollment.objects.filter(student=request.user, batch=obj.batch_week.batch).first()
        if not enrollment:
            return None
            
        submission = TestSubmission.objects.filter(
            enrollment=enrollment,
            batch_weekly_test=obj
        ).order_by('-submitted_at').first()
        
        if submission:
            return TestSubmissionSerializer(submission, context=self.context).data
        return None

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_passed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        from apps.courses.models import BatchEnrollment, TestSubmission
        enrollment = BatchEnrollment.objects.filter(student=request.user, batch=obj.batch_week.batch).first()
        if not enrollment:
            return False
            
        return TestSubmission.objects.filter(
            enrollment=enrollment,
            batch_weekly_test=obj,
            status='published',
            is_passed=True
        ).exists()

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_has_attempted(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        from apps.courses.models import BatchEnrollment, TestSubmission
        enrollment = BatchEnrollment.objects.filter(student=request.user, batch=obj.batch_week.batch).first()
        if not enrollment:
            return False
            
        return TestSubmission.objects.filter(
            enrollment=enrollment,
            batch_weekly_test=obj
        ).exists()


class BatchWeeklyTestCreateUpdateSerializer(serializers.ModelSerializer):
    def validate_answer_key(self, value):
        if not value:
            return value

        file_name = getattr(value, 'name', '') or ''
        lower_name = file_name.lower()
        if not lower_name.endswith(ALLOWED_ANSWER_KEY_EXTENSIONS):
            raise ServiceError(detail="Answer key must be a PDF or .ipynb file.", status_code=status.HTTP_400_BAD_REQUEST)
        return value

    class Meta:
        model = BatchWeeklyTest
        fields = ['id', 'title', 'instructions', 'pass_percentage', 'answer_key']


# Legacy aliases kept for backward compat during transition (will remove later)
WeeklyTestQuestionSerializer = CourseTestQuestionSerializer
WeeklyTestSerializer = CourseWeeklyTestSerializer
WeeklyTestCreateUpdateSerializer = CourseWeeklyTestCreateUpdateSerializer
