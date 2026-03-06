import uuid
import random
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from utils.constants import UserTypeConstants


# UserType
class UserType(models.Model):
    """
    User Types for the application using choices for predefined roles.
    """
    class Role(models.TextChoices):
        SUPERADMIN = UserTypeConstants.SUPERADMIN, _('Super Admin')
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


# CustomUserManager
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
                name=UserType.Role.SUPERADMIN,
                defaults={'description': 'Super Administrator with full system access (backend only)'}
            )
            extra_fields['user_type'] = user_type
        except Exception:
            pass

        return self.create_user(email, password, **extra_fields)


# User
class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model using email as the primary identifier.
    """
    class UserStatus(models.TextChoices):
        ACTIVE   = "ACTIVE",   "Active"
        INACTIVE = "INACTIVE", "Inactive"
        DELETED  = "DELETED",  "Deleted"

    user_code = models.CharField(max_length=20, unique=True, editable=False)
    email = models.EmailField(_('Email Address'), unique=True)
    fullname = models.CharField(_('Full Name'), max_length=255)

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

    status = models.CharField(
        max_length=20,
        choices=UserStatus.choices,
        default=UserStatus.ACTIVE
    )

    is_deleted  = models.BooleanField(default=False)
    deleted_at  = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')
    updated_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_users')
    deleted_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_users')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    
    objects = CustomUserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['fullname']
    
    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')
    
    def __str__(self):
        return self.email
    
    def save(self, *args, **kwargs):
        if not self.user_code:
            self.user_code = self.generate_user_code()
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)

    def activate(self):
        self.status = self.UserStatus.ACTIVE
        self.is_active = True
        self.save()

    def deactivate(self):
        self.status = self.UserStatus.INACTIVE
        self.is_active = False
        self.save()
    
    def generate_user_code(self):
        """Generate a unique user code."""
        while True:
            code = f"USR{uuid.uuid4().hex[:8].upper()}"
            if not User.objects.filter(user_code=code).exists():
                return code

    def soft_delete(self, deleted_by_user=None):
        import time
        ts = int(time.time())
        
        self.email     = f"{self.email}__del_{ts}"
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.is_active  = False
        self.status     = self.UserStatus.DELETED
        if deleted_by_user:
            self.deleted_by = deleted_by_user
        self.save()


# Profile
class Profile(models.Model):
    """
    Extended profile information for users.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    address = models.TextField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    profile_picture = models.ImageField(
        upload_to="profile_pictures/",
        blank=True,
        null=True,
        help_text="Profile picture"
    )
    bio = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Profile of {self.user.email}"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Signal to create a Profile when a User is created.
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


# Email Setting
class EmailSetting(models.Model):
    """
    EmailSetting model to store email configuration.
    """
    Choice = (("smtp", "smtp"),)
    
    email = models.EmailField(unique=True)
    email_type = models.CharField(max_length=20, choices=Choice, default='smtp')
    email_host = models.CharField(max_length=100, null=True, blank=True)
    email_port = models.CharField(max_length=100, null=True, blank=True)
    email_user = models.CharField(max_length=100, null=True, blank=True)
    email_password = models.CharField(max_length=100, null=True, blank=True)
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


# Password Reset OTP
class PasswordResetOTP(models.Model):
    """
    Model to store OTP for password reset.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_otps'
    )
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = _('Password Reset OTP')
        verbose_name_plural = _('Password Reset OTPs')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"OTP for {self.email} - {self.otp}"
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if OTP has expired."""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Check if OTP is valid (not used and not expired)."""
        return not self.is_used and not self.is_expired()
    
    @staticmethod
    def generate_otp():
        """Generate a 6-digit OTP."""
        return str(random.randint(100000, 999999))


# AppConfiguration
class AppConfiguration(models.Model):
    business_name = models.CharField(_("Business Name"), max_length=255, default="Learn Hub")
    timezone = models.CharField(_("Timezone"), max_length=100, default="Asia/Kolkata")
    logo = models.ImageField(upload_to="app_config/logos/", null=True, blank=True)

    class Meta:
        verbose_name = _('App Configuration')
        verbose_name_plural = _('App Configurations')

    def __str__(self):
        return self.business_name

    def save(self, *args, **kwargs):
        if not self.pk and AppConfiguration.objects.exists():
            return
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


# Notification
class Notification(models.Model):
    class NotificationType(models.TextChoices):
        INFO = 'info', _('Info')
        WARNING = 'warning', _('Warning')
        SUCCESS = 'success', _('Success')
        ERROR = 'error', _('Error')

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(_("Title"), max_length=255)
    message = models.TextField(_("Message"))
    
    notification_type = models.CharField(
        _("Notification Type"), 
        max_length=20, 
        choices=NotificationType.choices, 
        default=NotificationType.INFO
    )

    # Optional Generic Foreign Key for linking to any object
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    action_url = models.CharField(_("Action URL"), max_length=1024, blank=True, null=True, help_text=_("Path to redirect when clicked (e.g. /admin-batches)"))
    is_read = models.BooleanField(_("Is Read"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.email} - {self.title}"

