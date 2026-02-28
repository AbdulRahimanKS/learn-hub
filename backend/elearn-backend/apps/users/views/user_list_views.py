from rest_framework.views import APIView
from django.db.models import Q
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.users.models import User
from utils.permissions import IsSuperAdminAdminOrTeacher
from utils.common import format_success_response
from utils.pagination import CustomPageNumberPagination
from utils.constants import UserTypeConstants
import logging

logger = logging.getLogger(__name__)


@extend_schema(tags=["Users"])
class UserListByRoleView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    @extend_schema(
        summary="List users by role",
        parameters=[
            OpenApiParameter("role", OpenApiTypes.STR, description="Filter by role name: Teacher, Student, Admin"),
            OpenApiParameter("search", OpenApiTypes.STR, description="Search by name or email"),
            OpenApiParameter("paginate", OpenApiTypes.BOOL, description="Set to true to return paginated results (default: false)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number (when paginated)"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Results per page (when paginated)"),
        ],
        responses={200: OpenApiTypes.OBJECT}
    )
    def get(self, request):
        qs = User.objects.exclude(
            user_type__name=UserTypeConstants.SUPERADMIN
        ).select_related('user_type')

        role = request.query_params.get('role', '').strip()
        if role:
            qs = qs.filter(user_type__name__iexact=role)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(fullname__icontains=search) |
                Q(email__icontains=search)
            )

        qs = qs.order_by('fullname')

        paginate_param = request.query_params.get('paginate', 'false').lower() == 'true'
        if paginate_param:
            paginator = CustomPageNumberPagination()
            paginated_qs = paginator.paginate_queryset(qs, request)
            data = [
                {
                    'id': u.id,
                    'fullname': u.fullname,
                    'email': u.email,
                    'user_code': u.user_code,
                    'role': u.user_type.name if u.user_type else None,
                }
                for u in paginated_qs
            ]
            return format_success_response(
                message="Users retrieved successfully",
                data={
                    "current_page": paginator.page.number,
                    "total_pages": paginator.page.paginator.num_pages,
                    "total_items": paginator.page.paginator.count,
                    "page_size": paginator.page_size,
                    "next": paginator.get_next_link(),
                    "previous": paginator.get_previous_link(),
                    "data": data
                }
            )
        else:
            data = [
                {
                    'id': u.id,
                    'fullname': u.fullname,
                    'email': u.email,
                    'user_code': u.user_code,
                    'role': u.user_type.name if u.user_type else None,
                }
                for u in qs
            ]
            return format_success_response(message="Users retrieved successfully", data=data)
