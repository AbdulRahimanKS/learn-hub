import time
import random
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from apps.courses.models import TestSubmission
from apps.courses.serializers.test_submission_serializers import TestSubmissionSerializer, TestSubmissionUpdateSerializer
from utils.constants import UserTypeConstants
from django.contrib.contenttypes.models import ContentType
from apps.users.models import Notification

class BatchTestSubmissionListView(generics.ListAPIView):
    """
    List all test submissions for a specific batch. Intended for Admin/Teachers.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TestSubmissionSerializer

    def get_queryset(self):
        batch_id = self.kwargs.get('batch_id')
        user = self.request.user
        
        # Admin / Teacher filtering logic can be added here
        # E.g., verifying user is teacher of the batch
        qs = TestSubmission.objects.filter(enrollment__batch_id=batch_id)
        
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
            
        return qs.order_by('-submitted_at')

class TestSubmissionDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or Update a specific test submission.
    """
    permission_classes = [IsAuthenticated]
    queryset = TestSubmission.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return TestSubmissionUpdateSerializer
        return TestSubmissionSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        old_status = instance.status
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Admin is reviewing/updating
        new_status = serializer.validated_data.get('status')
        if new_status and new_status != old_status:
            # Updating status dynamically
            if new_status in [TestSubmission.Status.PUBLISHED, TestSubmission.Status.RETURNED]:
                instance.graded_at = timezone.now()
                instance.graded_by = request.user
                
        self.perform_update(serializer)
        
        # Fire notifications
        if new_status and new_status != old_status:
            student = instance.enrollment.student
            ct = ContentType.objects.get_for_model(TestSubmission)
            
            if new_status == TestSubmission.Status.PUBLISHED:
                Notification.objects.create(
                    user=student,
                    title="Test Results Published",
                    message=f"Your result for Test Attempt {instance.attempt_number} has been published by the instructor. Marks: {instance.marks_obtained}%",
                    notification_type=Notification.NotificationType.SUCCESS,
                    content_type=ct,
                    object_id=instance.id,
                    action_url=f"/progress" # Example URL
                )
            elif new_status == TestSubmission.Status.RETURNED:
                Notification.objects.create(
                    user=student,
                    title="Test Returned for Revision",
                    message=f"Your Test Attempt {instance.attempt_number} was returned. Please review the grader's remarks.",
                    notification_type=Notification.NotificationType.WARNING,
                    content_type=ct,
                    object_id=instance.id,
                    action_url=f"/progress"
                )
                
        return Response({
            "success": True,
            "message": "Test submission updated successfully",
            "data": TestSubmissionSerializer(instance).data
        }, status=status.HTTP_200_OK)

class TriggerAIEvaluationView(APIView):
    """
    Triggers AI Evaluation manually for a specific submission.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            submission = TestSubmission.objects.get(pk=pk)
        except TestSubmission.DoesNotExist:
            return Response({"success": False, "message": "Submission not found"}, status=status.HTTP_404_NOT_FOUND)

        if submission.status not in [TestSubmission.Status.PENDING, TestSubmission.Status.RETURNED]:
            return Response({
                "success": False, 
                "message": f"Cannot evaluate submission in '{submission.status}' state."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Switch status to EVALUATING
        submission.status = TestSubmission.Status.EVALUATING
        submission.save(update_fields=['status'])

        # Notify the student
        ct = ContentType.objects.get_for_model(TestSubmission)
        student = submission.enrollment.student
        
        Notification.objects.create(
            user=student,
            title="AI Evaluation Started",
            message=f"Your Test Attempt {submission.attempt_number} is currently being evaluated by our AI grader.",
            notification_type=Notification.NotificationType.INFO,
            content_type=ct,
            object_id=submission.id,
            action_url=f"/progress"
        )
        
        # Notify whoever triggered it (if not the student)
        if request.user != student:
            Notification.objects.create(
                user=request.user,
                title="AI Evaluation Initiated",
                message=f"AI evaluation started for {student.fullname}'s Test Attempt {submission.attempt_number}.",
                notification_type=Notification.NotificationType.INFO,
                content_type=ct,
                object_id=submission.id
            )

        # In a real scenario, you'd enqueue a Celery task here.
        # e.g., run_ai_grader.delay(submission.id)
        
        return Response({
            "success": True,
            "message": "AI evaluation started successfully.",
            "data": {"status": submission.status}
        }, status=status.HTTP_200_OK)

class SimulateAIEvaluationCompleteView(APIView):
    """
    A utility endpoint to simulate the AI completing its task (e.g. callback from Celery).
    Moves status from EVALUATING to PENDING_REVIEW.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            submission = TestSubmission.objects.get(pk=pk)
        except TestSubmission.DoesNotExist:
            return Response({"success": False, "message": "Submission not found"}, status=status.HTTP_404_NOT_FOUND)

        if submission.status != TestSubmission.Status.EVALUATING:
            return Response({"success": False, "message": "Submission is not currently evaluating."}, status=status.HTTP_400_BAD_REQUEST)

        # Simulate Grade
        submission.status = TestSubmission.Status.PENDING_REVIEW
        submission.marks_obtained = random.randint(40, 100)
        submission.is_passed = submission.marks_obtained >= 50
        submission.grader_remarks = "AI analysis: Good understanding, needs refinement in concepts."
        submission.save()

        # Notify teacher/admin of the batch
        ct = ContentType.objects.get_for_model(TestSubmission)
        batch = submission.enrollment.batch
        teacher = batch.teacher
        
        if teacher:
            Notification.objects.create(
                user=teacher,
                title="AI Evaluation Complete - Pending Review",
                message=f"AI has completed grading for {submission.enrollment.student.fullname}. Review required.",
                notification_type=Notification.NotificationType.WARNING,
                content_type=ct,
                object_id=submission.id,
                action_url=f"/admin/batches/{batch.id}/content" # Or a dedicated submissions page
            )

        return Response({
            "success": True,
            "message": "AI evaluation completed and is pending review.",
            "data": TestSubmissionSerializer(submission).data
        }, status=status.HTTP_200_OK)
