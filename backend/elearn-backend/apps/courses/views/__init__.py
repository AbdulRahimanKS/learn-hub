from .course_views import (
    CourseListView,
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
    BatchToggleActiveView,
    BatchAddStudentView,
    AvailableStudentListView,
    BatchStudentListView,
    CloneBatchContentView,
    ExtendBatchTimelineView,
)

from .course_module_views import (
    CourseWeekListCreateView,
    CourseWeekDetailView,
    ClassSessionListCreateView,
    ClassSessionDetailView,
    WeeklyTestView,
    WeeklyTestQuestionListCreateView,
    WeeklyTestQuestionDetailView,
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
)

from .upload_views import (
    InitMultipartUploadView,
    CompleteMultipartUploadView,
    AbortMultipartUploadView,
)

__all__ = [
    'CourseListView',
    'CourseCreateView',
    'CourseDetailView',
    'CourseUpdateView',
    'CourseToggleActiveView',
    'BatchSummaryView',
    'BatchListView',
    'BatchCreateView',
    'BatchDetailView',
    'BatchUpdateView',
    'BatchToggleActiveView',
    'BatchAddStudentView',
    'AvailableStudentListView',
    'BatchStudentListView',
    'CloneBatchContentView',
    'ExtendBatchTimelineView',
    'CourseWeekListCreateView',
    'CourseWeekDetailView',
    'ClassSessionListCreateView',
    'ClassSessionDetailView',
    'WeeklyTestView',
    'WeeklyTestQuestionListCreateView',
    'WeeklyTestQuestionDetailView',
    'BatchWeekListView',
    'BatchWeekDetailView',
    'BatchClassSessionListCreateView',
    'BatchWeeklyTestView',
    'InitMultipartUploadView',
    'CompleteMultipartUploadView',
    'AbortMultipartUploadView',
]
