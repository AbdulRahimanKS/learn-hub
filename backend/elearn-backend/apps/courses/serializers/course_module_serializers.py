from rest_framework import serializers
from apps.courses.models import CourseWeek, ClassSession, WeeklyTest, WeeklyTestQuestion
from utils.common import ServiceError
from rest_framework import status


class ClassSessionSerializer(serializers.ModelSerializer):
    video_presigned_url = serializers.SerializerMethodField()

    class Meta:
        model = ClassSession
        fields = [
            'id', 'course_week', 'session_number', 'title', 'description', 
            'video_file', 'video_url', 'video_presigned_url', 'thumbnail', 'duration_mins', 
            'uploaded_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uploaded_by', 'created_at', 'updated_at']

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
        except Exception as e:
            return None

class CourseWeekSerializer(serializers.ModelSerializer):
    class_sessions = ClassSessionSerializer(many=True, read_only=True)
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
            return WeeklyTestSerializer(obj.weekly_test).data
        return None

class CourseWeekCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseWeek
        fields = [
            'id', 'week_number', 'title', 'description', 'is_published'
        ]

    def validate_week_number(self, value):
        if value <= 0:
            raise ServiceError(detail="Week number must be greater than 0.", status_code=status.HTTP_400_BAD_REQUEST)
        return value

class ClassSessionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSession
        fields = [
            'id', 'session_number', 'title', 'description', 
            'video_file', 'video_url', 'thumbnail', 'duration_mins'
        ]

    def validate_session_number(self, value):
        if value <= 0:
            raise ServiceError(detail="Session number must be greater than 0.", status_code=status.HTTP_400_BAD_REQUEST)
        return value

class WeeklyTestQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyTestQuestion
        fields = [
            'id', 'test', 'text', 'question_file', 'image', 'order', 'marks'
        ]
        read_only_fields = ['test']

class WeeklyTestSerializer(serializers.ModelSerializer):
    questions = WeeklyTestQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = WeeklyTest
        fields = [
            'id', 'course_week', 'title', 'instructions', 'pass_percentage', 
            'questions', 'created_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['course_week', 'created_by', 'updated_by', 'created_at', 'updated_at']

class WeeklyTestCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyTest
        fields = [
            'id', 'title', 'instructions', 'pass_percentage'
        ]
