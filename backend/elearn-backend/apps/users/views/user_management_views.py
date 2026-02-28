"""
Admin User Management Views.
Handles listing, creating, updating, and deleting students and teachers.
"""
import secrets
import string
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
from utils.permissions import IsAdmin
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination
from utils.email_utils import send_email
from apps.courses.models import Batch, BatchEnrollment

logger = logging.getLogger(__name__)


def generate_temp_password(length=10) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@extend_schema(tags=["User Management"])
class UserManagementView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        summary="List users (admin)",
        parameters=[
            OpenApiParameter("role", OpenApiTypes.STR, description="Filter by role: Teacher, Student"),
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name or email"),
            OpenApiParameter("is_active", OpenApiTypes.BOOL, description="Filter by active status"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set true to return paginated results (default: false)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginate=true)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page (when paginate=true)"),
        ],
    )
    def get(self, request):
        base_qs = User.objects.filter(is_deleted=False).exclude(user_type__name='Admin')
        
        # Calculate summary statistics globally (ignoring search/filters)
        total_teachers = base_qs.filter(user_type__name__iexact='Teacher').count()
        total_students = base_qs.filter(user_type__name__iexact='Student').count()
        total_active_students = base_qs.filter(user_type__name__iexact='Student', is_active=True).count()

        qs = base_qs.select_related('user_type', 'profile').order_by('-created_at')

        role = request.query_params.get('role', '').strip()
        if role:
            qs = qs.filter(user_type__name__iexact=role)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(fullname__icontains=search) | Q(email__icontains=search))

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() == 'true'))

        summary = {
            "total_teachers": total_teachers,
            "total_students": total_students,
            "total_active_students": total_active_students,
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
            serializer = UserManagementSerializer(qs[:50], many=True, context={'request': request})
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
            batch_id = data.get('batch_id')

            user_type = UserType.objects.filter(name__iexact=role_name).first()
            if not user_type:
                raise ServiceError(
                    detail=f"UserType '{role_name}' not found in the database.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            batch = None
            if role_name == 'Student' and batch_id:
                batch = Batch.objects.filter(id=batch_id, is_deleted=False).first()
                if not batch:
                    raise ServiceError(
                        detail="The specified batch was not found.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )
                if batch.enrolled_count >= batch.max_students:
                    raise ServiceError(
                        detail=f"Batch is full. Maximum capacity of {batch.max_students} students has been reached.",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

            user = User.objects.create_user(
                email=data['email'],
                password=None,
                fullname=data['fullname'],
                phone_number_code=data['phone_number_code'],
                contact_number=data['contact_number'],
                user_type=user_type,
                is_active=False,
                created_by=request.user,
            )

            message = f"{role_name} account created. They will receive credentials when assigned to a batch."

            if batch:
                active_enrollment = BatchEnrollment.objects.filter(
                    student=user, status=BatchEnrollment.Status.ACTIVE
                ).first()
                if not active_enrollment:
                    BatchEnrollment.objects.create(
                        batch=batch,
                        student=user,
                        status=BatchEnrollment.Status.ACTIVE,
                        enrolled_by=request.user,
                    )
                    temp_password = generate_temp_password()
                    user.set_password(temp_password)
                    user.is_active = True
                    user.save(update_fields=['password', 'is_active'])
                    send_email(
                        user=request.user,
                        subject="Welcome to LearnHub – Your Login Credentials",
                        template="emails/user_welcome_credentials",
                        to_emails=[user.email],
                        payload={
                            "user_name": user.fullname,
                            "email": user.email,
                            "password": temp_password,
                            "role": "Student",
                        },
                    )
                    message = f"Student account created, enrolled in '{batch.name}', and credentials sent to {user.email}."

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
    permission_classes = [IsAdmin]

    def _get_user(self, pk):
        user = User.objects.filter(id=pk, is_deleted=False).exclude(
            user_type__name='Admin'
        ).select_related('user_type').first()
        if not user:
            raise ServiceError(detail="User not found.", status_code=status.HTTP_404_NOT_FOUND)
        return user

    @extend_schema(
        summary="Update a user",
        request=UserUpdateSerializer,
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
            for field in ['fullname', 'phone_number_code', 'contact_number', 'is_active']:
                if field in data:
                    setattr(user, field, data[field])

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

    @extend_schema(summary="Delete (deactivate) a user")
    def delete(self, request, pk):
        try:
            user = self._get_user(pk)
            user.is_deleted = True
            user.is_active = False
            user.updated_by = request.user
            user.save()

            return format_success_response(message="User deleted successfully.")

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting user {pk}: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(tags=["User Management"])
class UserSendCredentialsView(APIView):
    """
    Manually send (or re-send) login credentials to an inactive user.
    Generates a temporary password, activates the user, and emails the credentials.
    
    This is normally called automatically by the batch assignment endpoints,
    but can also be triggered manually by admins.
    """
    permission_classes = [IsAdmin]

    @extend_schema(summary="Send credentials to a user (activate + email)")
    def post(self, request, pk):
        try:
            user = User.objects.filter(id=pk, is_deleted=False).exclude(
                user_type__name='Admin'
            ).select_related('user_type').first()

            if not user:
                raise ServiceError(detail="User not found.", status_code=status.HTTP_404_NOT_FOUND)

            temp_password = generate_temp_password()
            user.set_password(temp_password)
            user.is_active = True
            user.updated_by = request.user
            user.save()

            role = user.user_type.name if user.user_type else "User"
            send_email(
                user=request.user,
                subject="Welcome to LearnHub – Your Login Credentials",
                template="emails/user_welcome_credentials",
                to_emails=[user.email],
                payload={
                    "user_name": user.fullname,
                    "email": user.email,
                    "password": temp_password,
                    "role": role,
                },
            )

            return format_success_response(
                message=f"Credentials sent to {user.email}. The account is now active."
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error sending credentials for user {pk}: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
