"""
Week-based learning progress for batch enrollments.

**Deliverable week** — has at least one class session and/or a weekly test. Empty week rows
(placeholder shells) are ignored: they do not count toward the total, and they do not break
the consecutive-completion chain.

A deliverable week is **fully complete** when:
  - Every class session has a completed StudentSessionView for the enrollment.
  - If there is a weekly test, the student has a published, passed TestSubmission.

**Consecutive completion** — walk batch weeks in `week_number` order. Skip weeks with no
deliverables. Among deliverable weeks, count how many are fully complete in a row from the
start of that walk; stop at the first deliverable week that is not fully complete (linear
gating). Unlock / manual unlock only affects access, not this math.

**Progress %** = (consecutive complete deliverable weeks) / (total deliverable weeks) * 100.
If there are no deliverable weeks, progress is 0.
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
    """True if the week has deliverables and all sessions (if any) + test (if any) are done."""
    total_sessions = BatchClassSession.objects.filter(batch_week=week).count()
    weekly_test = BatchWeeklyTest.objects.filter(batch_week=week).first()

    if total_sessions == 0 and weekly_test is None:
        return False

    if total_sessions > 0:
        completed_sessions = StudentSessionView.objects.filter(
            enrollment=enrollment,
            batch_session__batch_week=week,
            is_completed=True,
        ).count()
        if completed_sessions < total_sessions:
            return False

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


def week_has_deliverables(week: BatchWeek) -> bool:
    """True if the week has something a student can complete (sessions and/or weekly test)."""
    if BatchClassSession.objects.filter(batch_week=week).exists():
        return True
    return BatchWeeklyTest.objects.filter(batch_week=week).exists()


def count_deliverable_weeks(batch) -> int:
    """Number of batch weeks that have at least one session or a weekly test."""
    n = 0
    for week in BatchWeek.objects.filter(batch=batch).order_by("week_number"):
        if week_has_deliverables(week):
            n += 1
    return n


def count_consecutive_completed_weeks(enrollment: BatchEnrollment) -> int:
    """
    Consecutive fully-complete *deliverable* weeks in week_number order.
    Empty placeholder weeks are skipped (they neither add to the count nor break the chain).
    Stops at the first deliverable week that is not fully complete.
    """
    weeks = BatchWeek.objects.filter(batch=enrollment.batch).order_by("week_number")
    completed = 0
    for week in weeks:
        if not week_has_deliverables(week):
            continue
        if week_fully_complete(enrollment, week):
            completed += 1
        else:
            break
    return completed


def week_based_progress_percent(enrollment: BatchEnrollment) -> int:
    """Integer 0–100: consecutive complete deliverable weeks / total deliverable weeks."""
    total = count_deliverable_weeks(enrollment.batch)
    if total == 0:
        return 0
    done = count_consecutive_completed_weeks(enrollment)
    return min(100, round((done / total) * 100))


def week_based_progress_percent_float(enrollment: BatchEnrollment) -> float:
    """Same as week_based_progress_percent but one decimal for batch list cards."""
    total = count_deliverable_weeks(enrollment.batch)
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
