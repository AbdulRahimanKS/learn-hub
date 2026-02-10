from rest_framework import serializers
from apps.users.models import EmailSetting
from utils.common import ServiceError
from rest_framework import status


class EmailSettingSerializer(serializers.ModelSerializer):
    """
    Serializer for EmailSetting model.
    Handles both SMTP and Outlook configurations.
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
            'client_id',
            'client_secret',
            'tenant_id',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'email_password': {'write_only': True},
            'client_secret': {'write_only': True},
        }
    
    def validate(self, attrs):
        email_type = attrs.get('email_type')
        
        # Validate SMTP configuration
        if email_type == 'smtp':
            required_fields = ['email_host', 'email_port', 'email_user', 'email_password']
            for field in required_fields:
                if not attrs.get(field):
                    raise ServiceError(
                        detail=f"{field.replace('_', ' ').title()} is required for SMTP configuration",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
        
        # Validate Outlook configuration
        elif email_type == 'outlook':
            required_fields = ['client_id', 'client_secret', 'tenant_id']
            for field in required_fields:
                if not attrs.get(field):
                    raise ServiceError(
                        detail=f"{field.replace('_', ' ').title()} is required for Outlook configuration",
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
            'client_id',
            'tenant_id',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
