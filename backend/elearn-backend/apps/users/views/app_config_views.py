from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.users.models import AppConfiguration
from apps.users.serializers.app_config_serializers import AppConfigurationSerializer
from utils.constants import UserTypeConstants
from utils.common import ServiceError, format_success_response, handle_serializer_errors
import logging

logger = logging.getLogger(__name__)


class AppConfigurationView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        config = AppConfiguration.load()
        serializer = AppConfigurationSerializer(config)
        return format_success_response(
            data=serializer.data,
            message="App configuration fetched successfully"
        )

    def patch(self, request):
        try:
            user = request.user
            if not user.user_type or user.user_type.name not in [UserTypeConstants.SUPERADMIN, UserTypeConstants.ADMIN]:
                raise ServiceError("Only administrators can update app configuration", status_code=status.HTTP_403_FORBIDDEN)

            config = AppConfiguration.load()
            serializer = AppConfigurationSerializer(config, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return format_success_response(
                    data=serializer.data,
                    message="App configuration updated successfully"
                )
            
            error_msg = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_msg, status_code=status.HTTP_400_BAD_REQUEST)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error occurred: {e}")
            raise ServiceError(
                detail="An unexpected error occurred",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
