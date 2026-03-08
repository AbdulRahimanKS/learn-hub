import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VideoPlayer } from '@/components/VideoPlayer';
import {
  Play,
  Clock,
  Video,
  Award,
  BookOpen,
  ImageIcon,
  Loader2,
  ChevronLeft,
  Lock,
  CheckCircle2,
  HelpCircle,
  Users,
  Bell,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  LayoutGrid,
  FlaskConical,
  Monitor,
  Video as VideoIcon,
} from 'lucide-react';
import { courseApi, Course } from '@/lib/course-api';
import { CourseWeek, ClassSession, courseModuleApi } from '@/lib/course-module-api';
import { batchContentApi } from '@/lib/batch-api';
import { webinarApi, Webinar } from '@/lib/webinar-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SessionMcqPractice } from '@/components/SessionMcqPractice';

export default function Courses() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // Upcoming webinars
  const [upcomingWebinars, setUpcomingWebinars] = useState<Webinar[]>([]);
  const [loadingWebinars, setLoadingWebinars] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);

  // State for active video playback
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [playingSession, setPlayingSession] = useState<{ weekId: number; sessionId: number } | null>(null);

  // State for MCQ practice
  const [activeMcqSession, setActiveMcqSession] = useState<{ title: string; questions: any[] } | null>(null);

  // State for locally tracking viewed sessions in this component session
  const [viewedSessions, setViewedSessions] = useState<string[]>([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await courseApi.getCourses({ paginate: false, is_active: true });
      if (res.success) {
        setCourses((res as any).data);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load your courses', variant: 'destructive' });
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchUpcomingWebinars = async (batchId: number) => {
    setLoadingWebinars(true);
    try {
      const res = await webinarApi.getWebinars(batchId, { tab: 'scheduled', page_size: 5 });
      if (res.success) {
        setUpcomingWebinars(res.data);
      }
    } catch (err) {
      // Silently fail
    } finally {
      setLoadingWebinars(false);
    }
  };

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setLoadingWeeks(true);
    setActiveVideoUrl(null);
    setExpandedWeeks(new Set());
    setUpcomingWebinars([]);

    try {
      let res;
      if (course.batch_id) {
        res = await batchContentApi.getWeeks(course.batch_id);
        fetchUpcomingWebinars(course.batch_id);
      } else {
        res = await courseModuleApi.getWeeks(course.id.toString());
      }

      if (res.success) {
        setWeeks(res.data);
        if (res.data.length > 0) {
          // Auto-expand first unlocked week
          const firstUnlocked = res.data.find((w: CourseWeek) => !getWeekLockInfoFromData(w, course).is_locked);
          const target = firstUnlocked || res.data[0];
          setActiveWeekId(target.id);
          setExpandedWeeks(new Set([target.id]));
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load course content', variant: 'destructive' });
    } finally {
      setLoadingWeeks(false);
    }
  };

  const handleBack = () => {
    setSelectedCourse(null);
    setWeeks([]);
    setActiveVideoUrl(null);
    setActiveWeekId(null);
    setExpandedWeeks(new Set());
    setUpcomingWebinars([]);
  };

  const handlePlaySession = (weekId: number, session: ClassSession) => {
    if (session.video_presigned_url || session.video_url) {
      const url = session.video_presigned_url || session.video_url;
      if (url) {
        setActiveVideoUrl(url);
        setPlayingSession({ weekId, sessionId: session.id });
        const sessionIdent = `${session.id}`;
        if (!viewedSessions.includes(sessionIdent)) {
          setViewedSessions(prev => [...prev, sessionIdent]);
        }
      }
    } else {
      toast({ title: 'Not Available', description: 'Video is still processing or unavailable.', variant: 'destructive' });
    }
  };

  const handleVideoEnded = () => {
    if (playingSession) {
      const week = weeks.find(w => w.id === playingSession.weekId);
      const session = week?.class_sessions?.find(s => s.id === playingSession.sessionId);
      if (session && !session.is_completed) {
        toggleSessionCompletion(playingSession.weekId, playingSession.sessionId, false);
      }
    }
  };

  const getWeekLockInfoFromData = (week: CourseWeek, course: Course | null) => {
    if (!course?.batch_id || !week.student_lock_status) {
      return { is_locked: false, reason: null };
    }
    return week.student_lock_status;
  };

  const getWeekLockInfo = (week: CourseWeek) => {
    return getWeekLockInfoFromData(week, selectedCourse);
  };

  const toggleWeekExpand = (weekId: number) => {
    const week = weeks.find(w => w.id === weekId);
    if (!week) return;
    const lockInfo = getWeekLockInfo(week);
    if (lockInfo.is_locked) {
      let msg = 'Complete previous weeks first.';
      if (lockInfo.reason === 'date_locked') msg = `This week unlocks on ${new Date((lockInfo as any).unlock_date!).toLocaleDateString()}.`;
      if (lockInfo.reason === 'previous_test_not_passed') msg = "Pass the previous week's assessment first.";
      toast({ title: 'Week Locked', description: msg, variant: 'destructive' });
      return;
    }
    setActiveWeekId(weekId);
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const handleStartLearning = () => {
    if (weeks.length === 0) return;
    for (let i = 0; i < weeks.length; i++) {
      const lockInfo = getWeekLockInfo(weeks[i]);
      if (!lockInfo.is_locked) {
        const sessions = weeks[i].class_sessions || [];
        const incompleteSession = sessions.find((s: any) => !s.is_completed);
        if (incompleteSession) {
          setActiveWeekId(weeks[i].id);
          setExpandedWeeks(new Set([weeks[i].id]));
          handlePlaySession(weeks[i].id, incompleteSession);
          return;
        }
        continue;
      } else {
        break;
      }
    }
    setActiveWeekId(weeks[0].id);
    setExpandedWeeks(new Set([weeks[0].id]));
  };

  const toggleSessionCompletion = async (weekId: number, sessionId: number, currentlyCompleted: boolean) => {
    if (!selectedCourse?.batch_id) return;
    try {
      const res = await batchContentApi.completeSession(selectedCourse.batch_id, weekId, sessionId, !currentlyCompleted);
      if (res.success) {
        setWeeks(prevWeeks =>
          prevWeeks.map(w => {
            if (w.id === weekId) {
              return {
                ...w,
                class_sessions: w.class_sessions?.map((s: any) => {
                  if (s.id === sessionId) {
                    return { ...s, is_completed: res.data.is_completed };
                  }
                  return s;
                }),
              };
            }
            return w;
          })
        );
        toast({
          title: res.data.is_completed ? 'Session Completed' : 'Session Marked Incomplete',
          description: res.data.is_completed ? 'Great job! Keep going.' : 'Status updated.',
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update session progress', variant: 'destructive' });
    }
  };

  // ===================== Computed values =====================
  const totalSessions = weeks.reduce((acc, w) => acc + (w.class_sessions?.length || 0), 0);
  const completedSessions = weeks.reduce(
    (acc, w) => acc + (w.class_sessions?.filter((s: any) => s.is_completed).length || 0),
    0
  );

  // Current "in progress" week
  const inProgressWeek = weeks.find(w => {
    const lockInfo = getWeekLockInfo(w);
    if (lockInfo.is_locked) return false;
    const sessions = w.class_sessions || [];
    return sessions.some((s: any) => !s.is_completed) || sessions.length === 0;
  });

  const formatSessionDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  const formatWebinarDate = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isWebinarUnlocked = (webinar: Webinar) => {
    return new Date(webinar.unlock_at) <= new Date();
  };

  const getDaysUntilUnlock = (dt: string) => {
    const diff = new Date(dt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  // ===================== Render =====================
  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {!selectedCourse ? (
          // ===== COURSE LIST =====
          <>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">My Courses</h1>
              <p className="mt-1 text-muted-foreground">Continue learning and tracking your subjects</p>
            </div>

            {loadingCourses ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No courses yet</h3>
                <p>You haven't been enrolled in any courses yet.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => (
                  <Card
                    key={course.id}
                    className="flex flex-col shadow-card hover:shadow-lg transition-all duration-300 cursor-pointer"
                    onClick={() => handleSelectCourse(course)}
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-t-xl group bg-muted flex items-center justify-center">
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                      {course.batch_status && (
                        <div className="absolute top-3 left-3 flex gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'backdrop-blur-md font-bold border-none text-[10px] uppercase tracking-wider px-2 h-5 flex items-center shadow-lg',
                              course.batch_status === 'active'
                                ? 'bg-success/90 text-white'
                                : course.batch_status === 'completed'
                                ? 'bg-primary/90 text-white'
                                : 'bg-destructive/90 text-white'
                            )}
                          >
                            {course.batch_status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 px-5 pt-4 pb-2">
                      {course.batch_name ? (
                        <div className="flex items-center gap-1.5 text-primary mb-1">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold uppercase tracking-tight">{course.batch_name}</span>
                        </div>
                      ) : (
                        <div className="h-4" />
                      )}
                      <h3 className="text-lg line-clamp-1 font-bold leading-tight" title={course.title}>
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground" title={course.description}>
                          {course.description}
                        </p>
                      )}
                    </div>

                    <div className="px-5 pb-5 pt-3">
                      <div className="flex flex-col gap-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/40">
                        <div className="flex items-center justify-between font-medium">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4 text-primary/70" />
                            <span className="capitalize">{course.difficulty_level}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground/80">{course.total_weeks || 0}</span>
                            <span className="text-muted-foreground font-normal">Weeks</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          // ===== COURSE DETAIL =====
          <>
            {/* Back Button */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground -mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="-ml-3 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Courses
              </Button>
            </div>

            {/* Video Player Dialog */}
            <Dialog
              open={!!activeVideoUrl}
              onOpenChange={open => {
                if (!open) {
                  setActiveVideoUrl(null);
                  setPlayingSession(null);
                }
              }}
            >
              {activeVideoUrl && (
                <DialogContent className="max-w-5xl w-[90vw] p-0 bg-black border-none overflow-hidden shadow-2xl [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:hover:bg-white/10 [&>button]:z-[60] [&>button]:right-4 [&>button]:top-4 [&>button>svg]:w-6 [&>button>svg]:h-6">
                  <div className="w-full aspect-video bg-black relative flex items-center justify-center">
                    <VideoPlayer url={activeVideoUrl} onEnded={handleVideoEnded} />
                  </div>
                </DialogContent>
              )}
            </Dialog>

            {/* ===== HEADER BANNER ===== */}
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] text-white p-6 md:p-8 relative">
              {/* Decorative blobs */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-primary/20 rounded-full blur-2xl" />
              </div>

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                {/* Left: Course info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                    {selectedCourse.title}
                  </h1>
                  {selectedCourse.batch_name && (
                    <p className="mt-2 text-white/80 text-sm font-medium">
                      Enrolled in: {selectedCourse.batch_name}
                    </p>
                  )}
                  {selectedCourse.description && (
                    <p className="mt-3 text-white/70 text-sm leading-relaxed line-clamp-2 max-w-2xl">
                      {selectedCourse.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-5">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm font-medium shadow-sm">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span>{weeks.length} Week{weeks.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm font-medium shadow-sm">
                      <Video className="h-3.5 w-3.5" />
                      <span>{totalSessions} Session{totalSessions !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Progress Card */}
                {inProgressWeek && (
                  <div className="shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-5 min-w-[240px] max-w-[300px]">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-base">Week {inProgressWeek.week_number} in Progress</p>
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                        <Play className="h-3.5 w-3.5 fill-white text-white" />
                      </div>
                    </div>
                    <div className="mt-3">
                      {/* Progress bar */}
                      <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-green-300 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              inProgressWeek.class_sessions && inProgressWeek.class_sessions.length > 0
                                ? (inProgressWeek.class_sessions.filter((s: any) => s.is_completed).length /
                                    inProgressWeek.class_sessions.length) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <p className="text-white/60 text-xs mt-2 uppercase tracking-wider font-semibold">
                        {inProgressWeek.class_sessions?.filter((s: any) => s.is_completed).length || 0} /{' '}
                        {inProgressWeek.class_sessions?.length || 0} LESSONS COMPLETE
                      </p>
                    </div>
                    <Button
                      onClick={handleStartLearning}
                      className="w-full mt-4 bg-white text-[#1a237e] hover:bg-white/90 font-bold h-10 rounded-full shadow-lg text-sm"
                    >
                      <Play className="w-4 h-4 mr-1.5 fill-[#1a237e]" />
                      Continue Learning
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ===== WEEK TABS ===== */}
            {loadingWeeks ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : weeks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl bg-card">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No content available</h3>
                <p>Check back later for new course materials.</p>
              </div>
            ) : (
              <>
                {/* Week selector pills */}
                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1 scrollbar-hide">
                  {weeks.map(week => {
                    const lockInfo = getWeekLockInfo(week);
                    const locked = lockInfo.is_locked;
                    const allDone =
                      week.class_sessions &&
                      week.class_sessions.length > 0 &&
                      week.class_sessions.every((s: any) => s.is_completed);
                    const isActive = activeWeekId === week.id;

                    return (
                      <button
                        key={week.id}
                        onClick={() => toggleWeekExpand(week.id)}
                        className={cn(
                          'shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 border',
                          isActive
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                            : locked
                            ? 'bg-muted/30 text-muted-foreground border-border/50 opacity-60 cursor-not-allowed'
                            : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground'
                        )}
                        disabled={locked}
                      >
                        {locked ? (
                          <Lock className="h-3 w-3" />
                        ) : allDone ? (
                          <CheckCircle2 className={cn('h-3.5 w-3.5', isActive ? 'text-white' : 'text-emerald-500')} />
                        ) : null}
                        <span>Week {week.week_number}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ===== MAIN CONTENT + SIDEBAR ===== */}
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left: Weeks Content */}
                  <div className="flex-1 min-w-0 space-y-4">
                    {weeks.map(week => {
                      const lockInfo = getWeekLockInfo(week);
                      const locked = lockInfo.is_locked;
                      const isExpanded = expandedWeeks.has(week.id);
                      const sessions: ClassSession[] = week.class_sessions || [];
                      const completedCount = sessions.filter((s: any) => s.is_completed).length;
                      const allDone = sessions.length > 0 && completedCount === sessions.length;
                      const progressPct = sessions.length > 0 ? (completedCount / sessions.length) * 100 : 0;

                      return (
                        <div key={week.id} className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                          {/* Week Header */}
                          <button
                            className={cn(
                              'w-full text-left px-5 py-4 flex items-center gap-3 transition-colors',
                              locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/30',
                              isExpanded ? 'bg-muted/20' : ''
                            )}
                            onClick={() => toggleWeekExpand(week.id)}
                          >
                            {/* Number badge */}
                            <div
                              className={cn(
                                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                                locked
                                  ? 'bg-muted text-muted-foreground'
                                  : allDone
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : 'bg-primary/10 text-primary'
                              )}
                            >
                              {locked ? <Lock className="h-3.5 w-3.5" /> : allDone ? <CheckCircle2 className="h-4 w-4" /> : week.week_number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base text-foreground">
                                  Week {week.week_number}
                                  {week.title && week.title !== `Week ${week.week_number}` && (
                                    <span className="text-muted-foreground font-medium ml-1">– {week.title}</span>
                                  )}
                                </h3>
                                {allDone && (
                                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/25 text-[10px] h-5 px-2">
                                    ✓ Completed
                                  </Badge>
                                )}
                              </div>
                              {sessions.length > 0 && (
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex-1 h-1 rounded-full bg-border overflow-hidden max-w-[120px]">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all duration-500',
                                        allDone ? 'bg-emerald-500' : 'bg-primary'
                                      )}
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {completedCount} / {sessions.length} LESSONS COMPLETE
                                  </span>
                                </div>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </button>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t border-border/40">
                              {/* Session List Header */}
                              {sessions.length > 0 && (
                                <div className="flex items-center gap-2 px-5 py-3 bg-muted/10">
                                  <Monitor className="h-4 w-4 text-primary" />
                                  <span className="font-semibold text-sm">Lessons</span>
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                                </div>
                              )}

                              {/* Sessions */}
                              {sessions.length === 0 ? (
                                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                                  <VideoIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                  No video sessions yet for this week.
                                </div>
                              ) : (
                                <div className="divide-y divide-border/30">
                                  {sessions.map((session: any) => {
                                    const isPlaying =
                                      playingSession?.weekId === week.id && playingSession?.sessionId === session.id;
                                    const completed = session.is_completed;

                                    return (
                                      <div
                                        key={session.id}
                                        className={cn(
                                          'flex items-center gap-4 px-5 py-3.5 transition-all group',
                                          locked
                                            ? 'opacity-60 cursor-not-allowed'
                                            : 'cursor-pointer hover:bg-muted/20'
                                        )}
                                        onClick={() => !locked && handlePlaySession(week.id, session)}
                                      >
                                        {/* Play Button */}
                                        <div
                                          className={cn(
                                            'shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200',
                                            locked
                                              ? 'border-muted-foreground/30 bg-muted text-muted-foreground'
                                              : isPlaying
                                              ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                                              : completed
                                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                              : 'border-primary/30 bg-primary/5 text-primary group-hover:bg-primary/10 group-hover:border-primary/50'
                                          )}
                                        >
                                          {locked ? (
                                            <Lock className="h-3.5 w-3.5" />
                                          ) : isPlaying ? (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                                          ) : (
                                            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                                          )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                          <h4
                                            className={cn(
                                              'font-semibold text-sm leading-snug line-clamp-1',
                                              completed ? 'text-muted-foreground line-through' : 'text-foreground'
                                            )}
                                          >
                                            {session.title}
                                          </h4>
                                          {session.duration_seconds > 0 && (
                                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              {formatSessionDuration(session.duration_seconds)}
                                            </p>
                                          )}
                                        </div>

                                        {/* Right: date + status */}
                                        <div className="flex items-center gap-3 shrink-0">
                                          {session.weekday && (
                                            <span className="hidden sm:block text-xs text-muted-foreground capitalize font-medium">
                                              {session.weekday}
                                            </span>
                                          )}
                                          {completed ? (
                                            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/25 h-6 text-[10px] px-2 font-semibold">
                                              ✓ Completed
                                            </Badge>
                                          ) : isPlaying ? (
                                            <Badge className="bg-primary/10 text-primary border-primary/20 h-6 text-[10px] px-2 font-semibold animate-pulse">
                                              Playing...
                                            </Badge>
                                          ) : session.has_mcq ? (
                                            <Badge variant="outline" className="h-6 text-[10px] px-2 bg-blue-500/5 text-blue-500 border-blue-500/20">
                                              MCQ
                                            </Badge>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* MCQ Practice section */}
                              {sessions.some((s: any) => s.has_mcq) && (
                                <div className="mx-4 my-3 flex items-center justify-between rounded-xl bg-muted/30 border border-border/50 px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                                      <HelpCircle className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                      <p className="font-semibold text-sm">Practice Quiz</p>
                                      <p className="text-xs text-muted-foreground">Multiple Choice Questions</p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-white font-bold rounded-lg h-9 px-4 text-xs shadow-md"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const mcqSession = sessions.find((s: any) => s.has_mcq && s.mcq_questions?.length > 0);
                                      if (mcqSession) {
                                        setActiveMcqSession({
                                          title: mcqSession.title,
                                          questions: mcqSession.mcq_questions,
                                        });
                                      } else {
                                        toast({
                                          title: 'Not Available',
                                          description: 'No practice questions available yet.',
                                          variant: 'destructive',
                                        });
                                      }
                                    }}
                                  >
                                    Practice MCQs
                                  </Button>
                                </div>
                              )}

                              {/* Weekly Test Banner */}
                              {week.weekly_test ? (
                                <div
                                  className={cn(
                                    'mx-4 my-3 flex items-center justify-between rounded-xl px-4 py-3.5 border',
                                    locked
                                      ? 'bg-muted/30 border-border/50 opacity-70'
                                      : 'bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-amber-500/20'
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center',
                                        locked ? 'bg-muted' : 'bg-amber-500/15'
                                      )}
                                    >
                                      {locked ? (
                                        <Lock className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-sm">{week.weekly_test.title || 'Weekly Test'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {locked ? 'Unlocks after completing this week' : 'Scheduled for this week'}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    disabled={locked || !sessions.every((s: any) => s.is_completed)}
                                    className={cn(
                                      'font-bold rounded-lg h-9 px-4 text-xs shadow-md',
                                      locked || !sessions.every((s: any) => s.is_completed)
                                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                                    )}
                                  >
                                    {locked
                                      ? 'Locked'
                                      : !sessions.every((s: any) => s.is_completed)
                                      ? 'Complete Videos First'
                                      : 'Take Test'}
                                  </Button>
                                </div>
                              ) : (
                                <div className="mx-4 my-3 flex items-center gap-3 rounded-xl bg-muted/20 border border-dashed border-border/50 px-4 py-3 text-muted-foreground">
                                  <Award className="h-4 w-4 opacity-40" />
                                  <p className="text-xs font-medium">No assessment available for this week yet.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Upcoming Sidebar */}
                  {selectedCourse.batch_id && (
                    <div className="lg:w-72 xl:w-80 shrink-0 space-y-4">
                      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                        {/* Sidebar Header */}
                        <button
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors"
                          onClick={() => setUpcomingExpanded(prev => !prev)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center">
                              <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="font-bold text-sm">Upcoming</span>
                          </div>
                          {upcomingExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {upcomingExpanded && (
                          <div className="border-t border-border/30">
                            {loadingWebinars ? (
                              <div className="flex justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : upcomingWebinars.length === 0 ? (
                              <p className="text-center text-sm text-muted-foreground py-6 px-4">
                                No upcoming sessions scheduled.
                              </p>
                            ) : (
                              <div className="divide-y divide-border/30">
                                {upcomingWebinars.map(webinar => {
                                  const unlocked = isWebinarUnlocked(webinar);
                                  const daysLeft = getDaysUntilUnlock(webinar.unlock_at);
                                  const isLive = webinar.session_type === 'webinar';

                                  return (
                                    <div key={webinar.id} className="px-4 py-3.5 flex items-start gap-3">
                                      <div
                                        className={cn(
                                          'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
                                          isLive ? 'bg-blue-500/10' : 'bg-purple-500/10'
                                        )}
                                      >
                                        {isLive ? (
                                          <Monitor className="h-4 w-4 text-blue-500" />
                                        ) : (
                                          <VideoIcon className="h-4 w-4 text-purple-500" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm leading-snug">
                                          {isLive ? 'Live Session' : 'Recorded Webinar'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                          {formatWebinarDate(webinar.unlock_at)}
                                        </p>
                                        {!unlocked && daysLeft > 0 && (
                                          <Badge className="mt-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] h-4 px-1.5 font-semibold">
                                            Unlocks in {daysLeft} days
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* View Calendar link */}
                            <div className="px-4 pb-3">
                              <button className="w-full flex items-center justify-center gap-2 text-xs text-primary font-semibold py-2 rounded-lg hover:bg-primary/5 transition-colors">
                                <ClipboardList className="h-3.5 w-3.5" />
                                View Calendar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progress summary card */}
                      {totalSessions > 0 && (
                        <div className="rounded-xl border border-border/60 bg-card shadow-sm p-4">
                          <h3 className="font-bold text-sm mb-3">Overall Progress</h3>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-2">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                              style={{ width: `${(completedSessions / totalSessions) * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{completedSessions} of {totalSessions} lessons done</span>
                            <span className="font-bold text-primary">
                              {Math.round((completedSessions / totalSessions) * 100)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* MCQ Practice Dialog */}
            <Dialog open={!!activeMcqSession} onOpenChange={open => { if (!open) setActiveMcqSession(null); }}>
              {activeMcqSession && (
                <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden sm:rounded-2xl border-none shadow-2xl">
                  <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <HelpCircle className="w-5 h-5" />
                      {activeMcqSession.title}
                    </h2>
                    <p className="text-primary-foreground/80 text-sm mt-1">Practice Questionnaire</p>
                  </div>
                  <div className="p-2 sm:p-6 bg-background">
                    <SessionMcqPractice
                      sessionTitle={activeMcqSession.title}
                      questions={activeMcqSession.questions || []}
                      onClose={() => setActiveMcqSession(null)}
                    />
                  </div>
                </DialogContent>
              )}
            </Dialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
