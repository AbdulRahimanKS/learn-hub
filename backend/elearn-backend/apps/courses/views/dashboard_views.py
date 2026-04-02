import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Count, Q
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework import status
from utils.progress_utils import average_week_based_progress_percent

from apps.courses.models import (
    Batch,
    BatchEnrollment,
    Course,
    LiveSession,
    TestSubmission,
    BatchWeek,
    BatchChatMessage,
)
from utils.permissions import IsSuperAdminAdminOrTeacher
from utils.common import format_success_response, ServiceError
from utils.constants import UserTypeConstants

from drf_spectacular.utils import extend_schema, inline_serializer

logger = logging.getLogger(__name__)


@extend_schema(tags=["Dashboard"])
class AdminDashboardView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]

    @extend_schema(
        summary="Admin/teacher dashboard",
        responses={
            200: inline_serializer(
                name="AdminDashboardResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": serializers.JSONField(
                        help_text="summary_stats, batch_overview, pending_actions, student_performance, upcoming_events, recent_messages"
                    ),
                },
            )
        },
    )
    def get(self, request):
        try:
            user = request.user
            is_teacher = (
                getattr(user, "user_type", None)
                and user.user_type.name == UserTypeConstants.TEACHER
            )

            if is_teacher:
                batch_qs = Batch.objects.filter(
                    Q(teacher=user) | Q(co_teachers=user)
                ).distinct()
            else:
                batch_qs = Batch.objects.all()

            batch_ids = list(batch_qs.values_list("id", flat=True))

            total_students = (
                BatchEnrollment.objects
                .filter(batch_id__in=batch_ids, status=BatchEnrollment.Status.ACTIVE)
                .values("student")
                .distinct()
                .count()
            )
            completed_students = (
                BatchEnrollment.objects
                .filter(batch_id__in=batch_ids, status=BatchEnrollment.Status.COMPLETED)
                .values("student")
                .distinct()
                .count()
            )
            
            total_batches = batch_qs.count()
            if is_teacher:
                course_ids = (
                    batch_qs.exclude(course_id__isnull=True)
                    .values_list("course_id", flat=True)
                    .distinct()
                )
                active_courses = Course.objects.filter(
                    is_active=True, id__in=course_ids
                ).count()
            else:
                active_courses = Course.objects.filter(is_active=True).count()

            now = timezone.now()

            pending_evaluations = TestSubmission.objects.filter(
                enrollment__batch_id__in=batch_ids,
                status__in=[
                    TestSubmission.Status.PENDING,
                    TestSubmission.Status.EVALUATING,
                    TestSubmission.Status.PENDING_REVIEW,
                ],
            ).count()

            summary_stats = {
                "total_students": total_students,
                "completed_students": completed_students,
                "total_batches": total_batches,
                "active_courses": active_courses,
                "pending_evaluations": pending_evaluations,
            }

            batches = (
                batch_qs
                .select_related("course")
                .filter(status=Batch.Status.ACTIVE)
                .order_by("-created_at")[:10]
            )

            batch_overview = []
            for b in batches:
                student_count = BatchEnrollment.objects.filter(batch=b).count()

                relevant_enrollments = list(
                    BatchEnrollment.objects.filter(
                        batch=b,
                        status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED],
                    )
                )
                progress_pct = average_week_based_progress_percent(relevant_enrollments) if relevant_enrollments else 0.0

                batch_overview.append({
                    "id": b.id,
                    "name": b.name,
                    "course_name": b.course.title if b.course else None,
                    "student_count": student_count,
                    "progress_pct": round(progress_pct),
                    "status": b.status,
                })

            performance = []
            active_batches_with_data = (
                batch_qs
                .filter(status=Batch.Status.ACTIVE)
                .annotate(
                    published_count=Count(
                        'enrollments__test_submissions', 
                        filter=Q(enrollments__test_submissions__status=TestSubmission.Status.PUBLISHED)
                    )
                )
                .filter(published_count__gt=0)
                .order_by("-created_at")[:10]
            )

            for b in active_batches_with_data:
                agg = (
                    TestSubmission.objects
                    .filter(
                        enrollment__batch=b,
                        status=TestSubmission.Status.PUBLISHED,
                    )
                    .aggregate(
                        avg_marks=Avg("marks_obtained"),
                        total=Count("id"),
                        passed=Count("id", filter=Q(is_passed=True)),
                    )
                )
                avg = round(agg["avg_marks"] or 0, 1)
                total = agg["total"] or 0
                passed = agg["passed"] or 0
                pass_pct = round((passed / total * 100) if total > 0 else 0, 1)

                performance.append({
                    "batch_id": b.id,
                    "batch_name": b.name,
                    "avg_marks": avg,
                    "pass_percent": pass_pct,
                    "total_submissions": total,
                })

            upcoming_sessions = (
                LiveSession.objects
                .filter(
                    batch_id__in=batch_ids,
                    scheduled_at__gte=now,
                    scheduled_at__lte=now + timedelta(days=14),
                )
                .select_related("batch")
                .order_by("scheduled_at")[:10]
            )

            upcoming_events = [
                {
                    "id": ls.id,
                    "type": "live_session",
                    "title": ls.title,
                    "batch_name": ls.batch.name if ls.batch else "",
                    "batch_id": ls.batch.id if ls.batch else None,
                    "scheduled_at": ls.scheduled_at.isoformat(),
                    "duration_mins": ls.duration_mins,
                    "meeting_room": ls.meeting_room,
                }
                for ls in upcoming_sessions
            ]

            return format_success_response(
                message="Dashboard data retrieved successfully",
                data={
                    "summary_stats": summary_stats,
                    "batch_overview": batch_overview,
                    "student_performance": performance,
                    "upcoming_events": upcoming_events,
                },
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Dashboard error: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
