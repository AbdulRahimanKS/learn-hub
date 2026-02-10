from rest_framework import serializers
from rest_framework import status
from utils.common import ServiceError

class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    expected_role = serializers.CharField(required=False, allow_blank=True)

class LoginResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField()
    data = serializers.DictField()

class RefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()

class MessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField()

class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise ServiceError(detail="Passwords do not match", status_code=status.HTTP_400_BAD_REQUEST)
        return attrs
