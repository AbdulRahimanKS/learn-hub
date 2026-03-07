from rest_framework import serializers
from apps.courses.models import (
    CourseWeek, CourseClassSession, BatchClassSession,
    CourseWeeklyTest, CourseTestQuestion, CourseTestQuestionAttachment,
    BatchWeeklyTest, BatchTestQuestion, BatchTestQuestionAttachment,
    BatchWeek,
    PostSessionQuestion, PostSessionChoice
)
from utils.common import ServiceError
from rest_framework import status


class PostSessionChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostSessionChoice
        fields = ['id', 'question', 'text', 'is_correct']
        read_only_fields = ['question']

class PostSessionQuestionSerializer(serializers.ModelSerializer):
    choices = PostSessionChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = PostSessionQuestion
        fields = ['id', 'course_session', 'text', 'is_fill_in_the_blank', 'order', 'choices']
        read_only_fields = ['course_session']

class CourseClassSessionSerializer(serializers.ModelSerializer):
    video_presigned_url = serializers.SerializerMethodField()
    mcq_questions = PostSessionQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CourseClassSession
        fields = [
            'id', 'course_week', 'session_number', 'title', 'description', 'weekday',
            'video_file', 'video_presigned_url', 'thumbnail', 'duration_seconds',
            'mcq_questions', 'uploaded_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uploaded_by', 'updated_by', 'created_at', 'updated_at']

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


class BatchClassSessionSerializer(serializers.ModelSerializer):
    video_presigned_url = serializers.SerializerMethodField()

    class Meta:
        model = BatchClassSession
        fields = [
            'id', 'batch_week', 'session_number', 'title', 'description', 'weekday',
            'video_file', 'video_presigned_url', 'thumbnail', 'duration_seconds',
            'uploaded_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uploaded_by', 'updated_by', 'created_at', 'updated_at']

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

    def get_weekly_test(self, obj):
        if hasattr(obj, 'weekly_test') and obj.weekly_test:
            return CourseWeeklyTestSerializer(obj.weekly_test).data
        return None


class BatchWeekSerializer(serializers.ModelSerializer):
    class_sessions = BatchClassSessionSerializer(many=True, read_only=True)
    weekly_test = serializers.SerializerMethodField()
    is_unlocked = serializers.ReadOnlyField()

    class Meta:
        model = BatchWeek
        fields = [
            'id', 'batch', 'week_number', 'title', 'description', 
            'unlock_date', 'is_extended', 'is_unlocked', 'is_published', 
            'class_sessions', 'weekly_test', 'created_at', 'updated_at'
        ]

    def get_weekly_test(self, obj):
        if hasattr(obj, 'weekly_test') and obj.weekly_test:
            return BatchWeeklyTestSerializer(obj.weekly_test).data
        return None


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

    class Meta:
        model = BatchWeeklyTest
        fields = [
            'id', 'batch_week', 'title', 'instructions', 'pass_percentage',
            'answer_key', 'questions', 'created_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['batch_week', 'created_by', 'updated_by', 'created_at', 'updated_at']


class BatchWeeklyTestCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchWeeklyTest
        fields = ['id', 'title', 'instructions', 'pass_percentage', 'answer_key']


# Legacy aliases kept for backward compat during transition (will remove later)
WeeklyTestQuestionSerializer = CourseTestQuestionSerializer
WeeklyTestSerializer = CourseWeeklyTestSerializer
WeeklyTestCreateUpdateSerializer = CourseWeeklyTestCreateUpdateSerializer
