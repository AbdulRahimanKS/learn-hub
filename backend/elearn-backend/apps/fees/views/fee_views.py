import logging
from datetime import date, timedelta

from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from apps.fees.models import FeeStructure, Installment, Payment
from apps.fees.serializers import (
    FeeStudentListSerializer,
    FeeStudentDetailSerializer,
    FeeStructureCreateSerializer,
    FeeStructureUpdateSerializer,
    InstallmentCreateSerializer,
    InstallmentUpdateSerializer,
    PaymentSerializer,
    AddPaymentSerializer,
    PendingFeeSerializer,
)
from utils.common import format_success_response, handle_serializer_errors, ServiceError
from utils.pagination import CustomPageNumberPagination
from utils.permissions import IsSuperAdminOrAdmin, IsStudent, IsAuthenticated

logger = logging.getLogger(__name__)


def _get_fee_structure_or_error(pk):
    try:
        return FeeStructure.objects.select_related(
            'enrollment__student', 'enrollment__batch__course'
        ).get(pk=pk)
    except FeeStructure.DoesNotExist:
        raise ServiceError("Fee structure not found.", status.HTTP_404_NOT_FOUND)


@extend_schema(tags=["Fee Management"])
class FeeDashboardView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(
        summary="Fee dashboard statistics",
        parameters=[
            OpenApiParameter("batch_id",  OpenApiTypes.INT, description="Filter by batch"),
            OpenApiParameter("course_id", OpenApiTypes.INT, description="Filter by course"),
        ],
        responses={200: None},
    )
    def get(self, request):
        batch_id  = request.query_params.get('batch_id')
        course_id = request.query_params.get('course_id')

        qs = FeeStructure.objects.select_related(
            'enrollment__student', 'enrollment__batch__course'
        ).prefetch_related('payments', 'installments')

        if batch_id:
            qs = qs.filter(enrollment__batch_id=batch_id)
        if course_id:
            qs = qs.filter(enrollment__batch__course_id=course_id)

        today = timezone.now().date()
        total_students = qs.count()
        total_fees = float(qs.aggregate(t=Sum('total_fee'))['t'] or 0)

        # Verified payments total
        payment_qs = Payment.objects.filter(
            fee_structure__in=qs, status=Payment.Status.VERIFIED
        )
        amount_collected = float(payment_qs.aggregate(t=Sum('amount'))['t'] or 0)
        pending_amount = total_fees - amount_collected
        collection_rate = round((amount_collected / total_fees * 100), 1) if total_fees > 0 else 0

        # Distribution — compute fee_status for each structure
        dist_counts = {'paid': 0, 'partial': 0, 'pending': 0, 'overdue': 0}
        dist_amounts = {'paid': 0.0, 'partial': 0.0, 'pending': 0.0, 'overdue': 0.0}
        for fs in qs:
            s = fs.fee_status
            dist_counts[s] += 1
            dist_amounts[s] += float(fs.total_fee)

        overdue_students = dist_counts['overdue']

        distribution = [
            {'status': k, 'count': dist_counts[k], 'amount': dist_amounts[k]}
            for k in ('paid', 'partial', 'pending', 'overdue')
            if dist_counts[k] > 0
        ]

        # Monthly trend (last 6 months)
        six_months_ago = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        for _ in range(5):
            six_months_ago = (six_months_ago - timedelta(days=1)).replace(day=1)

        monthly_collected = (
            Payment.objects.filter(
                fee_structure__in=qs,
                status=Payment.Status.VERIFIED,
                payment_date__gte=six_months_ago,
            )
            .annotate(month=TruncMonth('payment_date'))
            .values('month')
            .annotate(collected=Sum('amount'))
            .order_by('month')
        )

        monthly_pending = (
            Installment.objects.filter(
                fee_structure__in=qs,
                status=Installment.Status.PENDING,
                due_date__gte=six_months_ago,
            )
            .annotate(month=TruncMonth('due_date'))
            .values('month')
            .annotate(pending=Sum('amount'))
            .order_by('month')
        )

        collected_map = {
            row['month'].strftime('%b %y'): float(row['collected'])
            for row in monthly_collected
        }
        pending_map = {
            row['month'].strftime('%b %y'): float(row['pending'])
            for row in monthly_pending
        }

        # Build 6 month slots
        monthly_trend = []
        cursor = six_months_ago
        for _ in range(6):
            label = cursor.strftime('%b %y')
            monthly_trend.append({
                'month':     label,
                'collected': collected_map.get(label, 0),
                'pending':   pending_map.get(label, 0),
            })
            next_month = cursor.replace(day=28) + timedelta(days=4)
            cursor = next_month.replace(day=1)

        # Recent payments (last 6)
        recent_qs = (
            Payment.objects.filter(fee_structure__in=qs, status=Payment.Status.VERIFIED)
            .select_related('fee_structure__enrollment__student')
            .order_by('-payment_date', '-created_at')[:6]
        )
        recent_payments = [
            {
                'id':           p.id,
                'student_name': p.fee_structure.enrollment.student.fullname,
                'amount':       float(p.amount),
                'method':       p.method,
                'payment_date': str(p.payment_date),
            }
            for p in recent_qs
        ]

        return format_success_response(
            message="Dashboard data retrieved successfully.",
            data={
                'stats': {
                    'total_students':   total_students,
                    'total_fees':       total_fees,
                    'amount_collected': amount_collected,
                    'pending_amount':   pending_amount,
                    'overdue_students': overdue_students,
                    'collection_rate':  collection_rate,
                },
                'monthly':         monthly_trend,
                'distribution':    distribution,
                'recent_payments': recent_payments,
            },
        )


