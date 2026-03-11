from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/chat/batch/(?P<batch_id>\w+)/$', consumers.BatchChatConsumer.as_asgi()),
]
