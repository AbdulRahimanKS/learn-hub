from rest_framework import serializers
from django.utils import timezone
from apps.fees.models import FeeStructure, Installment, Payment


class InstallmentSerializer(serializers.ModelSerializer):
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = Installment
        fields = [
            'id', 'installment_number', 'due_date', 'amount',
            'status', 'effective_status', 'paid_date', 'notes',
        ]

    def get_effective_status(self, obj):
        return obj.effective_status


class FeeStudentListSerializer(serializers.ModelSerializer):
    """Flat summary row for the student fee list table."""
    student_id      = serializers.IntegerField(source='enrollment.student.id',         read_only=True)
    student_name    = serializers.CharField(  source='enrollment.student.fullname',     read_only=True)
    student_email   = serializers.EmailField( source='enrollment.student.email',        read_only=True)
    profile_picture = serializers.SerializerMethodField()
    course_name     = serializers.CharField(  source='enrollment.batch.course.title',   read_only=True)
    batch_name      = serializers.CharField(  source='enrollment.batch.name',           read_only=True)
    batch_id        = serializers.IntegerField(source='enrollment.batch.id',            read_only=True)
    course_id       = serializers.IntegerField(source='enrollment.batch.course.id',     read_only=True)
    enrolled_at     = serializers.DateTimeField(source='enrollment.enrolled_at',        read_only=True)
    paid_amount     = serializers.SerializerMethodField()
    balance_amount  = serializers.SerializerMethodField()
    fee_status      = serializers.SerializerMethodField()

    class Meta:
        model  = FeeStructure
        fields = [
            'id', 'student_id', 'student_name', 'student_email', 'profile_picture',
            'course_name', 'batch_name', 'batch_id', 'course_id',
            'total_fee', 'paid_amount', 'balance_amount', 'fee_status', 'enrolled_at',
        ]

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        pic = obj.enrollment.student.profile_picture
        if pic and hasattr(pic, 'url') and request:
            return request.build_absolute_uri(pic.url)
        return None

    def get_paid_amount(self, obj):
        return float(obj.paid_amount)

    def get_balance_amount(self, obj):
        return float(obj.balance_amount)

    def get_fee_status(self, obj):
        return obj.fee_status


class FeeStudentDetailSerializer(FeeStudentListSerializer):
    """Detailed view with installment schedule included."""
    installments = InstallmentSerializer(many=True, read_only=True)

    class Meta(FeeStudentListSerializer.Meta):
        fields = FeeStudentListSerializer.Meta.fields + ['installments', 'notes']


class FeeStructureCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeeStructure
        fields = ['enrollment', 'total_fee', 'notes']

    def validate_enrollment(self, value):
        if FeeStructure.objects.filter(enrollment=value).exists():
            raise serializers.ValidationError(
                "A fee structure already exists for this enrollment."
            )
        return value


class FeeStructureUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeeStructure
        fields = ['total_fee', 'notes']


class InstallmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Installment
        fields = ['installment_number', 'due_date', 'amount', 'notes']

    def validate_installment_number(self, value):
        fee_structure = self.context.get('fee_structure')
        if fee_structure and Installment.objects.filter(
            fee_structure=fee_structure, installment_number=value
        ).exists():
            raise serializers.ValidationError(
                f"Installment #{value} already exists for this fee structure."
            )
        return value


class InstallmentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Installment
        fields = ['due_date', 'amount', 'status', 'paid_date', 'notes']


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for listing payments with student/batch context."""
    fee_student_id  = serializers.IntegerField(source='fee_structure.id',                      read_only=True)
    student_id      = serializers.IntegerField(source='fee_structure.enrollment.student.id',   read_only=True)
    student_name    = serializers.CharField(  source='fee_structure.enrollment.student.fullname', read_only=True)
    student_email   = serializers.EmailField( source='fee_structure.enrollment.student.email', read_only=True)
    batch_name      = serializers.CharField(  source='fee_structure.enrollment.batch.name',    read_only=True)
    batch_id        = serializers.IntegerField(source='fee_structure.enrollment.batch.id',     read_only=True)
    course_name     = serializers.CharField(  source='fee_structure.enrollment.batch.course.title', read_only=True)
    attachment_url  = serializers.SerializerMethodField()

    class Meta:
        model  = Payment
        fields = [
            'id', 'fee_student_id', 'student_id', 'student_name', 'student_email',
            'batch_name', 'batch_id', 'course_name',
            'amount', 'payment_date', 'method', 'reference_number',
            'status', 'notes', 'attachment_url',
        ]

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request and hasattr(obj.attachment, 'url'):
            return request.build_absolute_uri(obj.attachment.url)
        return None


class AddPaymentSerializer(serializers.Serializer):
    amount           = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_date     = serializers.DateField()
    method           = serializers.ChoiceField(choices=Payment.Method.choices)
    reference_number = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    notes            = serializers.CharField(required=False, allow_blank=True, default='')
    attachment       = serializers.FileField(required=False, allow_null=True)
    status           = serializers.ChoiceField(
        choices=Payment.Status.choices, default=Payment.Status.VERIFIED
    )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class PendingFeeSerializer(serializers.ModelSerializer):
    """Flat row for the pending fees table — derived from Installment."""
    fee_student_id  = serializers.IntegerField(source='fee_structure.id',                           read_only=True)
    student_id      = serializers.IntegerField(source='fee_structure.enrollment.student.id',        read_only=True)
    student_name    = serializers.CharField(  source='fee_structure.enrollment.student.fullname',   read_only=True)
    student_email   = serializers.EmailField( source='fee_structure.enrollment.student.email',      read_only=True)
    course_name     = serializers.CharField(  source='fee_structure.enrollment.batch.course.title', read_only=True)
    batch_name      = serializers.CharField(  source='fee_structure.enrollment.batch.name',         read_only=True)
    batch_id        = serializers.IntegerField(source='fee_structure.enrollment.batch.id',          read_only=True)
    pending_amount  = serializers.DecimalField(source='amount', max_digits=10, decimal_places=2,    read_only=True)
    pending_status  = serializers.SerializerMethodField()
    days_overdue    = serializers.SerializerMethodField()

    class Meta:
        model  = Installment
        fields = [
            'id', 'fee_student_id', 'student_id', 'student_name', 'student_email',
            'course_name', 'batch_name', 'batch_id',
            'pending_amount', 'due_date', 'pending_status', 'days_overdue',
        ]

    def get_pending_status(self, obj):
        today = timezone.now().date()
        diff = (obj.due_date - today).days
        if diff < 0:
            return 'overdue'
        if diff == 0:
            return 'due_today'
        return 'due_soon'

    def get_days_overdue(self, obj):
        today = timezone.now().date()
        delta = today - obj.due_date
        return max(0, delta.days)
