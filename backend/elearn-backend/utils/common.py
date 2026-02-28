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
