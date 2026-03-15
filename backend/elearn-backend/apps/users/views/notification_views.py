from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.users.serializers.notification_serializers import NotificationSerializer
from utils.common import format_success_response
from utils.pagination import CustomPageNumberPagination


@extend_schema(tags=["Notifications"])
class NotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        qs = self.request.user.notifications.all().order_by('-created_at')
        unread_only = self.request.query_params.get('unread_only', '').lower() == 'true'
        if unread_only:
            qs = qs.filter(is_read=False)
        return qs

    @extend_schema(
        summary="List notifications",
        description="Returns the authenticated user's notifications, optionally filtered to unread only and paginated.",
        parameters=[
            OpenApiParameter("unread_only", OpenApiTypes.BOOL, description="If true, return only unread notifications (default: false)"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
        ],
    )
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        paginate_param = request.query_params.get('paginate', 'true').lower() == 'true'
        
        if paginate_param:
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return format_success_response(
            data=serializer.data,
            message="Notifications fetched successfully"
        )


@extend_schema(tags=["Notifications"])
class NotificationUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return self.request.user.notifications.all()

    @extend_schema(summary="Update a notification", description="Update a notification (e.g. mark as read). Only is_read can be updated.")
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return format_success_response(
            data=serializer.data,
            message="Notification updated successfully"
        )


@extend_schema(tags=["Notifications"])
class NotificationMarkAllReadView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    @extend_schema(summary="Mark all notifications as read", description="Marks all notifications for the authenticated user as read. Returns the count of updated notifications.")
    def post(self, request):
        count = request.user.notifications.filter(is_read=False).update(is_read=True)
        return format_success_response(
            data={
                "count": count
            },
            message=f"Marked {count} notifications as read"
        )
