import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Video as VideoIcon,
  Calendar,
  Monitor,
  X,
  Search,
  Filter,
  Layers,
  GraduationCap,
  UserCircle2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { courseApi, Course, CourseMySummary } from '@/lib/course-api';
import { courseModuleApi, CourseWeek, ClassSession } from '@/lib/course-module-api';
import { batchContentApi } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SessionMcqPractice, McqPracticeQuestion } from '@/components/SessionMcqPractice';
import { WeeklyTestSubmission } from '@/components/WeeklyTestSubmission';
import { WeeklyTestResults } from '@/components/WeeklyTestResults';
import { WeeklyTest } from '@/components/WeeklyTestManager';

/** Human-readable label for submission/week status strings from the API. */
function formatStatusLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function Courses() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const batchIdFromUrl = searchParams.get('batch_id');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [summary, setSummary] = useState<CourseMySummary>({ active_count: 0, completed_count: 0 });
  const debouncedSearch = useDebounce(searchQuery, 500);
  const COURSE_PAGE_SIZE = 6;

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // State for active video playback
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [playingSession, setPlayingSession] = useState<{ weekId: number; sessionId: number } | null>(null);

  // State for MCQ practice
  const [activeMcqSession, setActiveMcqSession] = useState<{ title: string; questions: McqPracticeQuestion[] } | null>(null);

  // State for locally tracking viewed sessions in this component session
  const [viewedSessions, setViewedSessions] = useState<string[]>([]);

  // State for student test submission
  const [isTestSubmissionOpen, setIsTestSubmissionOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [activeTest, setActiveTest] = useState<WeeklyTest | null>(null);
  const [activeTestWeek, setActiveTestWeek] = useState<number | null>(null);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const load = async () => {
      setLoadingCourses(true);
      try {
        const params: Parameters<typeof courseApi.getCourses>[0] = {
          paginate: true,
          is_active: true,
          page: currentPage,
          page_size: COURSE_PAGE_SIZE,
        };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        if (statusFilter !== 'all') params.enrollment_status = statusFilter;
        const res = await courseApi.getCourses(params);
        const paginated = res as {
          success?: boolean;
          data?: Course[];
          total_pages?: number;
          current_page?: number;
          total_items?: number;
          page_size?: number;
        };
        const list = Array.isArray(paginated?.data) ? paginated.data : [];
        const totalPagesFromApi = paginated?.total_pages;
        const totalItems = paginated?.total_items;
        const pageSize = paginated?.page_size || COURSE_PAGE_SIZE;
        const computedTotalPages =
          totalPagesFromApi != null
            ? totalPagesFromApi
            : totalItems != null && pageSize > 0
              ? Math.max(1, Math.ceil(totalItems / pageSize))
              : 1;
        setCourses(list);
        setTotalPages(computedTotalPages);
      } catch {
        toast({ title: 'Error', description: 'Failed to load your courses', variant: 'destructive' });
        setCourses([]);
        setTotalPages(1);
      } finally {
        setLoadingCourses(false);
      }
    };
    load();
  }, [currentPage, debouncedSearch, statusFilter, toast]);

  // Fetch summary when on list view (no courseId)
  useEffect(() => {
    if (courseId) return;
    courseApi.getMySummary().then((res) => {
      if (res.success && res.data) setSummary(res.data);
    }).catch(() => {});
  }, [courseId]);

  const loadCourseContent = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setLoadingWeeks(true);
    setActiveVideoUrl(null);
    setExpandedWeeks(new Set());

    try {
      let res;
      if (course.batch_id) {
        res = await batchContentApi.getWeeks(course.batch_id);
      } else {
        res = await courseModuleApi.getWeeks(course.id.toString());
      }

      if (res.success) {
        setWeeks(res.data);
        if (res.data.length > 0) {
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
  }, [toast]);

  useEffect(() => {
    if (!loadingCourses) {
      if (courseId) {
        const course = courses.find(
          c => c.id.toString() === courseId &&
            (batchIdFromUrl == null || c.batch_id?.toString() === batchIdFromUrl)
        );
        if (course) {
          loadCourseContent(course);
        } else if (!selectedCourse) {
          const id = parseInt(courseId, 10);
          if (Number.isNaN(id)) {
            navigate('/courses', { replace: true });
            return;
          }
          const batchId = batchIdFromUrl ? parseInt(batchIdFromUrl, 10) : undefined;
          courseApi
            .getCourse(id, batchId ? { batch_id: batchId } : undefined)
            .then(res => {
              if (res.data) {
                loadCourseContent(res.data);
              } else {
                toast({
                  title: 'Course Not Found',
                  description: 'The requested course does not exist or you do not have access.',
                  variant: 'destructive',
                });
                navigate('/courses', { replace: true });
              }
            })
            .catch(() => {
              toast({
                title: 'Course Not Found',
                description: 'The requested course does not exist or you do not have access.',
                variant: 'destructive',
              });
              navigate('/courses', { replace: true });
            });
        }
      } else {
        setSelectedCourse(null);
        setWeeks([]);
        setActiveVideoUrl(null);
        setPlayingSession(null);
        setActiveMcqSession(null);
        setActiveWeekId(null);
        setExpandedWeeks(new Set());
      }
    }
  }, [courseId, batchIdFromUrl, courses, loadingCourses, loadCourseContent, navigate, toast, selectedCourse]);

  const handleSelectCourse = (course: Course) => {
    const query = course.batch_id != null ? `?batch_id=${course.batch_id}` : '';
    navigate(`/courses/${course.id}${query}`);
  };

  const handleBack = () => {
    navigate('/courses');
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
        const sessions: ClassSession[] = weeks[i].class_sessions || [];
        const incompleteSession = sessions.find((s) => !s.is_completed);
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
                class_sessions: w.class_sessions?.map((s: ClassSession) => {
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
        // Success feedback is implicitly handled by UI updates (checkmark/progress bar)
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update session progress', variant: 'destructive' });
    }
  };

  // ===================== Computed values (Sessions + Tests) =====================
  const totalSessions = weeks.reduce((acc, w) => {
    const sessionCount = w.class_sessions?.length || 0;
    const testCount = w.weekly_test ? 1 : 0;
    return acc + sessionCount + testCount;
  }, 0);

  /** Week-based progress from API (matches My Courses cards); not session-item counts. */
  const headerProgressPercent = Math.min(100, selectedCourse?.progress_percent ?? 0);

  /** Matches list card: completed batch → Review, not “Starts …” on calendar lock. */
  const isEnrollmentReviewLike =
    selectedCourse?.learning_status === 'review' ||
    selectedCourse?.batch_status === 'completed';

  const firstWeekLockInfo = weeks.length > 0 ? getWeekLockInfo(weeks[0]) : null;
  const isBatchNotStarted =
    !isEnrollmentReviewLike &&
    firstWeekLockInfo?.is_locked &&
    firstWeekLockInfo?.reason === 'date_locked';
  const batchUnlockDate = isBatchNotStarted && firstWeekLockInfo && 'unlock_date' in firstWeekLockInfo
    ? (firstWeekLockInfo as { unlock_date: string }).unlock_date
    : null;
  
  const isUpToDate = isEnrollmentReviewLike || headerProgressPercent >= 100;

  const formatSessionDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ===================== Render =====================
  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {!selectedCourse ? (
          // ===== COURSE LIST =====
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">My Courses</h1>
                <p className="mt-1 text-muted-foreground">Continue learning and tracking your subjects</p>
              </div>
              {loadingCourses && (
                <div className="flex items-center text-muted-foreground mt-1">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <BookOpen className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{summary.active_count}</p>
                      <p className="text-sm text-muted-foreground">Active Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{summary.completed_count}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info/10">
                      <LayoutGrid className="h-6 w-6 text-info" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {summary.active_count + summary.completed_count}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-[180px] shrink-0">
                <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'completed') => setStatusFilter(v)}>
                  <SelectTrigger className="border-primary text-primary">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Enrollments</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="completed">Completed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingCourses ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">
                  {searchQuery
                    ? `No courses matching "${searchQuery}"`
                    : statusFilter === 'active'
                    ? 'No active courses'
                    : statusFilter === 'completed'
                    ? 'No completed courses'
                    : 'You haven\'t been enrolled in any courses yet'}
                </h3>
                <p className="max-w-sm mx-auto">
                  {searchQuery
                    ? 'We couldn\'t find any courses matching your search. Try different keywords.'
                    : statusFilter === 'active'
                    ? "You don't have any active enrollments at the moment."
                    : statusFilter === 'completed'
                    ? "You don't have any completed courses yet."
                    : "Contact your admin to get enrolled in courses."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => {
                  const totalWeeks = typeof course.total_weeks === 'number' ? course.total_weeks : 0;
                  const progress = course.progress_percent ?? 0;
                  return (
                    <Card
                      key={course.id}
                      className="flex flex-col shadow-card hover:shadow-lg transition-all duration-300 cursor-pointer group"
                      onClick={() => handleSelectCourse(course)}
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted flex items-center justify-center">
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
                      </div>

                      <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-xl line-clamp-1 font-bold leading-snug flex-1 min-w-0" title={course.title}>
                            {course.title}
                          </h3>
                          {course.batch_status && (
                            <Badge
                              className={cn(
                                'shrink-0 px-2.5 py-0.5 text-xs font-medium tracking-normal normal-case border-none',
                                course.batch_status === 'active'
                                  ? 'bg-success text-white'
                                  : course.batch_status === 'completed'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-destructive text-destructive-foreground'
                              )}
                            >
                              {formatStatusLabel(String(course.batch_status))}
                            </Badge>
                          )}
                        </div>
                        {course.batch_name && (
                          <p className="text-base text-muted-foreground flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-primary/70 shrink-0" />
                            <span className="truncate font-medium">{course.batch_name}</span>
                          </p>
                        )}
                        {course.description && (
                          <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed" title={course.description}>
                            {course.description}
                          </p>
                        )}
                        {Array.isArray(course.tags) && course.tags.length > 0 && (
                          <div className="flex gap-2 flex-wrap max-h-16 overflow-hidden">
                            {course.tags.slice(0, 8).map((tag, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs capitalize"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                            {course.tags.length > 8 && (
                              <Badge variant="secondary" className="text-xs">
                                +{course.tags.length - 8}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="px-5 pt-1 pb-3">
                        <div className="bg-muted/30 border border-border/50 rounded-xl px-3 py-3">
                          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <BookOpen className="h-4 w-4 text-primary/70 shrink-0" />
                              <span className="capitalize truncate">{course.difficulty_level}</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar className="h-4 w-4 text-primary/70 shrink-0" />
                              <span className="truncate">
                                {totalWeeks} {totalWeeks === 1 ? 'Week' : 'Weeks'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 justify-end">
                              <Calendar className="h-4 w-4 text-primary/70 shrink-0" />
                              <span className="truncate">
                                {course.batch_start_date
                                  ? new Date(course.batch_start_date).toLocaleDateString('en-US', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-2">
                        <div className="flex items-center justify-between text-sm mb-2.5 mt-1">
                          <span className="font-medium text-muted-foreground">Progress</span>
                          <span className="font-bold text-foreground">{progress}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden mb-4">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <Button
                          variant={
                            course.learning_status === 'review'
                              ? 'outline'
                              : course.batch_content_starts_at
                                ? 'outline'
                                : 'gradient'
                          }
                          disabled={!!course.batch_content_starts_at}
                          className={cn(
                            'w-full font-bold h-10 transition-all duration-300 rounded-xl',
                            course.learning_status !== 'review' &&
                              !course.batch_content_starts_at &&
                              'shadow-md group-hover:shadow-lg',
                            /* Match outline “Review Course” vibrancy; native disabled applies opacity-50 */
                            !!course.batch_content_starts_at &&
                              'disabled:opacity-100 disabled:border-primary disabled:text-primary'
                          )}
                        >
                          <span className="flex items-center justify-center">
                            {course.learning_status === 'review' ? (
                              'Review Course'
                            ) : course.batch_content_starts_at ? (
                              <>
                                <Calendar className="h-4 w-4 mr-2 shrink-0" />
                                Starts{' '}
                                {new Date(course.batch_content_starts_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </>
                            ) : course.learning_status === 'continue_learning' ? (
                              <>
                                Continue Learning
                                <Play className="h-4 w-4 ml-2 fill-current opacity-80" />
                              </>
                            ) : (
                              <>
                                Start Learning
                                <Play className="h-4 w-4 ml-2 fill-current opacity-80" />
                              </>
                            )}
                          </span>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {!loadingCourses && courses.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(1, p - 1)); }}
                  disabled={loadingCourses || currentPage <= 1}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium text-muted-foreground px-4">
                  Page {currentPage} of {Math.max(1, totalPages)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1)); }}
                  disabled={loadingCourses || currentPage >= Math.max(1, totalPages)}
                >
                  Next
                </Button>
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

            {/* ===== HEADER BANNER WITH OVERALL PROGRESS ===== */}
            <div className="rounded-2xl overflow-hidden gradient-primary text-primary-foreground p-5 md:p-8 relative shadow-card border border-primary/20">
              {/* Decorative gradients */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
              </div>

              <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 md:gap-8">
                {/* Left: Course info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight leading-snug">
                    {selectedCourse.title}
                  </h1>
                  
                  {selectedCourse.batch_name && (
                    <p className="mt-2 text-primary-foreground/80 text-xs md:text-sm font-medium flex items-center gap-2">
                       <Users className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                       <span className="truncate">Batch: {selectedCourse.batch_name}</span>
                    </p>
                  )}

                  {(selectedCourse.batch_teacher_name ||
                    (Array.isArray(selectedCourse.batch_co_teacher_names) &&
                      selectedCourse.batch_co_teacher_names.length > 0)) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-primary-foreground/85">
                      {selectedCourse.batch_teacher_name && (
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <GraduationCap className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 opacity-90" />
                          <span className="min-w-0">
                            <span className="font-semibold text-primary-foreground/70">Teacher: </span>
                            {selectedCourse.batch_teacher_name}
                          </span>
                        </span>
                      )}
                      {Array.isArray(selectedCourse.batch_co_teacher_names) &&
                        selectedCourse.batch_co_teacher_names.length > 0 && (
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <UserCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 opacity-90" />
                            <span className="min-w-0 break-words">
                              <span className="font-semibold text-primary-foreground/70">
                                Co-teacher{selectedCourse.batch_co_teacher_names.length !== 1 ? 's' : ''}:{' '}
                              </span>
                              {selectedCourse.batch_co_teacher_names.join(', ')}
                            </span>
                          </span>
                        )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 md:gap-5 mt-4 md:mt-5">
                    <div className="flex items-center gap-1.5 md:gap-2 bg-white/10 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/10 text-xs md:text-sm font-medium shadow-sm">
                      <LayoutGrid className="h-3.5 w-3.5 md:h-4 md:h-4" />
                      <span>{weeks.length} Week{weeks.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 bg-white/10 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/10 text-xs md:text-sm font-medium shadow-sm">
                      <Video className="h-3.5 w-3.5 md:h-4 md:h-4" />
                      <span>{totalSessions} Session{totalSessions !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                  <div className="w-full lg:w-80 shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold tracking-tight text-primary-foreground/70">Overall Progress</span>
                    <span className="text-lg md:text-xl font-black text-primary-foreground">{Math.round(headerProgressPercent)}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                      style={{ width: `${headerProgressPercent}%` }}
                    />
                  </div>
                  <Button
                    onClick={handleStartLearning}
                    disabled={isBatchNotStarted}
                    variant={isBatchNotStarted ? 'hero-outline' : 'gradient'}
                    className={cn(
                      "w-full mt-4 md:mt-6 font-black h-10 md:h-11 rounded-xl shadow-lg transition-all text-xs md:text-sm"
                    )}
                  >
                    {isBatchNotStarted ? (
                      <>
                        <Calendar className="w-3.5 h-3.5 mr-2" />
                        Starts {new Date(batchUnlockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </>
                    ) : isUpToDate ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                        Review Course
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-2 fill-current" />
                        {selectedCourse.learning_status === 'continue_learning'
                          ? 'Continue Learning'
                          : 'Start Learning'}
                      </>
                    )}
                  </Button>
                </div>
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
              <Card className="overflow-hidden border-border/60 shadow-card">
                <CardHeader className="flex flex-col gap-1 space-y-0 border-b border-border/50 bg-muted/25 px-5 py-4 md:px-6 md:py-5">
                  <CardTitle className="text-lg font-bold tracking-tight md:text-xl">
                    Course weeks
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    Expand a week to view lessons and weekly assessments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 p-3 md:space-y-3 md:p-4">
                  {weeks.map(week => {
                    const lockInfo = getWeekLockInfo(week);
                    const locked = lockInfo.is_locked;
                    /** Batch/calendar not open yet — instructor may still add content. */
                    const isCalendarLocked = locked && lockInfo.reason === 'date_locked';
                    const isExpanded = expandedWeeks.has(week.id);
                    const baseSessions: ClassSession[] = week.class_sessions || [];
                    const weekdayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                    const sessions = [...baseSessions].sort((a, b) => {
                      const dayA = a.weekday?.toLowerCase() || '';
                      const dayB = b.weekday?.toLowerCase() || '';
                      const indexA = weekdayOrder.indexOf(dayA);
                      const indexB = weekdayOrder.indexOf(dayB);
                      
                      if (indexA !== indexB) {
                        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
                      }
                      return (a.session_number || 0) - (b.session_number || 0);
                    });
                    
                    const completedCount = sessions.filter((s: ClassSession) => s.is_completed).length;
                    const allDone = sessions.length > 0 && completedCount === sessions.length;
                    const progressPct = sessions.length > 0 ? (completedCount / sessions.length) * 100 : 0;
                    const weeklyTestWithPass = week.weekly_test as { is_passed?: boolean } | null | undefined;
                    const isPass = weeklyTestWithPass?.is_passed;

                    return (
                      <div
                        key={week.id}
                        className="overflow-hidden rounded-xl border border-border/50 bg-[hsl(var(--muted)_/_0.4)] shadow-none"
                      >
                        {/* Week Header */}
                        <button
                          className={cn(
                            'w-full text-left px-5 py-4 flex items-center gap-3 transition-colors',
                            locked ? 'opacity-90' : 'hover:bg-[hsl(var(--muted)_/_0.55)]',
                            isExpanded ? 'bg-[hsl(var(--muted)_/_0.5)]' : ''
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
                            {locked ? <Lock className="h-3.5 w-3.5" /> : allDone ? <Award className="h-4 w-4" /> : week.week_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-base text-foreground">
                                Week {week.week_number}
                                {week.title && week.title !== `Week ${week.week_number}` && (
                                  <span className="text-muted-foreground font-medium ml-1">– {week.title}</span>
                                )}
                              </h3>
                              {locked && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] h-5 px-2">
                                  <Lock className="w-2.5 h-2.5 mr-1" /> Locked
                                </Badge>
                              )}
                              {allDone && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5 px-2 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                  Completed
                                </Badge>
                              )}
                            </div>
                            {sessions.length > 0 && !locked && (
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
                                  {completedCount} / {sessions.length} lessons complete
                                </span>
                              </div>
                            )}
                            {locked && (
                              <p className="mt-0.5 text-xs text-muted-foreground font-medium leading-snug">
                                {lockInfo.reason === 'date_locked'
                                  ? (() => {
                                      const unlockDate = (lockInfo as { unlock_date?: string }).unlock_date;
                                      return unlockDate
                                        ? `Unlocks ${new Date(unlockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        : 'Locked';
                                    })()
                                  : lockInfo.reason === 'previous_test_not_passed'
                                    ? 'Pass previous assessment to unlock'
                                    : 'Locked'}
                              </p>
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
                                {sessions.map((session: ClassSession) => {
                                  const isPlaying =
                                    playingSession?.weekId === week.id && playingSession?.sessionId === session.id;
                                  const completed = session.is_completed;
                                  const sessionDescription = session.description?.trim() ?? '';

                                  return (
                                    <div
                                      key={session.id}
                                      className={cn(
                                        'flex flex-col sm:flex-row items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 transition-all group',
                                        locked
                                          ? 'opacity-60 cursor-not-allowed'
                                          : completed
                                          ? 'cursor-pointer hover:bg-emerald-500/5 bg-emerald-500/[0.02]'
                                          : 'cursor-pointer hover:bg-muted/20'
                                      )}
                                      onClick={() => !locked && handlePlaySession(week.id, session)}
                                    >
                                      {/* Play Button and Title Row for Mobile */}
                                      <div className="flex items-center w-full sm:w-auto gap-4">
                                        <div
                                          className={cn(
                                            'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-200',
                                            locked
                                              ? 'border-muted-foreground/30 bg-muted text-muted-foreground opacity-50'
                                              : isPlaying
                                              ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                                              : completed
                                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                              : 'border-primary/20 bg-primary/5 text-primary group-hover:bg-primary/10 group-hover:border-primary/40'
                                          )}
                                        >
                                          {locked ? (
                                            <Lock className="h-4 w-4" />
                                          ) : isPlaying ? (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                                          ) : (
                                            <Play className="h-4 w-4 fill-current ml-0.5" />
                                          )}
                                        </div>

                                        <div className="flex-1 min-w-0 sm:hidden">
                                           <h4 className={cn('font-bold text-sm leading-snug truncate', completed ? 'text-muted-foreground' : 'text-foreground')}>
                                              {session.title}
                                           </h4>
                                           {sessionDescription ? (
                                             <p
                                               className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2"
                                               title={sessionDescription.length > 120 ? sessionDescription : undefined}
                                             >
                                               {sessionDescription}
                                             </p>
                                           ) : null}
                                           <div className="flex items-center gap-2 mt-1.5">
                                             <span className="text-[9px] font-semibold capitalize text-primary/70">{session.weekday || 'Session'}</span>
                                             {completed && (
                                               <span className="inline-flex items-center h-5 shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 text-[10px] font-semibold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                 Watched
                                               </span>
                                             )}
                                           </div>
                                        </div>
                                      </div>

                                      {/* Info - Desktop Content */}
                                      <div className="hidden sm:block flex-1 min-w-0">
                                        <h4
                                          className={cn(
                                            'font-bold text-sm leading-snug line-clamp-1',
                                            completed ? 'text-muted-foreground' : 'text-foreground'
                                          )}
                                        >
                                          {session.title}
                                        </h4>
                                        {sessionDescription ? (
                                          <p
                                            className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2 max-w-3xl"
                                            title={sessionDescription.length > 160 ? sessionDescription : undefined}
                                          >
                                            {sessionDescription}
                                          </p>
                                        ) : null}
                                        {(session.duration_seconds > 0 || session.weekday || completed) && (
                                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            {session.weekday ? (
                                              <span className="flex items-center gap-1.5 capitalize text-[10px] font-medium">
                                                <Calendar className="h-3 w-3 shrink-0 text-primary/60" />
                                                {session.weekday}
                                              </span>
                                            ) : null}
                                            {session.duration_seconds > 0 ? (
                                              <span className="flex items-center gap-1.5 text-[10px] font-medium">
                                                <Clock className="h-3 w-3 shrink-0 text-primary/60" />
                                                {formatSessionDuration(session.duration_seconds)}
                                              </span>
                                            ) : null}
                                            {completed ? (
                                              <span className="inline-flex items-center h-5 shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 text-[10px] font-semibold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                Watched
                                              </span>
                                            ) : null}
                                          </p>
                                        )}
                                      </div>

                                      {/* Right: MCQ Button */}
                                      <div className="flex items-center justify-end w-full sm:w-auto shrink-0 py-1 sm:py-0 sm:px-2">
                                        {session.has_mcq && (
                                          <Button
                                            size="sm"
                                            variant={locked || !completed ? 'secondary' : 'gradient'}
                                            disabled={locked || !completed}
                                            title={
                                              locked
                                                ? 'This week is locked'
                                                : !completed
                                                  ? 'Finish this lesson (mark complete) to unlock practice questions'
                                                  : undefined
                                            }
                                            className={cn(
                                              'h-8 sm:h-9 px-6 sm:px-4 text-xs w-full sm:w-auto font-black rounded-full transition-all',
                                              locked || !completed
                                                ? 'border border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed hover:!scale-100 hover:!shadow-none'
                                                : 'border-0 shadow-sm'
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (session.mcq_questions?.length > 0) {
                                                setActiveMcqSession({
                                                  title: session.title,
                                                  questions: session.mcq_questions,
                                                });
                                              }
                                            }}
                                          >
                                            {completed ? (
                                              'Practice MCQs'
                                            ) : (
                                              <span className="inline-flex items-center gap-1.5">
                                                <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                                Locked
                                              </span>
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Weekly Test Banner */}
                            <div className="p-4 pt-1">
                              {week.weekly_test ? (
                                <div
                                  className={cn(
                                    'flex items-center justify-between rounded-xl px-5 py-4 border transition-all',
                                    locked
                                      ? 'bg-muted/30 border-border/50 opacity-70'
                                      : 'bg-card border-border/50 hover:bg-muted/30'
                                  )}
                                >
                                  <div className="flex items-center gap-4">
                                    <div
                                      className={cn(
                                        'w-10 h-10 rounded-xl flex items-center justify-center shadow-sm',
                                        locked ? 'bg-muted' : 'bg-primary/20 text-primary'
                                      )}
                                    >
                                      {locked ? (
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                      ) : isPass ? (
                                        <Award className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                                      ) : (
                                        <FlaskConical className="h-5 w-5" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm text-foreground flex items-center gap-2">
                                        {week.weekly_test.title || 'Weekly Assessment'}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                        {locked
                                          ? lockInfo.reason === 'date_locked'
                                            ? (() => {
                                                const unlockDate = (lockInfo as { unlock_date?: string }).unlock_date;
                                                return unlockDate
                                                  ? `Unlocks ${new Date(unlockDate).toLocaleDateString('en-US', {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      year: 'numeric',
                                                    })}`
                                                  : 'Unlocks soon';
                                              })()
                                            : 'Pass previous assessment to unlock'
                                          : "Test your understanding of this week's lessons"}
                                        {isPass ? (
                                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5 px-2 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                            Passed
                                          </Badge>
                                        ) : (() => {
                                          const weeklyTest = week.weekly_test as
                                            | { latest_submission?: { status: string; marks_obtained?: number } }
                                            | null
                                            | undefined;
                                          const latest = weeklyTest?.latest_submission;
                                          if (!latest) return null;
                                          if (latest.status === 'published' && !isPass) {
                                            return (
                                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] h-5 px-2 font-semibold shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                                                Failed
                                              </Badge>
                                            );
                                          }
                                          if (latest.status !== 'published') {
                                            return (
                                              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] h-5 px-2 font-semibold shadow-[0_0_10px_rgba(59,130,246,0.05)]">
                                                {formatStatusLabel(latest.status)}
                                              </Badge>
                                            );
                                          }
                                          return null;
                                        })()}
                                        
                                        {(() => {
                                          const weeklyTest = week.weekly_test as
                                            | { latest_submission?: { status: string; marks_obtained?: number } }
                                            | null
                                            | undefined;
                                          const latest = weeklyTest?.latest_submission;
                                          if (latest?.status === 'published' && typeof latest.marks_obtained === 'number') {
                                            return (
                                              <span className="text-[10px] font-bold text-foreground">
                                                Score: {latest.marks_obtained}%
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const weeklyTest = week.weekly_test as (WeeklyTest & {
                                        has_attempted?: boolean;
                                        latest_submission?: { status: string };
                                      }) | null | undefined;
                                      if (!weeklyTest?.has_attempted || weeklyTest.latest_submission?.status !== 'published') {
                                        return null;
                                      }
                                      return (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="font-bold rounded-full h-9 px-4 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTest(weeklyTest);
                                            setActiveTestWeek(week.id);
                                            setIsResultsOpen(true);
                                          }}
                                        >
                                          View Results
                                        </Button>
                                      );
                                    })()}
                                    {!isPass &&
                                      (() => {
                                        const weeklyTest = week.weekly_test as (WeeklyTest & {
                                          has_attempted?: boolean;
                                          latest_submission?: { status: string };
                                        }) | null | undefined;
                                        const allSessionsCompleted = sessions.every((s: ClassSession) => s.is_completed);
                                        const hasAttempted = !!weeklyTest?.has_attempted;
                                        const latestStatus = weeklyTest?.latest_submission?.status;
                                        const disabled = locked || (!allSessionsCompleted && !hasAttempted);

                                        const label = locked
                                          ? 'Locked'
                                          : hasAttempted
                                            ? isPass
                                              ? 'Passed'
                                              : latestStatus === 'published'
                                                ? 'Retake Test'
                                                : 'View Submission'
                                            : !allSessionsCompleted
                                              ? 'Complete Lessons'
                                              : 'Take Test';

                                        return (
                                          <Button
                                            size="sm"
                                            variant={disabled ? 'secondary' : 'gradient'}
                                            disabled={disabled}
                                            title={locked ? 'This week is locked' : undefined}
                                            className={cn(
                                              'font-bold rounded-full h-9 px-6 text-xs transition-all',
                                              disabled
                                                ? 'border border-border bg-muted text-muted-foreground cursor-not-allowed hover:!scale-100 hover:!shadow-none'
                                                : 'border-0 shadow-md',
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!weeklyTest) return;
                                              setActiveTest(weeklyTest);
                                              setActiveTestWeek(week.id);
                                              if (hasAttempted) {
                                                if (!isPass && latestStatus === 'published') {
                                                  setIsTestSubmissionOpen(true);
                                                } else {
                                                  setIsResultsOpen(true);
                                                }
                                              } else {
                                                setIsTestSubmissionOpen(true);
                                              }
                                            }}
                                          >
                                            {locked ? (
                                              <span className="inline-flex items-center gap-1.5">
                                                <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                                Locked
                                              </span>
                                            ) : (
                                              label
                                            )}
                                          </Button>
                                        );
                                      })()}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-[hsl(var(--muted)_/_0.3)] px-5 py-5 sm:flex-row sm:items-center sm:gap-4">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/40 text-primary/85 shadow-sm">
                                    <FlaskConical className="h-5 w-5" aria-hidden />
                                  </div>
                                  <div className="min-w-0 text-left">
                                    <p className="text-sm font-semibold text-foreground">No weekly assessment</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                      {isCalendarLocked
                                        ? "This week hasn't opened on the calendar yet. Your instructor may still add a weekly assessment before it unlocks."
                                        : locked
                                          ? 'No weekly assessment is listed for this week.'
                                          : "This week doesn't include a scheduled test — continue with your lessons."}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* MCQ Practice Dialog */}
            <Dialog open={!!activeMcqSession} onOpenChange={open => { if (!open) setActiveMcqSession(null); }}>
              {activeMcqSession && (
                <DialogContent className="max-w-2xl w-[95vw] overflow-hidden border border-primary/25 bg-background p-0 shadow-2xl sm:rounded-[26px] [&>button]:right-4 [&>button]:top-4 [&>button]:z-[60] [&>button]:text-primary-foreground [&>button]:opacity-90 [&>button]:ring-offset-transparent [&>button]:hover:bg-white/10 [&>button]:hover:text-primary-foreground [&>button]:hover:opacity-100 data-[state=open]:[&>button]:bg-transparent data-[state=open]:[&>button]:text-primary-foreground">
                  <div className="relative overflow-hidden border-b border-white/10 gradient-primary p-6 text-primary-foreground">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                      <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
                    </div>
                    <div className="relative flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-primary-foreground shadow-sm backdrop-blur-md">
                        <Video className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight text-primary-foreground">
                          {activeMcqSession.title}
                        </h2>
                        <p className="text-xs font-medium text-primary-foreground/75">Practice Quiz</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-background px-5 pb-5 pt-2">
                    <SessionMcqPractice
                      sessionTitle={activeMcqSession.title}
                      questions={activeMcqSession.questions || []}
                      onClose={() => setActiveMcqSession(null)}
                    />
                  </div>
                </DialogContent>
              )}
            </Dialog>

            {/* Student Weekly Test Submission */}
            {activeTest && selectedCourse?.batch_id && activeTestWeek && (
              <WeeklyTestSubmission
                open={isTestSubmissionOpen}
                onClose={() => {
                  setIsTestSubmissionOpen(false);
                  setActiveTest(null);
                  setActiveTestWeek(null);
                }}
                test={activeTest}
                batchId={selectedCourse.batch_id}
                weekId={activeTestWeek}
                onSubmitted={() => {
                  if (selectedCourse) loadCourseContent(selectedCourse);
                }}
              />
            )}

            {/* Student Weekly Test Results */}
            {(() => {
              type TestWithSubmission = WeeklyTest & { latest_submission?: { status: string } };
              const testWithSubmission = activeTest as TestWithSubmission | null;
              if (!testWithSubmission?.latest_submission) return null;
              return (
                <WeeklyTestResults
                  open={isResultsOpen}
                  onClose={() => {
                    setIsResultsOpen(false);
                    setActiveTest(null);
                    setActiveTestWeek(null);
                  }}
                  submission={testWithSubmission.latest_submission}
                  testTitle={testWithSubmission.title}
                />
              );
            })()}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
