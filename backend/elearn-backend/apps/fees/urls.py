from django.urls import path
from apps.fees.views import (
    FeeDashboardView,
    FeeStudentListView,
    FeeStudentCreateView,
    FeeStudentDetailView,
    FeeStudentUpdateView,
    InstallmentListCreateView,
    InstallmentDetailView,
    PaymentListView,
    AddPaymentView,
    PendingFeesView,
    MyFeesView,
)

urlpatterns = [
    # Dashboard
    path("dashboard/", FeeDashboardView.as_view(), name="fee-dashboard"),

    # Students (fee structures)
    path("students/",             FeeStudentListView.as_view(),   name="fee-student-list"),
    path("students/create/",      FeeStudentCreateView.as_view(), name="fee-student-create"),
    path("students/<int:fee_structure_id>/",         FeeStudentDetailView.as_view(), name="fee-student-detail"),
    path("students/<int:fee_structure_id>/update/",  FeeStudentUpdateView.as_view(), name="fee-student-update"),

    # Installments
    path("students/<int:fee_structure_id>/installments/",
         InstallmentListCreateView.as_view(), name="fee-installment-list-create"),
    path("students/<int:fee_structure_id>/installments/<int:installment_id>/",
         InstallmentDetailView.as_view(), name="fee-installment-detail"),

    # Payments
    path("payments/",                                PaymentListView.as_view(), name="fee-payment-list"),
    path("students/<int:fee_structure_id>/payments/", AddPaymentView.as_view(), name="fee-add-payment"),

    # Pending fees
    path("pending/", PendingFeesView.as_view(), name="fee-pending"),

    # Student portal
    path("my/", MyFeesView.as_view(), name="fee-my"),
]
