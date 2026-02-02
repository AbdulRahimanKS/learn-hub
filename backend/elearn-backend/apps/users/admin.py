from django.contrib import admin

# Register your models here.
from django.contrib.auth.admin import UserAdmin
from .models import User

admin.site.register(User, UserAdmin)
from .models import User, Profile

admin.site.register(Profile)
from .models import UserType

admin.site.register(UserType)
from .models import User, Profile, UserType
