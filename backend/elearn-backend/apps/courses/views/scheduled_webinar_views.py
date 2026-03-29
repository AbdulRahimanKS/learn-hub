import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.courses.models import ScheduledWebinar, Batch, BatchEnrollment
from apps.courses.serializers.scheduled_webinar_serializers import ScheduledWebinarSerializer
from apps.courses.services import delete_unused_video_from_storage
from utils.permissions import IsSuperAdminAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants

logger = logging.getLogger(__name__)


@extend_schema(tags=["Webinars"])
class ScheduledWebinarListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        summary="List webinars for a specific batch",
        parameters=[
            OpenApiParameter("tab", OpenApiTypes.STR, description="Filter: 'scheduled' (upcoming) or 'passed' (past). Default: all."),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
        ],
        responses={200: ScheduledWebinarSerializer(many=True)}
    )
    def get(self, request, batch_id):
        try:
            now = timezone.now()
            if getattr(request.user.user_type, 'name', '') == UserTypeConstants.STUDENT:
                if not BatchEnrollment.objects.filter(
                    batch_id=batch_id,
                    student=request.user,
                    status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED],
                ).exists():
                    raise ServiceError(
                        detail="Access denied. You are not an active or completed student in this batch.",
                        status_code=status.HTTP_403_FORBIDDEN,
                    )

            qs = ScheduledWebinar.objects.filter(batch_id=batch_id).order_by('unlock_at')
            tab = request.query_params.get('tab', '').strip().lower()
            if tab == 'scheduled':
                qs = qs.filter(unlock_at__gt=now)
            elif tab == 'passed':
                qs = qs.filter(unlock_at__lte=now).order_by('-unlock_at')

            paginate_param = request.query_params.get('paginate', 'true').strip().lower()
            if paginate_param != 'false':
                paginator = CustomPageNumberPagination()
                page = paginator.paginate_queryset(qs, request)
                serializer = ScheduledWebinarSerializer(page, many=True, context={'request': request})
                return paginator.get_paginated_response(serializer.data, message="Webinars retrieved successfully")

            serializer = ScheduledWebinarSerializer(qs, many=True, context={'request': request})
            return format_success_response(message="Webinars retrieved successfully", data=serializer.data)
        
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error listing webinars for batch {batch_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @extend_schema(
        summary="Create a new webinar for a batch",
        request=ScheduledWebinarSerializer,
        responses={201: ScheduledWebinarSerializer}
    )
    def post(self, request, batch_id):
        try:
            user_role = getattr(request.user.user_type, 'name', '')
            allowed_roles = {UserTypeConstants.ADMIN, UserTypeConstants.TEACHER, UserTypeConstants.SUPERADMIN}
            if user_role not in allowed_roles:
                raise ServiceError(
                    detail=f"Permission denied. You are not authorized to create a webinar for this batch.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            try:
                batch = Batch.objects.get(id=batch_id)
            except Batch.DoesNotExist:
                raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

            serializer = ScheduledWebinarSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            webinar = serializer.save(batch=batch, created_by=request.user)
            return format_success_response(
                message="Webinar created successfully",
                data=ScheduledWebinarSerializer(webinar, context={'request': request}).data,
                status_code=status.HTTP_201_CREATED
            )
        
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating webinar for batch {batch_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Webinars"])
class ScheduledWebinarDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = ScheduledWebinarSerializer

    def get_object(self, batch_id, webinar_id):
        try:
            return ScheduledWebinar.objects.get(id=webinar_id, batch_id=batch_id)
        except ScheduledWebinar.DoesNotExist:
            raise ServiceError(detail="Webinar not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a webinar", responses={200: ScheduledWebinarSerializer})
    def get(self, request, batch_id, webinar_id):
        try:
            webinar = self.get_object(batch_id, webinar_id)
            serializer = ScheduledWebinarSerializer(webinar, context={'request': request})
            return format_success_response(message="Webinar retrieved", data=serializer.data)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error retrieving webinar for batch {batch_id} and webinar {webinar_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Update a webinar", request=ScheduledWebinarSerializer)
    def patch(self, request, batch_id, webinar_id):
        try:
            webinar = self.get_object(batch_id, webinar_id)
        
            serializer = ScheduledWebinarSerializer(webinar, data=request.data, partial=True, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
            serializer.save()
            return format_success_response(message="Webinar updated successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating webinar for batch {batch_id} and webinar {webinar_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a webinar")
    def delete(self, request, batch_id, webinar_id):
        try:
            webinar = self.get_object(batch_id, webinar_id)
            video_file_key = webinar.video_file
            webinar.delete()
            if video_file_key:
                delete_unused_video_from_storage(video_file_key)
            return format_success_response(message="Webinar deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting webinar for batch {batch_id} and webinar {webinar_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
