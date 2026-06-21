import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { batchContentApi, type BatchWeek, type Batch } from '@/lib/batch-api';
import {
  getAttendanceStatus,
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_THRESHOLD,
} from '@/lib/attendance-api';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  Loader2,
  Video,
  CheckCircle,
  Clock,
  Lock,
  TrendingUp,
  Award,
  BarChart3,
  PlayCircle,
  AlertTriangle,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Week card (per-session detail) ──────────────────────────────────────────

function WeekAttendanceCard({ week }: { week: BatchWeek }) {
  const [expanded, setExpanded] = useState(false);

  const sessions = week.class_sessions ?? [];
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.is_completed).length;
  const pct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const status = getAttendanceStatus(pct);
  const cfg = ATTENDANCE_STATUS_CONFIG[status];

  const isLocked = week.student_lock_status?.is_locked ?? !week.is_unlocked;
  const hasContent = totalSessions > 0;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm transition-all',
        expanded && 'shadow-md',
        isLocked && 'opacity-70',
      )}
    >
      {/* Week header row */}
      <button
        type="button"
        onClick={() => hasContent && !isLocked && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 p-4 text-left rounded-xl transition-colors',
          hasContent && !isLocked && 'cursor-pointer hover:bg-muted/40',
          (!hasContent || isLocked) && 'cursor-default',
        )}
      >
        {/* Week number / icon */}
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black',
            isLocked
              ? 'bg-muted text-muted-foreground'
              : pct === 100
              ? 'bg-success/10 text-success'
              : 'bg-primary/10 text-primary',
          )}
        >
          {isLocked ? (
            <Lock className="h-4 w-4" />
          ) : pct === 100 ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <span>{week.week_number}</span>
          )}
        </div>

        {/* Title + progress bar */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'font-bold text-sm text-foreground truncate',
                isLocked && 'text-muted-foreground',
              )}
            >
              Week {week.week_number}: {week.title}
            </p>
            {!isLocked && hasContent && (
              <Badge
                variant="outline"
                className={cn('text-[10px] h-5 py-0 px-2 font-bold shrink-0', cfg.badgeClass)}
              >
                {cfg.label}
              </Badge>
            )}
            {isLocked && (
              <Badge variant="outline" className="text-[10px] h-5 py-0 px-2 font-bold shrink-0 text-muted-foreground border-border">
                Locked
              </Badge>
            )}
          </div>

          {!isLocked && hasContent ? (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    pct >= 90 ? 'bg-success' : pct >= 75 ? 'bg-primary' : pct >= 50 ? 'bg-orange-500' : 'bg-destructive',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-foreground">{pct}%</span>
              <span className="text-xs text-muted-foreground">
                ({completedSessions}/{totalSessions} sessions)
              </span>
            </div>
          ) : !isLocked ? (
            <p className="text-xs text-muted-foreground mt-1">No sessions published yet</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {week.student_lock_status?.unlock_date
                ? `Unlocks on ${new Date(week.student_lock_status.unlock_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : 'Complete previous week to unlock'}
            </p>
          )}
        </div>

        {/* Expand hint */}
        {hasContent && !isLocked && (
          <span className="text-xs text-muted-foreground shrink-0">
            {expanded ? 'Hide' : 'Details'}
          </span>
        )}
      </button>

      {/* Session list */}
      {expanded && !isLocked && sessions.length > 0 && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Sessions
          </p>
          {sessions.map((session: any, i: number) => (
            <div
              key={session.id ?? i}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                session.is_completed
                  ? 'bg-success/5 border-success/20'
                  : 'bg-muted/40 border-border/40',
              )}
            >
              <div
                className={cn(
                  'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                  session.is_completed ? 'bg-success/10' : 'bg-muted',
                )}
              >
                {session.is_completed ? (
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                ) : (
                  <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {session.title || `Session ${i + 1}`}
                </p>
                {session.weekday && (
                  <p className="text-xs text-muted-foreground capitalize">{session.weekday}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {session.duration_seconds > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(session.duration_seconds / 60)}m
                    </span>
                  </div>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] h-5 py-0 px-2 font-bold',
                    session.is_completed
                      ? 'bg-success/10 text-success border-success/30'
                      : 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  {session.is_completed ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyAttendance() {
  const { toast } = useToast();

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [weeks, setWeeks] = useState<BatchWeek[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(Number(id));
    setSelectedBatchName(batch.name);
  }, []);

  const fetchWeeks = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await batchContentApi.getWeeks(selectedBatchId);
      if (res.success) setWeeks(res.data ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load attendance data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, toast]);

  useEffect(() => {
    if (selectedBatchId) fetchWeeks();
  }, [selectedBatchId, fetchWeeks]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const publishedWeeks = weeks.filter((w) => w.is_published);
  const unlockedWeeks = publishedWeeks.filter((w) => !(w.student_lock_status?.is_locked ?? !w.is_unlocked));

  let totalSessions = 0;
  let completedSessions = 0;
  let weeksFullAttendance = 0;

  for (const w of unlockedWeeks) {
    const sessions = w.class_sessions ?? [];
    if (sessions.length === 0) continue;
    totalSessions += sessions.length;
    const done = sessions.filter((s: any) => s.is_completed).length;
    completedSessions += done;
    if (done === sessions.length) weeksFullAttendance++;
  }

  const overallPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const overallStatus = getAttendanceStatus(overallPct);
  const overallCfg = ATTENDANCE_STATUS_CONFIG[overallStatus];

  // Trend chart data (one point per unlocked week that has sessions)
  const trendData = unlockedWeeks
    .filter((w) => (w.class_sessions?.length ?? 0) > 0)
    .map((w) => {
      const sessions = w.class_sessions ?? [];
      const done = sessions.filter((s: any) => s.is_completed).length;
      const pct = sessions.length > 0 ? Math.round((done / sessions.length) * 100) : 0;
      return { weekLabel: `W${w.week_number}`, attendancePercent: pct };
    });

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              My Attendance
            </h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              Track your video completion and attendance across your batch
            </p>
          </div>
          <div className="w-full sm:w-[min(280px,100%)] shrink-0">
            <BatchFilterCombobox
              value={selectedBatchId?.toString() ?? ''}
              selectedLabel={selectedBatchName}
              onValueChange={handleBatchChange}
              onReady={() => setLoading(false)}
              placeholder="Select batch"
              triggerIcon={<BookOpen className="h-4 w-4 text-primary" />}
              className="h-10 sm:h-11 border-primary text-primary text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* ── Loading / Empty ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !selectedBatchId ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 opacity-40 text-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">Select a batch to view your attendance</p>
            <p className="text-sm mt-1">Use the selector above to choose a batch</p>
          </div>
        ) : (
          <>
            {/* ── A. Overall summary card (gradient, same as Progress.tsx student view) ── */}
            <Card className="relative overflow-hidden rounded-2xl border border-primary/20 bg-transparent shadow-card gradient-primary text-primary-foreground">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
              </div>
              <CardContent className="relative z-10 p-5 sm:p-8">
                <div className="grid gap-6 sm:grid-cols-3">
                  {/* Overall % */}
                  <div className="sm:border-r sm:border-white/20 sm:pr-6">
                    <p className="text-xs sm:text-sm font-semibold text-primary-foreground/80">
                      Overall attendance
                    </p>
                    <div className="mt-1.5 flex items-end gap-2">
                      <p className="font-display text-3xl sm:text-5xl font-black tabular-nums">
                        {overallPct}%
                      </p>
                    </div>
                    <div className="mt-3 h-2 w-full max-w-full overflow-hidden rounded-full border border-white/10 bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.35)] transition-all duration-500"
                        style={{ width: `${Math.min(100, overallPct)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-primary-foreground/70">
                      {overallPct >= ATTENDANCE_THRESHOLD
                        ? `Above ${ATTENDANCE_THRESHOLD}% threshold ✓`
                        : `${ATTENDANCE_THRESHOLD}% required · ${ATTENDANCE_THRESHOLD - overallPct}% to go`}
                    </p>
                  </div>

                  {/* Sessions watched */}
                  <div className="sm:border-r sm:border-white/20 sm:pr-6">
                    <p className="text-xs sm:text-sm font-semibold text-primary-foreground/80">
                      Sessions completed
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <p className="font-display text-2xl sm:text-4xl font-black tabular-nums">
                        {completedSessions}
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-primary-foreground/60">
                        /{totalSessions}
                      </p>
                    </div>
                  </div>

                  {/* Full-attendance weeks */}
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-primary-foreground/80">
                      Weeks with 100% attendance
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <p className="font-display text-2xl sm:text-4xl font-black tabular-nums">
                        {weeksFullAttendance}
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-primary-foreground/60">
                        /{unlockedWeeks.filter((w) => (w.class_sessions?.length ?? 0) > 0).length}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── B. Attendance trend chart ── */}
            {trendData.length >= 2 && (
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Attendance Trend
                  </CardTitle>
                  <CardDescription>Your video completion percentage week by week</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="myAttendanceGradient" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#myAttendanceGradient)"
                        dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* ── C. Attention banner if below threshold ── */}
            {totalSessions > 0 && overallPct < ATTENDANCE_THRESHOLD && (
              <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Your attendance is below the required {ATTENDANCE_THRESHOLD}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    You need to complete{' '}
                    <span className="font-semibold text-foreground">
                      {Math.ceil((ATTENDANCE_THRESHOLD / 100) * totalSessions) - completedSessions} more session
                      {Math.ceil((ATTENDANCE_THRESHOLD / 100) * totalSessions) - completedSessions !== 1 ? 's' : ''}
                    </span>{' '}
                    to reach {ATTENDANCE_THRESHOLD}%.
                  </p>
                </div>
              </div>
            )}

            {/* ── D. Weekly attendance breakdown ── */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Weekly Breakdown
                </CardTitle>
                <CardDescription>
                  Click a week to expand and see each session's completion status
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {publishedWeeks.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
                    <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-foreground">No weeks published yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your instructor hasn't published any weeks for this batch yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {publishedWeeks.map((week) => (
                      <WeekAttendanceCard key={week.id} week={week} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
