from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _


class UserType(models.Model):
    """
    User Types for the application using choices for predefined roles.
    """
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', _('Super Admin')
        ADMIN = 'ADMIN', _('Admin')
        TEACHER = 'TEACHER', _('Teacher')
        STUDENT = 'STUDENT', _('Student')

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


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    """
    email = models.EmailField(_('email address'), unique=True)
    user_type = models.ForeignKey(
        UserType, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='users',
        help_text=_("Role of the user in the system")
    )
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    # We can add more fields here if needed by the frontend directly on the user model,
    # but Profile is often better for extended details.

    def __str__(self):
        return self.email

class Profile(models.Model):
    """
    Profile model to store detailed user information.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.URLField(_("Avatar URL"), blank=True, null=True)
    bio = models.TextField(_("Bio"), blank=True)
    phone_number = models.CharField(_("Phone Number"), max_length=20, blank=True)
    
    # Add other fields required by frontend here
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

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
    instance.profile.save()
