from rest_framework import serializers
from apps.courses.models import CourseWeek, ClassSession
from utils.common import ServiceError
from rest_framework import status


class ClassSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSession
        fields = [
            'id', 'course_week', 'session_number', 'title', 'description', 
            'video_file', 'video_url', 'thumbnail', 'duration_mins', 
            'uploaded_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uploaded_by', 'created_at', 'updated_at']

class CourseWeekSerializer(serializers.ModelSerializer):
    class_sessions = ClassSessionSerializer(many=True, read_only=True)

    class Meta:
        model = CourseWeek
        fields = [
            'id', 'course', 'week_number', 'title', 'description', 
            'is_published', 'class_sessions', 'created_by', 'updated_by', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'updated_by', 'created_at', 'updated_at']

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
