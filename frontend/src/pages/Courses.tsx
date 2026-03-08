import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Users
} from 'lucide-react';
import { courseApi, Course } from '@/lib/course-api';
import { CourseWeek, ClassSession, courseModuleApi } from '@/lib/course-module-api';
import { batchContentApi } from '@/lib/batch-api';
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
  const [activeTab, setActiveTab] = useState<string>('');
  
  // State for active video playback
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [playingSession, setPlayingSession] = useState<{weekId: number, sessionId: number} | null>(null);

  // State for MCQ practice
  const [activeMcqSession, setActiveMcqSession] = useState<{title: string, questions: any[]} | null>(null);

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

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setLoadingWeeks(true);
    setActiveVideoUrl(null);
    try {
      let res;
      // If user is a student and belongs to a batch for this course, use batch content API
      if (course.batch_id) {
        res = await batchContentApi.getWeeks(course.batch_id);
      } else {
        res = await courseModuleApi.getWeeks(course.id.toString());
      }
      
      if (res.success) {
        setWeeks(res.data);
        if (res.data.length > 0) {
          setActiveTab(res.data[0].id.toString());
        } else {
          setActiveTab('');
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
  };

  const handlePlaySession = (weekId: number, session: ClassSession) => {
    if (session.video_presigned_url || session.video_url) {
      const url = session.video_presigned_url || session.video_url;
      if (url) {
        setActiveVideoUrl(url);
        setPlayingSession({ weekId, sessionId: session.id });
        // Optimistically mark as viewed
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
      // Find the current session status
      const week = weeks.find(w => w.id === playingSession.weekId);
      const session = week?.class_sessions?.find(s => s.id === playingSession.sessionId);
      
      // Only mark as completed if not already completed
      if (session && !session.is_completed) {
        toggleSessionCompletion(playingSession.weekId, playingSession.sessionId, false);
      }
    }
  };

  // Determine if a week is locked based on student_lock_status from backend
  const getWeekLockInfo = (week: CourseWeek) => {
    // If it's a regular course week (not batch), it's never locked for now
    if (!selectedCourse?.batch_id || !week.student_lock_status) {
      return { is_locked: false, reason: null };
    }
    return week.student_lock_status;
  };

  const handleStartLearning = () => {
    if (weeks.length === 0) return;

    // Find first unlocked week
    for (let i = 0; i < weeks.length; i++) {
      const lockInfo = getWeekLockInfo(weeks[i]);
      if (!lockInfo.is_locked) {
        // Find first incomplete session in this week
        const sessions = weeks[i].class_sessions || [];
        const incompleteSession = sessions.find(s => !s.is_completed);
        
        if (incompleteSession) {
          setActiveTab(weeks[i].id.toString());
          handlePlaySession(weeks[i].id, incompleteSession);
          return;
        }
        
        // If all sessions in this week are complete, check if there's a next unlocked week
        continue;
      } else {
        // Week is locked, we can't go further
        break;
      }
    }

    // If all unlocked sessions are complete, just open the first week
    setActiveTab(weeks[0].id.toString());
  };

  const toggleSessionCompletion = async (weekId: number, sessionId: number, currentlyCompleted: boolean) => {
    if (!selectedCourse?.batch_id) return;
    
    try {
      const res = await batchContentApi.completeSession(selectedCourse.batch_id, weekId, sessionId, !currentlyCompleted);
      if (res.success) {
        // Update local state
        setWeeks(prevWeeks => prevWeeks.map(w => {
          if (w.id === weekId) {
            return {
              ...w,
              class_sessions: w.class_sessions?.map(s => {
                if (s.id === sessionId) {
                  return { ...s, is_completed: res.data.is_completed };
                }
                return s;
              })
            };
          }
          return w;
        }));
        
        toast({ 
          title: res.data.is_completed ? 'Session Completed' : 'Session Marked Incomplete',
          description: res.data.is_completed ? 'Great job! Keep going.' : 'Status updated.',
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update session progress', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {!selectedCourse ? (
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
                {courses.map((course) => (
                  <Card key={course.id} className="flex flex-col shadow-card hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={() => handleSelectCourse(course)}>
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
                          <Badge variant="outline" className={cn(
                            "backdrop-blur-md font-bold border-none text-[10px] uppercase tracking-wider px-2 h-5 flex items-center shadow-lg",
                            course.batch_status === 'active' ? "bg-success/90 text-white" : 
                            course.batch_status === 'completed' ? "bg-primary/90 text-white" :
                            "bg-destructive/90 text-white"
                          )}>
                            {course.batch_status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardHeader className="flex-1 pb-2 pt-4 px-5">
                      {course.batch_name ? (
                        <div className="flex items-center gap-1.5 text-primary mb-1">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold uppercase tracking-tight">{course.batch_name}</span>
                        </div>
                      ) : (
                        <div className="h-4" />
                      )}
                      <CardTitle className="text-lg line-clamp-1 font-bold leading-tight" title={course.title}>
                        {course.title}
                      </CardTitle>
                      {course.description && (
                        <CardDescription className="mt-1.5 line-clamp-2 text-xs leading-relaxed" title={course.description}>
                          {course.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0 px-5 pb-5">
                      <div className="flex gap-2 flex-wrap mb-2 max-h-16 overflow-hidden">
                        {course.tags.slice(0, 8).map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs capitalize">
                            {tag.name}
                          </Badge>
                        ))}
                        {course.tags.length > 8 && (
                          <Badge variant="secondary" className="text-xs">+{course.tags.length - 8}</Badge>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/40 mt-auto">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-3 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Courses
              </Button>
            </div>
            
            {/* Active Video Player Popup */}
            <Dialog 
              open={!!activeVideoUrl} 
              onOpenChange={(open) => {
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

            {/* Course Overview Header */}
            <Card className="shadow-card gradient-primary text-primary-foreground overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{selectedCourse.title}</h2>
                    {selectedCourse.batch_name && (
                       <p className="inline-block px-3 py-1 font-medium bg-black/20 rounded-md text-primary-foreground/90 mt-2 text-sm border border-white/10 backdrop-blur-sm">
                          Enrolled in: {selectedCourse.batch_name}
                       </p>
                    )}
                    <p className="text-primary-foreground/90 mt-3 max-w-3xl line-clamp-3 text-base leading-relaxed">
                      {selectedCourse.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-6">
                      <div className="flex items-center gap-2 bg-black/10 px-4 py-2 rounded-full border border-white/10 shadow-sm backdrop-blur-md">
                        <BookOpen className="h-4 w-4" />
                        <span className="text-sm font-medium">{weeks.length} Week{weeks.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-black/10 px-4 py-2 rounded-full border border-white/10 shadow-sm backdrop-blur-md">
                        <Video className="h-4 w-4" />
                        <span className="text-sm font-medium">
                           {weeks.reduce((acc, w) => acc + (w.class_sessions?.length || 0), 0)} Sessions
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-3">
                    <Button 
                      onClick={handleStartLearning}
                      className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold px-8 h-12 rounded-full shadow-lg shadow-black/20"
                    >
                      <Play className="w-5 h-5 mr-2 fill-primary" />
                      {weeks.some(w => w.class_sessions?.some(s => s.is_completed)) ? 'Continue Learning' : 'Start Learning'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
              <Tabs value={activeTab} onValueChange={(val) => {
                 // Do not allow viewing tab if locked
                 const week = weeks.find(w => w.id.toString() === val);
                 if (week && getWeekLockInfo(week).is_locked) {
                    const lockInfo = getWeekLockInfo(week);
                    let msg = 'Complete previous weeks first.';
                    if (lockInfo.reason === 'date_locked') msg = `This week unlocks on ${new Date(lockInfo.unlock_date!).toLocaleDateString()}.`;
                    if (lockInfo.reason === 'previous_test_not_passed') msg = 'Pass the previous week\'s assessment first.';
                    
                    toast({ title: 'Week Locked', description: msg, variant: 'destructive' });
                    return;
                 }
                 setActiveTab(val);
              }} className="w-full overflow-hidden">
                <TabsList className="flex w-full bg-transparent h-auto p-0 flex-nowrap justify-start overflow-x-auto overflow-y-hidden scrollbar-hide gap-3 pb-2">
                  {weeks.map((week) => {
                    const lockInfo = getWeekLockInfo(week);
                    const locked = lockInfo.is_locked;
                    return (
                        <TabsTrigger
                          key={week.id}
                          value={week.id.toString()}
                          disabled={locked}
                          className={cn(
                            "px-6 py-2.5 shrink-0 rounded-full transition-all border border-border/50 text-sm font-medium",
                            "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary data-[state=active]:shadow-lg shadow-primary/20",
                            "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                            locked && "opacity-50 cursor-not-allowed grayscale"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {locked ? <Lock className="h-3 w-3" /> : null}
                            <span>Week {week.week_number}</span>
                            {week.class_sessions?.every(s => s.is_completed) && week.class_sessions.length > 0 && (
                              <CheckCircle2 className={cn("h-3.5 w-3.5", activeTab === week.id.toString() ? "text-white" : "text-green-500")} />
                            )}
                          </div>
                        </TabsTrigger>
                    );
                  })}
                </TabsList>

                {weeks.map((week) => {
                  const lockInfo = getWeekLockInfo(week);
                  const locked = lockInfo.is_locked;
                  return (
                  <TabsContent key={week.id} value={week.id.toString()} className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="shadow-card mb-8 border-none ring-1 ring-border/50">
                      <CardHeader className="pb-5 border-b border-border/40 bg-muted/10 rounded-t-xl">
                        <div className="flex flex-col gap-2">
                          <CardTitle className="text-2xl font-bold">{week.title}</CardTitle>
                          {week.description && <CardDescription className="text-base leading-relaxed">{week.description}</CardDescription>}
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                         {(!week.class_sessions || week.class_sessions.length === 0) ? (
                            <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-muted">
                              <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                              <p className="font-medium">No video sessions published for this week.</p>
                            </div>
                         ) : (
                          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {week.class_sessions.map((session) => {
                              const isViewed = viewedSessions.includes(session.id.toString());
                              const isActive = (session.video_presigned_url || session.video_url) === activeVideoUrl;
                              
                              return (
                              <div
                                key={session.id}
                                onClick={() => !locked && handlePlaySession(week.id, session)}
                                className={`group relative rounded-xl overflow-hidden border bg-card transition-all flex flex-col duration-300 transform ${isActive ? 'ring-2 ring-primary border-transparent scale-[1.02] shadow-xl' : locked ? 'border-border/40 opacity-70 cursor-not-allowed grayscale-[20%]' : 'border-border/60 shadow-sm hover:shadow-lg hover:border-primary/40 hover:-translate-y-1 cursor-pointer'}`}
                              >
                                <div className="aspect-video relative bg-muted flex items-center justify-center overflow-hidden">
                                  {session.thumbnail ? (
                                    <img
                                      src={session.thumbnail}
                                      alt={session.title}
                                      className={`w-full h-full object-cover transition-transform duration-500 ${!locked ? 'group-hover:scale-105' : ''}`}
                                    />
                                  ) : (
                                    <Video className="h-8 w-8 text-muted-foreground/40" />
                                  )}
                                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 ${locked ? 'from-black/90 opacity-100' : ''}`} />
                                  
                                  {/* Overlay Lock or Play */}
                                  <div className={`absolute inset-0 flex items-center justify-center transition-all ${locked ? 'bg-black/40' : isActive ? 'bg-primary/20 backdrop-blur-[2px]' : 'bg-black/0 group-hover:bg-black/20'} z-10`}>
                                     {locked ? (
                                        <div className="bg-background text-muted-foreground rounded-full p-4 shadow-xl border border-border/50">
                                           <Lock className="h-6 w-6" />
                                        </div>
                                     ) : isActive ? (
                                        <div className="text-white bg-primary shadow-lg shadow-primary/30 px-3 py-1.5 rounded-full font-semibold text-sm animate-pulse border border-white/20 flex items-center gap-2">
                                           <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                                           Playing Now
                                        </div>
                                     ) : (
                                        <div className="bg-primary text-primary-foreground rounded-full p-4 shadow-xl transform scale-90 group-hover:scale-100 transition-all duration-300 shadow-primary/30">
                                          <Play className="h-6 w-6 ml-1 fill-primary-foreground" />
                                        </div>
                                     )}
                                  </div>

                                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end z-20">
                                    {/* Duration on the left */}
                                    {(session.duration_seconds || session.duration_seconds === 0) && (
                                       <div className="flex items-center gap-1 text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded backdrop-blur-md border border-white/10 shadow-lg">
                                         <Clock className="h-3 w-3" />
                                         <span>{Math.floor(session.duration_seconds / 60)}:{(session.duration_seconds % 60).toString().padStart(2, '0')}</span>
                                       </div>
                                    )}

                                    {/* Labels on the right */}
                                    <div className="flex flex-col items-end gap-1.5">
                                      {session.weekday && (
                                        <Badge variant="outline" className="bg-background/90 backdrop-blur-md shadow-sm border-primary/20 capitalize font-bold text-[10px] h-5 px-2">
                                          {session.weekday}
                                        </Badge>
                                      )}
                                      {session.is_completed && !locked ? (
                                        <Badge 
                                          variant="secondary" 
                                          className="bg-success/20 text-success border border-success/30 backdrop-blur-md font-bold text-[10px] h-5 px-2 shadow-sm cursor-pointer hover:bg-success/30"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSessionCompletion(week.id, session.id, true);
                                          }}
                                        >
                                          <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> COMPLETED</span>
                                        </Badge>
                                      ) : !locked && (
                                        <Badge 
                                          variant="outline" 
                                          className="bg-background/90 text-muted-foreground border-border backdrop-blur-md font-bold text-[10px] h-5 px-2 shadow-sm cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSessionCompletion(week.id, session.id, false);
                                          }}
                                        >
                                          MARK COMPLETE
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className={`p-4 flex-1 flex flex-col bg-card relative z-20 ${isActive ? 'bg-primary/5' : ''}`}>
                                  <div className="flex justify-between items-start mb-1.5">
                                    <h4 className={`font-semibold text-foreground line-clamp-1 text-base transition-colors ${isActive ? 'text-primary' : !locked ? 'group-hover:text-primary' : ''}`} title={session.title}>
                                      {session.title}
                                    </h4>
                                    {session.has_mcq && !locked && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-primary/5 text-primary border-primary/20">
                                        MCQ
                                      </Badge>
                                    )}
                                  </div>
                                  {session.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-auto leading-relaxed" title={session.description}>
                                      {session.description}
                                    </p>
                                  )}
                                  
                                  {session.has_mcq && !locked && (
                                    <div className="mt-3 pt-3 border-t border-border/40 flex gap-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 text-xs flex-1 border-primary/20 hover:bg-primary/5 hover:text-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (session.mcq_questions && session.mcq_questions.length > 0) {
                                            setActiveMcqSession({
                                              title: session.title,
                                              questions: session.mcq_questions
                                            });
                                          } else {
                                            toast({ title: 'Not Available', description: 'No practice questions for this session yet.', variant: 'destructive' });
                                          }
                                        }}
                                      >
                                        <HelpCircle className="w-3 h-3 mr-1.5 opacity-70" />
                                        Practice MCQs
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )})}
                          </div>
                         )}
                      </CardContent>
                    </Card>

                    {/* Weekly Assessment */}
                    {week.weekly_test ? (
                      <Card className={`shadow-lg border-primary/20 ${locked ? 'bg-muted/50 grayscale opacity-80' : 'bg-gradient-to-r from-primary/10 to-transparent'} relative overflow-hidden group`}>
                        {!locked && <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />}
                        <CardContent className="p-6 md:p-8 relative z-10">
                          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${locked ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                                  {locked ? <Lock className="h-6 w-6" /> : <Award className="h-6 w-6" />}
                                </div>
                                <h3 className="font-bold text-xl text-foreground tracking-tight">{week.weekly_test.title}</h3>
                              </div>
                              <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                                {locked ? 'This assessment will unlock once you complete all sessions for this week.' : week.weekly_test.instructions || 'Ready to test your knowledge? Complete the assessment for this week to track your progress.'}
                              </p>
                              {!locked && (
                                <div className="flex gap-3 mt-4">
                                  <Badge variant="outline" className="bg-background/50 backdrop-blur-sm text-foreground/80">
                                    {week.weekly_test.questions?.length || 0} Questions
                                  </Badge>
                                  <Badge variant="outline" className="bg-background/50 backdrop-blur-sm text-foreground/80">
                                    Passing score: {week.weekly_test.pass_percentage || 70}%
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <Button 
                               variant={locked ? "outline" : "gradient"} 
                               size="lg" 
                               disabled={locked || !week.class_sessions?.every(s => s.is_completed)}
                               className={`shrink-0 ${!locked && week.class_sessions?.every(s => s.is_completed) ? 'shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5' : ''} transition-all text-sm font-semibold h-12 px-8`}
                            >
                              {locked ? 'Locked' : !week.class_sessions?.every(s => s.is_completed) ? 'Complete Videos First' : 'Take Assessment'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                       <Card className="shadow-sm border-dashed border-border/80 bg-transparent text-muted-foreground">
                         <CardContent className="p-6 flex items-center justify-center gap-3">
                           <Award className="h-5 w-5 opacity-40 text-primary" />
                           <p className="text-sm font-medium">No assessment available for this week yet.</p>
                         </CardContent>
                       </Card>
                    )}
                  </TabsContent>
                )})}
              </Tabs>
            )}

            {/* MCQ Practice Dialog */}
            <Dialog 
              open={!!activeMcqSession} 
              onOpenChange={(open) => {
                if (!open) setActiveMcqSession(null);
              }}
            >
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
