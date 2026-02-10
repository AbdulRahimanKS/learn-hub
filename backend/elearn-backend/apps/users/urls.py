from django.urls import path
from apps.users.views.auth_views import LoginView, LogoutView, RefreshTokenView, ChangePasswordView
from apps.users.views.password_reset_views import (
    RequestPasswordResetView,
    VerifyOTPView,
    ResetPasswordView
)
from apps.users.views.user_profile_views import UserProfileView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", RefreshTokenView.as_view(), name="token-refresh"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    
    # User Profile
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    
    # Password Reset URLs
    path("password-reset/request/", RequestPasswordResetView.as_view(), name="password-reset-request"),
    path("password-reset/verify/", VerifyOTPView.as_view(), name="password-reset-verify"),
    path("password-reset/confirm/", ResetPasswordView.as_view(), name="password-reset-confirm"),
]