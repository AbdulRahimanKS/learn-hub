import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, AdminDashboardData } from '@/lib/dashboard-api';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
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
  Zap,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Activity,
  Layers,
  Bell,
  Target,
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

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-muted" />
        <div className="h-80 rounded-2xl bg-muted" />
      </div>
    </div>
  );
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
      className={`relative overflow-hidden shadow-card hover:shadow-lg transition-all duration-300 cursor-pointer group ${
        urgent ? 'border-orange-400/50 dark:border-orange-500/40' : ''
      }`}
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

  if (isLoading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive opacity-70" />
        <p className="text-muted-foreground text-sm">Failed to load dashboard. Please refresh.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { summary_stats: stats, batch_overview, pending_actions, student_performance, upcoming_events } = data;
  const totalPending = (pending_actions.pending_tests.length + pending_actions.pending_review.length);

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
          onClick={() => navigate('/users')}
        />
        <StatCard
          label="Completed Students"
          value={stats.completed_students}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
          change="Finished batches"
          onClick={() => navigate('/users')}
        />
        <StatCard
          label="Active Courses"
          value={stats.active_courses}
          icon={BookOpen}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
          change="All active courses"
          onClick={() => navigate('/admin-courses')}
        />
        <StatCard
          label="Total Batches"
          value={stats.total_batches}
          icon={GraduationCap}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
          change="All time"
          onClick={() => navigate('/batches')}
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
                      <th className="text-center px-3 py-3 text-sm font-semibold text-muted-foreground hidden md:table-cell">Week</th>
                      <th className="text-left px-3 py-3 text-sm font-semibold text-muted-foreground">Progress</th>
                      <th className="text-right pl-3 py-3 text-sm font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch_overview.map((b, i) => (
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
                        <td className="text-center px-3 py-3 hidden md:table-cell">
                          <Badge variant="outline" className="text-xs font-mono">
                            W{b.current_week}{b.total_weeks > 0 ? `/${b.total_weeks}` : ''}
                          </Badge>
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

        {/* F. Quick Actions */}
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
                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-base font-medium text-foreground truncate">{p.batch_name}</span>
                    <span className="text-sm text-muted-foreground shrink-0">{p.total_submissions} submissions</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="text-base font-bold text-foreground tabular-nums">{p.avg_marks}%</p>
                      <p className="text-sm text-muted-foreground">avg</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-bold tabular-nums ${p.pass_percent >= 70 ? 'text-emerald-500' : 'text-orange-500'}`}>{p.pass_percent}%</p>
                      <p className="text-sm text-muted-foreground">pass</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <Progress value={p.avg_marks} className="h-1.5 flex-1" />
                  {p.pass_percent >= 70 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Target className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  )}
                </div>
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

// ─── Student dashboard (unchanged) ───────────────────────────────────────────

const weeklyVideos = [
  { id: 1, title: 'Introduction to Python', duration: '45:00', completed: true },
  { id: 2, title: 'Variables and Data Types', duration: '38:00', completed: true },
  { id: 3, title: 'Control Flow Statements', duration: '52:00', completed: false },
  { id: 4, title: 'Functions and Modules', duration: '41:00', completed: false },
];

const upcomingEvents = [
  { id: 1, title: 'Live Q&A Session', type: 'live', date: 'Today, 3:00 PM' },
  { id: 2, title: 'Weekly Assessment', type: 'assessment', date: 'Tomorrow, 10:00 AM' },
  { id: 3, title: 'Python Advanced Webinar', type: 'webinar', date: 'Feb 5, 2:00 PM' },
];

function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="mt-1 text-muted-foreground">Continue your learning journey</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5">
            <Award className="h-4 w-4 mr-1.5" />
            Week 3
          </Badge>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="shadow-card gradient-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-primary-foreground/80">Current Week Progress</p>
              <h2 className="text-2xl font-bold mt-1">Python Fundamentals - Week 3</h2>
              <p className="text-primary-foreground/80 mt-2">2 of 4 videos completed</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-3xl font-bold">50%</div>
              <Progress value={50} className="w-32 h-2 bg-primary-foreground/20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>This Week's Content</CardTitle>
            <CardDescription>Complete all videos to unlock the weekly assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyVideos.map((video, index) => (
                <div
                  key={video.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    video.completed ? 'bg-success/5 border-success/20' : 'bg-card hover:bg-muted/50 border-border'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    video.completed ? 'bg-success text-success-foreground' : 'bg-primary/10 text-primary'
                  }`}>
                    {video.completed ? '✓' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{video.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {video.duration}
                    </p>
                  </div>
                  <Button variant={video.completed ? 'outline' : 'default'} size="sm">
                    {video.completed ? 'Rewatch' : 'Watch'}
                    <Play className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Your schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:bg-accent/20 hover:shadow-sm transition-all">
                  <div className={`p-2 rounded-lg ${
                    event.type === 'live' ? 'bg-destructive/10' :
                    event.type === 'assessment' ? 'bg-warning/10' : 'bg-primary/10'
                  }`}>
                    {event.type === 'live' ? (
                      <Video className="h-4 w-4 text-destructive" />
                    ) : event.type === 'assessment' ? (
                      <ClipboardCheck className="h-4 w-4 text-warning" />
                    ) : (
                      <Calendar className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Average Score', value: '87%', icon: TrendingUp, color: 'text-success' },
          { label: 'Videos Watched', value: '18', icon: Play, color: 'text-primary' },
          { label: 'Assessments Done', value: '6', icon: ClipboardCheck, color: 'text-accent-foreground' },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
