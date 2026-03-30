import json
import logging
from rest_framework import status
from rest_framework.renderers import JSONRenderer
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.db.models import Q, Max, F
from django.db.models.functions import Coalesce

from apps.courses.models import Batch, BatchChatMessage, BatchChatReadReceipt, BatchEnrollment
from apps.courses.serializers import BatchListSerializer
from apps.courses.serializers.chat_serializers import BatchChatMessageSerializer

from utils.permissions import IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants

logger = logging.getLogger(__name__)

@extend_schema(tags=["Chat"])
class ChatBatchListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List batches for the chat sidebar",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10"),
        ],
        responses={200: BatchListSerializer(many=True)},
    )
    def get(self, request):
        qs = Batch.objects.select_related('teacher', 'course').annotate(
            last_message_time=Coalesce(Max('chat_messages__sent_at'), F('created_at'))
        ).order_by('-last_message_time', '-created_at')

        user = request.user
        if getattr(user, 'user_type', None):
            if user.user_type.name == UserTypeConstants.TEACHER:
                qs = qs.filter(Q(teacher=user) | Q(co_teachers=user)).distinct()
            elif user.user_type.name == UserTypeConstants.STUDENT:
                qs = qs.filter(enrollments__student=user, enrollments__status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED]).distinct()

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(name__icontains=search)

        paginator = CustomPageNumberPagination()
        paginated_qs = paginator.paginate_queryset(qs, request)
        serializer = BatchListSerializer(paginated_qs, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data, message="Chat batches retrieved successfully")


@extend_schema(tags=["Chat"])
class BatchChatMessageListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def check_batch_access(self, user, batch_id):
        try:
            batch = Batch.objects.get(pk=batch_id)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

        if getattr(user, 'user_type', None):
            if user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]:
                return batch
            elif user.user_type.name == UserTypeConstants.TEACHER:
                if batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists():
                    return batch
                raise ServiceError(detail="Access denied.", status_code=status.HTTP_403_FORBIDDEN)
            elif user.user_type.name == UserTypeConstants.STUDENT:
                if batch.enrollments.filter(student=user, status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED]).exists():
                    return batch
                raise ServiceError(detail="Access denied.", status_code=status.HTTP_403_FORBIDDEN)
        return batch

    @extend_schema(
        summary="List paginated chat messages for a batch",
        parameters=[
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 50"),
        ],
        responses={200: BatchChatMessageSerializer(many=True)}
    )
    def get(self, request, batch_id):
        try:
            batch = self.check_batch_access(request.user, batch_id)
            qs = BatchChatMessage.objects.filter(batch=batch).select_related('sender').order_by('-sent_at')

            paginator = CustomPageNumberPagination()
            # Set a higher default page size for chat (e.g., 50)
            paginator.page_size = int(request.query_params.get('page_size', 50))
            
            paginated_qs = paginator.paginate_queryset(qs, request)
            # Reverse order of messages to render chronologically
            if paginated_qs is not None:
                serializer = BatchChatMessageSerializer(paginated_qs, many=True, context={'request': request})
                # Re-reverse array so earliest is first if needed, though frontend handles lists often standard
                return paginator.get_paginated_response(serializer.data, message="Messages retrieved successfully")

            serializer = BatchChatMessageSerializer(qs, many=True, context={'request': request})
            return format_success_response(message="Messages retrieved", data=serializer.data)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error retrieving messages: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Send a new chat message (with optional attachment)",
        request=BatchChatMessageSerializer,
        responses={201: BatchChatMessageSerializer}
    )
    def post(self, request, batch_id):
        try:
            batch = self.check_batch_access(request.user, batch_id)
            # Force context to know batch
            data = request.data.copy()
            data['batch'] = batch.id
            
            serializer = BatchChatMessageSerializer(data=data, context={'request': request})
            if not serializer.is_valid():
                raise ServiceError(detail=handle_serializer_errors(serializer), status_code=status.HTTP_400_BAD_REQUEST)

            message_instance = serializer.save()

            # Optional: Broadcast to WebSocket group
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            
            # Use serializer data to send fully populated user details.
            # serializer.data is a ReturnDict that keeps a ref to the serializer -> request -> FILES
            # (open BufferedRandom handles). Channel layers pickle the event; strip refs via JSON round-trip.
            raw_message = BatchChatMessageSerializer(message_instance, context={'request': request}).data
            serialized_message = json.loads(JSONRenderer().render(raw_message))

            async_to_sync(channel_layer.group_send)(
                f'chat_batch_{batch.id}',
                {
                    'type': 'chat_message',
                    'message': message_instance.message,
                    'user_id': request.user.id,
                    'serialized_data': serialized_message,
                }
            )

            return format_success_response(
                message="Message sent successfully",
                data=serialized_message,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Chat"])
class ChatMarkReadView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BatchChatMessageSerializer

    @extend_schema(
        summary="Mark batch messages as read",
        responses={200: OpenApiTypes.OBJECT}
    )
    def post(self, request, batch_id):
        try:
            batch = Batch.objects.get(pk=batch_id)
            receipt, created = BatchChatReadReceipt.objects.get_or_create(
                batch=batch,
                user=request.user
            )
            if not created:
                receipt.save() # Updates the auto_now last_read_at field
                
            return format_success_response(message="Messages marked as read successfully")
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error marking messages as read: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
