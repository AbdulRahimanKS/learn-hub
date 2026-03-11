import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoPlayer } from '@/components/VideoPlayer';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Play,
  Clock,
  Calendar,
  Upload,
  Search,
  Filter,
  Edit,
  Trash2,
  Lock,
  Unlock,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  BookOpen,
  Loader2,
  X,
  HelpCircle,
} from 'lucide-react';
import { courseModuleApi, CourseWeek } from '@/lib/course-module-api';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import getBlobDuration from 'get-blob-duration';
import { WeeklyTestManager } from '@/components/WeeklyTestManager';
import { SessionMcqManager } from '@/components/SessionMcqManager';

export default function Content() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [isMcqOpen, setIsMcqOpen] = useState(false);

  // Track which week's test panel is open
  const [testWeek, setTestWeek] = useState<CourseWeek | null>(null);
  
  // Track which session MCQ panel is open
  const [mcqSession, setMcqSession] = useState<any>(null);
  const [mcqApiUrl, setMcqApiUrl] = useState('');

  // Backend state
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  
  // Data creation state
  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [newWeekDesc, setNewWeekDesc] = useState('');
  const [newWeekNumber, setNewWeekNumber] = useState<number | ''>('');
  const [newWeekPublished, setNewWeekPublished] = useState(true);
  const [deleteWeekId, setDeleteWeekId] = useState<number | null>(null);
  const [editWeek, setEditWeek] = useState<CourseWeek | null>(null);
  const [isEditWeekOpen, setIsEditWeekOpen] = useState(false);
  const [editWeekTitle, setEditWeekTitle] = useState('');
  const [editWeekDesc, setEditWeekDesc] = useState('');
  const [editWeekNumber, setEditWeekNumber] = useState<number | ''>('');
  const [editWeekTitleError, setEditWeekTitleError] = useState('');
  const [editWeekNumberError, setEditWeekNumberError] = useState('');
  
  // Validation states
  const [weekTitleError, setWeekTitleError] = useState('');
  const [weekNumberError, setWeekNumberError] = useState('');

  // Video upload / edit state
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | ''>('');
  const [weekday, setWeekday] = useState<string>('');
  
  const [editVideoId, setEditVideoId] = useState<number | null>(null);
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [deleteVideoId, setDeleteVideoId] = useState<number | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [videoFormErrors, setVideoFormErrors] = useState<Record<string, string>>({});
  const [uploadWeekId, setUploadWeekId] = useState<string>('');
  
  const [uploadProgress, setUploadProgress] = useState(-1); // -1 means no active upload
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);



  const fetchWeeks = async () => {
    if (!courseId) return;
    setIsLoading(true);
    try {
      const res = await courseModuleApi.getWeeks(courseId);
      if (res.success) {
        setWeeks(res.data);
        if (res.data.length > 0 && !activeTab) {
          setActiveTab(res.data[0].id.toString());
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load content', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeks();
  }, [courseId]);

  useEffect(() => {
    if (isWeekOpen) {
      setNewWeekTitle('');
      setNewWeekDesc('');
      setWeekTitleError('');
      setWeekNumberError('');
      const nextWeekNumber = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1;
      setNewWeekNumber(nextWeekNumber);
    }
  }, [isWeekOpen, weeks]);

  useEffect(() => {
    if (isUploadOpen) {
      setVideoTitle('');
      setVideoDesc('');
      setVideoFile(null);
      setSessionNumber(1);
    }
  }, [isUploadOpen]);

  const handleCreateWeek = async () => {
    let hasError = false;
    
    if (!newWeekTitle.trim()) {
      setWeekTitleError('Title is required');
      hasError = true;
    } else {
      setWeekTitleError('');
    }
    
    if (newWeekNumber === '' || newWeekNumber <= 0) {
      setWeekNumberError('A valid week number is required');
      hasError = true;
    } else {
      // Sequential validation: all weeks 1..N-1 must exist before adding week N
      const num = Number(newWeekNumber);
      const existingNumbers = new Set(weeks.map(w => w.week_number));
      const missingPrev = [];
      for (let i = 1; i < num; i++) {
        if (!existingNumbers.has(i)) missingPrev.push(i);
      }
      if (missingPrev.length > 0) {
        setWeekNumberError(`Week ${missingPrev.join(', ')} must be created first before adding Week ${num}`);
        hasError = true;
      } else {
        setWeekNumberError('');
      }
    }

    if (hasError || !courseId) return;

    try {
      const res = await courseModuleApi.createWeek(courseId, {
        week_number: Number(newWeekNumber),
        title: newWeekTitle,
        description: newWeekDesc,
        is_published: false,
      });

      if (res.success) {
        toast({ title: 'Success', description: 'Week created successfully', variant: 'success' });
        setIsWeekOpen(false);
        fetchWeeks();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({ title: 'Error creating week', description: error?.response?.data?.message || 'A network error occurred', variant: 'destructive' });
    }
  };

  const handleDeleteWeek = async () => {
    if (!deleteWeekId || !courseId) return;
    try {
      const res = await courseModuleApi.deleteWeek(courseId, deleteWeekId);
      if (res.success) {
        toast({ title: 'Success', description: 'Week deleted successfully', variant: 'success' });
        // Switch to another week if the deleted one was active
        if (activeTab === deleteWeekId.toString()) {
          const remaining = weeks.filter(w => w.id !== deleteWeekId);
          setActiveTab(remaining.length > 0 ? remaining[0].id.toString() : '');
        }
        fetchWeeks();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to delete week', variant: 'destructive' });
    } finally {
      setDeleteWeekId(null);
    }
  };

  const handleOpenEditWeek = (week: CourseWeek) => {
    setEditWeek(week);
    setEditWeekTitle(week.title);
    setEditWeekDesc(week.description || '');
    setEditWeekNumber(week.week_number);
    setEditWeekTitleError('');
    setEditWeekNumberError('');
    setIsEditWeekOpen(true);
  };

  const handleUpdateWeek = async () => {
    let hasError = false;
    if (!editWeekTitle.trim()) {
      setEditWeekTitleError('Title is required');
      hasError = true;
    } else { setEditWeekTitleError(''); }
    if (editWeekNumber === '' || editWeekNumber <= 0) {
      setEditWeekNumberError('A valid week number is required');
      hasError = true;
    } else { setEditWeekNumberError(''); }
    if (hasError || !editWeek || !courseId) return;

    try {
      const res = await courseModuleApi.updateWeek(courseId, editWeek.id, {
        week_number: Number(editWeekNumber),
        title: editWeekTitle,
        description: editWeekDesc,
      });
      if (res.success) {
        toast({ title: 'Success', description: 'Week updated successfully', variant: 'success' });
        setIsEditWeekOpen(false);
        fetchWeeks();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({ title: 'Error', description: error?.response?.data?.message || 'Failed to update week', variant: 'destructive' });
    }
  };

  const handleTogglePublish = async (week: CourseWeek) => {
    if (!courseId) return;
    const newStatus = !week.is_published;

    // Frontend publish guard: check requirements before hitting the API
    if (newStatus) {
      const hasVideos = week.class_sessions && week.class_sessions.length > 0;
      const hasTest = !!week.weekly_test;
      if (!hasVideos) {
        toast({ title: 'Cannot Publish', description: 'At least one video session must be added before publishing this week.', variant: 'destructive' });
        return;
      }
      if (!hasTest) {
        toast({ title: 'Cannot Publish', description: 'A weekly test must be configured before publishing this week.', variant: 'destructive' });
        return;
      }
    }

    try {
      const res = await courseModuleApi.updateWeek(courseId, week.id, { is_published: newStatus });
      if (res.success) {
        toast({ title: 'Success', description: newStatus ? 'Week published successfully' : 'Week unpublished', variant: 'success' });
        fetchWeeks();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({ title: 'Error', description: error?.response?.data?.message || 'Failed to update publish status', variant: 'destructive' });
    }
  };

  const handleOpenAddVideo = () => {
    setVideoTitle('');
    setVideoDesc('');
    setSessionNumber(1);
    setWeekday('');
    setVideoFile(null);
    setUploadWeekId(activeTab);
    setVideoFormErrors({});
    setIsUploadOpen(true);
  };

  const handleUploadVideo = async () => {
    const errors: Record<string, string> = {};
    if (!videoTitle.trim()) errors.title = 'Title is required';
    if (!uploadWeekId) errors.week = 'Please select a week';
    if (!courseId) errors.course = 'System Error: Course missing';
    if (sessionNumber === '' || sessionNumber <= 0) errors.session_number = 'Session number must be a valid number greater than 0';
    if (!weekday || weekday === 'none') errors.weekday = 'Weekday is required';
    if (!videoFile) errors.video_file = 'You must select a video file to upload';

    setVideoFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let finalVideoKey = '';
      let actualDurationSeconds = 0;

      // Direct-to-R2 Multipart Upload Flow
      if (videoFile) {
        // Step 0: Get Video Duration (in seconds)
        try {
          const durationS = await getBlobDuration(videoFile);
          actualDurationSeconds = Math.round(durationS);
        } catch (err) {
          console.warn('Failed to parse video duration', err);
        }

        // 1. Initialize Upload
        const initRes = await courseModuleApi.initMultipartUpload(videoFile.name, videoFile.type, videoFile.size);
        if (!initRes.success) throw new Error(initRes.message);

        const { upload_id, key, part_urls, chunk_size } = initRes.data;
        const uploadedParts = [];

        // 2. Map chunks and upload sequentially (or carefully in parallel)
        for (let i = 0; i < part_urls.length; i++) {
          const start = i * chunk_size;
          const end = Math.min(start + chunk_size, videoFile.size);
          const chunk = videoFile.slice(start, end);

          // PUT to pre-signed URL directly bypassing Django
          const uploadRes = await axios.put(part_urls[i], chunk, {
            headers: { 'Content-Type': videoFile.type },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                // Calculate total precise progress across chunks
                const chunkPct = progressEvent.loaded / progressEvent.total;
                const overallPct = Math.round(((i + chunkPct) / part_urls.length) * 100);
                setUploadProgress(overallPct);
              }
            }
          });

          // Retrieve ETag from header response
          let etag = uploadRes.headers['etag'] || uploadRes.headers['ETag'];
          if (!etag) throw new Error("Storage server didn't return an ETag for the part.");
          
          uploadedParts.push({ ETag: etag, PartNumber: i + 1 });
        }

        // 3. Complete Upload
        const completeRes = await courseModuleApi.completeMultipartUpload(key, upload_id, uploadedParts);
        if (!completeRes.success) throw new Error("Failed to finalize upload.");
        
        finalVideoKey = completeRes.data.video_key;
      }

      // 4. Save to Django Database
      const formData = new FormData();
      formData.append('title', videoTitle);
      formData.append('description', videoDesc);
      formData.append('session_number', sessionNumber.toString());
      if (weekday && weekday !== 'none') {
        formData.append('weekday', weekday);
      }
      formData.append('duration_seconds', actualDurationSeconds.toString()); 
      if (finalVideoKey) {
        // Just store the key text in the CharField
        formData.append('video_file', finalVideoKey);
      }

      const res = await courseModuleApi.createSession(courseId, uploadWeekId, formData);
      if (res.success) {
        toast({ title: 'Success', description: 'Video session created successfully.', variant: 'success' });
        setIsUploadOpen(false);
        setVideoTitle('');
        setVideoDesc('');
        setVideoFile(null);
        fetchWeeks();
      }
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error?.response?.data?.message || error.message || 'A network error occurred', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(-1);
    }
  };

  const handleOpenEditVideo = (video: any, weekId: string) => {
    setEditVideoId(video.id);
    setUploadWeekId(weekId); // Prevents background UI from shifting
    setVideoTitle(video.title);
    setVideoDesc(video.description || '');
    setSessionNumber(video.session_number);
    setWeekday(video.weekday || '');
    setWeekday(video.weekday || '');
    setIsEditVideoOpen(true);
  };

  const handleUpdateVideo = async () => {
    const errors: Record<string, string> = {};
    if (!videoTitle.trim()) errors.title = 'Title is required';
    if (!uploadWeekId || !editVideoId || !courseId) errors.course = 'System validation missing data';
    if (sessionNumber === '' || sessionNumber <= 0) errors.session_number = 'Session number must be a valid number greater than 0';
    if (!weekday || weekday === 'none') errors.weekday = 'Weekday is required';

    setVideoFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const formData = new FormData();
    formData.append('title', videoTitle);
    formData.append('description', videoDesc);
    formData.append('session_number', sessionNumber.toString());
    if (weekday && weekday !== 'none') {
      formData.append('weekday', weekday);
    }

    if (weekday && weekday !== 'none') {
      formData.append('weekday', weekday);
    }

    try {
      const res = await courseModuleApi.updateSession(courseId, uploadWeekId, editVideoId, formData);
      if (res.success) {
        toast({ title: 'Success', description: 'Video updated successfully', variant: 'success' });
        setIsEditVideoOpen(false);
        fetchWeeks();
      }
    } catch (error: any) {
      toast({ title: 'Error updating video', description: error?.response?.data?.message || 'A network error occurred', variant: 'destructive' });
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteVideoId || !activeTab || !courseId) return;
    try {
      const res = await courseModuleApi.deleteSession(courseId, activeTab, deleteVideoId);
      if (res.success) {
        toast({ title: 'Success', description: 'Video deleted successfully', variant: 'success' });
        fetchWeeks();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to delete video', variant: 'destructive' });
    } finally {
      setDeleteVideoId(null);
    }
  };


  const handleOpenTestManager = (week: CourseWeek) => {
    setTestWeek(week);
    setIsTestOpen(true);
  };


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoCard = ({ video }: { video: any }) => (
    <Card className="shadow-card overflow-hidden group hover:shadow-md transition-all duration-300 bg-card border border-border/50">
      <div className="flex flex-col sm:flex-row items-center p-4 gap-4">
        {/* Left: Icon/Play */}
        <div className="flex shrink-0">
          <div 
            className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
            onClick={() => {
              if (video.video_presigned_url) {
                setPlayingVideoUrl(video.video_presigned_url);
              } else if (video.video_url) {
                 window.open(video.video_url, '_blank');
              } else {
                toast({ title: 'Video Unavailable', description: 'This video cannot be played directly at this time.', variant: 'destructive' });
              }
            }}
          >
            <Play className="h-6 w-6 fill-current ml-1" />
          </div>
        </div>

        {/* Middle: Content */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <h3 className="font-bold text-foreground truncate text-lg">{video.title}</h3>
            {video.weekday && (
              <Badge variant="outline" className="w-fit mx-auto sm:mx-0 bg-background/90 shadow-sm border-primary/20 capitalize font-bold text-[10px] h-5 px-2">
                {video.weekday}
              </Badge>
            )}
            <Badge variant="secondary" className="w-fit mx-auto sm:mx-0 text-[10px] h-5 px-2 font-bold">
              SESSION {video.session_number}
            </Badge>
          </div>
          
          {video.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
              {video.description}
            </p>
          )}
          
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {video.duration_seconds > 0 ? (
                  `${Math.floor(video.duration_seconds / 60).toString().padStart(2, '0')}:${(video.duration_seconds % 60).toString().padStart(2, '0')}`
                ) : (
                  'Processing'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 shrink-0 ml-auto w-full sm:w-auto justify-center sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0">
          <div className="flex items-center gap-1">
            <Button 
               variant="ghost" 
               size="sm" 
               className="h-9 px-3 gap-2 text-muted-foreground hover:text-foreground" 
               onClick={() => {
                setMcqSession(video);
                setMcqApiUrl(`/api/courses/v1/courses/${courseId}/weeks/${activeTab}/sessions/${video.id}/mcq`);
                setIsMcqOpen(true);
              }}
            >
              <HelpCircle className="h-4 w-4" />
              <span className="text-xs font-bold">MCQs</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEditVideo(video, activeTab)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteVideoId(video.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="gradient" 
            size="sm" 
            className="gap-2 px-6 h-9 rounded-lg shadow-sm font-bold"
            onClick={() => {
              if (video.video_presigned_url) {
                setPlayingVideoUrl(video.video_presigned_url);
              } else if (video.video_url) {
                 window.open(video.video_url, '_blank');
              }
            }}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Watch
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb + Back */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <button
            onClick={() => navigate('/admin-courses')}
            className="hover:text-foreground transition-colors"
          >
            Courses
          </button>
          <ChevronLeft className="h-3 w-3 rotate-180" />
          <span className="text-foreground font-medium">Course Content</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin-courses')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">Course Content</h1>
              <p className="mt-1 text-muted-foreground">Manage your weekly video content and assessments</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsWeekOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Week
            </Button>
            <Button variant="gradient" onClick={handleOpenAddVideo}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
          </div>
        </div>



        {/* ── Tabbed View ───────────────── */}
        {isLoading ? (
          <div className="flex justify-center items-center py-32 bg-muted/10 rounded-2xl border-2 border-dashed border-border/50">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
              <p className="text-muted-foreground font-medium animate-pulse">Loading course content...</p>
            </div>
          </div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 border-2 border-dashed border-border rounded-xl">
            <BookOpen className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
            <h3 className="text-2xl font-bold text-foreground mb-2">No Weeks Initialized</h3>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              This course doesn't have any weekly content yet. Start by defining the first week to begin uploading videos and assessments.
            </p>
            <Button variant="gradient" onClick={() => setIsWeekOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Add First Week
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full overflow-hidden">
            <TabsList className="flex w-full bg-transparent h-auto p-0 flex-nowrap justify-start overflow-x-auto overflow-y-hidden scrollbar-hide gap-3 pb-2">
            {weeks.map(week => (
              <TabsTrigger 
                key={week.id} 
                value={week.id.toString()} 
                className={cn(
                  "px-6 py-2.5 shrink-0 rounded-full transition-all border border-border/50 text-sm font-medium",
                  "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary data-[state=active]:shadow-lg shadow-primary/20",
                  "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                Week {week.week_number}
              </TabsTrigger>
            ))}
          </TabsList>

          {weeks.map(week => (
            <TabsContent key={week.id} value={week.id.toString()} className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Week {week.week_number}: {week.title}</h2>
                  <p className="text-muted-foreground text-sm">{week.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenTestManager(week)}>
                    <FileText className="h-4 w-4 mr-2" />
                    {week.weekly_test ? 'Edit Assessment' : 'Add Weekly Test'}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleOpenEditWeek(week)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="text-primary" onClick={() => setDeleteWeekId(week.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Videos List */}
              {week.class_sessions.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {[...week.class_sessions]
                    .sort((a, b) => {
                      const days: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
                      const dayA = days[a.weekday?.toLowerCase()] || 8;
                      const dayB = days[b.weekday?.toLowerCase()] || 8;
                      if (dayA !== dayB) return dayA - dayB;
                      return (a.session_number || 0) - (b.session_number || 0);
                    })
                    .map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-foreground/20 rounded-lg">
                  No videos uploaded for this week yet.
                </div>
              )}

              {/* Weekly Assessment Display Card */}
              <div className="mt-8 pt-8 border-t border-foreground/10">
                <h3 className="text-lg font-semibold mb-4">Weekly Assessment</h3>
                {week.weekly_test ? (
                  <Card className="shadow-card overflow-hidden group hover:shadow-md transition-all duration-300 bg-card border border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{week.weekly_test.title}</CardTitle>
                          <CardDescription>
                            {week.weekly_test.questions?.length || 0} Question{(week.weekly_test.questions?.length || 0) !== 1 ? 's' : ''}
                            {' · '}{week.weekly_test.pass_percentage ?? 70}% pass mark
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenTestManager(week)}>
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Manage
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {week.weekly_test.instructions && (
                        <p className="text-sm text-foreground/70 mt-1 line-clamp-2">{week.weekly_test.instructions}</p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="border-2 border-dashed border-foreground/20 rounded-xl p-8 text-center bg-muted/20">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h4 className="font-medium text-foreground mb-1">No Assessment Configured</h4>
                    <p className="text-sm text-muted-foreground mb-4">Add a weekly test that students must complete.</p>
                    <Button variant="outline" onClick={() => handleOpenTestManager(week)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Weekly Test
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}

          </Tabs>
        )}
      </div>

      {/* Upload Video Modal */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => !isUploading && setIsUploadOpen(open)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Upload New Video</DialogTitle>
            <DialogDescription>Add a new video to your course content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Video Title <span className="text-destructive">*</span></Label>
                <Input 
                  id="title" 
                  placeholder="Enter video title" 
                  value={videoTitle}
                  disabled={isUploading}
                  onChange={(e) => {
                    setVideoTitle(e.target.value);
                    if (videoFormErrors.title) setVideoFormErrors({...videoFormErrors, title: ''});
                  }}
                  className={videoFormErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {videoFormErrors.title && <p className="text-xs text-destructive">{videoFormErrors.title}</p>}
              </div>

              {/* Week Selection */}
              <div className="space-y-2">
                <Label>Select Week <span className="text-destructive">*</span></Label>
                <Select 
                  value={uploadWeekId} 
                  disabled={isUploading}
                  onValueChange={(val) => {
                    setUploadWeekId(val);
                    if (videoFormErrors.week) setVideoFormErrors({...videoFormErrors, week: ''});
                  }}
                >
                  <SelectTrigger className={videoFormErrors.week ? "border-destructive focus:ring-destructive" : ""}>
                    <SelectValue placeholder="Select a week" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((week) => (
                      <SelectItem key={week.id} value={week.id.toString()}>
                        Week {week.week_number}: {week.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {videoFormErrors.week && <p className="text-xs text-destructive">{videoFormErrors.week}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="Enter video description" 
                value={videoDesc}
                disabled={isUploading}
                onChange={(e) => setVideoDesc(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sessionNumber">Session Number <span className="text-destructive">*</span></Label>
                <Input 
                  id="sessionNumber"
                  type="number"
                  min="1"
                  value={sessionNumber}
                  disabled={isUploading}
                  onChange={(e) => {
                    setSessionNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                    if (videoFormErrors.session_number) setVideoFormErrors({...videoFormErrors, session_number: ''});
                  }}
                  className={videoFormErrors.session_number ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {videoFormErrors.session_number && <p className="text-xs text-destructive">{videoFormErrors.session_number}</p>}
              </div>

              <div className="space-y-2">
                <Label>Weekday Tag <span className="text-destructive">*</span></Label>
                <select 
                  className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${videoFormErrors.weekday ? "border-destructive focus:ring-destructive" : "border-input"}`}
                  value={weekday}
                  disabled={isUploading}
                  onChange={(e) => {
                    setWeekday(e.target.value);
                    if (videoFormErrors.weekday) setVideoFormErrors({...videoFormErrors, weekday: ''});
                  }}
                >
                  <option value="" disabled>Select a weekday</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
                {videoFormErrors.weekday && <p className="text-xs text-destructive">{videoFormErrors.weekday}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Video File <span className="text-destructive">*</span></Label>
              <input 
                type="file" 
                ref={fileInputRef} 
                disabled={isUploading}
                className="hidden" 
                accept="video/mp4"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.type !== 'video/mp4') {
                      setVideoFormErrors(prev => ({...prev, video_file: "Only MP4 videos are allowed"}));
                      setVideoFile(null);
                      e.target.value = '';
                      return;
                    }
                    setVideoFile(file);
                    setVideoFormErrors(prev => {
                      const newErrs = { ...prev };
                      delete newErrs.video_file;
                      return newErrs;
                    });
                  }
                }}
              />
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${videoFormErrors.video_file ? 'border-destructive bg-destructive/5' : videoFile ? 'border-primary bg-primary/5' : 'border-foreground/20 hover:border-primary/50'}`}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                {videoFile ? (
                  <>
                    <CheckCircle className={`h-10 w-10 mx-auto mb-4 ${videoFormErrors.video_file ? 'text-destructive' : 'text-primary'}`} />
                    <p className={`text-sm font-medium ${videoFormErrors.video_file ? 'text-destructive' : 'text-foreground'}`}>{videoFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className={`h-10 w-10 mx-auto mb-4 ${videoFormErrors.video_file ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <p className={`text-sm ${videoFormErrors.video_file ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 text-primary">
                      MP4 videos only
                    </p>
                  </>
                )}
              </div>
              {videoFormErrors.video_file && <p className="text-xs text-destructive">{videoFormErrors.video_file}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            {isUploading ? (
              <div className="w-full flex items-center justify-between gap-4 py-1">
                <div className="flex-1 w-full bg-muted rounded-full overflow-hidden h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max(uploadProgress, 0)}%` }} 
                  ></div>
                </div>
                <span className="text-xs font-medium text-muted-foreground w-12">{uploadProgress}%</span>
              </div>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                <Button variant="gradient" onClick={handleUploadVideo}>Save Video</Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Week Modal */}
      <Dialog open={isWeekOpen} onOpenChange={setIsWeekOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Create New Week</DialogTitle>
            <DialogDescription>Add a new module week for the course curriculum.</DialogDescription>
          </DialogHeader>
            <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="weekNumber">Week Number <span className="text-destructive">*</span></Label>
              <Input 
                id="weekNumber" 
                type="number"
                min="1"
                placeholder="e.g. 1" 
                value={newWeekNumber}
                onChange={(e) => {
                  setNewWeekNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  if (weekNumberError) setWeekNumberError('');
                }}
                className={weekNumberError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {weekNumberError && <p className="text-sm text-destructive mt-1">{weekNumberError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekTitle">Week Title <span className="text-destructive">*</span></Label>
              <Input 
                id="weekTitle" 
                placeholder="e.g. Loops & Statements" 
                value={newWeekTitle}
                onChange={(e) => {
                  setNewWeekTitle(e.target.value);
                  if (weekTitleError) setWeekTitleError('');
                }}
                className={weekTitleError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {weekTitleError && <p className="text-sm text-destructive mt-1">{weekTitleError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekDesc">Description (Optional)</Label>
              <Textarea 
                id="weekDesc" 
                placeholder="Brief outline of topics..." 
                value={newWeekDesc}
                onChange={(e) => setNewWeekDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsWeekOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreateWeek}>Create Week</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Week Modal */}
      <Dialog open={isEditWeekOpen} onOpenChange={setIsEditWeekOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Week</DialogTitle>
            <DialogDescription>Update the details for this week.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editWeekNumber">Week Number <span className="text-destructive">*</span></Label>
              <Input
                id="editWeekNumber"
                type="number"
                min="1"
                value={editWeekNumber}
                disabled
                className="bg-muted opacity-100 cursor-not-allowed"
              />
              {editWeekNumberError && <p className="text-sm text-destructive mt-1">{editWeekNumberError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editWeekTitle">Week Title <span className="text-destructive">*</span></Label>
              <Input
                id="editWeekTitle"
                placeholder="e.g. Loops & Statements"
                value={editWeekTitle}
                onChange={(e) => {
                  setEditWeekTitle(e.target.value);
                  if (editWeekTitleError) setEditWeekTitleError('');
                }}
                className={editWeekTitleError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {editWeekTitleError && <p className="text-sm text-destructive mt-1">{editWeekTitleError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editWeekDesc">Description (Optional)</Label>
              <Textarea
                id="editWeekDesc"
                placeholder="Brief outline of topics..."
                value={editWeekDesc}
                onChange={(e) => setEditWeekDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditWeekOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleUpdateWeek}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Test Manager */}
      {testWeek && courseId && (
        <WeeklyTestManager
          open={isTestOpen}
          onClose={() => { setIsTestOpen(false); setTestWeek(null); }}
          existingTest={testWeek.weekly_test ?? null}
          weekLabel={`Week ${testWeek.week_number}: ${testWeek.title}`}
          testApiBase={`/api/courses/v1/courses/${courseId}/weeks/${testWeek.id}/test`}
          onSaved={fetchWeeks}
          onDeleted={() => { setIsTestOpen(false); setTestWeek(null); fetchWeeks(); }}
        />
      )}
      
      {/* Delete Week Confirmation */}
      <AlertDialog open={deleteWeekId !== null} onOpenChange={(open) => !open && setDeleteWeekId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this week and all of its associated sessions and tests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWeek} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Video Modal */}
      <Dialog open={isEditVideoOpen} onOpenChange={setIsEditVideoOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Video Session</DialogTitle>
            <DialogDescription>Update the details of this video.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editVTitle">Video Title <span className="text-destructive">*</span></Label>
              <Input 
                id="editVTitle" 
                placeholder="Enter video title" 
                value={videoTitle}
                onChange={(e) => {
                  setVideoTitle(e.target.value);
                  if (videoFormErrors.title) setVideoFormErrors({...videoFormErrors, title: ''});
                }}
                className={videoFormErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {videoFormErrors.title && <p className="text-xs text-destructive">{videoFormErrors.title}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editVDesc">Description (Optional)</Label>
              <Textarea 
                id="editVDesc" 
                placeholder="Enter video description" 
                value={videoDesc}
                onChange={(e) => setVideoDesc(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editVSessionNumber">Session Number <span className="text-destructive">*</span></Label>
                <Input 
                  id="editVSessionNumber"
                  type="number"
                  min="1"
                  value={sessionNumber}
                  onChange={(e) => {
                    setSessionNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                    if (videoFormErrors.session_number) setVideoFormErrors({...videoFormErrors, session_number: ''});
                  }}
                  className={videoFormErrors.session_number ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {videoFormErrors.session_number && <p className="text-xs text-destructive">{videoFormErrors.session_number}</p>}
              </div>

              <div className="space-y-2">
                <Label>Weekday Tag <span className="text-destructive">*</span></Label>
                <select 
                  className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${videoFormErrors.weekday ? "border-destructive focus:ring-destructive" : "border-input"}`}
                  value={weekday}
                  onChange={(e) => {
                    setWeekday(e.target.value);
                    if (videoFormErrors.weekday) setVideoFormErrors({...videoFormErrors, weekday: ''});
                  }}
                >
                  <option value="" disabled>Select a weekday</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
                {videoFormErrors.weekday && <p className="text-xs text-destructive">{videoFormErrors.weekday}</p>}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditVideoOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleUpdateVideo}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Video Confirmation */}
      <AlertDialog open={deleteVideoId !== null} onOpenChange={(open) => !open && setDeleteVideoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this video session from the curriculum.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVideo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Player Modal */}
      <Dialog open={!!playingVideoUrl} onOpenChange={(open) => !open && setPlayingVideoUrl(null)}>
        <DialogContent className="sm:max-w-4xl max-w-[90vw] p-0 overflow-hidden bg-black/95 border-none shadow-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
           {playingVideoUrl && (
             <div className="w-full aspect-video flex justify-center items-center">
               <VideoPlayer url={playingVideoUrl} />
             </div>
           )}
        </DialogContent>
      </Dialog>



      <SessionMcqManager
        open={isMcqOpen}
        onClose={() => setIsMcqOpen(false)}
        session={mcqSession}
        apiBaseUrl={mcqApiUrl}
        onSaved={fetchWeeks}
      />
    </DashboardLayout>
  );
}
