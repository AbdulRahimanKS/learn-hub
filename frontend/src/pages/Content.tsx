import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { courseModuleApi, CourseWeek } from '@/lib/course-module-api';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export default function Content() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [testType, setTestType] = useState<'text' | 'ipynb'>('text');

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
  const [videoThumbnail, setVideoThumbnail] = useState<File | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | ''>('');
  
  const [editVideoId, setEditVideoId] = useState<number | null>(null);
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [deleteVideoId, setDeleteVideoId] = useState<number | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  
  const [uploadProgress, setUploadProgress] = useState(-1); // -1 means no active upload
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const thumbnailInputRef = React.useRef<HTMLInputElement>(null);
  const editThumbnailInputRef = React.useRef<HTMLInputElement>(null);

  // Test setup state
  const [testTitle, setTestTitle] = useState('Weekly Assessment');
  const [testInstructions, setTestInstructions] = useState('');

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
      setVideoThumbnail(null);
      
      const activeWeek = weeks.find(w => w.id.toString() === activeTab);
      const nextSession = activeWeek && activeWeek.class_sessions ? activeWeek.class_sessions.length + 1 : 1;
      setSessionNumber(nextSession);
    }
  }, [isUploadOpen, activeTab, weeks]);

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

  const handleUploadVideo = async () => {
    if (!videoTitle.trim() || !activeTab || !courseId) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields and select a week.', variant: 'destructive' });
      return;
    }
    if (sessionNumber === '' || sessionNumber <= 0) {
      toast({ title: 'Validation Error', description: 'Session number must be greater than 0.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let finalVideoKey = '';

      // Direct-to-R2 Multipart Upload Flow
      if (videoFile) {
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
      formData.append('duration_mins', '0'); // Basic default
      if (finalVideoKey) {
        // Just store the key text in the CharField
        formData.append('video_file', finalVideoKey);
      }
      if (videoThumbnail) formData.append('thumbnail', videoThumbnail);

      const res = await courseModuleApi.createSession(courseId, activeTab, formData);
      if (res.success) {
        toast({ title: 'Success', description: 'Video session created successfully.', variant: 'success' });
        setIsUploadOpen(false);
        setVideoTitle('');
        setVideoDesc('');
        setVideoFile(null);
        setVideoThumbnail(null);
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
    setActiveTab(weekId); // make sure the week is selected
    setVideoTitle(video.title);
    setVideoDesc(video.description || '');
    setSessionNumber(video.session_number);
    setVideoThumbnail(null); // Clear previous file selection
    setIsEditVideoOpen(true);
  };

  const handleUpdateVideo = async () => {
    if (!videoTitle.trim() || !activeTab || !courseId || !editVideoId) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    if (sessionNumber === '' || sessionNumber <= 0) {
      toast({ title: 'Validation Error', description: 'Session number must be greater than 0.', variant: 'destructive' });
      return;
    }

    const formData = new FormData();
    formData.append('title', videoTitle);
    formData.append('description', videoDesc);
    formData.append('session_number', sessionNumber.toString());
    if (videoThumbnail) formData.append('thumbnail', videoThumbnail);

    try {
      const res = await courseModuleApi.updateSession(courseId, activeTab, editVideoId, formData);
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

  const handleCreateTest = async () => {
    if (!testTitle.trim() || !activeTab || !courseId) {
      toast({ title: 'Validation Error', description: 'Please fill in test title.', variant: 'destructive' });
      return;
    }

    try {
      const res = await courseModuleApi.createTest(courseId, activeTab, {
        title: testTitle,
        instructions: testInstructions,
        pass_percentage: 70
      });
      if (res.success) {
        toast({ title: 'Success', description: 'Test created successfully', variant: 'success' });
        setIsTestOpen(false);
        fetchWeeks(); // to bring in the new test details
        setTestTitle('Weekly Assessment');
        setTestInstructions('');
      }
    } catch (error: any) {
      toast({ title: 'Error creating test', description: error?.response?.data?.message || 'A network error occurred', variant: 'destructive' });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoCard = ({ video }: { video: any }) => (
    <Card className="shadow-card overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-video">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
        
        {video.isLocked && (
          <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center backdrop-blur-sm">
            <Lock className="h-8 w-8 text-primary-foreground" />
          </div>
        )}
        
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <Badge variant="secondary" className="bg-foreground/80 text-background">
            <Clock className="h-3 w-3 mr-1" />
            {video.duration}
          </Badge>
        </div>

        <button 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
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
        </button>
      </div>
      <CardContent className="p-4 flex flex-col justify-between flex-1">
        <div>
          <h3 className="font-semibold text-foreground line-clamp-1">{video.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" onClick={() => handleOpenEditVideo(video, activeTab)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {video.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteVideoId(video.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
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
            <Button variant="gradient" onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
          </div>
        </div>

        {/* Global Search & Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos and tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Content Tabs for Weeks */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto">
            {weeks.map(week => (
              <TabsTrigger key={week.id} value={week.id.toString()} className="whitespace-nowrap">
                Week {week.week_number}: {week.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {weeks.map(week => (
            <TabsContent key={week.id} value={week.id.toString()} className="space-y-6 mt-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Week {week.week_number}: {week.title}</h2>
                  <p className="text-muted-foreground text-sm">{week.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsTestOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    {week.weekly_test ? 'Edit Test' : 'Add Weekly Test'}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleOpenEditWeek(week)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setDeleteWeekId(week.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Videos Grid */}
              {week.class_sessions.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {week.class_sessions.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-foreground/20 rounded-lg">
                  No videos uploaded for this week yet.
                </div>
              )}

              {/* Weekly Test Display Card */}
              <div className="mt-8 pt-8 border-t border-foreground/10">
                <h3 className="text-lg font-semibold mb-4">Weekly Assessment</h3>
                {week.weekly_test ? (
                  <Card className="shadow-sm border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{week.weekly_test.title}</CardTitle>
                          <CardDescription>{week.weekly_test.questions?.length || 0} Questions</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setIsTestOpen(true)}><Edit className="h-4 w-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/80 mt-2">
                        This test will be automatically unlocked when students complete the preceding videos for the week.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="border-2 border-dashed border-foreground/20 rounded-xl p-8 text-center bg-muted/20">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h4 className="font-medium text-foreground mb-1">No Assessment Configured</h4>
                    <p className="text-sm text-muted-foreground mb-4">Add a weekly test that students must pass to proceed to the next week.</p>
                    <Button variant="outline" onClick={() => setIsTestOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Weekly Test
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}

        </Tabs>
      </div>

      {/* Upload Video Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload New Video</DialogTitle>
            <DialogDescription>Add a new video to your course content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Video Title <span className="text-destructive">*</span></Label>
              <Input 
                id="title" 
                placeholder="Enter video title" 
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="Enter video description" 
                value={videoDesc}
                onChange={(e) => setVideoDesc(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sessionNumber">Session Number (Order in week) <span className="text-destructive">*</span></Label>
              <Input 
                id="sessionNumber"
                type="number"
                min="1"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              />
            </div>
            
            {/* Week Selection instead of text input */}
            <div className="space-y-2">
              <Label>Select Week</Label>
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Thumbnail Image (Optional)</Label>
              <Input 
                type="file" 
                accept="image/*"
                ref={thumbnailInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setVideoThumbnail(e.target.files[0]);
                  }
                }}
              />
              {videoThumbnail && <p className="text-xs mt-1 text-muted-foreground">Selected: {videoThumbnail.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Video File (Optional External Link alternative)</Label>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/mp4,video/webm"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setVideoFile(e.target.files[0]);
                  }
                }}
              />
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${videoFile ? 'border-primary bg-primary/5' : 'border-foreground/20 hover:border-primary/50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {videoFile ? (
                  <>
                    <CheckCircle className="h-10 w-10 text-primary mx-auto mb-4" />
                    <p className="text-sm text-foreground font-medium">{videoFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      MP4, WebM up to 500MB
                    </p>
                  </>
                )}
              </div>
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
        <DialogContent className="sm:max-w-md">
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

      {/* Weekly Test Modal */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly Test Configuration</DialogTitle>
            <DialogDescription>Create a test that students must pass completing this week's content.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Test Title <span className="text-destructive">*</span></Label>
              <Input 
                value={testTitle} 
                onChange={e => setTestTitle(e.target.value)} 
                placeholder="Week Assessment" 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea 
                value={testInstructions} 
                onChange={e => setTestInstructions(e.target.value)} 
                placeholder="Optional instructions for students..." 
              />
            </div>

            <div className="space-y-3">
              <Label>Question Format</Label>
              <div className="flex gap-2 p-1 bg-muted rounded-lg w-max">
                <Button 
                  variant={testType === 'text' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTestType('text')}
                  className="rounded-md"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Text Questions
                </Button>
                <Button 
                  variant={testType === 'ipynb' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTestType('ipynb')}
                  className="rounded-md"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload .ipynb File
                </Button>
              </div>
            </div>

            {testType === 'ipynb' ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-foreground/20 rounded-lg p-10 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/10">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Upload Jupyter Notebook (.ipynb)
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    The notebook text and cells will be converted to test questions. Upload your file to preview.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-muted p-3 border-b flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Question 1</h4>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      <span>Question Text</span>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary flex items-center h-5">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Add Image / Chart
                      </Button>
                    </Label>
                    <Textarea placeholder="Type your question here..." />
                  </div>
                  
                  {/* Options */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm">Multiple Choice Options</Label>
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="flex items-center gap-3">
                        <input type="radio" name="q1_correct" className="mt-1" />
                        <Input placeholder={`Option ${idx}`} className="h-9 flex-1" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-muted/30 p-3 border-t">
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Question
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">Tests with questions auto-unlock after videos</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsTestOpen(false)}>Cancel</Button>
              <Button variant="gradient" onClick={handleCreateTest}>Save Assessment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
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
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                onChange={(e) => setVideoTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editVDesc">Description (Optional)</Label>
              <Textarea 
                id="editVDesc" 
                placeholder="Enter video description" 
                value={videoDesc}
                onChange={(e) => setVideoDesc(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editVSessionNumber">Session Number (Order in week) <span className="text-destructive">*</span></Label>
              <Input 
                id="editVSessionNumber"
                type="number"
                min="1"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              />
            </div>

            <div className="space-y-2">
              <Label>Thumbnail Image (Optional)</Label>
              <Input 
                type="file" 
                accept="image/*"
                ref={editThumbnailInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setVideoThumbnail(e.target.files[0]);
                  }
                }}
              />
              {videoThumbnail ? (
                <p className="text-xs mt-1 text-muted-foreground">Selected: {videoThumbnail.name}</p>
              ) : (
                <p className="text-xs mt-1 text-muted-foreground">Leave blank to keep the current thumbnail</p>
              )}
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
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black/95 border-none shadow-2xl">
           {playingVideoUrl && (
             <video 
               src={playingVideoUrl} 
               controls 
               autoPlay 
               controlsList="nodownload"
               className="w-full h-full max-h-[85vh] outline-none" 
             />
           )}
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
