import boto3
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils.crypto import get_random_string
import mimetypes
import logging
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes, inline_serializer
from rest_framework import serializers

from utils.constants import UserTypeConstants
from utils.common import format_success_response, ServiceError

logger = logging.getLogger(__name__)

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'auto'),
    )

class InitUploadSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    file_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField() # bytes

class CompleteUploadPartSerializer(serializers.Serializer):
    ETag = serializers.CharField()
    PartNumber = serializers.IntegerField()

class CompleteUploadSerializer(serializers.Serializer):
    key = serializers.CharField()
    upload_id = serializers.CharField()
    parts = CompleteUploadPartSerializer(many=True)

class AbortUploadSerializer(serializers.Serializer):
    key = serializers.CharField()
    upload_id = serializers.CharField()

@extend_schema(tags=["Uploads"])
class InitMultipartUploadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Initialize direct-to-R2 multipart upload",
        request=InitUploadSerializer,
        responses={200: inline_serializer(
            name="InitUploadResponse",
            fields={
                "upload_id": serializers.CharField(),
                "key": serializers.CharField(),
                "part_urls": serializers.ListField(child=serializers.CharField()),
                "chunk_size": serializers.IntegerField()
            }
        )}
    )
    def post(self, request):
        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN, UserTypeConstants.TEACHER]:
            raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = InitUploadSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(detail="Invalid data format.", status_code=status.HTTP_400_BAD_REQUEST)

        file_size = serializer.validated_data['file_size']
        filename = serializer.validated_data['filename']
        file_type = serializer.validated_data['file_type']

        # Size check: 5GB max
        if file_size > 5 * 1024 * 1024 * 1024:
            raise ServiceError(detail="File size exceeds 5GB limit.", status_code=status.HTTP_400_BAD_REQUEST)

        # File type check (only videos)
        if not file_type.startswith('video/'):
            raise ServiceError(detail="Only video files are allowed.", status_code=status.HTTP_400_BAD_REQUEST)

        # Generate a unique object key
        ext = filename.split('.')[-1] if '.' in filename else 'mp4'
        random_str = get_random_string(16)
        key = f"class_videos/{user.id}_{random_str}.{ext}"

        chunk_size = 10 * 1024 * 1024 # 10MB chunks (min 5MB for S3/R2 multipart upload)
        num_parts = (file_size + chunk_size - 1) // chunk_size

        if num_parts > 10000:
            raise ServiceError(detail="File too large (exceeds max parts limit).", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            s3_client = get_s3_client()
            bucket_name = settings.AWS_STORAGE_BUCKET_NAME

            # Create multipart upload
            init_resp = s3_client.create_multipart_upload(
                Bucket=bucket_name,
                Key=key,
                ContentType=file_type,
                # CacheControl='max-age=86400' - Optional based on requirements
            )
            upload_id = init_resp['UploadId']

            # Generate presigned URLs for each part
            part_urls = []
            for part_num in range(1, num_parts + 1):
                url = s3_client.generate_presigned_url(
                    ClientMethod='upload_part',
                    Params={
                        'Bucket': bucket_name,
                        'Key': key,
                        'UploadId': upload_id,
                        'PartNumber': part_num
                    },
                    ExpiresIn=86400 # 24 hours
                )
                part_urls.append(url)

            return format_success_response(
                message="Multipart upload initialized",
                data={
                    "upload_id": upload_id,
                    "key": key,
                    "part_urls": part_urls,
                    "chunk_size": chunk_size,
                }
            )

        except Exception as e:
            logger.error(f"Failed to initialize multipart upload: {str(e)}")
            raise ServiceError(detail="Failed to communicate with storage server.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Uploads"])
class CompleteMultipartUploadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Complete direct-to-R2 multipart upload",
        request=CompleteUploadSerializer,
        responses={200: inline_serializer(
            name="CompleteUploadResponse",
            fields={
                "video_url": serializers.CharField()
            }
        )}
    )
    def post(self, request):
        serializer = CompleteUploadSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(detail="Invalid data format.", status_code=status.HTTP_400_BAD_REQUEST)

        key = serializer.validated_data['key']
        upload_id = serializer.validated_data['upload_id']
        parts = serializer.validated_data['parts']

        try:
            s3_client = get_s3_client()
            bucket_name = settings.AWS_STORAGE_BUCKET_NAME

            s3_client.complete_multipart_upload(
                Bucket=bucket_name,
                Key=key,
                UploadId=upload_id,
                MultipartUpload={'Parts': parts}
            )

            # Note: We will handle the database saving locally when the video is created, 
            # this just returns the successful URL/Key.
            
            # Use logic to generate the final media url
            if getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None):
                video_url = f'https://{settings.AWS_S3_CUSTOM_DOMAIN}/{key}'
            else:
                video_url = f'{settings.AWS_S3_ENDPOINT_URL}/{settings.AWS_STORAGE_BUCKET_NAME}/{key}'

            return format_success_response(
                message="Upload completed successfully",
                data={"video_url": video_url, "video_key": key}
            )
        except Exception as e:
            logger.error(f"Failed to complete multipart upload: {str(e)}")
            raise ServiceError(detail="Failed to finalize upload.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Uploads"])
class AbortMultipartUploadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Abort direct-to-R2 multipart upload",
        request=AbortUploadSerializer,
        responses={200: None}
    )
    def post(self, request):
        serializer = AbortUploadSerializer(data=request.data)
        if not serializer.is_valid():
            raise ServiceError(detail="Invalid data.", status_code=status.HTTP_400_BAD_REQUEST)

        key = serializer.validated_data['key']
        upload_id = serializer.validated_data['upload_id']

        try:
            s3_client = get_s3_client()
            s3_client.abort_multipart_upload(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=key,
                UploadId=upload_id
            )
            return format_success_response(message="Upload aborted successfully.")
        except Exception as e:
            logger.error(f"Failed to abort multipart upload: {str(e)}")
            raise ServiceError(detail="Failed to abort upload.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
