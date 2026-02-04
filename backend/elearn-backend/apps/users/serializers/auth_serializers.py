from rest_framework import serializers

class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    expected_role = serializers.CharField(required=False, allow_blank=True)

class LoginResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField()
    data = serializers.DictField()

class RefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()

class MessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField()
