from rest_framework import serializers
from apps.courses.models import LiveSession
from apps.users.serializers.user_management_serializers import UserManagementSerializer

class LiveSessionSerializer(serializers.ModelSerializer):
    hosted_by_details = UserManagementSerializer(source='hosted_by', read_only=True)
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
        read_only_fields = ['id', 'created_at', 'updated_at', 'end_time']
        extra_kwargs = {
            'meeting_room': {'required': False},
        }

    def get_is_live(self, obj):
        from django.utils import timezone
        now = timezone.now()
        return obj.scheduled_at <= now <= obj.end_time

    def get_can_join(self, obj):
        from django.utils import timezone
        now = timezone.now()
        # Allow joining 5 minutes before and up to the end time
        return (obj.scheduled_at - timezone.timedelta(minutes=5)) <= now <= obj.end_time
