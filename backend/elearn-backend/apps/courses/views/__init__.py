from .course_views import (
    CourseListView,
    CourseMySummaryView,
    CourseCreateView,
    CourseDetailView,
    CourseUpdateView,
    CourseToggleActiveView,
)
from .batch_views import (
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
    CloneBatchContentView,
    ExtendBatchTimelineView,
    BatchStudentWeekUnlockToggleView,
    BatchStudentBulkUpdateView,
)

from .course_module_views import (
    CourseWeekListCreateView,
    CourseWeekDetailView,
    ClassSessionListCreateView,
    ClassSessionDetailView,
    WeeklyTestView,
    WeeklyTestQuestionListCreateView,
    WeeklyTestQuestionDetailView,
    WeeklyTestQuestionAttachmentView,
    WeeklyTestQuestionAttachmentDetailView,
)

from .batch_content_views import (
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
    BatchClassSessionCompletionView,
)

from .upload_views import (
    InitMultipartUploadView,
    CompleteMultipartUploadView,
    AbortMultipartUploadView,
)

from .session_mcq_views import (
    CoursePostSessionQuestionListCreateView,
    CoursePostSessionQuestionDetailView,
    BatchPostSessionQuestionListCreateView,
    BatchPostSessionQuestionDetailView,
)

from .scheduled_webinar_views import (
    ScheduledWebinarListCreateView,
    ScheduledWebinarDetailView,
)

from .live_session_views import (
    LiveSessionListCreateView,
    LiveSessionDetailView,
)

__all__ = [
    'CourseListView',
    'CourseMySummaryView',
    'CourseCreateView',
    'CourseDetailView',
    'CourseUpdateView',
    'CourseToggleActiveView',
    'BatchSummaryView',
    'BatchListView',
    'BatchCreateView',
    'BatchDetailView',
    'BatchUpdateView',
    'BatchUpdateStatusView',
    'BatchAddStudentView',
    'AvailableStudentListView',
    'BatchStudentListView',
    'BatchStudentEnrollmentUpdateView',
    'CloneBatchContentView',
    'ExtendBatchTimelineView',
    'CourseWeekListCreateView',
    'CourseWeekDetailView',
    'ClassSessionListCreateView',
    'ClassSessionDetailView',
    'WeeklyTestView',
    'WeeklyTestQuestionListCreateView',
    'WeeklyTestQuestionDetailView',
    'WeeklyTestQuestionAttachmentView',
    'WeeklyTestQuestionAttachmentDetailView',
    'BatchWeekListView',
    'BatchWeekDetailView',
    'BatchClassSessionListCreateView',
    'BatchClassSessionDetailView',
    'BatchWeeklyTestView',
    'BatchWeeklyTestManageView',
    'BatchWeeklyTestQuestionListCreateView',
    'BatchWeeklyTestQuestionDetailView',
    'BatchWeeklyTestQuestionAttachmentView',
    'BatchWeeklyTestQuestionAttachmentDetailView',
    'BatchClassSessionCompletionView',
    'InitMultipartUploadView',
    'CompleteMultipartUploadView',
    'AbortMultipartUploadView',
    
    'CoursePostSessionQuestionListCreateView',
    'CoursePostSessionQuestionDetailView',
    'BatchPostSessionQuestionListCreateView',
    'BatchPostSessionQuestionDetailView',

    'ScheduledWebinarListCreateView',
    'ScheduledWebinarDetailView',

    'LiveSessionListCreateView',
    'LiveSessionDetailView',
    'BatchStudentWeekUnlockToggleView',
    'BatchStudentBulkUpdateView',
]
