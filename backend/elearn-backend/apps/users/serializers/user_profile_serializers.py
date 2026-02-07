"""
Serializers for User Profile API.
"""
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from apps.users.models import User, UserType, Profile
from utils.common import ServiceError
from rest_framework import status


class UserTypeSerializer(serializers.ModelSerializer):
    """Nested serializer for UserType."""
    class Meta:
        model = UserType
        fields = ['name', 'description']


class ProfileSerializer(serializers.ModelSerializer):
    """Nested serializer for Profile model."""
    class Meta:
        model = Profile
        fields = ['address', 'date_of_birth', 'profile_picture', 'bio']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing user profile.
    Includes both User and Profile model fields.
    """
    user_type = UserTypeSerializer(read_only=True)
    role = serializers.SerializerMethodField()
    profile = ProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'user_code',
            'email',
            'fullname',
            'phone_number_code',
            'contact_number',
            'user_type',
            'role',
            'profile',
            'created_at',
            'is_active',
        ]
        read_only_fields = [
            'user_code',
            'email',
            'created_at',
            'is_active',
        ]
    
    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_role(self, obj):
        """Return the user's role name."""
        return obj.user_type.name if obj.user_type else None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile.
    Allows updating both User and Profile model fields.
    """
    # Profile fields as direct fields on the serializer
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    bio = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = User
        fields = [
            'fullname',
            'phone_number_code',
            'contact_number',
            # Profile fields
            'address',
            'date_of_birth',
            'profile_picture',
            'bio',
        ]
    
    def validate_fullname(self, value):
        """Validate fullname is not empty."""
        if not value or not value.strip():
            raise ServiceError(detail="Full name cannot be empty", status_code=status.HTTP_400_BAD_REQUEST)
        return value.strip()
    
    def validate_contact_number(self, value):
        """Validate contact number format if provided."""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise ServiceError(detail="Contact number must contain only digits, spaces, hyphens, or plus sign", status_code=status.HTTP_400_BAD_REQUEST)
        return value
    
    def update(self, instance, validated_data):
        """
        Update both User and Profile models.
        Extract profile fields and update them separately.
        """
        # Extract profile-related fields
        profile_fields = {
            'address': validated_data.pop('address', None),
            'date_of_birth': validated_data.pop('date_of_birth', None),
            'profile_picture': validated_data.pop('profile_picture', None),
            'bio': validated_data.pop('bio', None),
        }
        
        # Update User model fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update Profile model fields
        profile = instance.profile
        for attr, value in profile_fields.items():
            if value is not None:  # Only update if value is provided
                setattr(profile, attr, value)
        profile.save()
        
        return instance
