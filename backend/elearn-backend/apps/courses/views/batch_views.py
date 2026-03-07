import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework import serializers
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
from apps.users.serializers.user_management_serializers import UserManagementSerializer
from apps.users.models import User
from apps.courses.models import BatchWeek

from utils.permissions import IsAuthenticated, IsSuperAdminAdminOrTeacher
from utils.common import (
    format_success_response, handle_serializer_errors, ServiceError, 
    activate_user_and_send_welcome_email, get_current_local_date,
    create_notification
)
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants
from apps.courses.services import initialize_batch_weeks, push_content_to_batch, extend_batch_timeline

logger = logging.getLogger(__name__)


@extend_schema(tags=["Batches"])
class BatchSummaryView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    @extend_schema(
        summary="Get batch summary stats",
        responses={200: None},
    )
    def get(self, request):
        qs = Batch.objects.all()

        user = request.user
        if getattr(user, 'user_type', None) and user.user_type.name == UserTypeConstants.TEACHER:
            qs = qs.filter(
                Q(teacher=user) | Q(co_teachers=user)
            ).distinct()

        total_batches = qs.count()
        active_batches = qs.filter(status=Batch.Status.ACTIVE).count()
        completed_batches = qs.filter(status=Batch.Status.COMPLETED).count()

        total_students = BatchEnrollment.objects.filter(
            batch__in=qs,
            status=BatchEnrollment.Status.ACTIVE
        ).count()

        return format_success_response(
            message="Batch summary retrieved successfully",
            data={
                'total_batches': total_batches,
                'active_batches': active_batches,
                'completed_batches': completed_batches,
                'total_students': total_students,
            }
        )



@extend_schema(tags=["Batches"])
class BatchListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List all batches",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name"),
            OpenApiParameter("status", OpenApiTypes.STR, description="Filter by status (ACTIVE, COMPLETED)"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
        ],
        responses={200: BatchListSerializer(many=True)},
    )
    def get(self, request):
        qs = Batch.objects.select_related('teacher', 'course').order_by('-created_at')

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

        status_param = request.query_params.get('status')
        if status_param is not None:
            qs = qs.filter(status=status_param.upper())

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
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
    permission_classes = [IsSuperAdminAdminOrTeacher]
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
                activate_user_and_send_welcome_email(batch.teacher, request.user)
                create_notification(batch.teacher, title="New Batch Assignment", message=f"You have been assigned as the Primary Teacher for the batch '{batch.name}'.", notification_type="info")
                
            if batch.co_teachers.exists():
                for co_teacher in batch.co_teachers.all():
                    activate_user_and_send_welcome_email(co_teacher, request.user)
                create_notification(list(batch.co_teachers.all()), title="New Batch Assignment", message=f"You have been assigned as a Co-Teacher for the batch '{batch.name}'.", notification_type="info")

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
    permission_classes = [IsSuperAdminAdminOrTeacher]

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk)
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

    @extend_schema(summary="Delete a batch (Admin or Assigned Teacher only, if before start date)")
    def delete(self, request, pk):
        try:
            batch = self.get_object(pk)
            user = request.user
            
            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to delete this batch.", status_code=status.HTTP_403_FORBIDDEN)
            
            today = get_current_local_date()
            if batch.start_date and batch.start_date <= today:
                raise ServiceError(detail="Cannot delete a batch that has already started.", status_code=status.HTTP_400_BAD_REQUEST)
                
            batch.delete()
            return format_success_response(message="Batch deleted successfully")
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting batch {pk}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["Batches"])
class BatchUpdateView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk)
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

            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to update this batch.", status_code=status.HTTP_403_FORBIDDEN)

            if 'start_date' in request.data:
                new_start_date_str = str(request.data.get('start_date'))
                if batch.start_date and str(batch.start_date) != new_start_date_str:
                    today = get_current_local_date()
                    if batch.start_date <= today:
                        raise ServiceError(detail="Cannot edit the start date of a batch that has already started.", status_code=status.HTTP_400_BAD_REQUEST)
                    
                    if BatchWeek.objects.filter(batch=batch).exists():
                        raise ServiceError(detail="Cannot edit the start date of a batch that already has content weeks added.", status_code=status.HTTP_400_BAD_REQUEST)

            old_teacher_id = batch.teacher_id if batch.teacher else None
            old_co_teachers = set(batch.co_teachers.values_list('id', flat=True)) if batch.pk else set()

            serializer = BatchCreateUpdateSerializer(batch, data=request.data, partial=True, context={'request': request})
            
            if not serializer.is_valid():
                error_str = handle_serializer_errors(serializer)
                raise ServiceError(detail=error_str, status_code=status.HTTP_400_BAD_REQUEST)
            
            batch = serializer.save()

            if batch.teacher:
                activate_user_and_send_welcome_email(batch.teacher, request.user)
                if batch.teacher_id != old_teacher_id:
                    create_notification(batch.teacher, title="New Batch Assignment", message=f"You have been assigned as the Primary Teacher for the batch '{batch.name}'.", notification_type="info")

            if old_teacher_id and old_teacher_id != batch.teacher_id:
                try:
                    old_teacher = User.objects.get(pk=old_teacher_id)
                    create_notification(old_teacher, title="Batch Assignment Removed", message=f"You have been removed as the Primary Teacher from the batch '{batch.name}'.", notification_type="warning")
                except User.DoesNotExist:
                    pass

            new_co_teachers = set(batch.co_teachers.values_list('id', flat=True))

            if batch.co_teachers.exists():
                for co_teacher in batch.co_teachers.all():
                    activate_user_and_send_welcome_email(co_teacher, request.user)
                
                added_co_teachers = new_co_teachers - old_co_teachers
                if added_co_teachers:
                    co_teacher_users = list(batch.co_teachers.filter(id__in=added_co_teachers))
                    create_notification(co_teacher_users, title="New Batch Assignment", message=f"You have been assigned as a Co-Teacher for the batch '{batch.name}'.", notification_type="info")

            removed_co_teachers = old_co_teachers - new_co_teachers
            if removed_co_teachers:
                removed_users = list(User.objects.filter(id__in=removed_co_teachers))
                create_notification(removed_users, title="Batch Assignment Removed", message=f"You have been removed as a Co-Teacher from the batch '{batch.name}'.", notification_type="warning")

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
class BatchUpdateStatusView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    class InputSerializer(serializers.Serializer):
        status = serializers.ChoiceField(choices=Batch.Status.choices)

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Update batch status (Admin or Assigned Teacher only)",
        request=InputSerializer,
        responses={200: BatchListSerializer},
    )
    def patch(self, request, pk):
        try:
            batch = self.get_object(pk)
            user = request.user

            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to update this batch.", status_code=status.HTTP_403_FORBIDDEN)

            serializer = self.InputSerializer(data=request.data)
            if not serializer.is_valid():
                raise ServiceError(detail=handle_serializer_errors(serializer), status_code=status.HTTP_400_BAD_REQUEST)

            new_status = serializer.validated_data['status']
            if new_status not in [Batch.Status.ACTIVE, Batch.Status.COMPLETED]:
                raise ServiceError(detail="Invalid status. Only 'ACTIVE' or 'COMPLETED' are allowed.", status_code=status.HTTP_400_BAD_REQUEST)

            batch.status = new_status
            batch.updated_by = request.user
            batch.save()

            return format_success_response(
                message=f"Batch status updated successfully",
                data=None,
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating batch status: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class BatchAddStudentView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    def get_batch(self, pk):
        try:
            return Batch.objects.get(pk=pk)
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

            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
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

            # If student is not active, activate them.
            # If they don't have a usable password, they'll get welcome credentials.
            if not student.is_active or student.status != 'ACTIVE':
                activate_user_and_send_welcome_email(student, request.user)
                
                # Make sure student is marked active even if they already had a password
                if not student.is_active:
                    student.is_active = True
                    student.status = 'ACTIVE'
                    student.save(update_fields=['is_active', 'status'])

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


@extend_schema(tags=["Batches"])
class AvailableStudentListView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    @extend_schema(
        summary="List students available for batch enrollment (not in any active batch)",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name or email"),
        ],
        responses={200: UserManagementSerializer(many=True)},
    )
    def get(self, request):
        # Students who are not in any ACTIVE enrollment
        enrolled_student_ids = BatchEnrollment.objects.filter(
            status=BatchEnrollment.Status.ACTIVE
        ).values_list('student_id', flat=True)

        qs = User.objects.filter(
            user_type__name=UserTypeConstants.STUDENT,
            is_deleted=False
        ).exclude(id__in=enrolled_student_ids)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(fullname__icontains=search) |
                Q(email__icontains=search)
            )

        serializer = UserManagementSerializer(qs, many=True, context={'request': request})
        return format_success_response(
            message="Available students retrieved successfully",
            data=serializer.data
        )


