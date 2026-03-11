from django.urls import path
from apps.courses.views import (
    CourseListView,
    CourseCreateView,
    CourseDetailView,
    CourseUpdateView,
    CourseToggleActiveView,
    BatchSummaryView,
    BatchListView,
    BatchCreateView,
    BatchDetailView,
    BatchUpdateView,
    BatchUpdateStatusView,
    BatchAddStudentView,
    AvailableStudentListView,
    BatchStudentListView,
    BatchStudentEnrollmentUpdateView,
    CourseWeekListCreateView,
    CourseWeekDetailView,
    ClassSessionListCreateView,
    ClassSessionDetailView,
    WeeklyTestView,
    WeeklyTestQuestionListCreateView,
    WeeklyTestQuestionDetailView,
    WeeklyTestQuestionAttachmentView,
    WeeklyTestQuestionAttachmentDetailView,
    BatchWeekListView,
    BatchWeekDetailView,
    BatchClassSessionListCreateView,
    BatchClassSessionDetailView,
    BatchWeeklyTestView,
    BatchWeeklyTestManageView,
    BatchWeeklyTestQuestionListCreateView,
    BatchWeeklyTestQuestionDetailView,
    BatchWeeklyTestQuestionAttachmentView,
    BatchWeeklyTestQuestionAttachmentDetailView,
    CloneBatchContentView,
    ExtendBatchTimelineView,
    InitMultipartUploadView,
    CompleteMultipartUploadView,
    AbortMultipartUploadView,
    CoursePostSessionQuestionListCreateView,
    CoursePostSessionQuestionDetailView,
    BatchPostSessionQuestionListCreateView,
    BatchPostSessionQuestionDetailView,
    BatchClassSessionCompletionView,
    ScheduledWebinarListCreateView,
    ScheduledWebinarDetailView,
)
from apps.courses.views.chat_views import (
    ChatBatchListView,
    BatchChatMessageListCreateView,
    ChatMarkReadView,
)
from apps.courses.views.test_submission_views import (
    BatchTestSubmissionListView,
    TestSubmissionDetailView,
    TriggerAIEvaluationView,
    SimulateAIEvaluationCompleteView,
)
from apps.courses.views.live_session_views import (
    LiveSessionListCreateView,
    LiveSessionDetailView,
)

