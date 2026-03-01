import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.db.models import Q

from apps.courses.models import Batch, BatchEnrollment
from apps.courses.serializers import (
    BatchListSerializer,
    BatchCreateUpdateSerializer,
    BatchEnrollmentSerializer,
)
from utils.permissions import IsAdminOrTeacher, IsAuthenticated
from utils.common import format_success_response, handle_serializer_errors, ServiceError, generate_temp_password
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants
from utils.email_utils import send_email

logger = logging.getLogger(__name__)


def _activate_and_email_teacher(teacher_user, requesting_user):
    """If a teacher has never been activated (no usable password), generate credentials and email them."""
    if teacher_user and not teacher_user.has_usable_password():
        temp_password = generate_temp_password()
        teacher_user.set_password(temp_password)
        teacher_user.status = 'ACTIVE'
        teacher_user.is_active = True
        teacher_user.save(update_fields=['password', 'is_active', 'status'])
        send_email(
            user=requesting_user,
            subject="Welcome to LearnHub – Your Login Credentials",
            template="emails/user_welcome_credentials",
            to_emails=[teacher_user.email],
            payload={
                "user_name": teacher_user.fullname,
                "email": teacher_user.email,
                "password": temp_password,
                "role": "Teacher",
            },
        )
        logger.info(f"Welcome credentials sent to teacher {teacher_user.email} upon first batch assignment.")


@extend_schema(tags=["Batches"])
class BatchSummaryView(APIView):
    """
    Returns aggregate stats for the summary cards at the top of the Batches page.
    Respects the same role-based filtering as BatchListView.
    """
    permission_classes = [IsAdminOrTeacher]

    @extend_schema(
        summary="Get batch summary stats",
        responses={200: None},
    )
    def get(self, request):
        qs = Batch.objects.filter(is_deleted=False)

        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.TEACHER:
            qs = qs.filter(
                Q(teacher=user) | Q(co_teachers=user)
            ).distinct()

        total_batches = qs.count()
        active_batches = qs.filter(is_active=True).count()
        upcoming_batches = 0 
        on_hold_batches = 0

        total_students = BatchEnrollment.objects.filter(
            batch__in=qs,
            status=BatchEnrollment.Status.ACTIVE
        ).count()

        return format_success_response(
            message="Batch summary retrieved successfully",
            data={
                'total_batches': total_batches,
                'active_batches': active_batches,
                'upcoming_batches': upcoming_batches,
                'on_hold_batches': on_hold_batches,
                'total_students': total_students,
            }
        )



@extend_schema(tags=["Batches"])
class BatchListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List all batches",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name or batch code"),
            OpenApiParameter("is_active", OpenApiTypes.BOOL, description="Filter by active status"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
        ],
        responses={200: BatchListSerializer(many=True)},
    )
    def get(self, request):
        qs = Batch.objects.filter(is_deleted=False).select_related('teacher', 'course').order_by('-created_at')

        user = request.user
        if getattr(user, 'user_type', None):
            if user.user_type.name == UserTypeConstants.TEACHER:
                qs = qs.filter(
                    Q(teacher=user) | 
                    Q(co_teachers=user)
                ).distinct()
            elif user.user_type.name == UserTypeConstants.STUDENT:
                qs = qs.filter(
                    enrollments__student=user
                ).distinct()

        is_active_param = request.query_params.get('is_active')
        if is_active_param is not None:
            qs = qs.filter(is_active=is_active_param.lower() == 'true')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(batch_code__icontains=search)
            )

        paginate_param = request.query_params.get('paginate', 'true').lower() == 'true'
        if paginate_param:
            paginator = CustomPageNumberPagination()
            paginated_qs = paginator.paginate_queryset(qs, request)
            serializer = BatchListSerializer(paginated_qs, many=True)
            return paginator.get_paginated_response(serializer.data, message="Batches retrieved successfully")

        serializer = BatchListSerializer(qs, many=True)
        return format_success_response(
            message="Batches retrieved successfully",
            data=serializer.data
        )



