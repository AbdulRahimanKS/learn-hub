"""
Serializers for the Batch models.
"""
from utils.common import ServiceError
from rest_framework import serializers
from apps.courses.models import Course, Batch, BatchEnrollment
from rest_framework import status


class BatchListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing batches.
    """
    teacher_name = serializers.CharField(source='teacher.fullname', read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    progress_percent = serializers.FloatField(read_only=True)
    weeks_count = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id', 'batch_code', 'name', 'description', 'course',
            'teacher', 'teacher_name', 'max_students', 'enrolled_count', 'is_full',
            'start_date', 'status', 'progress_percent', 'weeks_count', 'unread_count', 'created_at', 'updated_at'
        ]

    def get_weeks_count(self, obj):
        return obj.batch_weeks.count()

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
            
        user = request.user
        
        # Get the latest read receipt for this user in this batch
        last_receipt = obj.read_receipts.filter(user=user).first()
        
        # Count messages sent by others after the last read receipt
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

    # Progress fields (Mocked for now, to be implemented with real logic)
    overall_progress = serializers.SerializerMethodField()
    weeks_completed = serializers.SerializerMethodField()
    total_weeks = serializers.SerializerMethodField()
    weekly_tests_submitted = serializers.SerializerMethodField()
    total_weekly_tests = serializers.SerializerMethodField()
    manual_unlocked_weeks = serializers.SerializerMethodField()
    weeks_access_status = serializers.SerializerMethodField()

    class Meta:
        model = BatchEnrollment
        fields = [
            'id', 'batch', 'student', 'student_name', 'student_email',
            'status', 'notes', 'manual_unlocked_weeks', 'weeks_access_status',
            'enrolled_at', 'created_at',
            'overall_progress', 'weeks_completed', 'total_weeks',
            'weekly_tests_submitted', 'total_weekly_tests'
        ]
        read_only_fields = ['id', 'batch', 'enrolled_at', 'created_at', 'student_name', 'student_email']

    def get_manual_unlocked_weeks(self, obj):
        return list(obj.manual_unlocks.values_list('batch_week__week_number', flat=True))

    def get_weeks_access_status(self, obj):
        from apps.courses.models import BatchWeek, TestSubmission, StudentSessionView, BatchClassSession
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
                                enrollment=obj, batch_weekly_test=pw.weekly_test, status='published', is_passed=True
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

    def get_overall_progress(self, obj):
        from apps.courses.models import BatchClassSession, StudentSessionView, BatchWeeklyTest, TestSubmission
        total_sessions = BatchClassSession.objects.filter(batch_week__batch=obj.batch).count()
        total_tests = BatchWeeklyTest.objects.filter(batch_week__batch=obj.batch).count()
        total_items = total_sessions + total_tests
        
        if total_items == 0:
            return 0
            
        completed_sessions = StudentSessionView.objects.filter(enrollment=obj, is_completed=True).count()
        completed_tests = TestSubmission.objects.filter(enrollment=obj, is_passed=True, status='published').count()
        completed_items = completed_sessions + completed_tests
        
        return min(100, round((completed_items / total_items) * 100))

    def get_weeks_completed(self, obj):
        from apps.courses.models import BatchWeek, TestSubmission
        all_weeks = BatchWeek.objects.filter(batch=obj.batch).order_by('week_number')
        completed = 0
        for week in all_weeks:
            # A week is completed if test (if exists) is passed
            if hasattr(week, 'weekly_test') and week.weekly_test:
                if TestSubmission.objects.filter(enrollment=obj, batch_weekly_test=week.weekly_test, status='published', is_passed=True).exists():
                    completed += 1
                else:
                    # If there's a test and it's not passed, we stop counting linear progress
                    break
            else:
                # If no test, and we reached here, consider it "done" if it's unlocked 
                # (This is simplified, could also check session completion)
                if week.is_unlocked:
                    completed += 1
        return completed

    def get_total_weeks(self, obj):
        return obj.batch.batch_weeks.count()

    def get_total_weekly_tests(self, obj):
        from apps.courses.models import BatchWeeklyTest
        return BatchWeeklyTest.objects.filter(batch_week__batch=obj.batch).count()

    def get_weekly_tests_submitted(self, obj):
        from apps.courses.models import TestSubmission
        return TestSubmission.objects.filter(enrollment=obj, status='published', is_passed=True).count()
