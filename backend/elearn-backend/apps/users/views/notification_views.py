from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.users.models import Notification
from apps.users.serializers.notification_serializers import NotificationSerializer
from utils.common import format_success_response
from utils.pagination import CustomPageNumberPagination


class NotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        return self.request.user.notifications.all().order_by('-created_at')

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


class NotificationUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return self.request.user.notifications.all()

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


class NotificationMarkAllReadView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def post(self, request):
        count = request.user.notifications.filter(is_read=False).update(is_read=True)
        return format_success_response(
            data={
                "count": count
            },
            message=f"Marked {count} notifications as read"
        )
