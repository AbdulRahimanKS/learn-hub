import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _
from utils.constants import UserTypeConstants

class UserType(models.Model):
    """
    User Types for the application using choices for predefined roles.
    """
    class Role(models.TextChoices):
        ADMIN = UserTypeConstants.ADMIN, _('Admin')
        TEACHER = UserTypeConstants.TEACHER, _('Teacher')
        STUDENT = UserTypeConstants.STUDENT, _('Student')

    name = models.CharField(
        _("Type Name"), 
        max_length=50, 
        choices=Role.choices, 
        unique=True
    )
    description = models.TextField(_("Description"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.get_name_display()


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email field must be set'))
        
        email = self.normalize_email(email).lower()
        
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        try:
            user_type, _ = UserType.objects.get_or_create(
                name=UserType.Role.ADMIN,
                defaults={'description': 'Super Administrator with full access'}
            )
            extra_fields['user_type'] = user_type
        except Exception:
            pass

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model extending AbstractBaseUser.
    """
    email = models.EmailField(_('email address'), unique=True)
    fullname = models.CharField(_("Full Name"), max_length=255, blank=True)
    user_code = models.CharField(_("User Code"), max_length=20, unique=True, editable=False)
    
    phone_number_code = models.CharField(_("Phone Code"), max_length=10, blank=True)
    contact_number = models.CharField(_("Contact Number"), max_length=20, blank=True)
    
    user_type = models.ForeignKey(
        UserType, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='users',
        help_text=_("Role of the user in the system")
    )

    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')
    updated_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_users')
    is_deleted = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['fullname']

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower()
            
        if not self.user_code:
            while True:
                code = f"USR-{uuid.uuid4().hex[:8].upper()}"
                if not User.objects.filter(user_code=code).exists():
                    self.user_code = code
                    break
            
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class Profile(models.Model):
    """
    Profile model to store detailed user information.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    avatar = models.URLField(_("Avatar URL"), blank=True)
    bio = models.TextField(_("Bio"), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email}'s Profile"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Signal to automatically create a Profile when a User is created.
    """
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    Signal to save the Profile when the User is saved.
    """
    if hasattr(instance, 'profile'):
        instance.profile.save()


class EmailSetting(models.Model):
    """
    EmailSetting model to store email configuration.
    """
    Choice = (("smtp", "smtp"), ("outlook", "outlook"))
    
    email = models.EmailField(unique=True)
    email_type = models.CharField(max_length=20, choices=Choice)
    email_host = models.CharField(max_length=100, null=True, blank=True)
    email_port = models.CharField(max_length=100, null=True, blank=True)
    email_user = models.CharField(max_length=100, null=True, blank=True)
    email_password = models.CharField(max_length=100, null=True, blank=True)
    client_id = models.CharField(max_length=200, null=True, blank=True)
    client_secret = models.CharField(max_length=200, null=True, blank=True)
    tenant_id = models.CharField(max_length=200, null=True, blank=True)
    status = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_email_settings",
    )

    def __str__(self):
        return self.email
