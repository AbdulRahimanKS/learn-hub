"""
Serializers for the Batch models.
"""
from rest_framework import serializers
from apps.courses.models import Course, Batch, BatchEnrollment


class BatchListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing batches.
    """
    teacher_name = serializers.CharField(source='teacher.fullname', read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    progress_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = Batch
        fields = [
            'id', 'batch_code', 'name', 'description', 'course',
            'teacher', 'teacher_name', 'max_students', 'enrolled_count', 'is_full',
            'start_date', 'end_date', 'progress_percent', 'is_active',
            'created_at', 'updated_at'
        ]


class BatchCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating batches.
    Course is required — every batch must belong to a course.
    """
    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.filter(is_deleted=False),
        required=True,
        allow_null=False,
        error_messages={
            'required': 'A course must be selected for this batch.',
            'null': 'A course must be selected for this batch.',
        }
    )

    class Meta:
        model = Batch
        fields = [
            'name', 'description', 'course', 'teacher', 'co_teachers',
            'max_students', 'start_date', 'end_date', 'is_active'
        ]

    def create(self, validated_data):
        user = self.context['request'].user
        co_teachers = validated_data.pop('co_teachers', [])
        batch = Batch.objects.create(**validated_data, created_by=user)
        if co_teachers:
            batch.co_teachers.set(co_teachers)
        return batch

    def update(self, instance, validated_data):
        user = self.context['request'].user
        co_teachers = validated_data.pop('co_teachers', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.updated_by = user
        instance.save()

        if co_teachers is not None:
            instance.co_teachers.set(co_teachers)
            
        return instance


class BatchEnrollmentSerializer(serializers.ModelSerializer):
    """
    Serializer for enrolling a student into a batch.
    """
    student_name = serializers.CharField(source='student.fullname', read_only=True)
    student_email = serializers.EmailField(source='student.email', read_only=True)

    # Progress fields (Mocked for now, to be implemented with real logic)
    overall_progress = serializers.SerializerMethodField()
    weeks_completed = serializers.SerializerMethodField()
    total_weeks = serializers.SerializerMethodField()
    weekly_tests_submitted = serializers.SerializerMethodField()
    total_weekly_tests = serializers.SerializerMethodField()
    quizzes_done = serializers.SerializerMethodField()
    total_quizzes = serializers.SerializerMethodField()
    marks_obtained = serializers.SerializerMethodField()
    total_marks = serializers.SerializerMethodField()

    class Meta:
        model = BatchEnrollment
        fields = [
            'id', 'batch', 'student', 'student_name', 'student_email',
            'status', 'notes', 'fee_paid', 'fee_amount',
            'enrolled_at', 'created_at',
            'overall_progress', 'weeks_completed', 'total_weeks',
            'weekly_tests_submitted', 'total_weekly_tests',
            'quizzes_done', 'total_quizzes',
            'marks_obtained', 'total_marks'
        ]
        read_only_fields = ['id', 'batch', 'enrolled_at', 'created_at', 'student_name', 'student_email']

    def get_overall_progress(self, obj):
        return 15.0 # Mock

    def get_weeks_completed(self, obj):
        return 2 # Mock

    def get_total_weeks(self, obj):
        if obj.batch and obj.batch.course:
            return obj.batch.course.total_weeks
        return 0

    def get_weekly_tests_submitted(self, obj):
        return 1 # Mock

    def get_total_weekly_tests(self, obj):
        return 3 # Mock

    def get_quizzes_done(self, obj):
        return 0 # Mock

    def get_total_quizzes(self, obj):
        return 2 # Mock

    def get_marks_obtained(self, obj):
        return 0 # Mock

    def get_total_marks(self, obj):
        return 0 # Mock

