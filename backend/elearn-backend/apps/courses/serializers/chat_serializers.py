from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from apps.courses.models import BatchChatMessage
from apps.users.serializers.user_management_serializers import UserManagementSerializer
from rest_framework import status
from utils.common import ServiceError

class BatchChatMessageSerializer(serializers.ModelSerializer):
    sender = UserManagementSerializer(read_only=True)
    is_current_user = serializers.SerializerMethodField()

    class Meta:
        model = BatchChatMessage
        fields = [
            'id', 'batch', 'sender', 'live_session', 'message', 
            'attachment', 'attachment_name', 'reply_to',
            'is_edited', 'edited_at', 'sent_at', 'is_current_user'
        ]
        read_only_fields = ['sender', 'is_edited', 'edited_at', 'sent_at']

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_current_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False

    def validate_attachment(self, value):
        if value:
            max_size = 100 * 1024 * 1024  # 100MB
            if value.size > max_size:
                raise ServiceError(detail="File too large. Size should not exceed 100MB. Current size: {value.size / (1024*1024):.2f}MB", status_code=status.HTTP_400_BAD_REQUEST)
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['sender'] = request.user
        
        # If an attachment is uploaded but no name was provided, auto-fill it
        attachment = validated_data.get('attachment')
        if attachment and not validated_data.get('attachment_name'):
            validated_data['attachment_name'] = attachment.name
            
        return super().create(validated_data)
