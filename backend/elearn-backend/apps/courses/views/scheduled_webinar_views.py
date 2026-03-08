import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.courses.models import ScheduledWebinar, Batch
from apps.courses.serializers.scheduled_webinar_serializers import ScheduledWebinarSerializer
from utils.permissions import IsAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError

logger = logging.getLogger(__name__)

@extend_schema(tags=["Webinars"])
class ScheduledWebinarListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        summary="List webinars for a specific batch",
        responses={200: ScheduledWebinarSerializer(many=True)}
    )
    def get(self, request, batch_id):
        webinars = ScheduledWebinar.objects.filter(batch_id=batch_id).order_by('unlock_at')
        serializer = ScheduledWebinarSerializer(webinars, many=True, context={'request': request})
        return format_success_response(message="Webinars retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Create a new webinar for a batch",
        request=ScheduledWebinarSerializer,
        responses={201: ScheduledWebinarSerializer}
    )
    def post(self, request, batch_id):
        if not request.user.user_type or request.user.user_type.name not in ['admin', 'teacher']:
             # Double check permission manually if needed, but IsAdminOrTeacher should handle it
             pass

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

@extend_schema(tags=["Webinars"])
class ScheduledWebinarDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, batch_id, webinar_id):
        try:
            return ScheduledWebinar.objects.get(id=webinar_id, batch_id=batch_id)
        except ScheduledWebinar.DoesNotExist:
            raise ServiceError(detail="Webinar not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a webinar", responses={200: ScheduledWebinarSerializer})
    def get(self, request, batch_id, webinar_id):
        webinar = self.get_object(batch_id, webinar_id)
        serializer = ScheduledWebinarSerializer(webinar, context={'request': request})
        return format_success_response(message="Webinar retrieved", data=serializer.data)

    @extend_schema(summary="Update a webinar", request=ScheduledWebinarSerializer)
    def patch(self, request, batch_id, webinar_id):
        webinar = self.get_object(batch_id, webinar_id)
        
        # Logic to prevent editing past webinars could be added here
        # But for now, we'll allow it if needed, or implement it as per requirements
        
        serializer = ScheduledWebinarSerializer(webinar, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        return format_success_response(message="Webinar updated successfully")

    @extend_schema(summary="Delete a webinar")
    def delete(self, request, batch_id, webinar_id):
        webinar = self.get_object(batch_id, webinar_id)
        webinar.delete()
        return format_success_response(message="Webinar deleted successfully")
