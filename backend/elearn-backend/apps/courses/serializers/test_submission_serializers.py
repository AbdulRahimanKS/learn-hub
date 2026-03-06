from rest_framework import serializers
from apps.courses.models import TestSubmission

class TestSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='enrollment.student.fullname', read_only=True)
    student_email = serializers.CharField(source='enrollment.student.email', read_only=True)
    batch_name = serializers.CharField(source='enrollment.batch.name', read_only=True)
    week_number = serializers.SerializerMethodField()
    test_title = serializers.CharField(source='weekly_test.title', read_only=True)
    graded_by_name = serializers.CharField(source='graded_by.fullname', read_only=True)

    class Meta:
        model = TestSubmission
        fields = [
            'id', 'weekly_test', 'enrollment', 'attempt_number', 'student_name', 'student_email',
            'batch_name', 'week_number', 'test_title', 'answer_file', 'answer_text', 
            'submitted_at', 'marks_obtained', 'is_passed', 'grader_remarks', 
            'graded_at', 'graded_by', 'graded_by_name', 'status'
        ]
        read_only_fields = ['id', 'weekly_test', 'enrollment', 'submitted_at', 'graded_at', 'graded_by']

    def get_week_number(self, obj):
        if obj.weekly_test.batch_week:
            return obj.weekly_test.batch_week.week_number
        if obj.weekly_test.course_week:
            return obj.weekly_test.course_week.week_number
        return None

class TestSubmissionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestSubmission
        fields = ['marks_obtained', 'is_passed', 'grader_remarks', 'status']
