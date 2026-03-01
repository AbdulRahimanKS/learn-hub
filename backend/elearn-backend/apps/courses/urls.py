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
    BatchToggleActiveView,
    BatchAddStudentView,
    CourseWeekListCreateView,
    CourseWeekDetailView,
    ClassSessionListCreateView,
    ClassSessionDetailView,
)

urlpatterns = [
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

    # Batches
    path("batches/summary/", BatchSummaryView.as_view(), name="batch-summary"),
    path("batches/", BatchListView.as_view(), name="batch-list"),
    path("batches/create/", BatchCreateView.as_view(), name="batch-create"),
    path("batches/<int:pk>/", BatchDetailView.as_view(), name="batch-detail"),
    path("batches/<int:pk>/update/", BatchUpdateView.as_view(), name="batch-update"),
    path("batches/<int:pk>/toggle-active/", BatchToggleActiveView.as_view(), name="batch-toggle-active"),
    path("batches/<int:pk>/add-student/", BatchAddStudentView.as_view(), name="batch-add-student"),
]
