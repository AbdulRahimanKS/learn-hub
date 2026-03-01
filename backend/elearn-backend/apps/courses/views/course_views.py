import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.db.models import Q

from apps.courses.models import Course
from apps.courses.serializers import (
    CourseListSerializer,
    CourseDetailSerializer,
    CourseCreateUpdateSerializer,
)
from utils.permissions import IsSuperAdminAdminOrTeacher, IsSuperAdminOrAdmin, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants

logger = logging.getLogger(__name__)


@extend_schema(tags=["Courses"])
class CourseListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List all courses",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by title, course code, or description"),
            OpenApiParameter("is_active", OpenApiTypes.BOOL, description="Filter by active status"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
        ],
        responses={200: CourseListSerializer(many=True)},
    )
    def get(self, request):
        qs = Course.objects.filter(is_deleted=False).prefetch_related('tags').order_by('title')

        user = request.user
        if getattr(user, 'user_type', None):
            if user.user_type.name == UserTypeConstants.TEACHER:
                qs = qs.filter(
                    batches__is_deleted=False
                ).filter(
                    Q(batches__teacher=user) | 
                    Q(batches__co_teachers=user)
                ).distinct()
            elif user.user_type.name == UserTypeConstants.STUDENT:
                qs = qs.filter(
                    batches__is_deleted=False,
                    batches__enrollments__student=user
                ).distinct()

        is_active_param = request.query_params.get('is_active')
        if is_active_param is not None:
            qs = qs.filter(is_active=is_active_param.lower() == 'true')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(course_code__icontains=search) |
                Q(description__icontains=search)
            )

        paginate_param = request.query_params.get('paginate', 'true').strip().lower()
        if paginate_param != 'false':
            paginator = CustomPageNumberPagination()
            page = paginator.paginate_queryset(qs, request)
            serializer = CourseListSerializer(page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data, message="Courses retrieved successfully")

        serializer = CourseListSerializer(qs, many=True, context={'request': request})
        return format_success_response(message="Courses retrieved successfully", data=serializer.data)



@extend_schema(tags=["Courses"])
class CourseCreateView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        summary="Create a new course (Admin only)",
        request=CourseCreateUpdateSerializer,
        responses={201: CourseDetailSerializer},
    )
    def post(self, request):
        try:
            serializer = CourseCreateUpdateSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            serializer.save()

            return format_success_response(
                message="Course created successfully",
                data=None,
                status_code=status.HTTP_201_CREATED,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating course: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Courses"])
class CourseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        try:
            qs = Course.objects.filter(is_deleted=False)

            user = request.user
            if getattr(user, 'user_type', None):
                if user.user_type.name == UserTypeConstants.TEACHER:
                    qs = qs.filter(
                        batches__is_deleted=False
                    ).filter(
                        Q(batches__teacher=user) | 
                        Q(batches__co_teachers=user)
                    ).distinct()
                elif user.user_type.name == UserTypeConstants.STUDENT:
                    qs = qs.filter(
                        batches__is_deleted=False,
                        batches__enrollments__student=user
                    ).distinct()

            return qs.prefetch_related('tags').get(pk=pk)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found or you do not have permission to view it.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Retrieve a course",
        responses={200: CourseDetailSerializer},
    )
    def get(self, request, pk):
        course = self.get_object(request, pk)
        serializer = CourseDetailSerializer(course, context={'request': request})
        return format_success_response(message="Course retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Soft-delete a course (Admin only)",
        responses={200: None},
    )
    def delete(self, request, pk):
        try:
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name not in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]:
                raise ServiceError(detail="You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

            course = self.get_object(request, pk)

            if course.batches.filter(is_deleted=False).exists():
                raise ServiceError(
                    detail="Cannot delete a course that has batches. Remove all batches first.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            course.soft_delete(user)
            return format_success_response(message="Course deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting course: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Courses"])
class CourseUpdateView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, request, pk):
        try:
            qs = Course.objects.filter(is_deleted=False)
            
            user = request.user
            if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.TEACHER:
                qs = qs.filter(
                    batches__is_deleted=False
                ).filter(
                    Q(batches__teacher=user) | 
                    Q(batches__co_teachers=user)
                ).distinct()

            return qs.prefetch_related('tags').get(pk=pk)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found or you do not have permission to edit it.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Update a course (Admin only)",
        request=CourseCreateUpdateSerializer,
        responses={200: CourseDetailSerializer},
    )
    def patch(self, request, pk):
        try:
            course = self.get_object(request, pk)
            serializer = CourseCreateUpdateSerializer(
                course, data=request.data, partial=True, context={'request': request}
            )
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            serializer.save()
            
            return format_success_response(message="Course updated successfully", data=None)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating course: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Courses"])
class CourseToggleActiveView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    def get_object(self, pk):
        try:
            return Course.objects.get(pk=pk, is_deleted=False)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Toggle course active status (Admin only)",
        request=None,
        responses={200: CourseDetailSerializer},
    )
    def post(self, request, pk):
        try:
            course = self.get_object(pk)
            course.is_active = not course.is_active
            course.updated_by = request.user
            course.save()

            status_label = "activated" if course.is_active else "deactivated"
            return format_success_response(
                message=f"Course {status_label} successfully",
                data=None,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error toggling course active status: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
