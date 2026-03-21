import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.db.models import Q

from django.utils import timezone
from apps.courses.models import Batch, BatchEnrollment
from apps.courses.serializers import (
    BatchListSerializer,
    BatchCreateUpdateSerializer,
    BatchEnrollmentSerializer,
)
from apps.users.serializers.user_management_serializers import UserManagementSerializer
from apps.users.models import Notification, User
from apps.courses.models import BatchWeek

from utils.permissions import IsAuthenticated, IsSuperAdminAdminOrTeacher
from utils.common import (
    format_success_response, handle_serializer_errors, ServiceError, 
    activate_user_and_send_welcome_email, get_current_local_date,
    create_notification
)
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants
from apps.courses.services import push_content_to_batch, extend_batch_timeline

logger = logging.getLogger(__name__)


def batch_roster_delete_window_closed(batch):
    """
    Removing an enrollment row (vs marking dropped) is only allowed before the batch is live:
    - local calendar date is on/after batch.start_date, OR
    - current time is on/after the earliest configured week unlock_date (by week_number).
    """
    if get_current_local_date() >= batch.start_date:
        return True
    first_with_unlock = (
        BatchWeek.objects.filter(batch=batch)
        .exclude(unlock_date__isnull=True)
        .order_by('week_number')
        .first()
    )
    if first_with_unlock and timezone.now() >= first_with_unlock.unlock_date:
        return True
    return False


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
        user = request.user
        is_student = (
            getattr(user, 'user_type', None) and
            user.user_type.name == UserTypeConstants.STUDENT
        )

        if is_student:
            enrollments = (
                BatchEnrollment.objects
                .filter(
                    student=user,
                    status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED]
                )
                .select_related('batch', 'batch__teacher', 'batch__course')
                .order_by('-enrolled_at')
            )
            
            status_param = request.query_params.get('status')
            if status_param:
                enrollments = enrollments.filter(batch__status=status_param.upper())

            search = request.query_params.get('search', '').strip()
            if search:
                enrollments = enrollments.filter(batch__name__icontains=search)

            paginate_param = request.query_params.get('paginate', 'true').lower() == 'true'
            if paginate_param:
                paginator = CustomPageNumberPagination()
                page = paginator.paginate_queryset(enrollments, request)
                data = [
                    BatchListSerializer(e.batch, context={'request': request, 'enrollment': e}).data
                    for e in page
                ]
                return paginator.get_paginated_response(data, message="Batches retrieved successfully")

            data = [
                BatchListSerializer(e.batch, context={'request': request, 'enrollment': e}).data
                for e in enrollments
            ]
            return format_success_response(
                message="Batches retrieved successfully",
                data=data
            )

        qs = Batch.objects.select_related('teacher', 'course').order_by('-created_at')

        if getattr(user, 'user_type', None):
            if user.user_type.name == UserTypeConstants.TEACHER:
                qs = qs.filter(
                    Q(teacher=user) | 
                    Q(co_teachers=user)
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
            serializer = BatchListSerializer(paginated_qs, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data, message="Batches retrieved successfully")

        serializer = BatchListSerializer(qs, many=True, context={'request': request})
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

            if request.user.user_type and request.user.user_type.name == UserTypeConstants.TEACHER:
                admins = User.objects.filter(
                    user_type__name__in=[UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN],
                    is_active=True,
                    is_deleted=False
                ).exclude(id=request.user.id)
                if admins.exists():
                    create_notification(
                        user_or_users=list(admins),
                        title="New Batch Created by Teacher",
                        message=f"Teacher {request.user.fullname} has created a new batch: '{batch.name}'.",
                        notification_type="info",
                        content_object=batch
                    )

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
    serializer_class = BatchCreateUpdateSerializer

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
                    if batch.batch_weeks.exists():
                        raise ServiceError(
                            detail="Cannot edit the start date after weeks have been added to this batch.",
                            status_code=status.HTTP_400_BAD_REQUEST
                        )
                    today = get_current_local_date()
                    if batch.start_date <= today:
                        raise ServiceError(detail="Cannot edit the start date of a batch that has already started.", status_code=status.HTTP_400_BAD_REQUEST)

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

    class BatchUpdateStatusRequestSerializer(serializers.Serializer):
        status = serializers.ChoiceField(choices=Batch.Status.choices)

    def get_object(self, pk):
        try:
            return Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Update batch status (Admin or Assigned Teacher only)",
        request=BatchUpdateStatusRequestSerializer,
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

            serializer = self.BatchUpdateStatusRequestSerializer(data=request.data)
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

            student_id = request.data.get('student')
            if not student_id:
                raise ServiceError(detail="Student ID is required.", status_code=status.HTTP_400_BAD_REQUEST)

            try:
                student = User.objects.get(id=student_id)
            except User.DoesNotExist:
                raise ServiceError(detail="Student not found.", status_code=status.HTTP_404_NOT_FOUND)

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
                status=request.data.get('status', BatchEnrollment.Status.ACTIVE),
                notes=request.data.get('notes', ''),
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

            try:
                create_notification(
                    student,
                    title="Enrolled in a batch",
                    message=(
                        f'You have been added to the batch "{batch.name}". '
                        f'If you received login credentials by email, use them to sign in and open your courses.'
                    ),
                    notification_type="success",
                )
            except Exception as notify_err:
                logger.warning("Failed to notify student on batch enrollment: %s", notify_err)

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
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to false to return all results without pagination (default: true)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page, default 10, max 100 (when paginated)"),
            OpenApiParameter(
                "batch_id",
                OpenApiTypes.INT,
                description=(
                    "When set, also excludes students who already have any enrollment in this batch "
                    "(active, dropped, or completed) to avoid duplicate adds. Caller must be allowed to manage the batch."
                ),
            ),
        ],
        responses={200: UserManagementSerializer(many=True)},
    )
    def get(self, request):
        # Students who are not in any ACTIVE enrollment (any batch)
        active_student_ids = set(
            BatchEnrollment.objects.filter(status=BatchEnrollment.Status.ACTIVE).values_list(
                'student_id', flat=True
            )
        )
        exclude_ids = set(active_student_ids)

        batch_id_raw = request.query_params.get('batch_id', '').strip()
        if batch_id_raw:
            try:
                bid = int(batch_id_raw)
            except (TypeError, ValueError):
                raise ServiceError(detail="Invalid batch_id.", status_code=status.HTTP_400_BAD_REQUEST)
            try:
                batch = Batch.objects.get(pk=bid)
            except Batch.DoesNotExist:
                raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)

            user = request.user
            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [
                UserTypeConstants.ADMIN,
                UserTypeConstants.SUPERADMIN,
            ]
            is_assigned_teacher = (
                getattr(user, 'user_type', None)
                and user.user_type.name == UserTypeConstants.TEACHER
                and (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )
            if not (is_admin or is_assigned_teacher):
                raise ServiceError(
                    detail="You do not have permission to list available students for this batch.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            in_this_batch = BatchEnrollment.objects.filter(batch_id=bid).values_list('student_id', flat=True)
            exclude_ids.update(in_this_batch)

        qs = User.objects.filter(
            user_type__name=UserTypeConstants.STUDENT,
            is_deleted=False
        ).exclude(id__in=exclude_ids).order_by('fullname')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(fullname__icontains=search) |
                Q(email__icontains=search)
            )

        paginate_param = request.query_params.get('paginate', 'true').lower() == 'true'
        if paginate_param:
            paginator = CustomPageNumberPagination()
            paginated_qs = paginator.paginate_queryset(qs, request)
            serializer = UserManagementSerializer(paginated_qs, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data, message="Available students retrieved successfully")

        serializer = UserManagementSerializer(qs, many=True, context={'request': request})
        return format_success_response(
            message="Available students retrieved successfully",
            data=serializer.data
        )


@extend_schema(tags=["Batches"])
class BatchStudentListView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPageNumberPagination

    @extend_schema(
        summary="List students in a specific batch",
        parameters=[
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Number of items per page"),
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by student name or email"),
            OpenApiParameter("status", OpenApiTypes.STR, description="Filter by enrollment status"),
        ],
        responses={200: BatchEnrollmentSerializer(many=True)},
    )
    def get(self, request, pk):
        try:
            batch = Batch.objects.get(pk=pk)
            enrollments = batch.enrollments.all().select_related('student', 'student__profile')
            
            # Stats for top cards
            status_stats = {
                'total': enrollments.count(),
                'active': enrollments.filter(status=BatchEnrollment.Status.ACTIVE).count(),
                'completed': enrollments.filter(status=BatchEnrollment.Status.COMPLETED).count(),
                'dropped': enrollments.filter(status=BatchEnrollment.Status.DROPPED).count(),
            }

            search = request.query_params.get('search')
            if search:
                enrollments = enrollments.filter(
                    Q(student__fullname__icontains=search) |
                    Q(student__email__icontains=search)
                )

            status_filter = request.query_params.get('status')
            if status_filter and status_filter != 'all':
                enrollments = enrollments.filter(status=status_filter)
            
            enrollments = enrollments.order_by('id')

            paginator = self.pagination_class()
            page = paginator.paginate_queryset(enrollments, request, view=self)
            
            if page is not None:
                serializer = BatchEnrollmentSerializer(
                    page, many=True, context={'request': request}
                )
                response = paginator.get_paginated_response(serializer.data)
                response.data['stats'] = status_stats
                return response

            serializer = BatchEnrollmentSerializer(
                enrollments, many=True, context={'request': request}
            )
            return format_success_response(
                message="Batch students retrieved successfully",
                data={
                    'enrollments': serializer.data,
                    'stats': status_stats
                }
            )
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error listing batch students: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class ExtendBatchTimelineView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = BatchListSerializer

    @extend_schema(
        summary="Extend batch timeline by adding days to future unlock dates",
        parameters=[
            OpenApiParameter(
                "days",
                OpenApiTypes.INT,
                description="Days to add to each future week's unlock date. Must be a multiple of 7 (whole weeks) so the schedule stays aligned.",
            ),
        ],
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            try:
                days = int(request.query_params.get('days', 0))
            except (TypeError, ValueError):
                raise ServiceError(
                    detail="Invalid days parameter. Provide a positive integer, multiple of 7.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if days <= 0:
                raise ServiceError(detail="Days must be greater than 0", status_code=status.HTTP_400_BAD_REQUEST)
            if days % 7 != 0:
                raise ServiceError(
                    detail=(
                        "Extension must be in whole weeks (a multiple of 7 days) so unlock dates stay "
                        "aligned with your curriculum weeks. Examples: 7, 14, 21, 28."
                    ),
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

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
        except ServiceError:
            raise
        except ValueError as e:
            raise ServiceError(detail=str(e), status_code=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error cloning content: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class BatchStudentEnrollmentUpdateView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    class EnrollmentUpdateRequestSerializer(serializers.Serializer):
        status = serializers.ChoiceField(choices=BatchEnrollment.Status.choices, required=False)

    @extend_schema(
        summary="Update a student's enrollment status",
        request=EnrollmentUpdateRequestSerializer,
        responses={200: BatchEnrollmentSerializer},
    )
    def patch(self, request, pk, enrollment_id):
        try:
            batch = Batch.objects.get(pk=pk)
            user = request.user
            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to update enrollments in this batch.", status_code=status.HTTP_403_FORBIDDEN)

            enrollment = BatchEnrollment.objects.filter(batch=batch, pk=enrollment_id).first()
            if not enrollment:
                raise ServiceError(detail="Enrollment not found.", status_code=status.HTTP_404_NOT_FOUND)

            serializer = self.EnrollmentUpdateRequestSerializer(data=request.data)
            if not serializer.is_valid():
                raise ServiceError(detail=handle_serializer_errors(serializer), status_code=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data
            if 'status' in data:
                new_status = data['status']
                old_status = enrollment.status

                # Terminal statuses: cannot change away from completed or dropped
                if enrollment.status == BatchEnrollment.Status.COMPLETED and new_status != BatchEnrollment.Status.COMPLETED:
                    raise ServiceError(detail="Once a student's status is marked as 'completed', it cannot be changed.", status_code=status.HTTP_400_BAD_REQUEST)
                if enrollment.status == BatchEnrollment.Status.DROPPED and new_status != BatchEnrollment.Status.DROPPED:
                    raise ServiceError(detail="Once a student's status is marked as 'dropped', it cannot be changed.", status_code=status.HTTP_400_BAD_REQUEST)

                # One-way transitions into terminal states: only from ACTIVE
                if new_status == BatchEnrollment.Status.COMPLETED and enrollment.status != BatchEnrollment.Status.ACTIVE:
                    raise ServiceError(detail="Only active students can be marked as completed. Please move the student to 'Active' status first if you wish to mark them as completed.", status_code=status.HTTP_400_BAD_REQUEST)
                if new_status == BatchEnrollment.Status.DROPPED and enrollment.status != BatchEnrollment.Status.ACTIVE:
                    raise ServiceError(detail="Only active students can be marked as dropped.", status_code=status.HTTP_400_BAD_REQUEST)

                # Handle completed_at
                if new_status == BatchEnrollment.Status.COMPLETED and enrollment.status != BatchEnrollment.Status.COMPLETED:
                    enrollment.completed_at = timezone.now()
                elif new_status != BatchEnrollment.Status.COMPLETED:
                    enrollment.completed_at = None
                    
                enrollment.status = new_status

            enrollment.save()

            if 'status' in data and old_status != data['status']:
                stu = enrollment.student
                bn = batch.name
                ns = data['status']
                try:
                    if ns == BatchEnrollment.Status.COMPLETED:
                        create_notification(
                            stu,
                            title="Batch enrollment completed",
                            message=f'Your enrollment in "{bn}" has been marked as completed. Congratulations!',
                            notification_type="success",
                        )
                    elif ns == BatchEnrollment.Status.DROPPED:
                        create_notification(
                            stu,
                            title="Enrollment status updated",
                            message=f'Your enrollment in "{bn}" has been marked as dropped. Contact your instructor if this is unexpected.',
                            notification_type="warning",
                        )
                    elif ns == BatchEnrollment.Status.ACTIVE:
                        create_notification(
                            stu,
                            title="Enrollment reactivated",
                            message=f'Your enrollment in "{bn}" is now active again. You can continue your learning from your courses area.',
                            notification_type="info",
                        )
                except Exception as notify_err:
                    logger.warning("Failed to notify student on enrollment status change: %s", notify_err)

            return format_success_response(message="Enrollment updated successfully", data=BatchEnrollmentSerializer(enrollment, context={'request': request}).data)
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating enrollment {enrollment_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Remove student from batch (only before batch start date)",
        description=(
            "Deletes the enrollment record only before the batch start date (local) and before the first "
            "week's unlock time. After either applies, use status 'dropped' instead."
        ),
        responses={200: None},
    )
    def delete(self, request, pk, enrollment_id):
        try:
            batch = Batch.objects.get(pk=pk)
            user = request.user
            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [
                UserTypeConstants.ADMIN,
                UserTypeConstants.SUPERADMIN,
            ]
            is_assigned_teacher = (
                getattr(user, 'user_type', None)
                and user.user_type.name == UserTypeConstants.TEACHER
                and (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(
                    detail="You do not have permission to remove enrollments in this batch.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            if batch_roster_delete_window_closed(batch):
                raise ServiceError(
                    detail=(
                        "Enrollments can only be removed before the batch start date and before any week "
                        "content has unlocked. After that, mark the student as dropped instead."
                    ),
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            enrollment = BatchEnrollment.objects.filter(batch=batch, pk=enrollment_id).first()
            if not enrollment:
                raise ServiceError(detail="Enrollment not found.", status_code=status.HTTP_404_NOT_FOUND)

            student_user = enrollment.student
            batch_name = batch.name
            enrollment.delete()
            try:
                create_notification(
                    student_user,
                    title="Removed from batch",
                    message=(
                        f'You have been removed from the batch "{batch_name}". '
                        f'If you believe this is a mistake, contact your instructor or administrator.'
                    ),
                    notification_type="warning",
                )
            except Exception as notify_err:
                logger.warning("Failed to notify student on roster removal: %s", notify_err)

            return format_success_response(message="Student removed from batch.")
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting enrollment {enrollment_id}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class BatchStudentWeekUnlockToggleView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    class WeekUnlockToggleRequestSerializer(serializers.Serializer):
        week_number = serializers.IntegerField(required=True, min_value=1)
        action = serializers.ChoiceField(choices=['unlock', 'revoke'], required=True)

    @extend_schema(
        summary="Toggle manual unlock for a specific week for a student",
        request=WeekUnlockToggleRequestSerializer,
        responses={200: BatchEnrollmentSerializer},
    )
    def post(self, request, pk, enrollment_id):
        try:
            batch = Batch.objects.get(pk=pk)
            user = request.user
            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to manage unlocks in this batch.", status_code=status.HTTP_403_FORBIDDEN)

            enrollment = BatchEnrollment.objects.filter(batch=batch, pk=enrollment_id).first()
            if not enrollment:
                raise ServiceError(detail="Enrollment not found.", status_code=status.HTTP_404_NOT_FOUND)

            serializer = self.WeekUnlockToggleRequestSerializer(data=request.data)
            if not serializer.is_valid():
                raise ServiceError(detail=handle_serializer_errors(serializer), status_code=status.HTTP_400_BAD_REQUEST)

            week_number = serializer.validated_data['week_number']
            action = serializer.validated_data['action']

            batch_week = BatchWeek.objects.filter(batch=batch, week_number=week_number).first()
            if not batch_week:
                raise ServiceError(detail=f"Week {week_number} not found in this batch.", status_code=status.HTTP_404_NOT_FOUND)

            from apps.courses.models import ManualStudentWeekUnlock
            if action == 'unlock':
                ManualStudentWeekUnlock.objects.get_or_create(
                    enrollment=enrollment,
                    batch_week=batch_week,
                    defaults={'unlocked_by': user}
                )
                message = f"Week {week_number} unlocked manually."
            else:
                # Check for student progress in this week before revoking
                from apps.courses.models import StudentSessionView, TestSubmission, ManualStudentWeekUnlock
                
                has_session_progress = StudentSessionView.objects.filter(
                    enrollment=enrollment, 
                    batch_session__batch_week=batch_week, 
                    is_completed=True
                ).exists()
                
                has_test_progress = TestSubmission.objects.filter(
                    enrollment=enrollment, 
                    batch_weekly_test__batch_week=batch_week
                ).exists()

                if has_session_progress or has_test_progress:
                     raise ServiceError(
                         detail=f"Cannot revoke unlock for week {week_number} because the student has already started consuming content or attempted tests in this week.",
                         status_code=status.HTTP_400_BAD_REQUEST
                     )

                ManualStudentWeekUnlock.objects.filter(
                    enrollment=enrollment,
                    batch_week=batch_week
                ).delete()
                message = f"Manual unlock for week {week_number} revoked."

            return format_success_response(
                message=message,
                data=BatchEnrollmentSerializer(enrollment, context={'request': request}).data
            )
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error toggling manual unlock: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Batches"])
class BatchStudentBulkUpdateView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    class BulkUpdateRequestSerializer(serializers.Serializer):
        status = serializers.ChoiceField(choices=BatchEnrollment.Status.choices, required=True)
        enrollment_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    @extend_schema(
        summary="Bulk update enrollment status for students in a batch",
        request=BulkUpdateRequestSerializer,
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            batch = Batch.objects.get(pk=pk)
            user = request.user
            is_admin = getattr(user, 'user_type', None) and user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
            is_assigned_teacher = (
                getattr(user, 'user_type', None) and
                user.user_type.name == UserTypeConstants.TEACHER and
                (batch.teacher == user or batch.co_teachers.filter(pk=user.pk).exists())
            )

            if not (is_admin or is_assigned_teacher):
                raise ServiceError(detail="You do not have permission to update enrollments in this batch.", status_code=status.HTTP_403_FORBIDDEN)

            serializer = self.BulkUpdateRequestSerializer(data=request.data)
            if not serializer.is_valid():
                raise ServiceError(detail=handle_serializer_errors(serializer), status_code=status.HTTP_400_BAD_REQUEST)

            target_status = serializer.validated_data['status']
            enrollment_ids = serializer.validated_data.get('enrollment_ids')

            if target_status != BatchEnrollment.Status.COMPLETED:
                raise ServiceError(
                    detail="Bulk update only supports marking active students as completed. Use individual enrollment update to mark a student as dropped.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            # Start with base queryset for the batch
            enrollments = BatchEnrollment.objects.filter(batch=batch)
            
            # If specific IDs provided, filter by them
            if enrollment_ids:
                enrollments = enrollments.filter(id__in=enrollment_ids)
            
            # CRITICAL: Only update ACTIVE enrollments as requested
            # Students already COMPLETED or DROPPED should not be updated in bulk
            active_enrollments = enrollments.filter(status=BatchEnrollment.Status.ACTIVE)
            to_notify = list(
                active_enrollments.select_related("student")
            )

            updated_count = active_enrollments.update(
                status=target_status,
                completed_at=timezone.now(),
                updated_at=timezone.now(),
            )

            bn = batch.name
            if to_notify:
                try:
                    msg = (
                        f'Your enrollment in "{bn}" has been marked as completed. Congratulations!'
                    )
                    notification_rows = [
                        Notification(
                            user=enr.student,
                            title="Batch enrollment completed",
                            message=msg,
                            notification_type=Notification.NotificationType.SUCCESS
                        )
                        for enr in to_notify
                    ]
                    # One batched INSERT (or chunked) instead of N separate creates
                    Notification.objects.bulk_create(notification_rows, batch_size=500)
                except Exception as notify_err:
                    logger.warning(
                        "Failed bulk notify on bulk completion (%s students): %s",
                        len(to_notify),
                        notify_err,
                    )

            return format_success_response(message=f"Successfully updated {updated_count} active students to {target_status.lower()}.")
        except Batch.DoesNotExist:
            raise ServiceError(detail="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error bulk updating students in batch {pk}: {str(e)}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