urlpatterns = [
    # Video Uploads
    path("courses/upload/init/", InitMultipartUploadView.as_view(), name="upload-init"),
    path("courses/upload/complete/", CompleteMultipartUploadView.as_view(), name="upload-complete"),
    path("courses/upload/abort/", AbortMultipartUploadView.as_view(), name="upload-abort"),

    # Courses
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("courses/create/", CourseCreateView.as_view(), name="course-create"),
    path("courses/<int:pk>/", CourseDetailView.as_view(), name="course-detail"),
    path("courses/<int:pk>/update/", CourseUpdateView.as_view(), name="course-update"),
    path("courses/<int:pk>/toggle-active/", CourseToggleActiveView.as_view(), name="course-toggle-active"),

    # Course Modules (Weeks & Sessions)
    path("courses/<int:course_id>/weeks/", CourseWeekListCreateView.as_view(), name="course-week-list-create"),
    path("courses/<int:course_id>/weeks/<int:week_id>/", CourseWeekDetailView.as_view(), name="course-week-detail"),
    path("courses/<int:course_id>/weeks/<int:week_id>/sessions/", ClassSessionListCreateView.as_view(), name="class-session-list-create"),
    path("courses/<int:course_id>/weeks/<int:week_id>/sessions/<int:session_id>/", ClassSessionDetailView.as_view(), name="class-session-detail"),
    path("courses/<int:course_id>/weeks/<int:week_id>/sessions/<int:session_id>/mcq/", CoursePostSessionQuestionListCreateView.as_view(), name="course-session-mcq-list"),
    path("courses/<int:course_id>/weeks/<int:week_id>/sessions/<int:session_id>/mcq/<int:mcq_id>/", CoursePostSessionQuestionDetailView.as_view(), name="course-session-mcq-detail"),
    path("courses/<int:course_id>/weeks/<int:week_id>/test/", WeeklyTestView.as_view(), name="weekly-test"),
    path("courses/<int:course_id>/weeks/<int:week_id>/test/questions/", WeeklyTestQuestionListCreateView.as_view(), name="weekly-test-question-list-create"),
    path("courses/<int:course_id>/weeks/<int:week_id>/test/questions/<int:question_id>/", WeeklyTestQuestionDetailView.as_view(), name="weekly-test-question-detail"),
    path("courses/<int:course_id>/weeks/<int:week_id>/test/questions/<int:question_id>/attachments/", WeeklyTestQuestionAttachmentView.as_view(), name="weekly-test-question-attachments"),
    path("courses/<int:course_id>/weeks/<int:week_id>/test/questions/<int:question_id>/attachments/<int:attachment_id>/", WeeklyTestQuestionAttachmentDetailView.as_view(), name="weekly-test-question-attachment-detail"),

    # Batches
    path("batches/summary/", BatchSummaryView.as_view(), name="batch-summary"),
    path("batches/", BatchListView.as_view(), name="batch-list"),
    path("batches/create/", BatchCreateView.as_view(), name="batch-create"),
    path("batches/<int:pk>/", BatchDetailView.as_view(), name="batch-detail"),
    path("batches/<int:pk>/update/", BatchUpdateView.as_view(), name="batch-update"),
    path("batches/<int:pk>/status/", BatchUpdateStatusView.as_view(), name="batch-update-status"),
    path("batches/<int:pk>/add-student/", BatchAddStudentView.as_view(), name="batch-add-student"),
    path("batches/available-students/", AvailableStudentListView.as_view(), name="batch-available-students"),
    path("batches/<int:pk>/students/", BatchStudentListView.as_view(), name="batch-student-list"),
    path("batches/<int:pk>/students/<int:enrollment_id>/", BatchStudentEnrollmentUpdateView.as_view(), name="batch-student-enrollment-update"),
    path("batches/<int:pk>/clone-content/", CloneBatchContentView.as_view(), name="batch-clone-content"),
    path("batches/<int:pk>/extend-timeline/", ExtendBatchTimelineView.as_view(), name="batch-extend-timeline"),
    path("batches/<int:batch_id>/weeks/", BatchWeekListView.as_view(), name="batch-week-list"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/", BatchWeekDetailView.as_view(), name="batch-week-detail"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/sessions/", BatchClassSessionListCreateView.as_view(), name="batch-class-session-list-create"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/sessions/<int:session_id>/", BatchClassSessionDetailView.as_view(), name="batch-class-session-detail"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/sessions/<int:session_id>/complete/", BatchClassSessionCompletionView.as_view(), name="batch-session-complete"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/sessions/<int:session_id>/mcq/", BatchPostSessionQuestionListCreateView.as_view(), name="batch-session-mcq-list"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/sessions/<int:session_id>/mcq/<int:mcq_id>/", BatchPostSessionQuestionDetailView.as_view(), name="batch-session-mcq-detail"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/test/", BatchWeeklyTestView.as_view(), name="batch-weekly-test"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/test/manage/", BatchWeeklyTestManageView.as_view(), name="batch-weekly-test-manage"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/test/questions/", BatchWeeklyTestQuestionListCreateView.as_view(), name="batch-test-question-list"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/test/questions/<int:question_id>/", BatchWeeklyTestQuestionDetailView.as_view(), name="batch-test-question-detail"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/test/questions/<int:question_id>/attachments/", BatchWeeklyTestQuestionAttachmentView.as_view(), name="batch-test-question-attachments"),
    path("batches/<int:batch_id>/weeks/<int:week_id>/test/questions/<int:question_id>/attachments/<int:attachment_id>/", BatchWeeklyTestQuestionAttachmentDetailView.as_view(), name="batch-test-question-attachment-detail"),

    # Test Submissions / Evaluation Workflow
    path("batches/<int:batch_id>/submissions/", BatchTestSubmissionListView.as_view(), name="batch-submissions-list"),
    path("submissions/<int:pk>/", TestSubmissionDetailView.as_view(), name="submission-detail"),
    path("submissions/<int:pk>/trigger-evaluation/", TriggerAIEvaluationView.as_view(), name="trigger-ai-evaluation"),
    path("submissions/<int:pk>/simulate-evaluation-complete/", SimulateAIEvaluationCompleteView.as_view(), name="simulate-ai-evaluation-complete"),

    # Webinars
    path("batches/<int:batch_id>/webinars/", ScheduledWebinarListCreateView.as_view(), name="batch-webinar-list-create"),
    path("batches/<int:batch_id>/webinars/<int:webinar_id>/", ScheduledWebinarDetailView.as_view(), name="batch-webinar-detail"),

    # Live Sessions
    path("batches/<int:batch_id>/live-sessions/", LiveSessionListCreateView.as_view(), name="batch-live-session-list-create"),
    path("batches/<int:batch_id>/live-sessions/<int:session_id>/", LiveSessionDetailView.as_view(), name="batch-live-session-detail"),

    # Chat
    path("chat/batches/", ChatBatchListView.as_view(), name="chat-batch-list"),
    path("chat/batches/<int:batch_id>/messages/", BatchChatMessageListCreateView.as_view(), name="chat-messages"),
    path("chat/batches/<int:batch_id>/mark-read/", ChatMarkReadView.as_view(), name="chat-mark-read"),
]
