from rest_framework import serializers
from apps.users.models import AppConfiguration

class AppConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppConfiguration
        fields = ['business_name', 'timezone', 'logo', 'id', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
