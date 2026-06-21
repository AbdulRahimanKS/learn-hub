// Attendance data is derived from video completion tracking (StudentSessionView).
// No separate backend attendance model exists; these helpers transform existing
// batchApi.getBatchStudents() responses into attendance-shaped records.

export const ATTENDANCE_THRESHOLD = 75; // percent; students below this are flagged

export type AttendanceStatus = 'excellent' | 'good' | 'warning' | 'critical';

export function getAttendanceStatus(pct: number): AttendanceStatus {
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'good';
  if (pct >= 50) return 'warning';
  return 'critical';
}

export const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; badgeClass: string; dotColor: string; chartColor: string }
> = {
  excellent: {
    label: 'Excellent',
    badgeClass: 'bg-success/10 text-success border-success/30',
    dotColor: 'bg-success',
    chartColor: '#10b981',
  },
  good: {
    label: 'Good',
    badgeClass: 'bg-primary/10 text-primary border-primary/30',
    dotColor: 'bg-primary',
    chartColor: '#3b82f6',
  },
  warning: {
    label: 'Warning',
    badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    dotColor: 'bg-orange-500',
    chartColor: '#f97316',
  },
  critical: {
    label: 'Critical',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',
    dotColor: 'bg-destructive',
    chartColor: '#ef4444',
  },
};

export interface WeekAttendanceDetail {
  weekNumber: number;
  title: string;
  totalVideos: number;
  completedVideos: number;
  attendancePercent: number;
  hasTest: boolean;
  testAttempted: boolean;
  testPassed: boolean;
  testScore: number | null;
}

export interface StudentAttendanceRecord {
  enrollmentId: number;
  studentName: string;
  studentEmail: string;
  profilePicture: string | null;
  enrollmentStatus: string;
  totalVideos: number;
  completedVideos: number;
  attendancePercent: number;
  attendanceStatus: AttendanceStatus;
  weekDetails: WeekAttendanceDetail[];
  enrolledAt: string;
  overallProgress: number;
}

export function toStudentAttendanceRecord(enrollment: any): StudentAttendanceRecord {
  const totalVideos = enrollment.total_videos ?? 0;
  const completedVideos = enrollment.videos_watched ?? 0;
  const pct = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

  const weekDetails: WeekAttendanceDetail[] = (enrollment.week_details ?? []).map((w: any) => {
    const wTotal = w.total_videos ?? 0;
    const wCompleted = w.videos_watched ?? 0;
    const wPct = wTotal > 0 ? Math.round((wCompleted / wTotal) * 100) : 0;
    return {
      weekNumber: w.week_number,
      title: w.title ?? `Week ${w.week_number}`,
      totalVideos: wTotal,
      completedVideos: wCompleted,
      attendancePercent: wPct,
      hasTest: !!(w.test?.exists ?? w.test?.attempted !== undefined),
      testAttempted: !!w.test?.attempted,
      testPassed: !!w.test?.is_passed,
      testScore: w.test?.score ?? null,
    };
  });

  return {
    enrollmentId: enrollment.id,
    studentName: enrollment.student_name ?? '',
    studentEmail: enrollment.student_email ?? '',
    profilePicture: enrollment.profile_picture ?? null,
    enrollmentStatus: enrollment.status ?? 'active',
    totalVideos,
    completedVideos,
    attendancePercent: pct,
    attendanceStatus: getAttendanceStatus(pct),
    weekDetails,
    enrolledAt: enrollment.enrolled_at ?? '',
    overallProgress: enrollment.overall_progress ?? 0,
  };
}

export interface AttendanceSummaryStats {
  totalStudents: number;
  avgAttendancePercent: number;
  belowThreshold: number;
  bestStudentName: string;
  bestStudentPercent: number;
}

export function computeAttendanceSummary(records: StudentAttendanceRecord[]): AttendanceSummaryStats {
  const active = records.filter((r) => r.enrollmentStatus !== 'dropped');
  if (active.length === 0) {
    return { totalStudents: 0, avgAttendancePercent: 0, belowThreshold: 0, bestStudentName: '—', bestStudentPercent: 0 };
  }
  const sum = active.reduce((acc, r) => acc + r.attendancePercent, 0);
  const avg = Math.round(sum / active.length);
  const below = active.filter((r) => r.attendancePercent < ATTENDANCE_THRESHOLD).length;
  const best = active.reduce((a, b) => (a.attendancePercent >= b.attendancePercent ? a : b));

  return {
    totalStudents: active.length,
    avgAttendancePercent: avg,
    belowThreshold: below,
    bestStudentName: best.studentName,
    bestStudentPercent: best.attendancePercent,
  };
}

export interface WeeklyTrendPoint {
  weekLabel: string;
  attendancePercent: number;
}

export function computeWeeklyTrend(records: StudentAttendanceRecord[]): WeeklyTrendPoint[] {
  const active = records.filter((r) => r.enrollmentStatus !== 'dropped');
  if (active.length === 0) return [];

  const weekMap = new Map<number, { sum: number; count: number; title: string }>();
  for (const record of active) {
    for (const w of record.weekDetails) {
      if (w.totalVideos === 0) continue;
      const existing = weekMap.get(w.weekNumber);
      if (existing) {
        existing.sum += w.attendancePercent;
        existing.count += 1;
      } else {
        weekMap.set(w.weekNumber, { sum: w.attendancePercent, count: 1, title: w.title });
      }
    }
  }

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNum, { sum, count, title }]) => ({
      weekLabel: title || `Week ${weekNum}`,
      attendancePercent: Math.round(sum / count),
    }));
}

export interface DistributionPoint {
  name: string;
  value: number;
  color: string;
}

export function computeAttendanceDistribution(records: StudentAttendanceRecord[]): DistributionPoint[] {
  const active = records.filter((r) => r.enrollmentStatus !== 'dropped');
  const counts: Record<AttendanceStatus, number> = {
    excellent: 0,
    good: 0,
    warning: 0,
    critical: 0,
  };
  for (const r of active) counts[r.attendanceStatus]++;
  return (['excellent', 'good', 'warning', 'critical'] as AttendanceStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => ({
      name: ATTENDANCE_STATUS_CONFIG[s].label,
      value: counts[s],
      color: ATTENDANCE_STATUS_CONFIG[s].chartColor,
    }));
}
