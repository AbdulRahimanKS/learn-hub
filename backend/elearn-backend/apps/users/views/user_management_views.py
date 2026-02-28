"""
Admin User Management Views.
Handles listing, creating, updating, and deleting students and teachers.
"""

import logging

from rest_framework import status
from rest_framework.views import APIView
from django.db.models import Q
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.users.models import User, UserType
from apps.users.serializers.user_management_serializers import (
    UserManagementSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
)
from utils.permissions import IsSuperAdminOrAdmin
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination
from apps.courses.models import Batch, BatchEnrollment
from utils.constants import UserTypeConstants

logger = logging.getLogger(__name__)


@extend_schema(tags=["User Management"])
class UserManagementView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(
        summary="List users",
        parameters=[
            OpenApiParameter("role", OpenApiTypes.STR, description="Filter by role: Teacher, Student"),
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name or email"),
            OpenApiParameter("is_active", OpenApiTypes.BOOL, description="Filter by active status"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set true to return paginated results (default: false)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginate=true)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page (when paginate=true)"),
        ],
        responses={200: OpenApiTypes.OBJECT}
    )
    def get(self, request):
        base_qs = User.objects.filter(is_deleted=False).exclude(
            user_type__name__in=[UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
        )
        
        total_teachers = base_qs.filter(user_type__name__iexact=UserTypeConstants.TEACHER).count()
        total_students = base_qs.filter(user_type__name__iexact=UserTypeConstants.STUDENT).count()
        total_active_students = base_qs.filter(
            user_type__name__iexact=UserTypeConstants.STUDENT, 
            status=User.UserStatus.ACTIVE
        ).count()
        total_active_teachers = base_qs.filter(
            user_type__name__iexact=UserTypeConstants.TEACHER,
            status=User.UserStatus.ACTIVE
        ).count()

        qs = base_qs.select_related('user_type', 'profile').order_by('-created_at')

        role = request.query_params.get('role', '').strip()
        if role:
            qs = qs.filter(user_type__name__iexact=role)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(fullname__icontains=search) | Q(email__icontains=search))

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            target_status = User.UserStatus.ACTIVE if is_active_bool else User.UserStatus.INACTIVE
            qs = qs.filter(status=target_status)

        summary = {
            "total_teachers": total_teachers,
            "total_students": total_students,
            "total_active_students": total_active_students,
            "total_active_teachers": total_active_teachers,
        }

        paginate_param = request.query_params.get('paginate', 'false').lower() == 'true'
        if paginate_param:
            paginator = CustomPageNumberPagination()
            page = paginator.paginate_queryset(qs, request)
            serializer = UserManagementSerializer(page, many=True, context={'request': request})
            return format_success_response(
                message="Users retrieved successfully",
                data={
                    "current_page": paginator.page.number,
                    "total_pages": paginator.page.paginator.num_pages,
                    "total_items": paginator.page.paginator.count,
                    "page_size": paginator.page_size,
                    "next": paginator.get_next_link(),
                    "previous": paginator.get_previous_link(),
                    "data": serializer.data,
                    "summary": summary,
                }
            )
        else:
            serializer = UserManagementSerializer(qs, many=True, context={'request': request})
            return format_success_response(
                message="Users retrieved successfully",
                data={
                    "data": serializer.data,
                    "summary": summary,
                }
            )

    @extend_schema(
        summary="Create Teacher or Student",
        request=UserCreateSerializer,
        responses={200: OpenApiTypes.OBJECT}
    )
    def post(self, request):
        try:
            serializer = UserCreateSerializer(data=request.data)
            if not serializer.is_valid():
                raise ServiceError(
                    detail=handle_serializer_errors(serializer),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            data = serializer.validated_data
            role_name = data['role']

            user_type = UserType.objects.filter(name__iexact=role_name).first()
            if not user_type:
                raise ServiceError(
                    detail=f"UserType '{role_name}' not found in the database.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.create_user(
                email=data['email'],
                password=None,
                fullname=data['fullname'],
                phone_number_code=data['phone_number_code'],
                contact_number=data['contact_number'],
                user_type=user_type,
                status=User.UserStatus.INACTIVE,
                is_active=False,
                created_by=request.user,
            )

            message = f"{role_name} account created. They will receive credentials when assigned to a batch."

            return format_success_response(
                message=message,
                data=None,
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["User Management"])
class UserManagementDetailView(APIView):
    """
    Admin endpoint to update or soft-delete a single user.
    """
    permission_classes = [IsSuperAdminOrAdmin]

    def _get_user(self, pk):
        user = User.objects.filter(id=pk, is_deleted=False).exclude(
            user_type__name__in=[UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]
        ).select_related('user_type').first()
        if not user:
            raise ServiceError(detail="User not found.", status_code=status.HTTP_404_NOT_FOUND)
        return user

    @extend_schema(
        summary="Update a user",
        request=UserUpdateSerializer,
        responses={200: OpenApiTypes.OBJECT}
    )
    def patch(self, request, pk):
        try:
            user = self._get_user(pk)
            serializer = UserUpdateSerializer(data=request.data, partial=True, context={'user_instance': user})
            if not serializer.is_valid():
                raise ServiceError(
                    detail=handle_serializer_errors(serializer),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            data = serializer.validated_data
            for field in ['fullname', 'phone_number_code', 'contact_number']:
                if field in data:
                    setattr(user, field, data[field])

            if 'is_active' in data:
                if data['is_active']:
                    user.status = User.UserStatus.ACTIVE
                    user.is_active = True
                else:
                    user.status = User.UserStatus.INACTIVE
                    user.is_active = False

            user.updated_by = request.user
            user.save()

            return format_success_response(
                message="User updated successfully.",
                data=None,
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating user {pk}: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Soft-delete a user",
        responses={200: OpenApiTypes.OBJECT}
    )
    def delete(self, request, pk):
        try:
            user = self._get_user(pk)
            role = user.user_type.name if user.user_type else ''
            force = str(request.data.get('force', 'false')).lower() == 'true'

            # --- dependency check ---
            warnings = []

            if role == UserTypeConstants.TEACHER:
                primary_batches = Batch.objects.filter(
                    teacher=user, is_deleted=False
                ).values_list('name', flat=True)
                co_batches = Batch.objects.filter(
                    co_teachers=user, is_deleted=False
                ).values_list('name', flat=True)
                if primary_batches:
                    warnings.append({
                        'type': 'primary_teacher',
                        'message': f"This teacher is the primary instructor for {len(primary_batches)} batch(es).",
                        'batches': list(primary_batches),
                    })
                if co_batches:
                    warnings.append({
                        'type': 'co_teacher',
                        'message': f"This teacher is a co-instructor in {len(co_batches)} batch(es).",
                        'batches': list(co_batches),
                    })

            elif role == UserTypeConstants.STUDENT:
                enrollments = BatchEnrollment.objects.filter(
                    student=user
                ).exclude(
                    status__in=['dropped', 'completed']
                ).select_related('batch')
                if enrollments.exists():
                    batch_names = [e.batch.name for e in enrollments]
                    warnings.append({
                        'type': 'enrollment',
                        'message': f"This student has {len(batch_names)} active enrollment(s).",
                        'batches': batch_names,
                    })

            if warnings and not force:
                # Return 409 with metadata — frontend must confirm with force=true
                return format_success_response(
                    message="User has active dependencies. Pass force=true to proceed.",
                    data={'warnings': warnings, 'requires_force': True},
                    status_code=status.HTTP_409_CONFLICT,
                )

            # --- perform soft delete ---
            user.soft_delete(request.user)
            logger.info(f"User {pk} soft-deleted by admin {request.user.id}")

            return format_success_response(
                message="User deleted successfully.",
                data=None,
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting user {pk}: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)