"""
Week-based learning progress for batch enrollments.

A week counts as **fully complete** when:
  - Every class session in that week has a completed StudentSessionView for the enrollment.
  - If the week has a weekly test, the student has a published, passed TestSubmission.

`weeks_completed` is the number of **consecutive** fully-complete weeks starting from week 1
(stops at the first incomplete week), matching linear course gating.

`overall_progress` is (weeks_completed / total_weeks) * 100.
"""

from __future__ import annotations

from apps.courses.models import (
    BatchClassSession,
    BatchEnrollment,
    BatchWeek,
    BatchWeeklyTest,
    StudentSessionView,
    TestSubmission,
)


def week_fully_complete(enrollment: BatchEnrollment, week: BatchWeek) -> bool:
    """True if all sessions in `week` are done and weekly test (if any) is passed."""
    total_sessions = BatchClassSession.objects.filter(batch_week=week).count()
    if total_sessions > 0:
        completed_sessions = StudentSessionView.objects.filter(
            enrollment=enrollment,
            batch_session__batch_week=week,
            is_completed=True,
        ).count()
        if completed_sessions < total_sessions:
            return False

    weekly_test = BatchWeeklyTest.objects.filter(batch_week=week).first()
    if weekly_test:
        passed = TestSubmission.objects.filter(
            enrollment=enrollment,
            batch_weekly_test=weekly_test,
            status=TestSubmission.Status.PUBLISHED,
            is_passed=True,
        ).exists()
        if not passed:
            return False

    return True


def count_consecutive_completed_weeks(enrollment: BatchEnrollment) -> int:
    """How many weeks are fully complete in order from week 1 until the first gap."""
    weeks = BatchWeek.objects.filter(batch=enrollment.batch).order_by("week_number")
    completed = 0
    for week in weeks:
        if week_fully_complete(enrollment, week):
            completed += 1
        else:
            break
    return completed


def week_based_progress_percent(enrollment: BatchEnrollment) -> int:
    """Integer 0–100: consecutive completed weeks / total batch weeks."""
    total = BatchWeek.objects.filter(batch=enrollment.batch).count()
    if total == 0:
        return 0
    done = count_consecutive_completed_weeks(enrollment)
    return min(100, round((done / total) * 100))


def week_based_progress_percent_float(enrollment: BatchEnrollment) -> float:
    """Same as week_based_progress_percent but one decimal for batch list cards."""
    total = BatchWeek.objects.filter(batch=enrollment.batch).count()
    if total == 0:
        return 0.0
    done = count_consecutive_completed_weeks(enrollment)
    return min(100.0, round((done / total) * 100, 1))


def average_week_based_progress_percent(enrollments) -> float:
    """Mean of week-based progress across enrollments (for teacher/admin batch cards)."""
    enrollments = list(enrollments)
    if not enrollments:
        return 0.0
    return round(
        sum(week_based_progress_percent_float(e) for e in enrollments) / len(enrollments),
        1,
    )
