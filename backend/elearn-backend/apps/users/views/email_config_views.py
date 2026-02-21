from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from drf_spectacular.utils import extend_schema
from apps.users.models import EmailSetting
from apps.users.serializers.email_serializers import (
    EmailSettingSerializer,
    EmailSettingResponseSerializer
)
from apps.users.serializers.auth_serializers import MessageResponseSerializer
from utils.common import ServiceError, format_success_response, handle_serializer_errors
import logging

logger = logging.getLogger(__name__)


@extend_schema(
    tags=['Email Configuration'],
    summary="Get Email Configuration",
    description="Retrieve the current email configuration settings.",
    responses={
        200: EmailSettingResponseSerializer,
        404: MessageResponseSerializer,
    }
)
class EmailConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current email configuration"""
        try:
            email_setting = EmailSetting.objects.filter(status=True).first()
            
            if not email_setting:
                return format_success_response(
                    data=None,
                    message="No email configuration found"
                )
            
            serializer = EmailSettingResponseSerializer(email_setting)
            return format_success_response(
                data=serializer.data,
                message="Email configuration retrieved successfully"
            )
        except Exception as e:
            logger.error(f"Error retrieving email configuration: {e}")
            raise ServiceError(
                detail="Failed to retrieve email configuration",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(
    tags=['Email Configuration'],
    summary="List All Email Configurations",
    description="Retrieve all email configurations with their status.",
    responses={
        200: EmailSettingResponseSerializer(many=True),
    }
)
class EmailConfigListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all email configurations"""
        try:
            email_settings = EmailSetting.objects.all().order_by('-status', '-updated_at')
            serializer = EmailSettingResponseSerializer(email_settings, many=True)
            return format_success_response(
                data=serializer.data,
                message="Email configurations retrieved successfully"
            )
        except Exception as e:
            logger.error(f"Error retrieving email configurations: {e}")
            raise ServiceError(
                detail="Failed to retrieve email configurations",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(
    tags=['Email Configuration'],
    summary="Create or Update Email Configuration",
    description="Create a new email configuration or update existing one. Supports SMTP.",
    request=EmailSettingSerializer,
    responses={
        200: EmailSettingResponseSerializer,
        400: MessageResponseSerializer,
    }
)
class EmailConfigCreateUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create or update email configuration"""
        try:
            email = request.data.get('email')
            email_type = request.data.get('email_type')
            
            email_setting = EmailSetting.objects.filter(email=email).first()
            
            if email_setting:
                serializer = EmailSettingSerializer(email_setting, data=request.data, partial=True)
            else:
                serializer = EmailSettingSerializer(data=request.data)
            
            if not serializer.is_valid():
                raise ServiceError(
                    detail=handle_serializer_errors(serializer),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            
            if request.data.get('status', False):
                EmailSetting.objects.exclude(email=email).update(status=False)
            
            email_setting = serializer.save(created_by=request.user)
            
            response_serializer = EmailSettingResponseSerializer(email_setting)
            
            return format_success_response(
                data=response_serializer.data,
                message="Email configuration saved successfully"
            )
        
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error saving email configuration: {e}")
            raise ServiceError(
                detail="Failed to save email configuration",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(
    tags=['Email Configuration'],
    summary="Toggle Email Configuration Status",
    description="Enable or disable an email configuration.",
    responses={
        200: MessageResponseSerializer,
        404: MessageResponseSerializer,
    }
)
class EmailConfigToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        """Toggle email configuration status"""
        try:
            email_setting = EmailSetting.objects.filter(id=pk).first()
            
            if not email_setting:
                raise ServiceError(
                    detail="Email configuration not found",
                    status_code=status.HTTP_404_NOT_FOUND
                )
            
            if not email_setting.status:
                EmailSetting.objects.exclude(id=pk).update(status=False)
                email_setting.status = True
            else:
                email_setting.status = False
            
            email_setting.save()
            
            return format_success_response(
                message=f"Email configuration {'enabled' if email_setting.status else 'disabled'} successfully"
            )
        
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error toggling email configuration: {e}")
            raise ServiceError(
                detail="Failed to toggle email configuration",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
