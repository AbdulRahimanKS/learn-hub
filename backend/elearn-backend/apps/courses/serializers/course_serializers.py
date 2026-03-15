"""
Serializers for the Course models.
"""
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from apps.courses.models import Course, Tag
from utils.common import ServiceError
from rest_framework import status


class TagSerializer(serializers.ModelSerializer):
    """Serializer for the Tag model."""
    class Meta:
        model = Tag
        fields = ['id', 'name']


class CourseListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing courses (used in list API).
    """
    tags = TagSerializer(many=True, read_only=True)
    difficulty_display = serializers.CharField(
        source='get_difficulty_level_display', read_only=True
    )
    total_weeks = serializers.IntegerField(read_only=True)
    batch_id = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()
    batch_status = serializers.SerializerMethodField()
    learning_status = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id',
            'course_code',
            'title',
            'description',
            'difficulty_level',
            'difficulty_display',
            'thumbnail',
            'tags',
            'is_active',
            'created_at',
            'total_weeks',
            'batch_id',
            'batch_name',
            'batch_status',
            'learning_status',
            'progress_percent',
        ]
        read_only_fields = ['course_code', 'created_at', 'total_weeks']

    @extend_schema_field(OpenApiTypes.INT)
    def get_batch_id(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        # Find the batch the student is enrolled in for this course
        batch = obj.batches.filter(enrollments__student=user).first()
        return batch.id if batch else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_name(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        batch = obj.batches.filter(enrollments__student=user).first()
        return batch.name if batch else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_status(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        from apps.courses.models import BatchEnrollment
        enrollment = BatchEnrollment.objects.filter(batch__course=obj, student=user).first()
        return enrollment.status if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_learning_status(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return 'start_learning'
        from apps.courses.models import BatchEnrollment, BatchClassSession, StudentSessionView
        enrollment = BatchEnrollment.objects.filter(batch__course=obj, student=user).first()
        if not enrollment:
            return 'start_learning'
        if enrollment.status == 'completed':
            return 'review'
        
        completed_sessions = StudentSessionView.objects.filter(enrollment=enrollment, is_completed=True).count()
        if completed_sessions > 0:
            return 'continue_learning'
        return 'start_learning'

    @extend_schema_field(OpenApiTypes.INT)
    def get_progress_percent(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return 0
        from apps.courses.models import BatchEnrollment, BatchClassSession, StudentSessionView, BatchWeeklyTest, TestSubmission
        enrollment = BatchEnrollment.objects.filter(batch__course=obj, student=user).first()
        if not enrollment:
            return 0
            
        total_sessions = BatchClassSession.objects.filter(batch_week__batch=enrollment.batch).count()
        total_tests = BatchWeeklyTest.objects.filter(batch_week__batch=enrollment.batch).count()
        total_items = total_sessions + total_tests
        
        if total_items == 0:
            return 0
            
        completed_sessions = StudentSessionView.objects.filter(enrollment=enrollment, is_completed=True).count()
        completed_tests = TestSubmission.objects.filter(enrollment=enrollment, is_passed=True, status='published').count()
        completed_items = completed_sessions + completed_tests
        
        # Don't exceed 100 in odd test edge cases
        return min(100, round((completed_items / total_items) * 100))


class CourseDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for a single course (used in retrieve/create/update).
    """
    tags = TagSerializer(many=True, read_only=True)
    difficulty_display = serializers.CharField(
        source='get_difficulty_level_display', read_only=True
    )
    total_weeks = serializers.IntegerField(read_only=True)
    batch_id = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()
    batch_status = serializers.SerializerMethodField()
    learning_status = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id',
            'course_code',
            'title',
            'description',
            'difficulty_level',
            'difficulty_display',
            'thumbnail',
            'tags',
            'is_active',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
            'total_weeks',
            'batch_id',
            'batch_name',
            'batch_status',
            'learning_status',
            'progress_percent',
        ]
        read_only_fields = ['course_code', 'created_by', 'updated_by', 'created_at', 'updated_at', 'total_weeks']

    @extend_schema_field(OpenApiTypes.INT)
    def get_batch_id(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        batch = obj.batches.filter(enrollments__student=user).first()
        return batch.id if batch else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_name(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        batch = obj.batches.filter(enrollments__student=user).first()
        return batch.name if batch else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_status(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        from apps.courses.models import BatchEnrollment
        enrollment = BatchEnrollment.objects.filter(batch__course=obj, student=user).first()
        return enrollment.status if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_learning_status(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return 'start_learning'
        from apps.courses.models import BatchEnrollment, BatchClassSession, StudentSessionView
        enrollment = BatchEnrollment.objects.filter(batch__course=obj, student=user).first()
        if not enrollment:
            return 'start_learning'
        if enrollment.status == 'completed':
            return 'review'
        
        completed_sessions = StudentSessionView.objects.filter(enrollment=enrollment, is_completed=True).count()
        if completed_sessions > 0:
            return 'continue_learning'
        return 'start_learning'

    @extend_schema_field(OpenApiTypes.INT)
    def get_progress_percent(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return 0
        from apps.courses.models import BatchEnrollment, BatchClassSession, StudentSessionView, BatchWeeklyTest, TestSubmission
        enrollment = BatchEnrollment.objects.filter(batch__course=obj, student=user).first()
        if not enrollment:
            return 0
            
        total_sessions = BatchClassSession.objects.filter(batch_week__batch=enrollment.batch).count()
        total_tests = BatchWeeklyTest.objects.filter(batch_week__batch=enrollment.batch).count()
        total_items = total_sessions + total_tests
        
        if total_items == 0:
            return 0
            
        completed_sessions = StudentSessionView.objects.filter(enrollment=enrollment, is_completed=True).count()
        completed_tests = TestSubmission.objects.filter(enrollment=enrollment, is_passed=True, status='published').count()
        completed_items = completed_sessions + completed_tests
        
        # Don't exceed 100 in odd test edge cases
        return min(100, round((completed_items / total_items) * 100))


class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating courses.
    Handles tags as a list of tag name strings — auto get_or_creates each tag.
    """
    # Accept tag names as plain strings; the serializer will get_or_create them
    tags_input = serializers.ListField(
        child=serializers.CharField(max_length=100, allow_blank=True),
        required=False,
        write_only=True,
        help_text="List of tag name strings, e.g. ['python', 'data-science']. Tags are created automatically if they don't exist."
    )
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'course_code',
            'title',
            'description',
            'difficulty_level',
            'thumbnail',
            'tags_input',
            'tags',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['course_code', 'created_at', 'updated_at']

    def validate_title(self, value):
        """Validate that title is not empty."""
        if not value or not value.strip():
            raise ServiceError(detail="Course Title cannot be empty.", status_code=status.HTTP_400_BAD_REQUEST)
        return value.strip()

    def _resolve_tags(self, tag_names):
        """Get or create Tag objects from a list of name strings."""
        tags = []
        for name in tag_names:
            cleaned = name.strip().lower()
            if cleaned:
                tag, _ = Tag.objects.get_or_create(name=cleaned)
                tags.append(tag)
        return tags

    def create(self, validated_data):
        tags_input = validated_data.pop('tags_input', [])
        user = self.context['request'].user
        course = Course.objects.create(**validated_data, created_by=user)
        if tags_input:
            course.tags.set(self._resolve_tags(tags_input))
        return course

    def update(self, instance, validated_data):
        tags_input = validated_data.pop('tags_input', None)
        user = self.context['request'].user

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.updated_by = user
        instance.save()

        if tags_input is not None:
            instance.tags.set(self._resolve_tags(tags_input))

        return instance
