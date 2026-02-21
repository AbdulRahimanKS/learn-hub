from rest_framework import serializers
from apps.users.models import EmailSetting
from utils.common import ServiceError
from rest_framework import status


class EmailSettingSerializer(serializers.ModelSerializer):
    """
    Serializer for EmailSetting model.
    Handles SMTP configuration.
    """
    
    class Meta:
        model = EmailSetting
        fields = [
            'id',
            'email',
            'email_type',
            'email_host',
            'email_port',
            'email_user',
            'email_password',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'email_password': {'write_only': True},
        }
    
    def validate(self, attrs):
        email_type = attrs.get('email_type', 'smtp')
        
        # Validate SMTP configuration
        if email_type == 'smtp':
            required_fields = ['email_host', 'email_port', 'email_user', 'email_password']
            for field in required_fields:
                if not attrs.get(field):
                    raise ServiceError(
                        detail=f"{field.replace('_', ' ').title()} is required for SMTP configuration",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
        
        return attrs


class EmailSettingResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer that excludes sensitive information.
    """
    
    class Meta:
        model = EmailSetting
        fields = [
            'id',
            'email',
            'email_type',
            'email_host',
            'email_port',
            'email_user',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
