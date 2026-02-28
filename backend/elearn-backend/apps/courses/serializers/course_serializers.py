"""
Serializers for the Course models.
"""
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
        ]
        read_only_fields = ['course_code', 'created_at']


class CourseDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for a single course (used in retrieve/create/update).
    """
    tags = TagSerializer(many=True, read_only=True)
    difficulty_display = serializers.CharField(
        source='get_difficulty_level_display', read_only=True
    )

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
            'is_deleted',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['course_code', 'created_by', 'updated_by', 'created_at', 'updated_at']


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
