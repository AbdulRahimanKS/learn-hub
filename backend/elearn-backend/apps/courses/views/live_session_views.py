import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.courses.models import LiveSession, Batch
from apps.courses.serializers.live_session_serializers import LiveSessionSerializer
from utils.permissions import IsAdminOrTeacher
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination

logger = logging.getLogger(__name__)

@extend_schema(tags=["Live Sessions"])
class LiveSessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List live sessions for a specific batch",
        parameters=[
            OpenApiParameter("tab", OpenApiTypes.STR, description="Filter: 'upcoming' or 'past'. Default: 'upcoming'."),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page (default 6, max 100)"),
        ],
        responses={200: LiveSessionSerializer(many=True)}
    )
    def get(self, request, batch_id):
        now = timezone.now()
        qs = LiveSession.objects.filter(batch_id=batch_id).order_by('scheduled_at')

        # Students only see upcoming sessions (relative to their local time, but we use server time for simplicity here)
        # Based on start time + duration logic
        tab = request.query_params.get('tab', 'upcoming').strip().lower()
        
        user_role = getattr(request.user.user_type, 'name', '').lower()
        is_student = user_role == 'student'
        
        if is_student:
            # Students only see upcoming or currently live sessions
            # Session is considered "past" if now > scheduled_at + duration
            upcoming_ids = [
                s.id for s in qs
                if s.scheduled_at + timedelta(minutes=s.duration_mins) >= now
            ]
            qs = qs.filter(id__in=upcoming_ids)
        else:
            # Admins/Teachers can switch between upcoming and past
            if tab == 'upcoming':
                upcoming_ids = [
                    s.id for s in qs
                    if s.scheduled_at + timedelta(minutes=s.duration_mins) >= now
                ]
                qs = qs.filter(id__in=upcoming_ids)
            elif tab == 'past':
                past_ids = [
                    s.id for s in qs
                    if s.scheduled_at + timedelta(minutes=s.duration_mins) < now
                ]
                qs = qs.filter(id__in=past_ids).order_by('-scheduled_at')

        paginator = CustomPageNumberPagination()
        paginator.page_size = 6
        page = paginator.paginate_queryset(qs, request)
        serializer = LiveSessionSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data, message="Live sessions retrieved successfully")

    @extend_schema(
        summary="Create a new live session for a batch",
        request=LiveSessionSerializer,
        responses={201: LiveSessionSerializer}
    )
    def post(self, request, batch_id):
        user_role = getattr(request.user.user_type, 'name', '').lower()
        if user_role not in ['admin', 'teacher', 'superadmin']:
             raise ServiceError(detail="Permission denied.", status_code=status.HTTP_403_FORBIDDEN)

        try:
            batch = Batch.objects.get(id=batch_id)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = LiveSessionSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

        live_session = serializer.save(batch=batch, hosted_by=request.user)
        return format_success_response(
            message="Live session scheduled successfully",
            data=LiveSessionSerializer(live_session, context={'request': request}).data,
            status_code=status.HTTP_201_CREATED
        )

@extend_schema(tags=["Live Sessions"])
class LiveSessionDetailView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_object(self, batch_id, session_id):
        try:
            return LiveSession.objects.get(id=session_id, batch_id=batch_id)
        except LiveSession.DoesNotExist:
            raise ServiceError(detail="Live session not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Retrieve a live session", responses={200: LiveSessionSerializer})
    def get(self, request, batch_id, session_id):
        session = self.get_object(batch_id, session_id)
        serializer = LiveSessionSerializer(session, context={'request': request})
        return format_success_response(message="Live session retrieved", data=serializer.data)

    @extend_schema(summary="Update a live session", request=LiveSessionSerializer)
    def patch(self, request, batch_id, session_id):
        session = self.get_object(batch_id, session_id)
        serializer = LiveSessionSerializer(session, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            error_str = handle_serializer_errors(serializer)
            raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        return format_success_response(message="Live session updated successfully")

    @extend_schema(summary="Delete a live session")
    def delete(self, request, batch_id, session_id):
        session = self.get_object(batch_id, session_id)
        session.delete()
        return format_success_response(message="Live session deleted successfully")
