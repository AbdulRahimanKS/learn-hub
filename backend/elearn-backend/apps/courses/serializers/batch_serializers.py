"""
Serializers for the Batch models.
"""
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from utils.common import ServiceError
from rest_framework import serializers
from apps.courses.models import Course, Batch, BatchEnrollment, BatchWeek, BatchClassSession, StudentSessionView, TestSubmission, BatchWeeklyTest
from rest_framework import status
from apps.courses.models import BatchEnrollment as BE
from utils.progress_utils import (
    average_week_based_progress_percent,
    count_consecutive_completed_weeks,
    count_deliverable_weeks,
    week_based_progress_percent,
    week_based_progress_percent_float,
)


class BatchListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing batches.
    """
    teacher_name = serializers.CharField(source='teacher.fullname', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    progress_percent = serializers.SerializerMethodField()
    weeks_count = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id', 'batch_code', 'name', 'description', 'course',
            'course_title', 'teacher', 'teacher_name', 'max_students', 'enrolled_count', 'is_full',
            'start_date', 'status', 'progress_percent', 'weeks_count', 'unread_count', 'created_at', 'updated_at'
        ]

    @extend_schema_field(OpenApiTypes.INT)
    def get_progress_percent(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0.0

        enrollment = self.context.get('enrollment')
        if not enrollment:
            enrollment = BE.objects.filter(
                batch=obj,
                student=request.user,
                status__in=[BE.Status.ACTIVE, BE.Status.COMPLETED]
            ).first()

        # Student view: week-based progress (sessions + tests per week, consecutive from week 1).
        if enrollment:
            return week_based_progress_percent_float(enrollment)

        # Admin/teacher view: average week-based progress across active + completed students.
        relevant_enrollments = BE.objects.filter(
            batch=obj,
            status__in=[BE.Status.ACTIVE, BE.Status.COMPLETED]
        )
        return average_week_based_progress_percent(relevant_enrollments)

    @extend_schema_field(OpenApiTypes.INT)
    def get_weeks_count(self, obj):
        return obj.batch_weeks.count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
            
        user = request.user
        
        last_receipt = obj.read_receipts.filter(user=user).first()
        
        qs = obj.chat_messages.exclude(sender=user)
        if last_receipt:
            qs = qs.filter(sent_at__gt=last_receipt.last_read_at)
            
        return qs.count()


class BatchCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating batches.
    Course is required — every batch must belong to a course.
    """
    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(),
        required=True,
        allow_null=False,
        error_messages={
            'required': 'A course must be selected for this batch.',
            'null': 'A course must be selected for this batch.',
        }
    )

    course_name = serializers.CharField(source='course.title', read_only=True)
    teacher_name = serializers.CharField(source='teacher.fullname', read_only=True)
    teacher_email = serializers.CharField(source='teacher.email', read_only=True)
    co_teacher_details = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'name', 'description', 'course', 'course_name', 'teacher', 'teacher_name', 'teacher_email', 'co_teachers', 'co_teacher_details',
            'max_students', 'start_date', 'status'
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_co_teacher_details(self, obj):
        return [{'id': t.id, 'fullname': t.fullname, 'email': t.email} for t in obj.co_teachers.all()]

    def validate_status(self, value):
        if self.instance:
            if value not in [Batch.Status.ACTIVE, Batch.Status.COMPLETED]:
                raise ServiceError(detail="Invalid status. Only 'ACTIVE' or 'COMPLETED' are allowed.", status_code=status.HTTP_400_BAD_REQUEST)
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        co_teachers = validated_data.pop('co_teachers', [])
        validated_data.setdefault('status', Batch.Status.ACTIVE)
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
    profile_picture = serializers.SerializerMethodField()

    # Progress: week-based (all sessions in week + passed weekly test if present); see progress_utils.
    overall_progress = serializers.SerializerMethodField()
    weeks_completed = serializers.SerializerMethodField()
    total_weeks = serializers.SerializerMethodField()
    weekly_tests_submitted = serializers.SerializerMethodField()
    total_weekly_tests = serializers.SerializerMethodField()
    manual_unlocked_weeks = serializers.SerializerMethodField()
    weeks_access_status = serializers.SerializerMethodField()
    videos_watched = serializers.SerializerMethodField()
    total_videos = serializers.SerializerMethodField()
    week_details = serializers.SerializerMethodField()

    class Meta:
        model = BatchEnrollment
        fields = [
            'id', 'batch', 'student', 'student_name', 'student_email', 'profile_picture',
            'status', 'notes', 'manual_unlocked_weeks', 'weeks_access_status',
            'enrolled_at', 'created_at',
            'overall_progress', 'weeks_completed', 'total_weeks',
            'weekly_tests_submitted', 'total_weekly_tests',
            'videos_watched', 'total_videos', 'week_details'
        ]
        read_only_fields = [
            'id', 'batch', 'enrolled_at', 'created_at',
            'student_name', 'student_email', 'profile_picture',
        ]

    @extend_schema_field(OpenApiTypes.URI)
    def get_profile_picture(self, obj):
        request = self.context.get('request')
        try:
            pic = obj.student.profile.profile_picture
            if pic and request:
                return request.build_absolute_uri(pic.url)
        except Exception:
            pass
        return None

    @extend_schema_field(serializers.ListField(child=serializers.IntegerField()))
    def get_manual_unlocked_weeks(self, obj):
        return list(obj.manual_unlocks.values_list('batch_week__week_number', flat=True))

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_weeks_access_status(self, obj):
        weeks = BatchWeek.objects.filter(batch=obj.batch).order_by('week_number')
        manual_unlocked_ids = set(obj.manual_unlocks.values_list('batch_week_id', flat=True))
        
        status_list = []
        for week in weeks:
            is_manually_unlocked = week.id in manual_unlocked_ids
            
            is_system_unlocked = False
            if week.is_unlocked:
                is_system_unlocked = True
                if week.week_number > 1:
                    prev_weeks = obj.batch.batch_weeks.filter(week_number__lt=week.week_number).order_by('week_number')
                    for pw in prev_weeks:
                        # A. Check Sessions
                        total_sessions = BatchClassSession.objects.filter(batch_week=pw).count()
                        if total_sessions > 0:
                            completed_sessions = StudentSessionView.objects.filter(
                                enrollment=obj, 
                                batch_session__batch_week=pw, 
                                is_completed=True
                            ).count()
                            if completed_sessions < total_sessions:
                                is_system_unlocked = False
                                break
                        
                        # B. Check Test
                        if hasattr(pw, 'weekly_test') and pw.weekly_test:
                            if not TestSubmission.objects.filter(
                                enrollment=obj, batch_weekly_test=pw.weekly_test, status=TestSubmission.Status.PUBLISHED, is_passed=True
                            ).exists():
                                is_system_unlocked = False
                                break
            
            is_revokable = is_manually_unlocked
            if is_revokable:
                has_session_progress = StudentSessionView.objects.filter(
                    enrollment=obj, batch_session__batch_week=week, is_completed=True
                ).exists()
                has_test_progress = TestSubmission.objects.filter(
                    enrollment=obj, batch_weekly_test__batch_week=week
                ).exists()
                if has_session_progress or has_test_progress:
                    is_revokable = False

            status_list.append({
                'week_number': week.week_number,
                'is_manually_unlocked': is_manually_unlocked,
                'is_system_unlocked': is_system_unlocked,
                'is_revokable': is_revokable
            })
        return status_list

    @extend_schema_field(OpenApiTypes.INT)
    def get_overall_progress(self, obj):
        return week_based_progress_percent(obj)

    @extend_schema_field(OpenApiTypes.INT)
    def get_weeks_completed(self, obj):
        return count_consecutive_completed_weeks(obj)

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_weeks(self, obj):
        # Match progress denominator: weeks that have sessions and/or a weekly test (not empty shells).
        return count_deliverable_weeks(obj.batch)

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_weekly_tests(self, obj):
        return BatchWeeklyTest.objects.filter(batch_week__batch=obj.batch).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_weekly_tests_submitted(self, obj):
        return TestSubmission.objects.filter(enrollment=obj, status=TestSubmission.Status.PUBLISHED, is_passed=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_videos_watched(self, obj):
        return StudentSessionView.objects.filter(enrollment=obj, is_completed=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_videos(self, obj):
        return BatchClassSession.objects.filter(batch_week__batch=obj.batch).count()

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_week_details(self, obj):
        weeks = BatchWeek.objects.filter(batch=obj.batch).order_by('week_number')
        result = []
        for week in weeks:
            total_vids = BatchClassSession.objects.filter(batch_week=week).count()
            watched_vids = StudentSessionView.objects.filter(
                enrollment=obj,
                batch_session__batch_week=week,
                is_completed=True
            ).count()

            # Safely check if week has a weekly_test
            try:
                weekly_test = week.weekly_test
            except Exception:
                weekly_test = None

            if weekly_test:
                submission = TestSubmission.objects.filter(
                    enrollment=obj,
                    batch_weekly_test=weekly_test,
                    status=TestSubmission.Status.PUBLISHED
                ).order_by('-submitted_at').first()
                test_info = {
                    'exists': True,
                    'is_passed': submission.is_passed if submission else False,
                    'score': submission.marks_obtained if submission else None,
                    'attempted': submission is not None,
                }
            else:
                test_info = {'exists': False, 'is_passed': False, 'score': None, 'attempted': False}

            result.append({
                'week_number': week.week_number,
                'title': week.title,
                'total_videos': total_vids,
                'videos_watched': watched_vids,
                'test': test_info,
            })
        return result
