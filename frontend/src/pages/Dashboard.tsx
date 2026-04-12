import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, AdminDashboardData, StudentDashboardData } from '@/lib/dashboard-api';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  BookOpen,
  Users,
  ClipboardCheck,
  TrendingUp,
  Play,
  Calendar,
  Clock,
  Award,
  ArrowRight,
  Video,
  GraduationCap,
  AlertTriangle,
  MessageSquare,
  Upload,
  Plus,
  BarChart3,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
    if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  } catch {
    return dateStr;
  }
}

function formatRelative(dateStr: string): string {
  try {
    const diff = Date.now() - parseISO(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return dateStr;
  }
}



// ─── Summary stat card ────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  change?: string;
  changeColor?: string;
  urgent?: boolean;
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, change, changeColor, urgent, onClick }: StatCardProps) {
  return (
    <Card
      className={`relative overflow-hidden shadow-card transition-all duration-300 group ${
        onClick ? 'hover:shadow-lg cursor-pointer' : ''
      } ${urgent ? 'border-orange-400/50 dark:border-orange-500/40' : ''}`}
      onClick={onClick}
    >
      {urgent && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400" />
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
            {change && (
              <p className={`text-sm mt-2 font-medium ${changeColor || 'text-muted-foreground'}`}>{change}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${iconBg} transition-transform group-hover:scale-110`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Admin / Teacher dashboard ────────────────────────────────────────────────

function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: dashboardApi.getAdminDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive opacity-70" />
        <p className="text-muted-foreground text-sm">Failed to load dashboard. Please refresh.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { summary_stats: stats, batch_overview, student_performance, upcoming_events } = data;

  return (
    <div className="space-y-7 pb-8">

      {/* ── Header ── */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Welcome back, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's what's happening across your platform today.
        </p>
      </div>

      {/* ── A. Summary Stats ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Active Students"
          value={stats.total_students}
          icon={Users}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          change="Actively enrolled"
        />
        <StatCard
          label="Completed Students"
          value={stats.completed_students}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
          change="Finished batches"
        />
        <StatCard
          label="Active Courses"
          value={stats.active_courses}
          icon={BookOpen}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
          change="All active courses"
        />
        <StatCard
          label="Total Batches"
          value={stats.total_batches}
          icon={GraduationCap}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
          change="All time"
        />
        <StatCard
          label="Pending Evaluations"
          value={stats.pending_evaluations}
          icon={AlertTriangle}
          iconColor="text-orange-500"
          iconBg="bg-orange-500/10"
          change={stats.pending_evaluations > 0 ? 'Needs attention!' : 'All clear ✓'}
          changeColor={stats.pending_evaluations > 0 ? 'text-orange-500 font-semibold' : 'text-emerald-500 font-semibold'}
          urgent={stats.pending_evaluations > 0}
          onClick={() => navigate('/assessments')}
        />
      </div>



      {/* ── B. Batch Overview  +  F. Quick Actions ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Batch table */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1.5">
              <CardTitle>Batch Overview</CardTitle>
              <CardDescription>Active batches at a glance</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/batches')} className="gap-1">
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-8 pb-2">
            {batch_overview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                  <GraduationCap className="h-8 w-8 opacity-40 text-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">No active batches</p>
                <p className="text-sm mt-1">Batches will appear here once created</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pr-3 py-3 text-sm font-semibold text-muted-foreground">Batch</th>
                      <th className="text-center px-3 py-3 text-sm font-semibold text-muted-foreground hidden sm:table-cell">Students</th>
                      <th className="text-left px-3 py-3 text-sm font-semibold text-muted-foreground">Progress</th>
                      <th className="text-right pl-3 py-3 text-sm font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch_overview.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-border/60 hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/batches/${b.id}/students`)}
                      >
                        <td className="pr-3 py-3 min-w-0">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-base leading-tight truncate">{b.name}</p>
                            {b.course_name && (
                              <p className="text-sm text-muted-foreground mt-0.5 truncate">{b.course_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-center px-3 py-3 hidden sm:table-cell">
                          <div className="flex items-center justify-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{b.student_count}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={b.progress_pct} className="h-1.5 flex-1" />
                            <span className="text-sm font-medium tabular-nums text-muted-foreground w-9 text-right">{Math.round(b.progress_pct)}%</span>
                          </div>
                        </td>
                        <td className="pl-3 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={e => { e.stopPropagation(); navigate(`/batches/${b.id}/students`); }}
                          >
                            View <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common management tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: 'Upload Weekly Content', icon: Upload, color: 'text-primary', bg: 'bg-primary/10', to: '/batches' },
              { label: 'Schedule Live Session', icon: Video, color: 'text-red-500', bg: 'bg-red-500/10', to: '/live-sessions' },
              { label: 'Manage Assessments', icon: ClipboardCheck, color: 'text-orange-500', bg: 'bg-orange-500/10', to: '/assessments' },
              { label: 'View Student Progress', icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10', to: '/progress' },
              { label: 'Create New Batch', icon: Plus, color: 'text-violet-500', bg: 'bg-violet-500/10', to: '/batches' },
              { label: 'Open Chat', icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10', to: '/chat' },
            ].map(action => (
              <button
                key={action.label}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all text-left group border border-transparent hover:border-border"
                onClick={() => navigate(action.to)}
              >
                <div className={`h-8 w-8 rounded-lg ${action.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <action.icon className={`h-4 w-4 ${action.color}`} />
                </div>
                <span className="text-base font-medium text-foreground">{action.label}</span>
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── D. Student Performance + E. Upcoming Events ── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Performance */}
        <Card className="shadow-card lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1.5">
              <CardTitle>Student Performance</CardTitle>
              <CardDescription>Avg marks & pass rate per batch</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')} className="gap-1 text-xs">
              Details <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {student_performance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                  <BarChart3 className="h-8 w-8 opacity-40 text-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">No evaluation data yet</p>
                <p className="text-sm mt-1">Metrics will appear after evaluations</p>
              </div>
            ) : student_performance.map(p => (
              <div key={p.batch_id} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-medium text-foreground truncate">{p.batch_name}</span>
                    <span className="text-sm text-muted-foreground shrink-0">{p.total_submissions} evaluated</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-foreground shrink-0 ml-3">
                    {p.pass_percent}% pass
                  </span>
                </div>
                <Progress value={p.pass_percent} className="h-1.5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* E. Upcoming Events */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1.5">
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Next 14 days</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/live-sessions')} className="gap-1">
              All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcoming_events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 opacity-40 text-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">No upcoming events</p>
                <p className="text-sm mt-1 mb-4">You have no events scheduled</p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/live-sessions')}>
                  <Plus className="h-4 w-4" /> Schedule Session
                </Button>
              </div>
            ) : upcoming_events.map(ev => (
              <div
                key={ev.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border hover:bg-accent/30 hover:border-primary/20 transition-all cursor-pointer"
                onClick={() => navigate('/live-sessions')}
              >
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Video className="h-4 w-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground leading-tight truncate">{ev.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{ev.batch_name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{formatEventDate(ev.scheduled_at)}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {ev.duration_mins}m
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

// ─── Student dashboard ─────────────────────────────────────────────────────────

function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<StudentDashboardData>({
    queryKey: ['student-dashboard'],
    queryFn: dashboardApi.getStudentDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive opacity-70" />
        <p className="text-muted-foreground text-sm">Failed to load dashboard. Please refresh.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { focus, stats, upcoming } = data;

  const weekHeadline =
    focus && (focus.course_title || focus.batch_name);

  const navigateUpcoming = (ev: StudentDashboardData['upcoming'][0]) => {
    if (ev.type === 'live_session') {
      navigate('/live-sessions');
      return;
    }
    navigate('/webinars');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">Continue your learning journey</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data.active_batches > 1 ? (
            <Badge variant="secondary" className="px-3 py-1.5">
              {data.active_batches} active batches
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Progress overview */}
      <Card className="shadow-card gradient-primary text-primary-foreground">
        <CardContent className="p-4 md:p-5">
          {focus ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-primary-foreground/80 text-xs sm:text-sm">Current week progress</p>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold mt-1 leading-tight truncate">{weekHeadline}</h2>
                <p className="mt-3 text-primary-foreground/85 text-sm font-medium">
                  {focus.videos_completed} of {focus.videos_total} videos completed
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-2xl sm:text-3xl font-bold tabular-nums">{focus.week_progress_pct}%</div>
                <Progress value={focus.week_progress_pct} className="w-24 sm:w-28 md:w-32 h-2 bg-primary-foreground/20" />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-primary-foreground/80">Overview</p>
              <h2 className="text-2xl font-bold mt-1">No active enrollments</h2>
              <p className="text-primary-foreground/80 mt-2 max-w-xl">
                When you are enrolled in a batch, your current week and learning progress will show here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-display font-black">
                  <Award className="h-5 w-5 text-primary" />
                  Weekly Progress
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs sm:text-sm">Complete each week's content to unlock the next</CardDescription>
              </div>
              {focus ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-10 shrink-0 gap-1 sm:gap-1.5 rounded-xl border-border bg-background font-bold text-xs sm:text-sm"
                  onClick={() => navigate('/progress')}
                >
                  View All
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {!focus || !focus.weekly_progress || focus.weekly_progress.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground rounded-xl border border-border bg-muted/40">
                <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 opacity-40 text-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">
                  {data.active_batches === 0
                    ? 'No active enrollments'
                    : 'No weekly progress yet'}
                </p>
                <p className="text-sm mt-1 text-center max-w-sm px-4">
                  {data.active_batches === 0
                    ? 'You are not enrolled in any active batch yet.'
                    : 'No weeks have been published for this batch yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {focus.weekly_progress.slice(0, 4).map((w) => (
                  <div
                    key={w.week_id}
                    className="group flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 transition-all hover:bg-accent/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black transition-colors ${
                          w.is_passed
                            ? 'bg-success/10 text-success group-hover:bg-success/15'
                            : 'bg-primary/10 text-primary group-hover:bg-primary/15'
                        }`}
                      >
                        {w.is_passed ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-black">{w.week_number}</span>}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground text-sm sm:text-base">Week {w.week_number}: {w.title || 'Untitled'}</p>
                          {w.is_passed ? (
                            <Badge
                              variant="outline"
                              className="rounded-lg border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-black text-success shadow-sm"
                            >
                              Passed
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium">
                            <Video className="h-3 w-3 shrink-0" />
                            {w.videos_watched}/{w.total_videos} videos
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-lg sm:text-xl">Upcoming</CardTitle>
            <CardDescription className="mt-0.5 text-xs sm:text-sm">
              {focus
                ? 'Live sessions and webinars for the batch above · next two weeks'
                : 'Across your active batches · next two weeks'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm font-medium text-foreground">Nothing scheduled</p>
                <p className="text-xs mt-1 text-center max-w-[220px]">Live sessions and webinars from your batches appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcoming.slice(0, 4).map(ev => (
                  <button
                    key={ev.id}
                    type="button"
                    className="w-full flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:bg-accent/20 hover:shadow-sm transition-all text-left"
                    onClick={() => navigateUpcoming(ev)}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        ev.type === 'live_session' ? 'bg-destructive/10' : 'bg-primary/10'
                      }`}
                    >
                      {ev.type === 'live_session' ? (
                        <Video className="h-4 w-4 text-destructive" />
                      ) : (
                        <Calendar className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground leading-snug">{ev.title}</p>
                      {ev.subtitle ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.subtitle}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground mt-1">{formatEventDate(ev.scheduled_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data.active_batches > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Avg. on graded tests',
              hint: focus
                ? 'Published results · same batch as the week above'
                : 'Published results · all active batches',
              value: stats.avg_score_pct != null ? `${stats.avg_score_pct}%` : '—',
              icon: TrendingUp,
              color: 'text-success',
            },
            {
              label: 'Class sessions done',
              hint: focus
                ? 'Marked complete in that batch'
                : 'Marked complete across active batches',
              value: String(stats.sessions_completed),
              icon: CheckCircle2,
              color: 'text-primary',
            },
            {
              label: 'Weekly tests graded',
              hint: focus
                ? 'Returned scores in that batch'
                : 'Returned scores across active batches',
              value: String(stats.graded_tests),
              icon: ClipboardCheck,
              color: 'text-accent-foreground',
            },
          ].map(stat => (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{stat.hint}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      {user?.role === 'student' ? <StudentDashboard /> : <AdminDashboard />}
    </DashboardLayout>
  );
}
