from django.urls import path
from apps.courses.views import (
    CourseListView,
    CourseCreateView,
    CourseDetailView,
    CourseUpdateView,
    CourseToggleActiveView,
)

urlpatterns = [
    # Courses
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("courses/create/", CourseCreateView.as_view(), name="course-create"),
    path("courses/<int:pk>/", CourseDetailView.as_view(), name="course-detail"),
    path("courses/<int:pk>/update/", CourseUpdateView.as_view(), name="course-update"),
    path("courses/<int:pk>/toggle-active/", CourseToggleActiveView.as_view(), name="course-toggle-active"),
]
