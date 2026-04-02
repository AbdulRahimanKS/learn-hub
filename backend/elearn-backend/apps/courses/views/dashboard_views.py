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
                student_count = BatchEnrollment.objects.filter(
                    batch=b, status=BatchEnrollment.Status.ACTIVE
                ).count()

                # Current week = number of weeks since start_date
                current_week = 1
                if b.start_date:
                    delta = (timezone.now().date() - b.start_date).days
                    current_week = max(1, (delta // 7) + 1)

                # Total weeks in batch
                total_weeks = b.batch_weeks.count()

                # Progress: use the same helper as the batch list serializer
                relevant_enrollments = list(
                    BatchEnrollment.objects.filter(
                        batch=b,
                        status__in=[BatchEnrollment.Status.ACTIVE, BatchEnrollment.Status.COMPLETED],
                    )
                )
                progress_pct = average_week_based_progress_percent(relevant_enrollments) if relevant_enrollments else 0.0

                # Next unlock date (next BatchWeek not yet unlocked)
                next_week = (
                    BatchWeek.objects
                    .filter(batch=b, unlock_date__gt=now)
                    .order_by("unlock_date")
                    .first()
                )
                next_unlock = next_week.unlock_date.isoformat() if next_week else None

                batch_overview.append({
                    "id": b.id,
                    "name": b.name,
                    "course_name": b.course.title if b.course else None,
                    "student_count": student_count,
                    "current_week": current_week,
                    "total_weeks": total_weeks,
                    "progress_pct": round(progress_pct),
                    "next_unlock_date": next_unlock,
                    "status": b.status,
                })

            # ── C. Pending Actions ────────────────────────────────────────
            pending_tests = (
                TestSubmission.objects
                .filter(
                    enrollment__batch_id__in=batch_ids,
                    status=TestSubmission.Status.PENDING,
                )
                .select_related(
                    "enrollment__student",
                    "batch_weekly_test__batch_week__batch",
                )
                .order_by("-submitted_at")[:5]
            )

            pending_review = (
                TestSubmission.objects
                .filter(
                    enrollment__batch_id__in=batch_ids,
                    status=TestSubmission.Status.PENDING_REVIEW,
                )
                .select_related(
                    "enrollment__student",
                    "batch_weekly_test__batch_week__batch",
                )
                .order_by("-submitted_at")[:5]
            )

            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = today_start + timedelta(days=1)
            live_today = (
                LiveSession.objects
                .filter(
                    batch_id__in=batch_ids,
                    scheduled_at__gte=today_start,
                    scheduled_at__lt=today_end,
                )
                .select_related("batch")
                .order_by("scheduled_at")[:5]
            )

            def _sub_brief(s):
                bwt = s.batch_weekly_test
                bw = bwt.batch_week if bwt else None
                return {
                    "submission_id": s.id,
                    "student_name": s.enrollment.student.fullname,
                    "batch_name": bw.batch.name if bw else "",
                    "batch_id": bw.batch.id if bw else None,
                    "week_number": bw.week_number if bw else None,
                    "submitted_at": s.submitted_at.isoformat(),
                    "status": s.status,
                }

            pending_actions = {
                "pending_tests": [_sub_brief(s) for s in pending_tests],
                "pending_review": [_sub_brief(s) for s in pending_review],
                "live_today": [
                    {
                        "id": ls.id,
                        "title": ls.title,
                        "batch_name": ls.batch.name if ls.batch else "",
                        "batch_id": ls.batch.id if ls.batch else None,
                        "scheduled_at": ls.scheduled_at.isoformat(),
                        "meeting_room": ls.meeting_room,
                    }
                    for ls in live_today
                ],
            }

            # ── D. Student Performance Overview ──────────────────────────
            performance = []
            for b in batch_qs.filter(status=Batch.Status.ACTIVE)[:8]:
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

            # ── E. Upcoming Events (next 14 days) ─────────────────────────
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

            # ── G. Recent Chat Messages ────────────────────────────────────
            recent_chats = (
                BatchChatMessage.objects
                .filter(batch_id__in=batch_ids)
                .select_related("sender", "batch")
                .order_by("-sent_at")[:10]
            )

            recent_messages = [
                {
                    "id": m.id,
                    "batch_id": m.batch_id,
                    "batch_name": m.batch.name,
                    "sender_name": m.sender.fullname if m.sender else "Unknown",
                    "message": (m.message[:100] + "…") if len(m.message) > 100 else m.message,
                    "sent_at": m.sent_at.isoformat(),
                }
                for m in recent_chats
            ]

            return format_success_response(
                message="Dashboard data retrieved successfully",
                data={
                    "summary_stats": summary_stats,
                    "batch_overview": batch_overview,
                    "pending_actions": pending_actions,
                    "student_performance": performance,
                    "upcoming_events": upcoming_events,
                    "recent_messages": recent_messages,
                },
            )

        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Dashboard error: {e}")
            raise ServiceError(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