class BatchStudentListView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPageNumberPagination

    @extend_schema(
        summary="List students in a specific batch",
        parameters=[
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Number of items per page"),
        ],
        responses={200: BatchEnrollmentSerializer(many=True)},
    )
    def get(self, request, pk):
        try:
            batch = Batch.objects.get(pk=pk)
            enrollments = batch.enrollments.all().select_related('student').order_by('id')

            paginator = self.pagination_class()
            page = paginator.paginate_queryset(enrollments, request, view=self)
            
            if page is not None:
                serializer = BatchEnrollmentSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)

            serializer = BatchEnrollmentSerializer(enrollments, many=True)
            return format_success_response(
                message="Batch students retrieved successfully",
                data=serializer.data
            )
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error listing batch students: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class ExtendBatchTimelineView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    @extend_schema(
        summary="Extend batch timeline by adding days to future unlock dates",
        parameters=[
            OpenApiParameter("days", OpenApiTypes.INT, description="Number of days to extend"),
        ],
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            days = int(request.query_params.get('days', 0))
            if days <= 0:
                raise ServiceError(detail="Days must be greater than 0", status_code=status.HTTP_400_BAD_REQUEST)
            
            extend_batch_timeline(pk, days)
            return format_success_response(message=f"Batch timeline extended by {days} days")
        except Exception as e:
            logger.error(f"Error extending timeline: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(tags=["Batches"])
class CloneBatchContentView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    @extend_schema(
        summary="Push/Clone content from a Course or another Batch to this Batch",
        request=None,
        parameters=[
            OpenApiParameter("source_course_id", OpenApiTypes.INT, description="Source Course ID"),
            OpenApiParameter("source_batch_id", OpenApiTypes.INT, description="Source Batch ID"),
        ],
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            source_course_id = request.query_params.get('source_course_id')
            source_batch_id = request.query_params.get('source_batch_id')
            
            success = push_content_to_batch(
                source_batch_id=source_batch_id,
                source_course_id=source_course_id,
                target_batch_id=pk
            )
            
            if success:
                return format_success_response(message="Content pushed successfully")
            else:
                raise ServiceError(detail="Missing source source_course_id or source_batch_id", status_code=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            raise ServiceError(detail=str(e), status_code=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error cloning content: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
