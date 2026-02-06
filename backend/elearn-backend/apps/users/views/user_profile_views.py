"""
User Profile API Views using Django REST Framework Generic Views.
"""
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from drf_spectacular.utils import extend_schema, OpenApiResponse

from apps.users.models import User
from apps.users.serializers.user_profile_serializers import (
    UserProfileSerializer,
    UserProfileUpdateSerializer
)
from utils.permissions import IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
import logging

logger = logging.getLogger(__name__)


@extend_schema(tags=["User Profile"])
class UserProfileView(RetrieveUpdateAPIView):
    """
    API endpoint for authenticated users to view and update their own profile.
    
    GET: Retrieve the authenticated user's profile
    PUT/PATCH: Update the authenticated user's profile
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method in ['PUT', 'PATCH']:
            return UserProfileUpdateSerializer
        return UserProfileSerializer
    
    def get_object(self):
        """Return the authenticated user's profile."""
        return self.request.user
    
    @extend_schema(
        responses={
            200: UserProfileSerializer,
            401: OpenApiResponse(description="Unauthorized - User not authenticated"),
        },
        description="Retrieve the authenticated user's profile information."
    )
    def get(self, request, *args, **kwargs):
        """Retrieve user profile."""
        instance = self.get_object()
        serializer = UserProfileSerializer(instance)
        return format_success_response(
            message="Profile retrieved successfully",
            data=serializer.data
        )
    
    @extend_schema(
        request=UserProfileUpdateSerializer,
        responses={
            200: UserProfileSerializer,
            400: OpenApiResponse(description="Bad Request - Invalid data"),
            401: OpenApiResponse(description="Unauthorized - User not authenticated"),
        },
        description="Update the authenticated user's profile. Only fullname, phone_number_code, and contact_number can be updated."
    )
    def patch(self, request, *args, **kwargs):
        try:
            """Partially update user profile."""
            instance = self.get_object()
            serializer = UserProfileUpdateSerializer(instance, data=request.data, partial=True)
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=str(error_str), status_code=status.HTTP_400_BAD_REQUEST)

            serializer.save(updated_by=request.user)
            
            # Return full profile data
            response_serializer = UserProfileSerializer(instance)
            return format_success_response(
                message="Profile updated successfully",
                data=response_serializer.data
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error occurred: {e}")
            raise ServiceError(
                detail=f"{e}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    
    @extend_schema(
        request=UserProfileUpdateSerializer,
        responses={
            200: UserProfileSerializer,
            400: OpenApiResponse(description="Bad Request - Invalid data"),
            401: OpenApiResponse(description="Unauthorized - User not authenticated"),
        },
        description="Fully update the authenticated user's profile. Only fullname, phone_number_code, and contact_number can be updated."
    )
    def put(self, request, *args, **kwargs):
        try:
            """Fully update user profile."""
            instance = self.get_object()
            serializer = UserProfileUpdateSerializer(instance, data=request.data, partial=False)
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=str(error_str), status_code=status.HTTP_400_BAD_REQUEST)

            serializer.save(updated_by=request.user)
            
            # Return full profile data
            response_serializer = UserProfileSerializer(instance)
            return format_success_response(
                message="Profile updated successfully",
                data=response_serializer.data
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error occurred: {e}")
            raise ServiceError(
                detail=f"{e}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
