from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from apps.courses.models import TestSubmission, TestSubmissionAnswer

class TestSubmissionAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.text', read_only=True)
    question_order = serializers.IntegerField(source='question.order', read_only=True)
    max_marks = serializers.FloatField(source='question.marks', read_only=True)
    question_file = serializers.FileField(source='question.question_file', read_only=True)
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = TestSubmissionAnswer
        fields = [
            'id', 'question', 'question_text', 'question_order', 'max_marks',
            'question_file', 'answer_file', 'answer_text', 'marks_obtained', 
            'ai_score', 'ai_feedback', 'ai_response', 'attachments'
        ]
        read_only_fields = ['id', 'ai_score', 'ai_feedback']

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_attachments(self, obj):
        from apps.courses.serializers.course_module_serializers import BatchTestQuestionAttachmentSerializer
        return BatchTestQuestionAttachmentSerializer(obj.question.attachments.all(), many=True).data

class TestSubmissionSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField()
    student_name = serializers.CharField(source='enrollment.student.fullname', read_only=True)
    student_profile_picture = serializers.SerializerMethodField()
    student_email = serializers.CharField(source='enrollment.student.email', read_only=True)
    batch_name = serializers.CharField(source='enrollment.batch.name', read_only=True)
    week_number = serializers.SerializerMethodField()
    test_title = serializers.CharField(source='batch_weekly_test.title', read_only=True)
    pass_percentage = serializers.FloatField(source='batch_weekly_test.pass_percentage', read_only=True)
    graded_by_name = serializers.CharField(source='graded_by.fullname', read_only=True)

    class Meta:
        model = TestSubmission
        fields = [
            'id', 'batch_weekly_test', 'enrollment', 'attempt_number', 'student_name', 'student_profile_picture',
            'student_email',
            'batch_name', 'week_number', 'test_title', 'pass_percentage',
            'submitted_at', 'marks_obtained', 'is_passed', 'grader_remarks', 
            'graded_at', 'graded_by', 'graded_by_name', 'status',
            'ai_score', 'ai_feedback', 'ai_evaluated_at', 'ai_job_status', 'ai_error_message',
            'answers'
        ]
        read_only_fields = ['id', 'batch_weekly_test', 'enrollment', 'submitted_at', 'graded_at', 'graded_by']

    @extend_schema_field(OpenApiTypes.URI)
    def get_student_profile_picture(self, obj):
        request = self.context.get('request')
        try:
            student = obj.enrollment.student
            pic = student.profile.profile_picture
            if pic and request:
                return request.build_absolute_uri(pic.url)
            if pic:
                return pic.url
        except Exception:
            pass
        return None

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_answers(self, obj):
        from apps.courses.serializers.course_module_serializers import BatchTestQuestionAttachmentSerializer
        
        request = self.context.get('request')
        questions = obj.batch_weekly_test.questions.all().order_by('order', 'id')
        submission_answers = {a.question_id: a for a in obj.answers.all()}
        
        results = []
        for q in questions:
            ans = submission_answers.get(q.id)
            if ans:
                data = TestSubmissionAnswerSerializer(ans, context=self.context).data
                data['is_attended'] = True
            else:
                data = {
                    'id': f"unattended-{q.id}",
                    'question': q.id,
                    'question_text': q.text,
                    'question_order': q.order,
                    'max_marks': q.marks,
                    'question_file': request.build_absolute_uri(q.question_file.url) if q.question_file and request else (q.question_file.url if q.question_file else None),
                    'answer_text': None,
                    'answer_file': None,
                    'marks_obtained': 0,
                    'ai_score': None,
                    'ai_feedback': None,
                    'ai_response': None,
                    'attachments': BatchTestQuestionAttachmentSerializer(q.attachments.all(), many=True, context=self.context).data,
                    'is_attended': False
                }
            results.append(data)
        return results

    @extend_schema_field(OpenApiTypes.INT)
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

    def validate(self, attrs):
        """Derive pass/fail from batch test config when overall percentage is submitted (ignore client is_passed)."""
        instance = self.instance
        if instance and 'marks_obtained' in attrs and attrs['marks_obtained'] is not None:
            test = instance.batch_weekly_test
            threshold = float(test.pass_percentage) if test else 70.0
            attrs['is_passed'] = float(attrs['marks_obtained']) >= threshold
        return attrs

    def update(self, instance, validated_data):
        answers_data = validated_data.pop('answers', None)
        
        # Update main submission fields
        instance = super().update(instance, validated_data)
        
        # Update individual answers if provided
        if answers_data:
            for ans_data in answers_data:
                ans_id = ans_data.get('id')
                marks = ans_data.get('marks_obtained')
                feedback = ans_data.get('ai_feedback')
                updates = {}
                if marks is not None:
                    updates['marks_obtained'] = marks
                if feedback is not None:
                    updates['ai_feedback'] = str(feedback).strip()
                if ans_id is not None and updates:
                    TestSubmissionAnswer.objects.filter(id=ans_id, submission=instance).update(**updates)
        
        return instance
