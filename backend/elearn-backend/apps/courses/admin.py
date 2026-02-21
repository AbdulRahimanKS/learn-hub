from django.contrib import admin
from django.apps import apps
from django.contrib.admin.sites import AlreadyRegistered

# No custom admin configurations needed — auto-register all models
app_config = apps.get_app_config('courses')
for model in app_config.get_models():
    try:
        admin.site.register(model)
    except AlreadyRegistered:
        pass
