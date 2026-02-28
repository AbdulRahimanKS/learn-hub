from django.urls import path
from apps.users.views.auth_views import LoginView, LogoutView, RefreshTokenView, ChangePasswordView
from apps.users.views.password_reset_views import (
    RequestPasswordResetView,
    VerifyOTPView,
    ResetPasswordView
)
from apps.users.views.user_profile_views import UserProfileView
from apps.users.views.user_list_views import UserListByRoleView
from apps.users.views.user_management_views import (
    UserManagementView,
    UserManagementDetailView,
    UserSendCredentialsView,
)
from apps.users.views.email_config_views import (
    EmailConfigView,
    EmailConfigListView,
    EmailConfigCreateUpdateView,
    EmailConfigToggleView
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", RefreshTokenView.as_view(), name="token-refresh"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    
    # User Profile & Listing
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("list/", UserListByRoleView.as_view(), name="user-list-by-role"),

    # Admin User Management
    path("manage/", UserManagementView.as_view(), name="user-manage-list-create"),
    path("manage/<int:pk>/", UserManagementDetailView.as_view(), name="user-manage-detail"),
    path("manage/<int:pk>/send-credentials/", UserSendCredentialsView.as_view(), name="user-send-credentials"),
    
    # Email Configuration
    path("email-config/", EmailConfigView.as_view(), name="email-config"),
    path("email-config/list/", EmailConfigListView.as_view(), name="email-config-list"),
    path("email-config/save/", EmailConfigCreateUpdateView.as_view(), name="email-config-save"),
    path("email-config/<int:pk>/toggle/", EmailConfigToggleView.as_view(), name="email-config-toggle"),
    
    # Password Reset URLs
    path("password-reset/request/", RequestPasswordResetView.as_view(), name="password-reset-request"),
    path("password-reset/verify/", VerifyOTPView.as_view(), name="password-reset-verify"),
    path("password-reset/confirm/", ResetPasswordView.as_view(), name="password-reset-confirm"),
]