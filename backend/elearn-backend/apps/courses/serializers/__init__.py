from .course_serializers import (
    TagSerializer,
    CourseListSerializer,
    CourseDetailSerializer,
    CourseCreateUpdateSerializer,
)
from .batch_serializers import (
    BatchListSerializer,
    BatchCreateUpdateSerializer,
    BatchEnrollmentSerializer,
)
from .course_module_serializers import (
    CourseWeekSerializer,
    CourseWeekCreateUpdateSerializer,
    CourseClassSessionSerializer,
    CourseClassSessionCreateUpdateSerializer,
    BatchClassSessionSerializer,
    BatchClassSessionCreateUpdateSerializer,
    # Course-level test serializers
    CourseWeeklyTestSerializer,
    CourseWeeklyTestCreateUpdateSerializer,
    CourseTestQuestionSerializer,
    # Batch-level test serializers
    BatchWeeklyTestSerializer,
    BatchWeeklyTestCreateUpdateSerializer,
    BatchTestQuestionSerializer,
    # Legacy aliases (kept for backward compat)
    WeeklyTestSerializer,
    WeeklyTestCreateUpdateSerializer,
    WeeklyTestQuestionSerializer,
)

__all__ = [
    'TagSerializer',
    'CourseListSerializer',
    'CourseDetailSerializer',
    'CourseCreateUpdateSerializer',
    'BatchListSerializer',
    'BatchCreateUpdateSerializer',
    'BatchEnrollmentSerializer',
    'CourseWeekSerializer',
    'CourseWeekCreateUpdateSerializer',
    'CourseClassSessionSerializer',
    'CourseClassSessionCreateUpdateSerializer',
    'BatchClassSessionSerializer',
    'BatchClassSessionCreateUpdateSerializer',
    'CourseWeeklyTestSerializer',
    'CourseWeeklyTestCreateUpdateSerializer',
    'CourseTestQuestionSerializer',
    'BatchWeeklyTestSerializer',
    'BatchWeeklyTestCreateUpdateSerializer',
    'BatchTestQuestionSerializer',
    'WeeklyTestSerializer',
    'WeeklyTestCreateUpdateSerializer',
    'WeeklyTestQuestionSerializer',
]
