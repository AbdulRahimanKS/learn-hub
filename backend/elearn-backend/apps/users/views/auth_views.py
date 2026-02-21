from apps.users.models import User
from utils.common import ServiceError, format_success_response
from apps.users.serializers.auth_serializers import (
    LoginRequestSerializer, LoginResponseSerializer, 
    MessageResponseSerializer, RefreshRequestSerializer,
    ChangePasswordSerializer
)
import logging
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


@extend_schema(
    tags=['Auth Management'],
    summary="User Login",
    description="Authenticates user using email and password.",
    request=LoginRequestSerializer,
    responses={
        200: LoginResponseSerializer,
        401: MessageResponseSerializer,
        403: MessageResponseSerializer,
    }
)
class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginRequestSerializer

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(
                detail=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data.get("email").lower()
        password = serializer.validated_data.get("password")
        expected_role = serializer.validated_data.get("expected_role", "")

        try:
            user = User.objects.filter(email=email).first()
            if not user:
                raise ServiceError(
                    detail="Email not found",
                    status_code=status.HTTP_401_UNAUTHORIZED
                )

            if not user.check_password(password):
                raise ServiceError(
                    detail="Invalid credentials",
                    status_code=status.HTTP_401_UNAUTHORIZED
                )

            if not user.is_active:
                raise ServiceError(
                    detail="Account is disabled",
                    status_code=status.HTTP_401_UNAUTHORIZED
                )

            if expected_role:
                user_role = user.user_type.name if user.user_type else None
                if user_role != expected_role:
                    raise ServiceError(
                        detail=f"These are not valid {expected_role.lower()} credentials",
                        status_code=status.HTTP_401_UNAUTHORIZED
                    )

            refresh = RefreshToken.for_user(user)
            
            user_data = {
                "user_code": user.user_code,
                "email": user.email,
                "fullname": user.fullname,
                "role": user.user_type.name if user.user_type else None,
                "access": str(refresh.access_token),
                "refresh": str(refresh)
            }

            return format_success_response(
                data=user_data,
                message="Login successful",
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error occurred: {e}")
            raise ServiceError(
                detail="An unexpected error occurred",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(
    tags=['Auth Management'],
    summary="User Logout",
    description="Stateless logout (client should delete tokens).",
    request=None,
    responses={200: MessageResponseSerializer}
)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return format_success_response(message="Logout successful")


@extend_schema(
    tags=['Auth Management'],
    summary="Token Refresh",
    description="Uses refresh token from body to issue a new access token.",
    request=RefreshRequestSerializer,
    responses={
        200: LoginResponseSerializer,
        401: MessageResponseSerializer
    }
)
class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RefreshRequestSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(
                detail="Refresh token required",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        refresh_token = serializer.validated_data.get("refresh")
        try:
            refresh = RefreshToken(refresh_token)
            return format_success_response(
                message="Token refreshed",
                data={
                    "access": str(refresh.access_token)
                }
            )
        except Exception:
            raise ServiceError(
                detail="Invalid refresh token",
                status_code=status.HTTP_401_UNAUTHORIZED
            )


@extend_schema(
    tags=['Auth Management'],
    summary="Change Password",
    description="Allows authenticated users to change their password.",
    request=ChangePasswordSerializer,
    responses={
        200: MessageResponseSerializer,
        400: MessageResponseSerializer,
        401: MessageResponseSerializer,
    }
)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            serializer = ChangePasswordSerializer(data=request.data)
            if not serializer.is_valid():
                raise ServiceError(
                    detail=serializer.errors,
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            user = request.user
            current_password = serializer.validated_data.get('current_password')
            new_password = serializer.validated_data.get('new_password')

            if not user.check_password(current_password):
                raise ServiceError(
                    detail="Current password is incorrect",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            if current_password == new_password:
                raise ServiceError(
                    detail="New password must be different from current password",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            user.set_password(new_password)
            user.save()

            return format_success_response(
                message="Password changed successfully"
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error occurred: {e}")
            raise ServiceError(
                detail="An unexpected error occurred",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

