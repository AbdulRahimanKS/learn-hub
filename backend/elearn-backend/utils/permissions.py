"""
Custom permission classes for role-based access control.
These permissions check the user's role (user_type) to determine access.
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Permission class that allows access only to Admin users.
    """
    message = "You must be an Admin to perform this action."

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and hasattr(request.user, 'user_type')
            and request.user.user_type 
            and request.user.user_type.name.lower() == 'admin'
        )


class IsTeacher(BasePermission):
    """
    Permission class that allows access only to Teacher users.
    """
    message = "You must be a Teacher to perform this action."

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and hasattr(request.user, 'user_type')
            and request.user.user_type 
            and request.user.user_type.name.lower() == 'teacher'
        )


class IsStudent(BasePermission):
    """
    Permission class that allows access only to Student users.
    """
    message = "You must be a Student to perform this action."

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and hasattr(request.user, 'user_type')
            and request.user.user_type 
            and request.user.user_type.name.lower() == 'student'
        )


class IsAdminOrTeacher(BasePermission):
    """
    Permission class that allows access to Admin or Teacher users.
    """
    message = "You must be an Admin or Teacher to perform this action."

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and hasattr(request.user, 'user_type')
            and request.user.user_type 
            and request.user.user_type.name.lower() in ['admin', 'teacher']
        )


class IsTeacherOrStudent(BasePermission):
    """
    Permission class that allows access to Teacher or Student users.
    """
    message = "You must be a Teacher or Student to perform this action."

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and hasattr(request.user, 'user_type')
            and request.user.user_type 
            and request.user.user_type.name.lower() in ['teacher', 'student']
        )


class IsAuthenticated(BasePermission):
    """
    Permission class that allows access to any authenticated user 
    (Admin, Teacher, or Student).
    """
    message = "You must be authenticated to perform this action."

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and hasattr(request.user, 'user_type')
            and request.user.user_type 
            and request.user.user_type.name.lower() in ['admin', 'teacher', 'student']
        )


# Optional: Object-level permissions for more granular control
class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission to only allow owners of an object or admins to access it.
    Assumes the model instance has an `user` or `created_by` attribute.
    """
    message = "You must be the owner or an Admin to perform this action."

    def has_object_permission(self, request, view, obj):
        # Admin can access any object
        if (request.user.user_type and 
            request.user.user_type.name.lower() == 'admin'):
            return True
        
        # Check if user is the owner
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False


class IsOwnerOrTeacher(BasePermission):
    """
    Object-level permission to only allow owners of an object or teachers to access it.
    Assumes the model instance has an `user` or `created_by` attribute.
    """
    message = "You must be the owner or a Teacher to perform this action."

    def has_object_permission(self, request, view, obj):
        # Teacher can access any object
        if (request.user.user_type and 
            request.user.user_type.name.lower() == 'teacher'):
            return True
        
        # Check if user is the owner
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False
