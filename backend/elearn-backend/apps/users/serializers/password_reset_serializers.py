from rest_framework import serializers, status
from django.contrib.auth.password_validation import validate_password
from utils.common import ServiceError

class RequestPasswordResetSerializer(serializers.Serializer):
    """Serializer for requesting password reset OTP"""
    email = serializers.EmailField()


class VerifyOTPSerializer(serializers.Serializer):
    """Serializer for verifying OTP"""
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for resetting password with OTP"""
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise ServiceError(detail="Password fields didn't match", status_code=status.HTTP_400_BAD_REQUEST)
        return attrs
