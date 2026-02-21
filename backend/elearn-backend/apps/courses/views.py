import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.db.models import Q

from apps.courses.models import Course, Tag
from apps.courses.serializers import (
    CourseListSerializer,
    CourseDetailSerializer,
    CourseCreateUpdateSerializer,
)
from utils.permissions import IsAdmin
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination

logger = logging.getLogger(__name__)



@extend_schema(tags=["Courses"])
class CourseListView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        summary="List all courses",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by title, course code, or description"),
            OpenApiParameter("is_active", OpenApiTypes.BOOL, description="Filter by active status (admin only)"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
        ],
        responses={200: CourseListSerializer(many=True)},
    )
    def get(self, request):
        qs = Course.objects.filter(is_deleted=False).prefetch_related('tags').order_by('title')

        is_active_param = request.query_params.get('is_active')
        if is_active_param is not None:
            qs = qs.filter(is_active=is_active_param.lower() == 'true')

        # Search
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(course_code__icontains=search) |
                Q(description__icontains=search)
            )

        # Paginate (default: true; skip if ?paginate=false)
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
    permission_classes = [IsAdmin]
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

            course = serializer.save()

            response_serializer = CourseDetailSerializer(course, context={'request': request})
            return format_success_response(
                message="Course created successfully",
                data=response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating course: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Courses"])
class CourseDetailView(APIView):
    permission_classes = [IsAdmin]

    def get_object(self, pk):
        try:
            qs = Course.objects.filter(is_deleted=False)
            return qs.prefetch_related('tags').get(pk=pk)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Retrieve a course",
        responses={200: CourseDetailSerializer},
    )
    def get(self, request, pk):
        course = self.get_object(pk)
        serializer = CourseDetailSerializer(course, context={'request': request})
        return format_success_response(message="Course retrieved successfully", data=serializer.data)

    @extend_schema(
        summary="Soft-delete a course (Admin only)",
        responses={200: None},
    )
    def delete(self, request, pk):
        try:
            course = self.get_object(pk)

            if course.batches.filter(is_deleted=False).exists():
                raise ServiceError(
                    detail="Cannot delete a course that has batches. Remove all batches first.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            course.is_deleted = True
            course.is_active = False
            course.save()
            return format_success_response(message="Course deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting course: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Courses"])
class CourseUpdateView(APIView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, pk):
        try:
            return Course.objects.filter(is_deleted=False).prefetch_related('tags').get(pk=pk)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Update a course (Admin only)",
        request=CourseCreateUpdateSerializer,
        responses={200: CourseDetailSerializer},
    )
    def patch(self, request, pk):
        try:
            course = self.get_object(pk)
            serializer = CourseCreateUpdateSerializer(
                course, data=request.data, partial=True, context={'request': request}
            )
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            course = serializer.save()
            return format_success_response(message="Course updated successfully", data=None)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating course: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Courses"])
class CourseToggleActiveView(APIView):
    permission_classes = [IsAdmin]

    def get_object(self, pk):
        try:
            return Course.objects.get(pk=pk, is_deleted=False)
        except Course.DoesNotExist:
            raise ServiceError(detail="Course not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Toggle course active status (Admin only)",
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