@extend_schema(tags=["Fee Management"])
class FeeStudentListView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(
        summary="List all students with fee summary",
        parameters=[
            OpenApiParameter("batch_id",   OpenApiTypes.INT, description="Filter by batch"),
            OpenApiParameter("course_id",  OpenApiTypes.INT, description="Filter by course"),
            OpenApiParameter("status",     OpenApiTypes.STR, description="paid|partial|pending|overdue"),
            OpenApiParameter("search",     OpenApiTypes.STR, description="Search by name/email"),
            OpenApiParameter("page",       OpenApiTypes.INT),
            OpenApiParameter("page_size",  OpenApiTypes.INT),
        ],
        responses={200: None},
    )
    def get(self, request):
        batch_id  = request.query_params.get('batch_id')
        course_id = request.query_params.get('course_id')
        search    = request.query_params.get('search', '').strip()
        status_f  = request.query_params.get('status', '').strip()

        qs = FeeStructure.objects.select_related(
            'enrollment__student', 'enrollment__batch__course'
        ).prefetch_related('payments', 'installments')

        if batch_id:
            qs = qs.filter(enrollment__batch_id=batch_id)
        if course_id:
            qs = qs.filter(enrollment__batch__course_id=course_id)
        if search:
            qs = qs.filter(
                Q(enrollment__student__first_name__icontains=search) |
                Q(enrollment__student__last_name__icontains=search) |
                Q(enrollment__student__email__icontains=search)
            )

        # Evaluate to list so we can filter by computed fee_status
        all_items = list(qs)

        # Stats computed over the unfiltered (batch/course-filtered) set
        stats_total   = len(all_items)
        stats_paid    = sum(1 for fs in all_items if fs.fee_status == 'paid')
        stats_partial = sum(1 for fs in all_items if fs.fee_status == 'partial')
        stats_pending = sum(1 for fs in all_items if fs.fee_status == 'pending')
        stats_overdue = sum(1 for fs in all_items if fs.fee_status == 'overdue')

        if status_f:
            all_items = [fs for fs in all_items if fs.fee_status == status_f]

        # Manual pagination
        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = max(1, min(100, int(request.query_params.get('page_size', 10))))
        except (ValueError, TypeError):
            page, page_size = 1, 10

        total_count = len(all_items)
        total_pages = max(1, -(-total_count // page_size))  # ceiling division
        start = (page - 1) * page_size
        paged = all_items[start: start + page_size]

        serializer = FeeStudentListSerializer(paged, many=True, context={'request': request})

        return format_success_response(
            message="Fee students retrieved successfully.",
            data=serializer.data,
            extra_params={
                'total_count': total_count,
                'total_pages': total_pages,
                'current_page': page,
                'stats': {
                    'total':   stats_total,
                    'paid':    stats_paid,
                    'partial': stats_partial,
                    'pending': stats_pending,
                    'overdue': stats_overdue,
                },
            },
        )


@extend_schema(tags=["Fee Management"])
class FeeStudentCreateView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(
        summary="Create fee structure for an enrollment",
        responses={201: None},
    )
    def post(self, request):
        serializer = FeeStructureCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return handle_serializer_errors(serializer)
        fs = serializer.save(created_by=request.user, updated_by=request.user)
        out = FeeStudentDetailSerializer(fs, context={'request': request})
        return format_success_response(
            message="Fee structure created successfully.",
            data=out.data,
            status_code=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Fee Management"])
class FeeStudentDetailView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(summary="Get student fee detail with installments and payments", responses={200: None})
    def get(self, request, fee_structure_id):
        fs = _get_fee_structure_or_error(fee_structure_id)
        student_data = FeeStudentDetailSerializer(fs, context={'request': request}).data
        payments_qs  = fs.payments.select_related(
            'fee_structure__enrollment__student', 'fee_structure__enrollment__batch__course'
        ).order_by('-payment_date', '-created_at')
        payments_data = PaymentSerializer(payments_qs, many=True, context={'request': request}).data
        return format_success_response(
            message="Fee student detail retrieved successfully.",
            data={'student': student_data, 'payments': payments_data},
        )


@extend_schema(tags=["Fee Management"])
class FeeStudentUpdateView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(summary="Update total fee or notes", responses={200: None})
    def patch(self, request, fee_structure_id):
        fs = _get_fee_structure_or_error(fee_structure_id)
        serializer = FeeStructureUpdateSerializer(fs, data=request.data, partial=True)
        if not serializer.is_valid():
            return handle_serializer_errors(serializer)
        serializer.save(updated_by=request.user)
        out = FeeStudentDetailSerializer(fs, context={'request': request})
        return format_success_response(
            message="Fee structure updated successfully.",
            data=out.data,
        )


@extend_schema(tags=["Fee Management"])
class InstallmentListCreateView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(summary="List installments for a fee structure", responses={200: None})
    def get(self, request, fee_structure_id):
        fs = _get_fee_structure_or_error(fee_structure_id)
        from apps.fees.serializers import InstallmentSerializer
        data = InstallmentSerializer(
            fs.installments.order_by('installment_number'), many=True
        ).data
        return format_success_response(message="Installments retrieved.", data=data)

    @extend_schema(summary="Add an installment to a fee structure", responses={201: None})
    def post(self, request, fee_structure_id):
        fs = _get_fee_structure_or_error(fee_structure_id)
        serializer = InstallmentCreateSerializer(
            data=request.data, context={'fee_structure': fs}
        )
        if not serializer.is_valid():
            return handle_serializer_errors(serializer)
        inst = serializer.save(fee_structure=fs)
        from apps.fees.serializers import InstallmentSerializer
        return format_success_response(
            message="Installment created successfully.",
            data=InstallmentSerializer(inst).data,
            status_code=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Fee Management"])
class InstallmentDetailView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    def _get_installment(self, fee_structure_id, installment_id):
        try:
            return Installment.objects.get(
                pk=installment_id, fee_structure_id=fee_structure_id
            )
        except Installment.DoesNotExist:
            raise ServiceError("Installment not found.", status.HTTP_404_NOT_FOUND)

    @extend_schema(summary="Update an installment", responses={200: None})
    def patch(self, request, fee_structure_id, installment_id):
        inst = self._get_installment(fee_structure_id, installment_id)
        serializer = InstallmentUpdateSerializer(inst, data=request.data, partial=True)
        if not serializer.is_valid():
            return handle_serializer_errors(serializer)
        updated = serializer.save()
        from apps.fees.serializers import InstallmentSerializer
        return format_success_response(
            message="Installment updated successfully.",
            data=InstallmentSerializer(updated).data,
        )

    @extend_schema(summary="Delete an installment", responses={200: None})
    def delete(self, request, fee_structure_id, installment_id):
        inst = self._get_installment(fee_structure_id, installment_id)
        inst.delete()
        return format_success_response(message="Installment deleted successfully.", data=None)


@extend_schema(tags=["Fee Management"])
class PaymentListView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(
        summary="List all payments with filters",
        parameters=[
            OpenApiParameter("batch_id",    OpenApiTypes.INT),
            OpenApiParameter("course_id",   OpenApiTypes.INT),
            OpenApiParameter("search",      OpenApiTypes.STR, description="Student name/email"),
            OpenApiParameter("method",      OpenApiTypes.STR),
            OpenApiParameter("status",      OpenApiTypes.STR),
            OpenApiParameter("date_from",   OpenApiTypes.DATE),
            OpenApiParameter("date_to",     OpenApiTypes.DATE),
            OpenApiParameter("page",        OpenApiTypes.INT),
            OpenApiParameter("page_size",   OpenApiTypes.INT),
        ],
        responses={200: None},
    )
    def get(self, request):
        batch_id  = request.query_params.get('batch_id')
        course_id = request.query_params.get('course_id')
        search    = request.query_params.get('search', '').strip()
        method    = request.query_params.get('method', '').strip()
        status_f  = request.query_params.get('status', '').strip()
        date_from = request.query_params.get('date_from', '').strip()
        date_to   = request.query_params.get('date_to', '').strip()

        qs = Payment.objects.select_related(
            'fee_structure__enrollment__student',
            'fee_structure__enrollment__batch__course',
        ).order_by('-payment_date', '-created_at')

        if batch_id:
            qs = qs.filter(fee_structure__enrollment__batch_id=batch_id)
        if course_id:
            qs = qs.filter(fee_structure__enrollment__batch__course_id=course_id)
        if method:
            qs = qs.filter(method=method)
        if status_f:
            qs = qs.filter(status=status_f)
        if date_from:
            qs = qs.filter(payment_date__gte=date_from)
        if date_to:
            qs = qs.filter(payment_date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(fee_structure__enrollment__student__first_name__icontains=search) |
                Q(fee_structure__enrollment__student__last_name__icontains=search) |
                Q(fee_structure__enrollment__student__email__icontains=search)
            )

        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = max(1, min(100, int(request.query_params.get('page_size', 10))))
        except (ValueError, TypeError):
            page, page_size = 1, 10

        total_count = qs.count()
        total_pages = max(1, -(-total_count // page_size))
        paged = qs[(page - 1) * page_size: page * page_size]

        serializer = PaymentSerializer(paged, many=True, context={'request': request})
        return format_success_response(
            message="Payments retrieved successfully.",
            data=serializer.data,
            extra_params={
                'total_count':  total_count,
                'total_pages':  total_pages,
                'current_page': page,
            },
        )


@extend_schema(tags=["Fee Management"])
class AddPaymentView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(summary="Record a payment for a student", responses={201: None})
    def post(self, request, fee_structure_id):
        fs = _get_fee_structure_or_error(fee_structure_id)
        serializer = AddPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return handle_serializer_errors(serializer)

        vd = serializer.validated_data
        payment = Payment.objects.create(
            fee_structure    = fs,
            amount           = vd['amount'],
            payment_date     = vd['payment_date'],
            method           = vd['method'],
            reference_number = vd.get('reference_number', ''),
            status           = vd.get('status', Payment.Status.VERIFIED),
            notes            = vd.get('notes', ''),
            attachment       = vd.get('attachment'),
            recorded_by      = request.user,
        )

        out = PaymentSerializer(payment, context={'request': request})
        return format_success_response(
            message="Payment recorded successfully.",
            data=out.data,
            status_code=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Fee Management"])
class PendingFeesView(APIView):
    permission_classes = [IsSuperAdminOrAdmin]

    @extend_schema(
        summary="List all pending/overdue installments",
        parameters=[
            OpenApiParameter("batch_id",       OpenApiTypes.INT),
            OpenApiParameter("pending_status",  OpenApiTypes.STR, description="overdue|due_today|due_soon"),
            OpenApiParameter("due_date_from",   OpenApiTypes.DATE),
            OpenApiParameter("due_date_to",     OpenApiTypes.DATE),
        ],
        responses={200: None},
    )
    def get(self, request):
        batch_id       = request.query_params.get('batch_id')
        pending_status = request.query_params.get('pending_status', '').strip()
        due_date_from  = request.query_params.get('due_date_from', '').strip()
        due_date_to    = request.query_params.get('due_date_to', '').strip()

        today = timezone.now().date()

        qs = Installment.objects.filter(
            status=Installment.Status.PENDING
        ).select_related(
            'fee_structure__enrollment__student',
            'fee_structure__enrollment__batch__course',
        ).order_by('due_date')

        if batch_id:
            qs = qs.filter(fee_structure__enrollment__batch_id=batch_id)
        if due_date_from:
            qs = qs.filter(due_date__gte=due_date_from)
        if due_date_to:
            qs = qs.filter(due_date__lte=due_date_to)

        # Filter by pending_status (overdue/due_today/due_soon)
        if pending_status == 'overdue':
            qs = qs.filter(due_date__lt=today)
        elif pending_status == 'due_today':
            qs = qs.filter(due_date=today)
        elif pending_status == 'due_soon':
            qs = qs.filter(due_date__gt=today)

        serializer = PendingFeeSerializer(qs, many=True, context={'request': request})
        return format_success_response(
            message="Pending fees retrieved successfully.",
            data=serializer.data,
        )


@extend_schema(tags=["Fee Management"])
class MyFeesView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(
        summary="Get the logged-in student's own fee data",
        parameters=[
            OpenApiParameter("batch_id", OpenApiTypes.INT, description="Filter by batch"),
        ],
        responses={200: None},
    )
    def get(self, request):
        batch_id = request.query_params.get('batch_id')

        qs = FeeStructure.objects.filter(
            enrollment__student=request.user,
            enrollment__status='active',
        ).select_related(
            'enrollment__student', 'enrollment__batch__course'
        ).prefetch_related('payments', 'installments')

        if batch_id:
            qs = qs.filter(enrollment__batch_id=batch_id)

        fs = qs.first()
        if not fs:
            return format_success_response(
                message="No fee data found.",
                data=None,
            )

        student_data  = FeeStudentDetailSerializer(fs, context={'request': request}).data
        payments_data = PaymentSerializer(
            fs.payments.order_by('-payment_date', '-created_at'),
            many=True,
            context={'request': request},
        ).data

        return format_success_response(
            message="Fee data retrieved successfully.",
            data={'fee_student': student_data, 'payments': payments_data},
        )
