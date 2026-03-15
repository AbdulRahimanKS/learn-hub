from rest_framework import serializers
from apps.users.models import AppConfiguration

class AppConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppConfiguration
        fields = ['id', 'business_name', 'timezone', 'logo', 'openai_api_key', 'groq_api_key', 'openai_model', 'groq_model']
        read_only_fields = ['id']
