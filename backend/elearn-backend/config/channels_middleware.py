from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from channels.middleware import BaseMiddleware

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token.get('user_id')
        if not user_id:
            return AnonymousUser()
        try:
            user = User.objects.get(id=user_id)
            return user
        except User.DoesNotExist:
            return AnonymousUser()
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        try:
            query_string = scope.get('query_string', b'').decode()
            query_parameters = dict(qc.split('=') for qc in query_string.split('&') if '=' in qc)
            token_key = query_parameters.get('token')
            
            if token_key:
                user = await get_user_from_token(token_key)
                scope['user'] = user
            else:
                scope['user'] = AnonymousUser()
        except ValueError:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