@extend_schema(tags=["Batches"])
class BatchCreateView(APIView):
    permission_classes = [IsAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        summary="Create a new batch",
        request=BatchCreateUpdateSerializer,
        responses={201: BatchListSerializer},
    )
    def post(self, request):
        try:
            serializer = BatchCreateUpdateSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
            batch = serializer.save()

            if batch.teacher:
                _activate_and_email_teacher(batch.teacher, request.user)
            for co_teacher in batch.co_teachers.all():
                _activate_and_email_teacher(co_teacher, request.user)

            return format_success_response(
                message="Batch created successfully",
                data=None,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating batch: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Batches"])
class BatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk, is_deleted=False)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Retrieve a single batch by ID",
        responses={200: BatchCreateUpdateSerializer},
    )
    def get(self, request, pk):
        try:
            batch = self.get_object(pk)
            serializer = BatchCreateUpdateSerializer(batch)
            return format_success_response(
                message="Batch retrieved successfully",
                data=serializer.data
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error retrieving batch {pk}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Batches"])
class BatchUpdateView(APIView):
    permission_classes = [IsAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk, is_deleted=False)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Update an existing batch",
        request=BatchCreateUpdateSerializer,
        responses={200: BatchListSerializer},
    )
    def patch(self, request, pk):
        try:
            batch = self.get_object(pk)
            user = request.user

            is_admin = getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.ADMIN
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to update this batch.", status_code=status.HTTP_403_FORBIDDEN)

            serializer = BatchCreateUpdateSerializer(batch, data=request.data, partial=True, context={'request': request})
            
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
            batch = serializer.save()

            if batch.teacher:
                _activate_and_email_teacher(batch.teacher, request.user)
            for co_teacher in batch.co_teachers.all():
                _activate_and_email_teacher(co_teacher, request.user)

            return format_success_response(
                message="Batch updated successfully",
                data=None,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating batch {pk}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Batches"])
class BatchToggleActiveView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk, is_deleted=False)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Toggle batch active status (Admin or Assigned Teacher only)",
        request=None,
        responses={200: BatchListSerializer},
    )
    def post(self, request, pk):
        try:
            batch = self.get_object(pk)
            user = request.user

            is_admin = getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.ADMIN
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to update this batch.", status_code=status.HTTP_403_FORBIDDEN)

            batch.is_active = not batch.is_active
            batch.updated_by = request.user
            batch.save()

            status_label = "activated" if batch.is_active else "deactivated"
            return format_success_response(
                message=f"Batch {status_label} successfully",
                data=None,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error toggling batch active status: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class BatchAddStudentView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get_batch(self, pk):
        try:
            return Batch.objects.get(pk=pk, is_deleted=False)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Add a student to a batch (Admin or Assigned Teacher only)",
        request=BatchEnrollmentSerializer,
        responses={201: BatchEnrollmentSerializer},
    )
    def post(self, request, pk):
        try:
            batch = self.get_batch(pk)
            user = request.user

            is_admin = getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.ADMIN
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to add students to this batch.", status_code=status.HTTP_403_FORBIDDEN)

            if batch.enrolled_count >= batch.max_students:
                raise ServiceError(
                    detail=f"Batch is full. Maximum capacity of {batch.max_students} students has been reached.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            serializer = BatchEnrollmentSerializer(data=request.data)
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)

            student = serializer.validated_data['student']

            if BatchEnrollment.objects.filter(batch=batch, student=student).exists():
                raise ServiceError(
                    detail="This student is already enrolled in this batch.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            active_enrollment = BatchEnrollment.objects.filter(
                student=student,
                status=BatchEnrollment.Status.ACTIVE
            ).select_related('batch').first()

            if active_enrollment:
                raise ServiceError(
                    detail=f"Student is already actively enrolled in another batch: '{active_enrollment.batch.name}'.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            enrollment = BatchEnrollment.objects.create(
                batch=batch,
                student=student,
                status=serializer.validated_data.get('status', BatchEnrollment.Status.ACTIVE),
                notes=serializer.validated_data.get('notes', ''),
                fee_paid=serializer.validated_data.get('fee_paid', False),
                fee_amount=serializer.validated_data.get('fee_amount', None),
                enrolled_by=user,
            )

            if not student.has_usable_password():
                temp_password = generate_temp_password()
                student.set_password(temp_password)
                student.status = 'ACTIVE'
                student.is_active = True
                student.save(update_fields=['password', 'is_active', 'status'])
                send_email(
                    user=request.user,
                    subject="Welcome to LearnHub – Your Login Credentials",
                    template="emails/user_welcome_credentials",
                    to_emails=[student.email],
                    payload={
                        "user_name": student.fullname,
                        "email": student.email,
                        "password": temp_password,
                        "role": "Student",
                    },
                )
                logger.info(f"Welcome credentials sent to student {student.email} upon first batch enrollment.")

            return format_success_response(
                message="Student added to batch successfully.",
                data=None,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error adding student to batch {pk}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
