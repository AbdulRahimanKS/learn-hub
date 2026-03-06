from rest_framework import serializers
from apps.users.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'action_url', 'content_type', 'object_id', 'is_read', 'created_at']
        read_only_fields = ['id', 'title', 'message', 'notification_type', 'action_url', 'content_type', 'object_id', 'created_at']

    def update(self, instance, validated_data):
        instance.is_read = validated_data.get('is_read', instance.is_read)
        instance.save()
        return instance
