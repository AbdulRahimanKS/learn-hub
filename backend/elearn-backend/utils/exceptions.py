import logging

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import exception_handler
try:
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
except Exception:
    InvalidToken = tuple()
    TokenError = tuple()

from utils.common import ServiceError

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    request = context.get("request")
    if hasattr(request, "_request"):
        django_request = request._request
    else:
        django_request = request

    if isinstance(exc, ServiceError):
        logger.error(
            (
                f"METHOD:{getattr(django_request, 'method', 'UNKNOWN')} URL: {django_request.build_absolute_uri() if request else 'UNKNOWN'} Error:{exc.detail} -"
                f"ERROR TYPE: 'ServiceError'"
            )
        )
        if request.path.startswith("api/mobile/v1/"):
            response = Response(
                {"error": f"{exc}"}, status=exc.status_code
            )
        else:
            response = Response(
                {"message": f"{exc}"}, status=exc.status_code
            )
        return response

    # Map expired/invalid token errors to 440 (Login Time-out)
    def extract_code_and_message(obj):
        try:
            detail = getattr(obj, "detail", obj)
            if isinstance(detail, dict):
                code = detail.get("code")
                message = str(detail.get("detail") or detail).lower()
                # simplejwt sometimes nests codes in messages list
                messages = detail.get("messages", [])
                if messages and isinstance(messages, list):
                    try:
                        code = messages[0].get("token_type") and detail.get("code", code) or code
                    except Exception:
                        pass
                return code, message, detail
            return getattr(obj, "code", None), str(detail).lower(), detail
        except Exception:
            return None, str(obj).lower(), {}

    def is_token_invalid_or_expired(e):
        code, message, detail = extract_code_and_message(e)
        if code in {"token_not_valid", "token_expired"}:
            return True
        # common phrases
        text = " ".join([
            message,
            str(detail.get("detail", "")).lower() if isinstance(detail, dict) else "",
        ])
        keywords = [
            "token has expired",
            "token expired",
            "given token not valid",
            "token is invalid",
            "token not valid",
        ]
        return any(k in text for k in keywords)

    if (
        isinstance(exc, (AuthenticationFailed, NotAuthenticated, PermissionDenied))
        or isinstance(exc, (InvalidToken, TokenError))
    ) and is_token_invalid_or_expired(exc):
        return Response({"error": "Token invalid or expired"}, status=440)

    response = exception_handler(exc, context)

    # Post-process default responses to coerce token-invalid 401/403 to 440
    if response is not None and response.status_code in (401, 403):
        try:
            if is_token_invalid_or_expired(exc) or (
                isinstance(response.data, dict)
                and (
                    response.data.get("code") in {"token_not_valid", "token_expired"}
                    or "token" in str(response.data).lower()
                    and ("expired" in str(response.data).lower() or "not valid" in str(response.data).lower())
                )
            ):
                response.status_code = 440
                response.data = {"error": "Token invalid or expired"}
        except Exception:
            pass

    if response is None:
        logger.error(
            (
                f"METHOD:{getattr(django_request, 'method', 'UNKNOWN')} URL: {django_request.build_absolute_uri() if django_request else 'UNKNOWN'} Error:{exc} - "
                f"ERROR TYPE: 'UnhandledError'"
            )
        )
        if request.path.startswith("api/mobile/v1/"):
            response = Response(
                {"error": f"{exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        else:
            response = Response(
                {"message": f"{exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    return response
