from rest_framework import serializers
from apps.courses.models import ScheduledWebinar
from django.utils.translation import gettext_lazy as _

class ScheduledWebinarSerializer(serializers.ModelSerializer):
    video_presigned_url = serializers.SerializerMethodField()
    created_by_name = serializers.ReadOnlyField(source='created_by.fullname')

    class Meta:
        model = ScheduledWebinar
        fields = [
            'id', 'batch', 'title', 'session_type', 'description', 
            'unlock_at', 'duration_secs', 'video_file', 'video_presigned_url',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'batch']

    def get_video_presigned_url(self, obj):
        if not obj.video_file:
            return None
        try:
            from django.conf import settings
            import boto3
            s3_client = boto3.client(
                's3',
                endpoint_url=settings.AWS_S3_ENDPOINT_URL,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'auto'),
            )
            url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': obj.video_file
                },
                ExpiresIn=14400  # 4 hours
            )
            return url
        except Exception:
            return None
