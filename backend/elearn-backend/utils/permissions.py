"""
Custom permission classes for role-based access control.
These permissions check the user's role (user_type) to determine access.

User Types:
  - SuperAdmin : Backend-only super administrator. Not exposed in the UI.
  - Admin      : Tenant/client admin visible in the UI.
  - Teacher    : Course instructor.
  - Student    : Learner.
"""
from rest_framework.permissions import BasePermission
from utils.constants import UserTypeConstants

def _user_role(request):
    """Helper: safely return the role name for the authenticated user."""
    if (
        request.user
        and request.user.is_authenticated
        and hasattr(request.user, 'user_type')
        and request.user.user_type
    ):
        return request.user.user_type.name
    return None


# ---------------------------------------------------------------------------
# Single-role permissions
# ---------------------------------------------------------------------------

class IsSuperAdmin(BasePermission):
    """
    Allow access only to SuperAdmin users (backend / internal use only).
    SuperAdmin is NOT shown in the UI but has unrestricted system access.
    """
    message = "You must be a Super Admin to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) == UserTypeConstants.SUPERADMIN


class IsAdmin(BasePermission):
    """
    Allow access only to Admin users.
    """
    message = "You must be an Admin to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) == UserTypeConstants.ADMIN


class IsTeacher(BasePermission):
    """
    Allow access only to Teacher users.
    """
    message = "You must be a Teacher to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) == UserTypeConstants.TEACHER


class IsStudent(BasePermission):
    """
    Allow access only to Student users.
    """
    message = "You must be a Student to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) == UserTypeConstants.STUDENT


# ---------------------------------------------------------------------------
# Composite permissions
# ---------------------------------------------------------------------------

class IsSuperAdminOrAdmin(BasePermission):
    """
    Allow access to SuperAdmin or Admin users.
    Useful for management endpoints that both roles can operate.
    """
    message = "You must be a Super Admin or Admin to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) in [UserTypeConstants.SUPERADMIN, UserTypeConstants.ADMIN]


class IsAdminOrTeacher(BasePermission):
    """
    Allow access to Admin or Teacher users.
    """
    message = "You must be an Admin or Teacher to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) in [UserTypeConstants.ADMIN, UserTypeConstants.TEACHER]


class IsSuperAdminAdminOrTeacher(BasePermission):
    """
    Allow access to SuperAdmin, Admin, or Teacher users.
    """
    message = "You must be a Super Admin, Admin, or Teacher to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) in [UserTypeConstants.SUPERADMIN, UserTypeConstants.ADMIN, UserTypeConstants.TEACHER]


class IsTeacherOrStudent(BasePermission):
    """
    Allow access to Teacher or Student users.
    """
    message = "You must be a Teacher or Student to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) in [UserTypeConstants.TEACHER, UserTypeConstants.STUDENT]


class IsAuthenticated(BasePermission):
    """
    Allow access to any authenticated user with a recognised role
    (SuperAdmin, Admin, Teacher, or Student).
    """
    message = "You must be authenticated to perform this action."

    def has_permission(self, request, view):
        return _user_role(request) in [
            UserTypeConstants.SUPERADMIN,
            UserTypeConstants.ADMIN,
            UserTypeConstants.TEACHER,
            UserTypeConstants.STUDENT
        ]
