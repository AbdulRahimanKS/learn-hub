import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework import status
from utils.progress_utils import (
    average_week_based_progress_percent,
    week_fully_complete,
    week_has_deliverables,
    week_based_progress_percent,
    count_consecutive_completed_weeks,
    count_deliverable_weeks,
)

from apps.courses.models import (
    Batch,
    BatchEnrollment,
    BatchClassSession,
    Course,
    LiveSession,
    ScheduledWebinar,
    StudentSessionView,
    TestSubmission,
    BatchWeek,
    BatchWeeklyTest,
)
from utils.permissions import IsSuperAdminAdminOrTeacher, IsStudent
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
                subs = list(
                    TestSubmission.objects.filter(
                        enrollment__batch=b,
                        status=TestSubmission.Status.PUBLISHED,
                    )
                    .select_related("batch_weekly_test")
                    .prefetch_related("batch_weekly_test__questions")
                )
                total = len(subs)
                passed_n = sum(1 for s in subs if s.is_passed)
                score_percents = []
                for sub in subs:
                    if sub.marks_obtained is None:
                        continue
                    p = _submission_score_as_percent(sub)
                    if p is not None:
                        score_percents.append(p)
                avg = (
                    round(sum(score_percents) / len(score_percents), 1)
                    if score_percents
                    else 0.0
                )
                pass_pct = round((passed_n / total * 100) if total > 0 else 0, 1)

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


def _fmt_duration(seconds):
    if not seconds or seconds <= 0:
        return "—"
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _submission_score_as_percent(submission):
    """
    Map one published submission to a 0–100 score for averaging.

    Two conventions exist in the codebase:
    - **AI / per-question sum:** `marks_obtained` is raw points; pass uses
      (obtained / sum(question.marks)) * 100 vs `batch_weekly_test.pass_percentage`.
    - **Instructor overall grade:** `TestSubmissionUpdateSerializer` compares
      `marks_obtained` directly to `pass_percentage`, so teachers typically enter
      an overall **percentage** (0–100), not raw points.

    If `marks_obtained` fits the raw scale (≤ max points, with tolerance), convert
    with (obt / total) * 100. Otherwise treat the value as already a percentage.

    `is_passed` / pass bar does not change the number we average: a failed test
    still contributes its actual score %; only published results are included.
    """
    obt = float(submission.marks_obtained)
    test = submission.batch_weekly_test
    if not test:
        return None
    total_possible = sum(float(q.marks) for q in test.questions.all())
    if total_possible > 0:
        if obt <= total_possible * 1.02 + 1e-9:
            return min(100.0, max(0.0, (obt / total_possible) * 100.0))
        return min(100.0, max(0.0, obt))
    return min(100.0, max(0.0, obt))


def _average_published_percent_per_test(enrollment_ids):
    """Mean of per-test scores in 0–100 (each published submission counts once)."""
    if not enrollment_ids:
        return None
    subs = (
        TestSubmission.objects.filter(
            enrollment_id__in=enrollment_ids,
            status=TestSubmission.Status.PUBLISHED,
            marks_obtained__isnull=False,
        )
        .select_related("batch_weekly_test")
        .prefetch_related("batch_weekly_test__questions")
    )
    percents = []
    for sub in subs:
        p = _submission_score_as_percent(sub)
        if p is not None:
            percents.append(p)
    if not percents:
        return None
    return round(min(100.0, max(0.0, sum(percents) / len(percents))))


def _active_student_enrollments_qs(user):
    return (
        BatchEnrollment.objects.filter(
            student=user,
            status=BatchEnrollment.Status.ACTIVE
        )
        .select_related("batch", "batch__course")
    )


def _pick_focus_week(enrollment):
    weeks = list(BatchWeek.objects.filter(batch=enrollment.batch).order_by("week_number"))
    last_deliverable = None
    for w in weeks:
        if not week_has_deliverables(w):
            continue
        last_deliverable = w
        if not week_fully_complete(enrollment, w):
            return w
    if last_deliverable:
        return last_deliverable
    for w in weeks:
        if BatchClassSession.objects.filter(batch_week=w).exists():
            return w
    return weeks[0] if weeks else None


def _pick_focus_enrollment_and_week(user):
    enrollments = list(_active_student_enrollments_qs(user).order_by("-batch__start_date"))
    for e in enrollments:
        w = _pick_focus_week(e)
        if w is not None:
            return e, w
    return None, None


