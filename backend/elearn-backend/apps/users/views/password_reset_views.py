from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse

from apps.users.models import User, PasswordResetOTP
from apps.users.serializers.password_reset_serializers import (
    RequestPasswordResetSerializer,
    VerifyOTPSerializer,
    ResetPasswordSerializer
)
from utils.common import format_success_response
from utils.exceptions import ServiceError
from utils.email_utils import send_email


@extend_schema(tags=["Password Reset"])
class RequestPasswordResetView(APIView):
    """
    API endpoint to request password reset OTP.
    Sends a 6-digit OTP to the user's email.
    """
    permission_classes = [AllowAny]
    serializer_class = RequestPasswordResetSerializer

    @extend_schema(
        request=RequestPasswordResetSerializer,
        responses={
            200: OpenApiResponse(description="OTP sent successfully"),
            400: OpenApiResponse(description="Invalid email"),
            404: OpenApiResponse(description="User not found"),
        },
        description="Request password reset OTP. Sends a 6-digit code to the user's email."
    )
    def post(self, request):
        serializer = RequestPasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(
                detail=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data.get('email').lower()

        try:
            user = User.objects.filter(email=email, is_deleted=False).first()
            if not user:
                raise ServiceError(
                    detail="No account found with this email address",
                    status_code=status.HTTP_404_NOT_FOUND
                )

            if not user.is_active:
                raise ServiceError(
                    detail="This account is disabled",
                    status_code=status.HTTP_403_FORBIDDEN
                )

            # Delete any existing unused OTPs for this user to prevent data accumulation
            PasswordResetOTP.objects.filter(
                user=user
            ).delete()

            # Generate new OTP
            otp_code = PasswordResetOTP.generate_otp()
            
            # Create OTP record
            PasswordResetOTP.objects.create(
                user=user,
                email=email,
                otp=otp_code
            )

            # Prepare email context
            email_context = {
                'user_name': user.fullname,
                'email': email,
                'otp': otp_code,
                'validity_minutes': 10,
            }

            # Send email using existing utility
            send_email(
                user=user,
                subject="Password Reset OTP - LearnHub",
                template="emails/password_reset_otp",
                to_emails=email,
                payload=email_context,
                async_send=True
            )

            return format_success_response(
                message="Password reset OTP has been sent to your email",
                data={
                    "email": email,
                    "expires_in_minutes": 10
                }
            )

        except ServiceError:
            raise
        except Exception as e:
            raise ServiceError(
                detail=f"Failed to send OTP: {str(e)}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(tags=["Password Reset"])
class VerifyOTPView(APIView):
    """
    API endpoint to verify password reset OTP.
    """
    permission_classes = [AllowAny]
    serializer_class = VerifyOTPSerializer

    @extend_schema(
        request=VerifyOTPSerializer,
        responses={
            200: OpenApiResponse(description="OTP verified successfully"),
            400: OpenApiResponse(description="Invalid OTP or expired"),
            404: OpenApiResponse(description="OTP not found"),
        },
        description="Verify the OTP sent to user's email for password reset."
    )
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(
                detail=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data.get('email').lower()
        otp = serializer.validated_data.get('otp')

        try:
            # Find the most recent unused OTP for this email
            otp_record = PasswordResetOTP.objects.filter(
                email=email,
                otp=otp,
                is_used=False
            ).order_by('-created_at').first()

            if not otp_record:
                raise ServiceError(
                    detail="Invalid OTP code",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            if otp_record.is_expired():
                raise ServiceError(
                    detail="OTP has expired. Please request a new one",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            # Mark as verified (but not used yet)
            otp_record.is_verified = True
            otp_record.save()

            return format_success_response(
                message="OTP verified successfully. You can now reset your password",
                data={
                    "email": email,
                    "verified": True
                }
            )

        except ServiceError:
            raise
        except Exception as e:
            raise ServiceError(
                detail=f"OTP verification failed: {str(e)}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(tags=["Password Reset"])
class ResetPasswordView(APIView):
    """
    API endpoint to reset password using verified OTP.
    """
    permission_classes = [AllowAny]
    serializer_class = ResetPasswordSerializer

    @extend_schema(
        request=ResetPasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password reset successfully"),
            400: OpenApiResponse(description="Invalid request or OTP"),
            404: OpenApiResponse(description="User or OTP not found"),
        },
        description="Reset password using the verified OTP code."
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(
                detail=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data.get('email').lower()
        otp = serializer.validated_data.get('otp')
        new_password = serializer.validated_data.get('new_password')

        try:
            # Find the verified OTP
            otp_record = PasswordResetOTP.objects.filter(
                email=email,
                otp=otp,
                is_used=False,
                is_verified=True
            ).order_by('-created_at').first()

            if not otp_record:
                raise ServiceError(
                    detail="Invalid or unverified OTP. Please verify your OTP first",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            if otp_record.is_expired():
                raise ServiceError(
                    detail="OTP has expired. Please request a new one",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            # Get user and update password
            user = otp_record.user
            user.set_password(new_password)
            user.save()

            # Mark OTP as used
            otp_record.is_used = True
            otp_record.save()

            # Delete all other unused OTPs for this user
            PasswordResetOTP.objects.filter(
                user=user
            ).exclude(id=otp_record.id).delete()

            return format_success_response(
                message="Password has been reset successfully. You can now login with your new password",
                data={
                    "email": email,
                    "password_reset": True
                }
            )

        except ServiceError:
            raise
        except Exception as e:
            raise ServiceError(
                detail=f"Password reset failed: {str(e)}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
