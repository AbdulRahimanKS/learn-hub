"""
Serializers for Admin User Management.
Handles creation and updating of Student and Teacher accounts.
"""
from rest_framework import serializers
from rest_framework import status
from apps.users.models import User, UserType, Profile
from utils.common import ServiceError
from utils.constants import UserTypeConstants


class UserManagementSerializer(serializers.ModelSerializer):
    """Serializer for listing users (admin view)."""
    role = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'user_code',
            'email',
            'fullname',
            'phone_number_code',
            'contact_number',
            'role',
            'is_active',
            'profile_picture',
            'created_at',
        ]

    def get_role(self, obj):
        return obj.user_type.name if obj.user_type else None

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        try:
            pic = obj.profile.profile_picture
            if pic and request:
                return request.build_absolute_uri(pic.url)
        except Exception:
            pass
        return None


class UserCreateSerializer(serializers.Serializer):
    """Serializer for creating a new Teacher or Student account."""
    fullname = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=[UserTypeConstants.TEACHER, UserTypeConstants.STUDENT])
    phone_number_code = serializers.CharField(max_length=10)
    contact_number = serializers.CharField(max_length=20)

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ServiceError(
                detail="A user with this email already exists.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        return email

    def validate_fullname(self, value):
        if not value.strip():
            raise ServiceError(
                detail="Full name cannot be empty.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        return value.strip()

    def validate(self, attrs):
        code = attrs.get('phone_number_code', '').strip()
        number = attrs.get('contact_number', '').strip()
        if not code:
            raise ServiceError(
                detail="Phone number code is required.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        if not number:
            raise ServiceError(
                detail="Contact number is required.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(
            phone_number_code=code,
            contact_number=number,
        ).exists():
            raise ServiceError(
                detail="A user with this phone number already exists.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        attrs['phone_number_code'] = code
        attrs['contact_number'] = number
        return attrs


class UserUpdateSerializer(serializers.Serializer):
    """Serializer for updating an existing user account."""
    fullname = serializers.CharField(max_length=255, required=False)
    phone_number_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)

    def validate_fullname(self, value):
        if value is not None and not value.strip():
            raise ServiceError(
                detail="Full name cannot be empty.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        return value.strip() if value else value

    def validate(self, attrs):
        code = attrs.get('phone_number_code', '').strip()
        number = attrs.get('contact_number', '').strip()

        if code and number:
            user_instance = self.context.get('user_instance')
            qs = User.objects.filter(
                phone_number_code=code,
                contact_number=number,
            )
            if user_instance:
                qs = qs.exclude(pk=user_instance.pk)
            if qs.exists():
                raise ServiceError(
                    detail="Another user with this phone number already exists.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        if code:
            attrs['phone_number_code'] = code
        if number:
            attrs['contact_number'] = number
        return attrs
