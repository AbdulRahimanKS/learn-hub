"""
Serializers for the Course models.
"""
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from apps.courses.models import (
    Course,
    Tag,
    BatchEnrollment,
    BatchWeek,
    StudentSessionView,
    ManualStudentWeekUnlock,
)
from utils.progress_utils import week_based_progress_percent
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
    total_weeks = serializers.SerializerMethodField()
    batch_id = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()
    batch_status = serializers.SerializerMethodField()
    batch_student_count = serializers.SerializerMethodField()
    batch_start_date = serializers.SerializerMethodField()
    batch_teacher_name = serializers.SerializerMethodField()
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
            'batch_student_count',
            'batch_start_date',
            'batch_teacher_name',
            'learning_status',
            'progress_percent',
        ]
        read_only_fields = ['course_code', 'created_at', 'total_weeks']
    @extend_schema_field(OpenApiTypes.INT)
    def get_total_weeks(self, obj):
        """
        For student list items, use the enrolled batch's weeks count.
        Fallback to course template weeks for admin/teacher contexts.
        """
        enrollment = self._get_enrollment(obj)
        if enrollment:
            return BatchWeek.objects.filter(batch=enrollment.batch).count()
        return getattr(obj, 'total_weeks', 0) or 0


    def _get_enrollment(self, obj):
        """Return the enrollment to use: from context (student list) or first match (teachers/admins)."""
        enrollment = self.context.get('enrollment')
        if enrollment is not None:
            return enrollment
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        return BatchEnrollment.objects.filter(batch__course=obj, student=user).first()

    @extend_schema_field(OpenApiTypes.INT)
    def get_batch_id(self, obj):
        enrollment = self._get_enrollment(obj)
        return enrollment.batch_id if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_name(self, obj):
        enrollment = self._get_enrollment(obj)
        return enrollment.batch.name if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_status(self, obj):
        enrollment = self._get_enrollment(obj)
        return enrollment.status if enrollment else None

    @extend_schema_field(OpenApiTypes.INT)
    def get_batch_student_count(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return None
        return getattr(enrollment.batch, 'enrolled_count', None)

    @extend_schema_field(OpenApiTypes.DATE)
    def get_batch_start_date(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return None
        return getattr(enrollment.batch, 'start_date', None)

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_teacher_name(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return None
        teacher = getattr(enrollment.batch, 'teacher', None)
        if not teacher:
            return None
        return getattr(teacher, 'fullname', None) or getattr(teacher, 'get_full_name', lambda: None)() or str(teacher)

    @extend_schema_field(OpenApiTypes.STR)
    def get_learning_status(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return 'start_learning'
        if enrollment.status == BatchEnrollment.Status.COMPLETED:
            return 'review'
        completed_sessions = StudentSessionView.objects.filter(enrollment=enrollment, is_completed=True).count()
        if completed_sessions > 0:
            return 'continue_learning'
        return 'start_learning'

    def _batch_content_starts_at_value(self, obj):
        """
        When week 1 is still calendar-locked for this student, return its unlock datetime
        (same rule as BatchWeekSerializer.student_lock_status date_locked). Used on My Courses
        cards to show 'Starts Mar 23' before the student opens the course.
        """
        enrollment = self._get_enrollment(obj)
        if not enrollment or enrollment.status != BatchEnrollment.Status.ACTIVE:
            return None
        first_week = (
            BatchWeek.objects.filter(batch=enrollment.batch)
            .order_by('week_number')
            .first()
        )
        if not first_week or not first_week.unlock_date:
            return None
        if ManualStudentWeekUnlock.objects.filter(
            enrollment=enrollment, batch_week=first_week
        ).exists():
            return None
        if first_week.is_unlocked:
            return None
        return first_week.unlock_date

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['batch_content_starts_at'] = self._batch_content_starts_at_value(instance)
        return data

    @extend_schema_field(OpenApiTypes.INT)
    def get_progress_percent(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return 0
        return week_based_progress_percent(enrollment)


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

    def _get_enrollment(self, obj):
        """
        Return the enrollment to use for detail view.
        If an explicit enrollment is provided in context, use that; otherwise
        fall back to the first enrollment for this user and course.
        """
        enrollment = self.context.get('enrollment')
        if enrollment is not None:
            return enrollment
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        return BatchEnrollment.objects.filter(batch__course=obj, student=user).first()

    @extend_schema_field(OpenApiTypes.INT)
    def get_batch_id(self, obj):
        enrollment = self._get_enrollment(obj)
        return enrollment.batch_id if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_name(self, obj):
        enrollment = self._get_enrollment(obj)
        return enrollment.batch.name if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_batch_status(self, obj):
        enrollment = self._get_enrollment(obj)
        return enrollment.status if enrollment else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_learning_status(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return 'start_learning'
        if enrollment.status == BatchEnrollment.Status.COMPLETED:
            return 'review'
        completed_sessions = StudentSessionView.objects.filter(enrollment=enrollment, is_completed=True).count()
        if completed_sessions > 0:
            return 'continue_learning'
        return 'start_learning'

    @extend_schema_field(OpenApiTypes.INT)
    def get_progress_percent(self, obj):
        enrollment = self._get_enrollment(obj)
        if not enrollment:
            return 0
        return week_based_progress_percent(enrollment)


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
