from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
import logging
import secrets
import string

logger = logging.getLogger(__name__)


class ServiceError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Service error"
    default_code = "service_error"

    def __init__(self, detail=None, code=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail=detail, code=code)


def format_success_response(
    data=None, message="Data retrieved successfully", status_code=200,
    extra_params={}
):
    return Response({"message": message, "data": data, 'success': True, **extra_params}, status=status_code)


def get_formatted_field_name(field):
    return field.replace("_", " ").capitalize()


def handle_serializer_errors(serializer):
    errors = serializer.errors
    error_messages = []

    def parse_errors(field, messages):
        title_cased_field = get_formatted_field_name(field)
        if isinstance(messages, list):
            for index, item in enumerate(messages):
                if isinstance(item, dict):
                    for nested_field, nested_message in item.items():
                        parse_errors(f"{field}-{nested_field}", nested_message)
                else:
                    error_messages.append(f"{title_cased_field}: {item}")
        elif isinstance(messages, dict):
            for nested_field, nested_message in messages.items():
                parse_errors(f"{field}.{nested_field}", nested_message)
        else:
            error_messages.append(f"{title_cased_field}: {messages}")

    for field, messages in errors.items():
        parse_errors(field, messages)

    return " ".join(error_messages)


def generate_temp_password(length=10) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def activate_user_and_send_welcome_email(user, requesting_user):
    """
    Activates the user if they don't have a usable password, 
    generates a temporary password, and sends a welcome email.
    """
    from utils.email_utils import send_email

    if user and not user.has_usable_password():
        temp_password = generate_temp_password()
        user.set_password(temp_password)
        user.status = 'ACTIVE'
        user.is_active = True
        user.save(update_fields=['password', 'is_active', 'status'])
        
        role = user.user_type.name.capitalize() if user.user_type else "User"

        send_email(
            user=requesting_user,
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
        logger.info(f"Welcome credentials sent to {user.email}")
        return True
    return False


def create_notification(user_or_users, title, message, notification_type="info", action_url=None, content_object=None):
    """
    Utility function to create a notification for one or multiple users.
    
    Args:
        user_or_users: A single User instance or an iterable (list/QuerySet) of User instances.
        title (str): Notification title.
        message (str): Detailed notification message.
        notification_type (str): Type of notification ('info', 'warning', 'success', 'error').
        action_url (str, optional): URL to redirect to when the notification is clicked.
        content_object (Model, optional): Any django model instance related to this notification.
        
    Returns:
        List of created Notification objects.
    """
    from apps.users.models import Notification
    from django.contrib.contenttypes.models import ContentType

    # Convert to list if it's a single user object
    if hasattr(user_or_users, 'pk'):
        users = [user_or_users]
    else:
        users = user_or_users

    content_type = None
    object_id = None

    if content_object:
        content_type = ContentType.objects.get_for_model(content_object)
        object_id = content_object.pk

    notifications = []
    for user in users:
        notifications.append(
            Notification(
                user=user,
                title=title,
                message=message,
                notification_type=notification_type,
                action_url=action_url,
                content_type=content_type,
                object_id=object_id
            )
        )
    
    if notifications:
        return Notification.objects.bulk_create(notifications)
    return []
