from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


class FeeStructure(models.Model):
    """One fee structure per batch enrollment — tracks total fee and aggregates payments."""

    enrollment = models.OneToOneField(
        'courses.BatchEnrollment',
        on_delete=models.CASCADE,
        related_name='fee_structure',
    )
    total_fee = models.DecimalField(_('Total Fee'), max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_fee_structures',
    )
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_fee_structures',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Fee Structure')
        verbose_name_plural = _('Fee Structures')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['enrollment']),
        ]

    def __str__(self):
        return f"{self.enrollment.student.fullname} — {self.enrollment.batch.name}"

    @property
    def paid_amount(self):
        result = self.payments.filter(status=Payment.Status.VERIFIED).aggregate(
            total=models.Sum('amount')
        )['total']
        return result or 0

    @property
    def balance_amount(self):
        return float(self.total_fee) - float(self.paid_amount)

    @property
    def fee_status(self):
        today = timezone.now().date()
        paid = float(self.paid_amount)
        total = float(self.total_fee)

        if paid >= total:
            return 'paid'

        has_overdue = self.installments.filter(
            status=Installment.Status.PENDING,
            due_date__lt=today,
        ).exists()

        if has_overdue:
            return 'overdue'

        if paid > 0:
            return 'partial'

        return 'pending'


class Installment(models.Model):
    """A scheduled installment in the payment plan for a FeeStructure."""

    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        PAID    = 'paid',    _('Paid')

    fee_structure      = models.ForeignKey(
        FeeStructure, on_delete=models.CASCADE, related_name='installments',
    )
    installment_number = models.PositiveSmallIntegerField(_('Installment #'))
    due_date           = models.DateField(_('Due Date'))
    amount             = models.DecimalField(_('Amount'), max_digits=10, decimal_places=2)
    status             = models.CharField(
        _('Status'), max_length=10, choices=Status.choices, default=Status.PENDING,
    )
    paid_date  = models.DateField(_('Paid Date'), null=True, blank=True)
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Installment')
        verbose_name_plural = _('Installments')
        ordering            = ['installment_number']
        unique_together     = ('fee_structure', 'installment_number')
        indexes             = [
            models.Index(fields=['fee_structure', 'status']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return (
            f"#{self.installment_number} — "
            f"{self.fee_structure.enrollment.student.fullname} "
            f"(₹{self.amount})"
        )

    @property
    def effective_status(self):
        """Returns 'overdue' if the installment is past due and still pending."""
        if self.status == self.Status.PAID:
            return 'paid'
        if self.due_date < timezone.now().date():
            return 'overdue'
        return 'pending'


class Payment(models.Model):
    """An actual payment recorded against a fee structure."""

    class Method(models.TextChoices):
        CASH          = 'cash',          _('Cash')
        BANK_TRANSFER = 'bank_transfer', _('Bank Transfer')
        UPI           = 'upi',           _('UPI')
        CHEQUE        = 'cheque',        _('Cheque')
        CARD          = 'card',          _('Card')
        OTHER         = 'other',         _('Other')

    class Status(models.TextChoices):
        VERIFIED             = 'verified',             _('Verified')
        PENDING_VERIFICATION = 'pending_verification', _('Pending Verification')
        REJECTED             = 'rejected',             _('Rejected')

    fee_structure    = models.ForeignKey(
        FeeStructure, on_delete=models.CASCADE, related_name='payments',
    )
    amount           = models.DecimalField(_('Amount'), max_digits=10, decimal_places=2)
    payment_date     = models.DateField(_('Payment Date'))
    method           = models.CharField(
        _('Payment Method'), max_length=20, choices=Method.choices, default=Method.CASH,
    )
    reference_number = models.CharField(_('Reference Number'), max_length=255, blank=True)
    status           = models.CharField(
        _('Status'), max_length=25, choices=Status.choices, default=Status.VERIFIED,
    )
    notes            = models.TextField(blank=True)
    attachment       = models.FileField(
        _('Attachment'), upload_to='fee_payments/', null=True, blank=True,
    )
    recorded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='recorded_payments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _('Payment')
        verbose_name_plural = _('Payments')
        ordering            = ['-payment_date', '-created_at']
        indexes             = [
            models.Index(fields=['fee_structure', 'status']),
            models.Index(fields=['payment_date']),
        ]

    def __str__(self):
        return (
            f"₹{self.amount} — "
            f"{self.fee_structure.enrollment.student.fullname} "
            f"({self.payment_date})"
        )
