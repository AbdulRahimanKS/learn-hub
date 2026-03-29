from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from django.utils import timezone
from rest_framework import serializers
from apps.courses.models import LiveSession
from apps.users.serializers.user_management_serializers import UserManagementSerializer


class LiveSessionSerializer(serializers.ModelSerializer):
    hosted_by_details = UserManagementSerializer(source='hosted_by', read_only=True)
    end_time = serializers.SerializerMethodField()
    is_live = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()

    class Meta:
        model = LiveSession
        fields = [
            'id', 'batch', 'title', 'description', 
            'scheduled_at', 'duration_mins', 'end_time',
            'meeting_room', 'hosted_by', 'hosted_by_details',
            'is_live', 'can_join', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'meeting_room': {'required': False},
        }

    @extend_schema_field(OpenApiTypes.DATETIME)
    def get_end_time(self, obj):
        return obj.end_time

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_live(self, obj):
        now = timezone.now()
        return obj.scheduled_at <= now <= obj.end_time

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_can_join(self, obj):
        now = timezone.now()
        return (obj.scheduled_at - timezone.timedelta(minutes=5)) <= now <= obj.end_time
