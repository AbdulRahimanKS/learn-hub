from django.contrib import admin
from apps.fees.models import FeeStructure, Installment, Payment


class InstallmentInline(admin.TabularInline):
    model = Installment
    extra = 0
    fields = ('installment_number', 'due_date', 'amount', 'status', 'paid_date')


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ('amount', 'payment_date', 'method', 'reference_number', 'status', 'recorded_by')
    readonly_fields = ('recorded_by',)


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'total_fee', 'fee_status', 'created_at')
    list_select_related = ('enrollment__student', 'enrollment__batch')
    search_fields = ('enrollment__student__email', 'enrollment__student__first_name')
    inlines = (InstallmentInline, PaymentInline)
    readonly_fields = ('created_by', 'updated_by', 'created_at', 'updated_at')


@admin.register(Installment)
class InstallmentAdmin(admin.ModelAdmin):
    list_display = ('fee_structure', 'installment_number', 'due_date', 'amount', 'status')
    list_filter = ('status',)
    search_fields = ('fee_structure__enrollment__student__email',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('fee_structure', 'amount', 'payment_date', 'method', 'status', 'recorded_by')
    list_filter = ('status', 'method')
    search_fields = ('fee_structure__enrollment__student__email', 'reference_number')
    readonly_fields = ('recorded_by', 'created_at', 'updated_at')
