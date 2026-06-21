import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { batchContentApi, type BatchWeek } from '@/lib/batch-api';
import {
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_THRESHOLD,
  type StudentAttendanceRecord,
  type WeekAttendanceDetail,
  getAttendanceStatus,
} from '@/lib/attendance-api';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Video,
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  CalendarDays,
  Mail,
  FileText,
  PlayCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatTestScorePercent } from '@/lib/format-test-score';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="tabular-nums text-primary">
        Attendance: <span className="font-bold">{payload[0].value}%</span>
      </p>
    </div>
  );
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

interface MiniStatProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
}

function MiniStat({ icon: Icon, iconColor, iconBg, label, value }: MiniStatProps) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl shrink-0', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Week card ────────────────────────────────────────────────────────────────

interface WeekCardProps {
  week: WeekAttendanceDetail;
  batchWeek?: BatchWeek;
}

function WeekCard({ week, batchWeek }: WeekCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sessions = batchWeek?.class_sessions ?? [];
  const isPassed = week.attendancePercent >= ATTENDANCE_THRESHOLD && week.testAttempted
    ? week.testPassed
    : week.attendancePercent >= ATTENDANCE_THRESHOLD;

  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-sm transition-all', expanded && 'shadow-md')}>
      {/* Week header */}
      <button
        type="button"
        onClick={() => sessions.length > 0 && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 p-4 text-left',
          sessions.length > 0 && 'cursor-pointer hover:bg-muted/40 rounded-xl transition-colors',
        )}
      >
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black',
            isPassed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary',
          )}
        >
          {isPassed ? <CheckCircle className="h-5 w-5" /> : <span>{week.weekNumber}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-sm text-foreground">Week {week.weekNumber}: {week.title}</p>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] h-5 py-0 px-2 font-bold shrink-0',
                ATTENDANCE_STATUS_CONFIG[getAttendanceStatus(week.attendancePercent)].badgeClass,
              )}
            >
              {ATTENDANCE_STATUS_CONFIG[getAttendanceStatus(week.attendancePercent)].label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  week.attendancePercent >= 90
                    ? 'bg-success'
                    : week.attendancePercent >= 75
                    ? 'bg-primary'
                    : week.attendancePercent >= 50
                    ? 'bg-orange-500'
                    : 'bg-destructive',
                )}
                style={{ width: `${Math.min(100, week.attendancePercent)}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {week.attendancePercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              ({week.completedVideos}/{week.totalVideos} videos)
            </span>
          </div>
        </div>

        {/* Test badge */}
        {week.hasTest && (
          <div className="shrink-0 text-right">
            {!week.testAttempted ? (
              <span className="text-xs text-muted-foreground">Test: Not attempted</span>
            ) : (
              <span
                className={cn(
                  'text-xs font-bold',
                  week.testPassed ? 'text-success' : 'text-destructive',
                )}
              >
                Test: {week.testScore !== null ? `${formatTestScorePercent(week.testScore)}%` : '—'}{' '}
                {week.testPassed ? '✓' : '✗'}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Session list (expanded) */}
      {expanded && sessions.length > 0 && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Sessions
          </p>
          {sessions.map((session: any, i: number) => (
            <div
              key={session.id ?? i}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/40"
            >
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <PlayCircle className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {session.title || `Session ${i + 1}`}
                </p>
                {session.weekday && (
                  <p className="text-xs text-muted-foreground capitalize">{session.weekday}</p>
                )}
              </div>
              {session.duration_seconds > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(session.duration_seconds / 60)}m
                  </span>
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1">
            * Individual session completion is tracked at the week level for admin views.{' '}
            <span className="font-medium">{week.completedVideos} of {week.totalVideos}</span> sessions completed this week.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentAttendance() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Data passed via navigation state from BatchAttendance
  const state = location.state as {
    enrollment?: StudentAttendanceRecord;
    batchId?: number;
    batchName?: string;
  } | null;

  const enrollment = state?.enrollment ?? null;
  const batchId = state?.batchId ?? null;
  const batchName = state?.batchName ?? '—';

  const [batchWeeks, setBatchWeeks] = useState<BatchWeek[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(false);

  const fetchWeeks = useCallback(async () => {
    if (!batchId) return;
    setWeeksLoading(true);
    try {
      const res = await batchContentApi.getWeeks(batchId);
      if (res.success) setBatchWeeks(res.data ?? []);
    } catch {
      toast({ title: 'Error', description: 'Could not load week details.', variant: 'destructive' });
    } finally {
      setWeeksLoading(false);
    }
  }, [batchId, toast]);

  useEffect(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  // ── No enrollment state ───────────────────────────────────────────────────
  if (!enrollment || !batchId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
          <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <ClipboardList className="h-8 w-8 opacity-40 text-foreground" />
          </div>
          <p className="text-base font-medium text-foreground">No student selected</p>
          <p className="text-sm mt-1 mb-6">Navigate here from the Batch Attendance page.</p>
          <Button variant="outline" onClick={() => navigate('/attendance/batch')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go to Batch Attendance
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const weekDetails = enrollment.weekDetails;

  // Map batch week data by week_number for session titles
  const batchWeekMap = new Map<number, BatchWeek>(batchWeeks.map((w) => [w.week_number, w]));

  // Trend chart data
  const trendData = weekDetails
    .filter((w) => w.totalVideos > 0)
    .map((w) => ({
      weekLabel: `W${w.weekNumber}`,
      attendancePercent: w.attendancePercent,
    }));

  // Recent activity: weeks with some completion, most recent first
  const recentActivity = [...weekDetails]
    .filter((w) => w.completedVideos > 0 || w.testAttempted)
    .reverse()
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Breadcrumb / back ── */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate('/attendance/batch')}
          >
            <ArrowLeft className="h-4 w-4" />
            Batch Attendance
          </Button>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium text-foreground truncate">{enrollment.studentName}</span>
        </div>

        {/* ── Student hero card (same gradient token as Progress.tsx sheet header) ── */}
        <Card className="relative overflow-hidden gradient-primary text-primary-foreground shadow-card border-primary/20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <CardContent className="relative z-10 p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-white/25 shadow-lg ring-4 ring-white/10">
                  <AvatarImage src={enrollment.profilePicture ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="bg-white/20 text-lg font-black text-primary-foreground">
                    {enrollment.studentName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-primary-foreground truncate">
                    {enrollment.studentName}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="text-sm text-primary-foreground/85 truncate">{enrollment.studentEmail}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="text-sm text-primary-foreground/85">
                      {batchName} · Enrolled {formatDate(enrollment.enrolledAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Badge
                      className={cn(
                        'capitalize font-bold text-xs border',
                        enrollment.enrollmentStatus === 'active'
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : enrollment.enrollmentStatus === 'completed'
                          ? 'bg-white/25 text-white border-white/50'
                          : 'bg-rose-500 text-white border-rose-600',
                      )}
                    >
                      {enrollment.enrollmentStatus}
                    </Badge>
                    <Badge
                      className={cn(
                        'font-bold text-xs border',
                        ATTENDANCE_STATUS_CONFIG[enrollment.attendanceStatus].badgeClass,
                        'bg-white/15 text-primary-foreground border-white/30',
                      )}
                    >
                      {ATTENDANCE_STATUS_CONFIG[enrollment.attendanceStatus].label} Attendance
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Overall percentage */}
              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <div className="text-3xl sm:text-5xl font-black tabular-nums">
                  {enrollment.attendancePercent}%
                </div>
                <div className="w-32 h-2 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${Math.min(100, enrollment.attendancePercent)}%` }}
                  />
                </div>
                <p className="text-sm text-primary-foreground/80">Overall attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Mini stats ── */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <MiniStat
            icon={Video}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            label="Videos Completed"
            value={`${enrollment.completedVideos} / ${enrollment.totalVideos}`}
          />
          <MiniStat
            icon={TrendingUp}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-500/10"
            label="Overall Progress"
            value={`${enrollment.overallProgress}%`}
          />
          <MiniStat
            icon={AlertTriangle}
            iconColor={enrollment.attendancePercent < ATTENDANCE_THRESHOLD ? 'text-orange-500' : 'text-success'}
            iconBg={enrollment.attendancePercent < ATTENDANCE_THRESHOLD ? 'bg-orange-500/10' : 'bg-success/10'}
            label={enrollment.attendancePercent < ATTENDANCE_THRESHOLD ? 'Below Threshold' : 'Above Threshold'}
            value={`${ATTENDANCE_THRESHOLD}% required`}
          />
        </div>

        {/* ── Attendance Trend ── */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Attendance Trend
            </CardTitle>
            <CardDescription>Weekly attendance progression</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {trendData.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground rounded-xl border border-border bg-muted/40">
                <BarChart3 className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm font-medium text-foreground">Not enough data</p>
                <p className="text-xs mt-1">Trend appears once at least two weeks have data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="attendancePercent"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#attendanceGradient)"
                    dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Weekly Breakdown ── */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Weekly Attendance Breakdown
            </CardTitle>
            <CardDescription>
              Attendance and test results per week · click a week to see its sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {weeksLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : weekDetails.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
                <p className="text-muted-foreground text-sm">No week data available for this student.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {weekDetails.map((week) => (
                  <WeekCard
                    key={week.weekNumber}
                    week={week}
                    batchWeek={batchWeekMap.get(week.weekNumber)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Activity ── */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest completed weeks and test activity</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {recentActivity.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
                <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
              </div>
            ) : (
              recentActivity.map((week) => (
                <div
                  key={week.weekNumber}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border hover:bg-accent/20 transition-all"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {week.completedVideos > 0 ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Week {week.weekNumber}: {week.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {week.completedVideos > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {week.completedVideos}/{week.totalVideos} videos completed
                        </span>
                      )}
                      {week.testAttempted && (
                        <span className={cn('text-xs font-medium', week.testPassed ? 'text-success' : 'text-destructive')}>
                          {week.testPassed ? '✓ Test passed' : '✗ Test failed'}
                          {week.testScore !== null && ` · ${formatTestScorePercent(week.testScore)}%`}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-5 py-0 px-2 font-bold shrink-0',
                      ATTENDANCE_STATUS_CONFIG[getAttendanceStatus(week.attendancePercent)].badgeClass,
                    )}
                  >
                    {week.attendancePercent}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Navigation footer ── */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/attendance/batch')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Batch Attendance
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate(`/batches/${batchId}/students`)}
          >
            View in Batch Students
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