@extend_schema(tags=["Dashboard"])
class StudentDashboardView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(
        summary="Student dashboard",
        responses={
            200: inline_serializer(
                name="StudentDashboardResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": serializers.JSONField(
                        help_text="active_batches, focus, stats, upcoming"
                    ),
                },
            )
        },
    )
    def get(self, request):
        try:
            user = request.user
            now = timezone.now()
            enrollments_qs = _active_student_enrollments_qs(user)
            active_batches = enrollments_qs.count()
            all_batch_ids = list(enrollments_qs.values_list("batch_id", flat=True))

            focus_enrollment, focus_week = _pick_focus_enrollment_and_week(user)
            focus_payload = None
            if focus_enrollment and focus_week:
                sessions = list(
                    BatchClassSession.objects.filter(batch_week=focus_week).order_by(
                        "session_number"
                    )
                )
                session_ids = [s.id for s in sessions]
                completed_ids = set(
                    StudentSessionView.objects.filter(
                        enrollment=focus_enrollment,
                        batch_session_id__in=session_ids,
                        is_completed=True,
                    ).values_list("batch_session_id", flat=True)
                )
                videos_total = len(sessions)
                videos_done = len(completed_ids)
                has_test = BatchWeeklyTest.objects.filter(batch_week=focus_week).exists()
                course = focus_enrollment.batch.course
                overall_progress = week_based_progress_percent(focus_enrollment)
                weeks_completed = count_consecutive_completed_weeks(focus_enrollment)
                total_weeks = count_deliverable_weeks(focus_enrollment.batch)

                weekly_progress = []
                for week in BatchWeek.objects.filter(batch=focus_enrollment.batch).order_by("week_number"):
                    total_vids = BatchClassSession.objects.filter(batch_week=week).count()
                    watched_vids = StudentSessionView.objects.filter(
                        enrollment=focus_enrollment,
                        batch_session__batch_week=week,
                        is_completed=True,
                    ).count()
                    weekly_test = BatchWeeklyTest.objects.filter(batch_week=week).first()
                    if weekly_test:
                        submission = (
                            TestSubmission.objects.filter(
                                enrollment=focus_enrollment,
                                batch_weekly_test=weekly_test,
                                status=TestSubmission.Status.PUBLISHED,
                            )
                            .order_by("-submitted_at")
                            .first()
                        )
                        test_attempted = submission is not None
                        test_passed = submission.is_passed if submission else False
                    else:
                        test_attempted = False
                        test_passed = False
                    weekly_progress.append(
                        {
                            "week_id": week.id,
                            "week_number": week.week_number,
                            "title": week.title,
                            "videos_watched": watched_vids,
                            "total_videos": total_vids,
                            "has_test": weekly_test is not None,
                            "test_attempted": test_attempted,
                            "test_passed": test_passed,
                            "is_passed": week_fully_complete(focus_enrollment, week),
                        }
                    )

                focus_payload = {
                    "enrollment_id": focus_enrollment.id,
                    "batch_id": focus_enrollment.batch_id,
                    "batch_name": focus_enrollment.batch.name,
                    "course_id": course.id if course else None,
                    "course_title": course.title if course else None,
                    "week_id": focus_week.id,
                    "week_number": focus_week.week_number,
                    "week_title": focus_week.title or None,
                    "week_progress_pct": overall_progress,
                    "videos_completed": videos_done,
                    "videos_total": videos_total,
                    "has_weekly_test": has_test,
                    "weeks_completed": weeks_completed,
                    "total_weeks": total_weeks,
                    "sessions": [
                        {
                            "id": s.id,
                            "title": s.title,
                            "duration_label": _fmt_duration(s.duration_seconds),
                            "completed": s.id in completed_ids,
                        }
                        for s in sessions
                    ],
                    "weekly_progress": weekly_progress,
                }

            # Hero "focus" is one batch/week; stats + upcoming match that batch when we have
            # a focus enrollment so the dashboard is consistent. If there is no focus row
            # (e.g. no weeks yet), fall back to all active enrollments / batches.
            if focus_enrollment:
                stats_enrollment_ids = [focus_enrollment.id]
                upcoming_batch_ids = [focus_enrollment.batch_id]
            else:
                stats_enrollment_ids = list(enrollments_qs.values_list("id", flat=True))
                upcoming_batch_ids = all_batch_ids

            if active_batches == 0:
                stats = {
                    "avg_score_pct": None,
                    "sessions_completed": 0,
                    "graded_tests": 0,
                }
            else:
                stats = {
                    "avg_score_pct": _average_published_percent_per_test(
                        stats_enrollment_ids
                    ),
                    "sessions_completed": StudentSessionView.objects.filter(
                        enrollment_id__in=stats_enrollment_ids,
                        is_completed=True,
                    ).count(),
                    "graded_tests": TestSubmission.objects.filter(
                        enrollment_id__in=stats_enrollment_ids,
                        status=TestSubmission.Status.PUBLISHED,
                    ).count(),
                }

            window_end = now + timedelta(days=14)
            upcoming = []

            if upcoming_batch_ids:
                for ls in (
                    LiveSession.objects.filter(
                        batch_id__in=upcoming_batch_ids,
                        scheduled_at__gte=now,
                        scheduled_at__lte=window_end,
                    )
                    .select_related("batch", "batch__course")
                    .order_by("scheduled_at")[:8]
                ):
                    b = ls.batch
                    upcoming.append(
                        {
                            "id": f"live-{ls.id}",
                            "type": "live_session",
                            "title": ls.title,
                            "subtitle": b.name if b else "",
                            "scheduled_at": ls.scheduled_at.isoformat(),
                            "batch_id": b.id if b else None,
                            "course_id": b.course_id if b else None,
                        }
                    )

                for wb in (
                    ScheduledWebinar.objects.filter(
                        batch_id__in=upcoming_batch_ids,
                        unlock_at__gte=now,
                        unlock_at__lte=window_end,
                    )
                    .select_related("batch", "batch__course")
                    .order_by("unlock_at")[:8]
                ):
                    b = wb.batch
                    upcoming.append(
                        {
                            "id": f"webinar-{wb.id}",
                            "type": "webinar",
                            "title": wb.title,
                            "subtitle": b.name if b else "",
                            "scheduled_at": wb.unlock_at.isoformat(),
                            "batch_id": b.id if b else None,
                            "course_id": b.course_id if b else None,
                        }
                    )

            upcoming.sort(key=lambda x: x["scheduled_at"])
            upcoming = upcoming[:12]

            return format_success_response(
                message="Student dashboard data retrieved successfully",
                data={
                    "active_batches": active_batches,
                    "focus": focus_payload,
                    "stats": stats,
                    "upcoming": upcoming,
                },
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Student dashboard error: {e}")
            raise ServiceError(
                detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
