import json
from channels.generic.websocket import AsyncWebsocketConsumer
from apps.courses.models import Batch, BatchChatMessage
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from utils.constants import UserTypeConstants
from apps.courses.models import BatchEnrollment

User = get_user_model()

class BatchChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.batch_id = self.scope['url_route']['kwargs']['batch_id']
        self.room_group_name = f'chat_batch_{self.batch_id}'
        self.user = self.scope.get('user')

        if not self.user or self.user.is_anonymous:
            await self.close()
            return

        # Check if user has access to this batch
        has_access = await self.check_user_access(self.user.id, self.batch_id)
        if not has_access:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    @database_sync_to_async
    def check_user_access(self, user_id, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id)
            user = User.objects.get(id=user_id)
            
            if user.user_type.name in [UserTypeConstants.ADMIN, UserTypeConstants.SUPERADMIN]:
                return True
                
            if user.user_type.name == UserTypeConstants.TEACHER:
                return batch.teacher_id == user.id or batch.co_teachers.filter(id=user.id).exists()
                
            if user.user_type.name == UserTypeConstants.STUDENT:
                return batch.enrollments.filter(student=user, status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED]).exists()
            
            return False
        except (Batch.DoesNotExist, User.DoesNotExist):
            return False

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket (could be used for simple text messages)
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_text = text_data_json.get('message', '')

        if not message_text.strip():
            return
            
        # Optional: Handled here if messages shouldn't go via REST HTTP API.
        # But per the current architecture, files and text go through the HTTP 
        # API first (for attachments & reliable 201 Created), which then calls Group Send.
        # We can implement a direct WS save here as a fallback or for text-only speed.
        
        saved_message = await self.save_message(self.user.id, self.batch_id, message_text)
        
        if saved_message:
            # We would normally serialize it and broadcast it here, but we are relying
            # primarily on the POST request logic in views.py for saving files/texts
            pass

    @database_sync_to_async
    def save_message(self, user_id, batch_id, text):
        try:
            batch = Batch.objects.get(id=batch_id)
            user = User.objects.get(id=user_id)
            return BatchChatMessage.objects.create(
                batch=batch,
                sender=user,
                message=text
            )
        except Exception as e:
            print(f"WS Save Error: {e}")
            return None

    # Receive message from room group (broadcast from other clients or POST views)
    async def chat_message(self, event):
        message = event.get('message')
        # We can pass the whole serialized message
        serialized_data = event.get('serialized_data', {})

        if serialized_data:
            # Send serialized message to WebSocket
            await self.send(text_data=json.dumps(serialized_data))
        else:
            await self.send(text_data=json.dumps({
                'message': message,
                'user_id': event.get('user_id')
            }))
