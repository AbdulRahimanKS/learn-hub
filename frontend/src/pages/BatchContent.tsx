import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VideoPlayer } from '@/components/VideoPlayer';
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
  DialogFooter,
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
  Plus,
  Play,
  Clock,
  Calendar,
  Upload,
  Search,
  Edit,
  Trash2,
  Lock,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Loader2,
  Settings,
  HelpCircle,
  X,
} from 'lucide-react';
import { batchApi, batchContentApi, BatchWeek } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { WeeklyTestManager } from '@/components/WeeklyTestManager';
import { SessionMcqManager } from '@/components/SessionMcqManager';


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { courseModuleApi } from '@/lib/course-module-api';
import axios from 'axios';
import getBlobDuration from 'get-blob-duration';

export default function BatchContent() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [weeks, setWeeks] = useState<BatchWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [batchName, setBatchName] = useState('');
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  // Edit Week Modal
  const [editWeek, setEditWeek] = useState<BatchWeek | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editUnlockDate, setEditUnlockDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [isExtending, setIsExtending] = useState(false);

  // Content State
  const [sessions, setSessions] = useState<any[]>([]);
  const [weeklyTest, setWeeklyTest] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Session Modal
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);

  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | ''>('');
  const [weekday, setWeekday] = useState<string>('');
  const [videoFormErrors, setVideoFormErrors] = useState<Record<string, string>>({});
  
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);




  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({});

  // Test Modal (now replaced by WeeklyTestManager)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testWeek, setTestWeek] = useState<BatchWeek | null>(null);

  // Session MCQ Manager State
  const [isMcqOpen, setIsMcqOpen] = useState(false);
  const [mcqSession, setMcqSession] = useState<any>(null);
  const [mcqApiUrl, setMcqApiUrl] = useState('');

  // Delete Alert
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Delete Week Alert
  const [deleteWeekId, setDeleteWeekId] = useState<number | null>(null);
  const [isDeletingWeek, setIsDeletingWeek] = useState(false);

  // Add Week
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);
  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [newWeekNumber, setNewWeekNumber] = useState<number | ''>(1);
  const [newWeekTitleError, setNewWeekTitleError] = useState('');
  const [newWeekNumberError, setNewWeekNumberError] = useState('');
  const [isAddingWeek, setIsAddingWeek] = useState(false);

  const fetchBatchInfo = async () => {
    if (!batchId) return;
    try {
      const res = await batchApi.getBatch(parseInt(batchId));
      if (res.success) {
        setBatchName(res.data.name);
      }
    } catch (err) {}
  };

  const fetchWeeks = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await batchContentApi.getWeeks(parseInt(batchId));
      if (res.success) {
        setWeeks(res.data);
        if (res.data.length > 0 && !activeTab) {
          setActiveTab(res.data[0].id.toString());
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load batch content', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchContent = async (weekId: number) => {
    if (!batchId) return;
    setLoadingContent(true);
    try {
      const [sessRes, testRes] = await Promise.all([
        batchContentApi.getSessions(parseInt(batchId), weekId),
        batchContentApi.getWeeklyTest(parseInt(batchId), weekId).catch(() => ({ success: false, data: null }))
      ]);
      
      if (sessRes.success) setSessions(sessRes.data);
      if (testRes.success) setWeeklyTest(testRes.data);
      else setWeeklyTest(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    if (isAddWeekOpen) {
      setNewWeekTitle('');
      setNewWeekTitleError('');
      setNewWeekNumberError('');
      const nextWeekNumber = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1;
      setNewWeekNumber(nextWeekNumber);
    }
  }, [isAddWeekOpen, weeks]);

  useEffect(() => {
    fetchBatchInfo();
    fetchWeeks();
  }, [batchId]);

  useEffect(() => {
    if (activeTab) {
      fetchContent(parseInt(activeTab));
    }
  }, [activeTab]);

  const handleOpenEdit = (week: BatchWeek) => {
    setEditWeek(week);
    setEditTitle(week.title);
    setEditDesc(week.description || '');
    setEditUnlockDate(week.unlock_date ? week.unlock_date.split('T')[0] : '');
    setIsEditOpen(true);
  };

  const handleSaveWeek = async () => {
    if (!batchId || !editWeek) return;
    setIsSaving(true);
    try {
      await batchContentApi.updateWeek(parseInt(batchId), editWeek.id, {
        title: editTitle,
        description: editDesc,
      });
      toast({ title: 'Success', description: 'Week updated successfully', variant: 'success' });
      setIsEditOpen(false);
      fetchWeeks();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update week', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (!batchId || !deleteWeekId) return;
    setIsDeletingWeek(true);
    try {
      await batchContentApi.deleteWeek(parseInt(batchId), deleteWeekId);
      toast({ title: 'Success', description: 'Week deleted successfully', variant: 'success' });
      setDeleteWeekId(null);
      // If we deleted the active tab, reset
      if (activeTab === deleteWeekId.toString()) setActiveTab('');
      await fetchWeeks();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to delete week';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsDeletingWeek(false);
    }
  };

  const handleAddWeek = async () => {
    let hasError = false;
    if (!newWeekTitle.trim()) { setNewWeekTitleError('Title is required'); hasError = true; } else { setNewWeekTitleError(''); }
    if (newWeekNumber === '' || newWeekNumber <= 0) {
      setNewWeekNumberError('A valid week number is required'); hasError = true;
    } else {
      const existingNumbers = new Set(weeks.map(w => w.week_number));
      const missingPrev = [];
      for (let i = 1; i < Number(newWeekNumber); i++) {
        if (!existingNumbers.has(i)) missingPrev.push(i);
      }
      if (missingPrev.length > 0) {
        setNewWeekNumberError(`Week ${missingPrev.join(', ')} must be created first before adding Week ${newWeekNumber}`);
        hasError = true;
      } else { setNewWeekNumberError(''); }
    }
    if (hasError || !batchId) return;
    setIsAddingWeek(true);
    try {
      await batchContentApi.createWeek(parseInt(batchId), {
        week_number: Number(newWeekNumber),
        title: newWeekTitle.trim(),
        description: '',
      });
      toast({ title: 'Success', description: 'Week added successfully', variant: 'success' });
      setIsAddWeekOpen(false);
      setNewWeekTitle('');
      await fetchWeeks();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to add week';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsAddingWeek(false);
    }
  };

  const handleExtendTimeline = async () => {
    if (!batchId) return;
    setIsExtending(true);
    try {
      await batchApi.extendTimeline(parseInt(batchId), extendDays);
      toast({ title: 'Success', description: `Program extended by ${extendDays} days` });
      setIsExtendOpen(false);
      fetchWeeks();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to extend program', variant: 'destructive' });
    } finally {
      setIsExtending(false);
    }
  };

  const handleOpenSessionModal = (session?: any) => {
    if (session) {
      setEditingSession(session);
      setVideoTitle(session.title);
      setVideoDesc(session.description || '');
      setSessionNumber(session.session_number);
      setWeekday(session.weekday || '');
      setVideoFile(null);
    } else {
      setEditingSession(null);
      setVideoTitle('');
      setVideoDesc('');
      setSessionNumber(1);
      setWeekday('');
      setVideoFile(null);
    }
    setVideoFormErrors({});
    setIsSessionModalOpen(true);
  };

  const handleSaveSession = async () => {
    const errors: Record<string, string> = {};
    if (!videoTitle.trim()) errors.title = 'Title is required';
    if (!batchId || !activeTab) errors.week = 'Please select a week/batch';
    if (sessionNumber === '' || sessionNumber <= 0) errors.session_number = 'Session number must be a valid number greater than 0';
    if (!weekday || weekday === 'none') errors.weekday = 'Weekday is required';
    if (!editingSession && !videoFile) errors.video_file = 'You must select a video file to upload';

    setVideoFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingSession(true);
    setUploadProgress(0);

    try {
      let finalVideoKey = '';
      let actualDurationSeconds = 0;

      if (videoFile) {
        try {
          const durationS = await getBlobDuration(videoFile);
          actualDurationSeconds = Math.round(durationS);
        } catch (err) {
          console.warn('Failed to parse video duration', err);
        }

        const initRes = await courseModuleApi.initMultipartUpload(videoFile.name, videoFile.type, videoFile.size);
        if (!initRes.success) throw new Error(initRes.message);

        const { upload_id, key, part_urls, chunk_size } = initRes.data;
        const uploadedParts = [];

        for (let i = 0; i < part_urls.length; i++) {
          const start = i * chunk_size;
          const end = Math.min(start + chunk_size, videoFile.size);
          const chunk = videoFile.slice(start, end);

          const uploadRes = await axios.put(part_urls[i], chunk, {
            headers: { 'Content-Type': videoFile.type },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const chunkPct = progressEvent.loaded / progressEvent.total;
                const overallPct = Math.round(((i + chunkPct) / part_urls.length) * 100);
                setUploadProgress(overallPct);
              }
            }
          });

          const etag = uploadRes.headers['etag'] || uploadRes.headers['ETag'];
          if (!etag) throw new Error("Storage server didn't return an ETag for the part.");
          
          uploadedParts.push({ ETag: etag, PartNumber: i + 1 });
        }

        const completeRes = await courseModuleApi.completeMultipartUpload(key, upload_id, uploadedParts);
        if (!completeRes.success) throw new Error("Failed to finalize upload.");
        
        finalVideoKey = completeRes.data.video_key;
      }

      const formData = new FormData();
      formData.append('title', videoTitle);
      formData.append('description', videoDesc);
      formData.append('session_number', sessionNumber.toString());
      formData.append('weekday', weekday);
      if (actualDurationSeconds > 0) formData.append('duration_seconds', actualDurationSeconds.toString()); 
      if (finalVideoKey) formData.append('video_file', finalVideoKey);

      if (editingSession) {
        await batchContentApi.updateSession(parseInt(batchId as string), parseInt(activeTab), editingSession.id, formData);
      } else {
        await batchContentApi.createSession(parseInt(batchId as string), parseInt(activeTab), formData);
      }
      
      toast({ title: 'Success', description: editingSession ? 'Session updated' : 'Session created' });
      setIsSessionModalOpen(false);
      fetchContent(parseInt(activeTab));
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save session', variant: 'destructive' });
    } finally {
      setIsSavingSession(false);
      setUploadProgress(-1);
    }
  };

  const handleDeleteSession = async () => {
    if (!batchId || !activeTab || !deleteSessionId) return;
    setIsDeletingSession(true);
    try {
      await batchContentApi.deleteSession(parseInt(batchId), parseInt(activeTab), deleteSessionId);
      toast({ title: 'Success', description: 'Session deleted' });
      setDeleteSessionId(null);
      fetchContent(parseInt(activeTab));
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to delete session';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsDeletingSession(false);
    }
  };

  const handleOpenTestManager = (week: BatchWeek) => {
    setTestWeek(week);
    setIsTestModalOpen(true);
  };


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/batches')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {batchName || 'Batch Content'}
            </h1>
            <p className="mt-1 text-muted-foreground">Manage schedule and content for this specific batch</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setIsAddWeekOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Week
            </Button>
            <Button variant="outline" onClick={() => setIsExtendOpen(true)}>
              <Clock className="h-4 w-4 mr-2" />
              Extend Program
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

            {weeks.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium">No weeks initialized</h3>
                <p className="text-muted-foreground mb-6">This batch doesn't have any weekly content yet. Click "Add Week" to create the first week.</p>
                <Button variant="outline" onClick={() => setIsAddWeekOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Week
                </Button>
              </div>
            ) : (
              weeks.map(week => (
                <TabsContent key={week.id} value={week.id.toString()} className="space-y-6">

                  {/* Week info card — with title, unlock date, status, edit/delete */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <Card className="flex-1 shadow-card">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-2xl font-bold">{week.title}</CardTitle>
                          <CardDescription>{week.description || 'No description provided.'}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenTestManager(week)} disabled={week.is_unlocked}>
                            <FileText className="h-4 w-4 mr-2" />
                            {weeklyTest ? 'Edit Assessment' : 'Add Test'}
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleOpenEdit(week)} disabled={week.is_unlocked}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setDeleteWeekId(week.id)} disabled={week.is_unlocked}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Unlock Date</p>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span className="font-medium">
                                {week.unlock_date ? format(new Date(week.unlock_date), 'PPP') : 'Not Set'}
                              </span>
                            </div>
                          </div>
                          <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Status</p>
                            <Badge variant={week.is_unlocked ? 'outline' : 'secondary'}>
                              {week.is_unlocked ? 'Unlocked' : 'Scheduled'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>


                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Class Sessions</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleOpenSessionModal()} disabled={week.is_unlocked}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Session
                    </Button>
                  </div>

                {loadingContent ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : sessions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-foreground/20 rounded-lg">
                    No videos uploaded for this week yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                        {[...sessions]
                          .sort((a, b) => {
                            const days: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
                            const dayA = days[a.weekday?.toLowerCase()] || 8;
                            const dayB = days[b.weekday?.toLowerCase()] || 8;
                            if (dayA !== dayB) return dayA - dayB;
                            return (a.session_number || 0) - (b.session_number || 0);
                          })
                          .map((session) => (
                          <Card key={session.id} className="shadow-card overflow-hidden group hover:shadow-md transition-all duration-300 bg-card border border-border/50">
                            <div className="flex flex-col sm:flex-row items-center p-4 gap-4">
                              {/* Left: Icon/Play */}
                              <div className="flex shrink-0">
                                <div 
                                  className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                                  onClick={() => {
                                    const url = session.video_presigned_url || session.video_url;
                                    if (url) {
                                      setPlayingVideoUrl(url);
                                    } else {
                                      toast({ title: 'Video Unavailable', description: 'This video is still processing or unavailable.', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  <Play className="h-6 w-6 fill-current ml-1" />
                                </div>
                              </div>

                              {/* Middle: Content */}
                              <div className="flex-1 min-w-0 text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                  <h3 className="font-bold text-foreground truncate text-lg">{session.title}</h3>
                                  {session.weekday && (
                                    <Badge variant="outline" className="w-fit mx-auto sm:mx-0 bg-background/90 shadow-sm border-primary/20 capitalize font-bold text-[10px] h-5 px-2">
                                      {session.weekday}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="w-fit mx-auto sm:mx-0 text-[10px] h-5 px-2 font-bold">
                                    SESSION {session.session_number}
                                  </Badge>
                                </div>
                                
                                {session.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                                    {session.description}
                                  </p>
                                )}
                                
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                      {session.duration_seconds > 0 ? (
                                        `${Math.floor(session.duration_seconds / 60).toString().padStart(2, '0')}:${(session.duration_seconds % 60).toString().padStart(2, '0')}`
                                      ) : 'Processing'}
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
                                      setMcqSession(session);
                                      setMcqApiUrl(`/api/courses/v1/batches/${batchId}/weeks/${activeTab}/sessions/${session.id}/mcq`);
                                      setIsMcqOpen(true);
                                    }}
                                  >
                                    <HelpCircle className="h-4 w-4" />
                                    <span className="text-xs font-bold">MCQs</span>
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => handleOpenSessionModal(session)} disabled={week.is_unlocked}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteSessionId(session.id)} disabled={week.is_unlocked}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                <Button 
                                  variant="gradient" 
                                  size="sm" 
                                  className="gap-2 px-6 h-9 rounded-lg shadow-sm font-bold"
                                  onClick={() => {
                                    const url = session.video_presigned_url || session.video_url;
                                    if (url) {
                                      setPlayingVideoUrl(url);
                                    }
                                  }}
                                >
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                  Watch
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                <div className="mt-8 pt-8 border-t border-foreground/10">
                  <h3 className="text-lg font-semibold mb-4">Weekly Assessment</h3>
                  {loadingContent ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : weeklyTest ? (
                    <Card className="shadow-card overflow-hidden group hover:shadow-md transition-all duration-300 bg-card border border-border/50">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <CheckCircle className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{weeklyTest.title}</CardTitle>
                            <CardDescription>
                              {weeklyTest.questions?.length || 0} Question{(weeklyTest.questions?.length || 0) !== 1 ? 's' : ''}
                              {' · '}{weeklyTest.pass_percentage ?? 70}% pass mark
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenTestManager(week)} disabled={week.is_unlocked}>
                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                            Manage
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {weeklyTest.instructions && (
                          <p className="text-sm text-foreground/70 mt-1 line-clamp-2">{weeklyTest.instructions}</p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="border-2 border-dashed border-foreground/20 rounded-xl p-8 text-center bg-muted/20">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <h4 className="font-medium text-foreground mb-1">No Assessment Configured</h4>
                      <p className="text-sm text-muted-foreground mb-4">Add a weekly test that students must complete.</p>
                      <Button variant="outline" onClick={() => handleOpenTestManager(week)} disabled={week.is_unlocked}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Weekly Test
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))
            )}
          </Tabs>
        )}
      </div>

      {/* Edit Week Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Batch Week</DialogTitle>
            <DialogDescription>Modify title and description for this batch week.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Week Title</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveWeek} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Week Dialog — same layout as Course content */}
      <Dialog open={isAddWeekOpen} onOpenChange={(open) => { if (!open) { setIsAddWeekOpen(false); setNewWeekTitle(''); setNewWeekTitleError(''); setNewWeekNumberError(''); } }}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Week</DialogTitle>
            <DialogDescription>Add a new content week to this batch. The unlock date is auto-calculated from the batch start date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newBatchWeekNumber">Week Number <span className="text-destructive">*</span></Label>
              <Input
                id="newBatchWeekNumber"
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={newWeekNumber}
                onChange={(e) => {
                  setNewWeekNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  if (newWeekNumberError) setNewWeekNumberError('');
                }}
                className={newWeekNumberError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {newWeekNumberError && <p className="text-sm text-destructive mt-1">{newWeekNumberError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newBatchWeekTitle">Week Title <span className="text-destructive">*</span></Label>
              <Input
                id="newBatchWeekTitle"
                placeholder="e.g. Loops & Statements"
                value={newWeekTitle}
                onChange={(e) => {
                  setNewWeekTitle(e.target.value);
                  if (newWeekTitleError) setNewWeekTitleError('');
                }}
                className={newWeekTitleError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {newWeekTitleError && <p className="text-sm text-destructive mt-1">{newWeekTitleError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsAddWeekOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleAddWeek} disabled={isAddingWeek}>
              {isAddingWeek ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Week
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Timeline Dialog */}
      <Dialog open={isExtendOpen} onOpenChange={setIsExtendOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Extend Program Timeline</DialogTitle>
            <DialogDescription>
              This will shift the unlock dates for all FUTURE (not yet unlocked) weeks by the specified number of days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Days to Extend</Label>
              <Input 
                type="number" 
                value={extendDays} 
                onChange={e => setExtendDays(parseInt(e.target.value))} 
                min={1} 
              />
              <p className="text-xs text-muted-foreground">Example: 7 days = 1 week extension.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsExtendOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleExtendTimeline} disabled={isExtending}>
              {isExtending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
              Apply Extension
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Session Modal */}
      <Dialog open={isSessionModalOpen} onOpenChange={(v) => { if (!v) setIsSessionModalOpen(false) }}>
        <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Class Session' : 'Add Class Session'}</DialogTitle>
            <DialogDescription>
              {editingSession ? 'Update details, upload a new video, or change the thumbnail.' : 'Upload a new video session to this week. Videos are uploaded directly to Object Storage.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Label htmlFor="session_number">Session Number</Label>
                <Input
                  id="session_number"
                  type="number"
                  value={sessionNumber}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : '';
                    setSessionNumber(val as any);
                    if (videoFormErrors.session_number) setVideoFormErrors((p) => ({ ...p, session_number: '' }));
                  }}
                  className={videoFormErrors.session_number ? "border-destructive mt-1" : "mt-1"}
                />
                {videoFormErrors.session_number && <p className="text-xs text-destructive mt-1 absolute -bottom-5 left-0">{videoFormErrors.session_number}</p>}
              </div>

              <div className="relative">
                  <Label htmlFor="weekday" className="text-sm font-medium">Class Day</Label>
                  <Select value={weekday} onValueChange={(val) => {
                      setWeekday(val);
                      if (videoFormErrors.weekday) setVideoFormErrors(p => ({ ...p, weekday: '' }));
                  }}>
                      <SelectTrigger className={`mt-1 ${videoFormErrors.weekday ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Select a day" />
                      </SelectTrigger>
                      <SelectContent>
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                              <SelectItem key={day} value={day} className="capitalize">{day}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  {videoFormErrors.weekday && <p className="text-xs text-destructive mt-1 absolute -bottom-5 left-0">{videoFormErrors.weekday}</p>}
              </div>
            </div>

            <div className="grid gap-2 relative">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                value={videoTitle}
                onChange={(e) => {
                  setVideoTitle(e.target.value);
                  if (videoFormErrors.title) setVideoFormErrors((p) => ({ ...p, title: '' }));
                }}
                className={videoFormErrors.title ? "border-destructive" : ""}
                placeholder="e.g. Introduction to Variables"
              />
              {videoFormErrors.title && <p className="text-xs text-destructive absolute -bottom-5 left-0">{videoFormErrors.title}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Session Description (Optional)</Label>
              <Textarea
                id="description"
                value={videoDesc}
                onChange={(e) => setVideoDesc(e.target.value)}
                placeholder="Add notes, context, or homework references..."
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
                <Label>Video File</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${videoFormErrors.video_file ? 'border-destructive/50 bg-destructive/5' : 'hover:bg-muted/50'} ${videoFile || (editingSession && editingSession.video_file) ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setVideoFile(e.target.files[0]);
                        if (videoFormErrors.video_file) setVideoFormErrors((p) => ({ ...p, video_file: '' }));
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    {videoFile ? (
                      <>
                        <div className="p-2 bg-primary/10 rounded-full">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-sm font-medium text-primary line-clamp-1 px-4">{videoFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </>
                    ) : editingSession && editingSession.video_file ? (
                      <>
                        <div className="p-2 bg-primary/10 rounded-full">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-sm font-medium text-primary">Video Uploaded</div>
                        <div className="text-xs text-muted-foreground mt-1 px-2">Click to replace existing video file</div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-muted rounded-full">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-sm font-medium">Click to upload video</div>
                        <div className="text-xs text-muted-foreground">MP4, WebM (Max 5GB)</div>
                      </>
                    )}
                  </div>
                </div>
                {videoFormErrors.video_file && <p className="text-xs text-destructive">{videoFormErrors.video_file}</p>}
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress >= 0 && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Uploading {uploadProgress === 100 ? 'and Processing...' : 'Video...'}
                  </span>
                  <span className="font-bold text-primary">{Math.min(uploadProgress, 100)}%</span>
                </div>
                <div className="h-2 bg-muted overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out" 
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSessionModalOpen(false)} disabled={isSavingSession}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSaveSession} disabled={isSavingSession}>
              {isSavingSession ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadProgress >= 0 ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                editingSession ? 'Update Session' : 'Save Session'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Weekly Test Manager (Batch) */}
      {testWeek && batchId && (
        <WeeklyTestManager
          open={isTestModalOpen}
          onClose={() => { setIsTestModalOpen(false); setTestWeek(null); }}
          existingTest={weeklyTest ?? null}
          weekLabel={`Week ${testWeek.week_number}: ${testWeek.title}`}
          testApiBase={`/api/courses/v1/batches/${batchId}/weeks/${testWeek.id}/test/manage`}
          onSaved={() => fetchContent(parseInt(activeTab))}
        />
      )}

      {/* Session MCQ Manager */}
      <SessionMcqManager
        open={isMcqOpen}
        onClose={() => setIsMcqOpen(false)}
        session={mcqSession}
        apiBaseUrl={mcqApiUrl}
        onSaved={() => fetchContent(parseInt(activeTab))}
      />

      {/* Delete Session Confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this session and its video. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSession}
              disabled={isDeletingSession}
            >
              {isDeletingSession ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Week Confirmation */}
      <AlertDialog open={!!deleteWeekId} onOpenChange={() => setDeleteWeekId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this week?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this week along with ALL its sessions and tests. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWeek}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteWeek}
              disabled={isDeletingWeek}
            >
              {isDeletingWeek ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Week
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
    </DashboardLayout>
  );
}
