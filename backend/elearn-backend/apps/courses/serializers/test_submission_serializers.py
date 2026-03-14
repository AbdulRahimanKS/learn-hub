from rest_framework import serializers
from apps.courses.models import TestSubmission, TestSubmissionAnswer, BatchTestQuestion

class TestSubmissionAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.text', read_only=True)
    question_order = serializers.IntegerField(source='question.order', read_only=True)
    max_marks = serializers.FloatField(source='question.marks', read_only=True)

    class Meta:
        model = TestSubmissionAnswer
        fields = [
            'id', 'question', 'question_text', 'question_order', 'max_marks',
            'answer_file', 'answer_text', 'marks_obtained', 'ai_score', 'ai_feedback'
        ]
        read_only_fields = ['id', 'ai_score', 'ai_feedback']

class TestSubmissionSerializer(serializers.ModelSerializer):
    answers = TestSubmissionAnswerSerializer(many=True, read_only=True)
    student_name = serializers.CharField(source='enrollment.student.fullname', read_only=True)
    student_email = serializers.CharField(source='enrollment.student.email', read_only=True)
    batch_name = serializers.CharField(source='enrollment.batch.name', read_only=True)
    week_number = serializers.SerializerMethodField()
    test_title = serializers.CharField(source='batch_weekly_test.title', read_only=True)
    graded_by_name = serializers.CharField(source='graded_by.fullname', read_only=True)

    class Meta:
        model = TestSubmission
        fields = [
            'id', 'batch_weekly_test', 'enrollment', 'attempt_number', 'student_name', 'student_email',
            'batch_name', 'week_number', 'test_title', 'answer_file', 'answer_text', 
            'submitted_at', 'marks_obtained', 'is_passed', 'grader_remarks', 
            'graded_at', 'graded_by', 'graded_by_name', 'status', 'answers'
        ]
        read_only_fields = ['id', 'batch_weekly_test', 'enrollment', 'submitted_at', 'graded_at', 'graded_by']

    def get_week_number(self, obj):
        if obj.batch_weekly_test.batch_week:
            return obj.batch_weekly_test.batch_week.week_number
        return None

class TestSubmissionUpdateSerializer(serializers.ModelSerializer):
    answers = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = TestSubmission
        fields = ['marks_obtained', 'is_passed', 'grader_remarks', 'status', 'answers']

    def update(self, instance, validated_data):
        answers_data = validated_data.pop('answers', None)
        
        # Update main submission fields
        instance = super().update(instance, validated_data)
        
        # Update individual answers if provided
        if answers_data:
            for ans_data in answers_data:
                ans_id = ans_data.get('id')
                marks = ans_data.get('marks_obtained')
                if ans_id is not None and marks is not None:
                    TestSubmissionAnswer.objects.filter(id=ans_id, submission=instance).update(marks_obtained=marks)
        
        return instance
