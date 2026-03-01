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
    'CourseWeekListCreateView',
    'CourseWeekDetailView',
    'ClassSessionListCreateView',
    'ClassSessionDetailView',
    'WeeklyTestView',
    'WeeklyTestQuestionListCreateView',
    'WeeklyTestQuestionDetailView',
    'InitMultipartUploadView',
    'CompleteMultipartUploadView',
    'AbortMultipartUploadView',
]
