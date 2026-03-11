import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Calendar,
  Clock,
  Edit,
  Trash2,
  Video,
  Loader2,
  CheckCircle,
  Archive,
  Upload,
  Play,
  PlayCircle as PlayCircleIcon,
  Lock as LockIcon,
  BookOpen,
  Info,
} from 'lucide-react';
import { webinarApi, Webinar } from '@/lib/webinar-api';
import { batchApi } from '@/lib/batch-api';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { courseModuleApi } from '@/lib/course-module-api';
import axios from 'axios';
import getBlobDuration from 'get-blob-duration';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

export default function SpecialSessions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  // Tab states
  const [activeTab, setActiveTab] = useState('available');
  const [availableWebinars, setAvailableWebinars] = useState<Webinar[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availablePage, setAvailablePage] = useState(1);
  const [availableTotalPages, setAvailableTotalPages] = useState(1);
  const [availableTotal, setAvailableTotal] = useState(0);

  const [upcomingWebinars, setUpcomingWebinars] = useState<Webinar[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);
  const [upcomingTotal, setUpcomingTotal] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editWebinar, setEditWebinar] = useState<Webinar | null>(null);
  const [deleteWebinarId, setDeleteWebinarId] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    session_type: 'special_session' as 'webinar' | 'special_session',
    description: '',
    unlock_at: '',
    duration_secs: 3600,
    video_file: null as File | null,
  });

  const fetchBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const res = await batchApi.getBatches({ paginate: false });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setBatches(res.data);
        
        // Try to get batchId from URL if coming from AdminBatches
        const urlParams = new URLSearchParams(location.search);
        const urlBatchId = urlParams.get('batchId');
        
        const initialBatch = urlBatchId 
          ? res.data.find((b: any) => b.id === parseInt(urlBatchId)) || res.data[0]
          : res.data[0];

        setSelectedBatchId(initialBatch.id);
        setSelectedBatchName(initialBatch.name);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch batches', variant: 'destructive' });
    } finally {
      setLoadingBatches(false);
    }
  }, [toast, location.search]);

  const fetchAvailable = useCallback(async (batchId: number, page = 1) => {
    try {
      setAvailableLoading(true);
      const res = await webinarApi.getWebinars(batchId, { tab: 'passed', page, page_size: 6 });
      if (res.success) {
        setAvailableWebinars(res.data);
        setAvailableTotalPages(res.total_pages);
        setAvailableTotal(res.total_items);
        setAvailablePage(page);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch available sessions', variant: 'destructive' });
    } finally {
      setAvailableLoading(false);
    }
  }, [toast]);

  const fetchUpcoming = useCallback(async (batchId: number, page = 1) => {
    try {
      setUpcomingLoading(true);
      const res = await webinarApi.getWebinars(batchId, { tab: 'scheduled', page, page_size: 6 });
      if (res.success) {
        setUpcomingWebinars(res.data);
        setUpcomingTotalPages(res.total_pages);
        setUpcomingTotal(res.total_items);
        setUpcomingPage(page);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch upcoming sessions', variant: 'destructive' });
    } finally {
      setUpcomingLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchAvailable(selectedBatchId, 1);
      fetchUpcoming(selectedBatchId, 1);
    }
  }, [selectedBatchId, fetchAvailable, fetchUpcoming]);

  const handleOpenModal = (webinar?: Webinar) => {
    if (webinar) {
      setEditWebinar(webinar);
      const existingUnlockAt = webinar.unlock_at ? new Date(webinar.unlock_at) : null;
      const unlockAtValue = existingUnlockAt ? format(existingUnlockAt, "yyyy-MM-dd'T'HH:mm") : '';
      setFormData({
        title: webinar.title,
        session_type: webinar.session_type,
        description: webinar.description || '',
        unlock_at: unlockAtValue,
        duration_secs: webinar.duration_secs,
        video_file: null,
      });
    } else {
      setEditWebinar(null);
      setFormData({
        title: '',
        session_type: 'special_session',
        description: '',
        unlock_at: '',
        duration_secs: 3600,
        video_file: null,
      });
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;

    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.unlock_at) errors.unlock_at = 'Unlock time is required';
    if (!formData.video_file && !editWebinar?.video_file) errors.video_file = 'Video session is required.';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setIsSubmitting(true);
      setUploadProgress(0);

      let finalVideoKey = '';
      const formPayload = new FormData();

      if (formData.video_file) {
        let calculatedDurationSecs = 0;
        try {
          const durationS = await getBlobDuration(formData.video_file);
          calculatedDurationSecs = Math.max(1, Math.round(durationS));
        } catch (err) {
          console.warn('Failed to parse video duration', err);
        }

        const initRes = await courseModuleApi.initMultipartUpload(formData.video_file.name, formData.video_file.type, formData.video_file.size);
        if (!initRes.success) throw new Error(initRes.message);

        const { upload_id, key, part_urls, chunk_size } = initRes.data;
        const uploadedParts = [];

        for (let i = 0; i < part_urls.length; i++) {
          const start = i * chunk_size;
          const end = Math.min(start + chunk_size, formData.video_file.size);
          const chunk = formData.video_file.slice(start, end);

          const uploadRes = await axios.put(part_urls[i], chunk, {
            headers: { 'Content-Type': formData.video_file.type },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const chunkPct = progressEvent.loaded / progressEvent.total;
                const overallPct = Math.round(((i + chunkPct) / part_urls.length) * 100);
                setUploadProgress(overallPct);
              }
            }
          });

          const etag = uploadRes.headers['etag'] || uploadRes.headers['ETag'];
          uploadedParts.push({ ETag: etag, PartNumber: i + 1 });
        }

        const completeRes = await courseModuleApi.completeMultipartUpload(key, upload_id, uploadedParts);
        finalVideoKey = completeRes.data.video_key;
        if (calculatedDurationSecs > 0) {
          formPayload.append('duration_secs', calculatedDurationSecs.toString());
        }
      }

      formPayload.append('title', formData.title);
      formPayload.append('session_type', formData.session_type);
      formPayload.append('description', formData.description);
      formPayload.append('unlock_at', new Date(formData.unlock_at).toISOString());
      if (finalVideoKey) formPayload.append('video_file', finalVideoKey);

      if (editWebinar) {
        await webinarApi.updateWebinar(selectedBatchId, editWebinar.id, formPayload);
        toast({ title: 'Success', description: 'Session updated successfully', variant: 'success' });
      } else {
        await webinarApi.createWebinar(selectedBatchId, formPayload);
        toast({ title: 'Success', description: 'Special session added successfully', variant: 'success' });
      }
      setIsModalOpen(false);
      fetchAvailable(selectedBatchId, 1);
      fetchUpcoming(selectedBatchId, 1);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save session', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(-1);
    }
  };

  const confirmDelete = async () => {
    if (!selectedBatchId || !deleteWebinarId) return;
    try {
      await webinarApi.deleteWebinar(selectedBatchId, deleteWebinarId);
      toast({ title: 'Deleted', description: 'Session removed successfully', variant: 'success' });
      fetchAvailable(selectedBatchId, 1);
      fetchUpcoming(selectedBatchId, 1);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete session', variant: 'destructive' });
    } finally {
      setDeleteWebinarId(null);
    }
  };

  const RecordingCard = ({ webinar, canEdit = true, isUpcoming = false }: { webinar: Webinar, canEdit?: boolean, isUpcoming?: boolean }) => {
    const isLocked = isUpcoming && !isAdminOrTeacher;
    
    return (
      <Card className="shadow-card overflow-hidden group hover:shadow-md transition-all duration-300 bg-card border border-border/50">
        <div className="flex flex-col sm:flex-row items-center p-4 gap-4">
          {/* Left: Icon */}
          <div className="flex shrink-0">
            <div 
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                isLocked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer"
              )}
              onClick={() => !isLocked && webinar.video_presigned_url && setPlayingVideoUrl(webinar.video_presigned_url)}
            >
              {isLocked ? <LockIcon className="h-6 w-6" /> : <PlayCircleIcon className="h-6 w-6" />}
            </div>
          </div>

          {/* Middle: Content */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground truncate text-lg">{webinar.title}</h3>
              <Badge variant="outline" className="w-fit mx-auto sm:mx-0 text-[10px] h-5 bg-background font-semibold border-primary/20 text-primary">
                {webinar.session_type === 'special_session' ? 'Special' : 'Webinar'}
              </Badge>
            </div>
            
            {webinar.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {webinar.description}
              </p>
            )}
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{webinar.duration_secs > 0 ? (
                    `${Math.floor(webinar.duration_secs / 3600).toString().padStart(2, '0')}:${(Math.floor(webinar.duration_secs % 3600 / 60)).toString().padStart(2, '0')}:${(webinar.duration_secs % 60).toString().padStart(2, '0')}`
                  ) : '00:00:00'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(new Date(webinar.unlock_at), "MMM d, yyyy")}</span>
              </div>
              {isUpcoming && (
                <div className="flex items-center gap-1.5 text-amber-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Available at {format(new Date(webinar.unlock_at), "h:mm a")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 shrink-0 ml-auto w-full sm:w-auto justify-center sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0">
            {canEdit && isAdminOrTeacher && (
              <div className="flex items-center gap-1">
                {isUpcoming && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => handleOpenModal(webinar)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteWebinarId(webinar.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!isLocked ? (
              <Button 
                onClick={() => webinar.video_presigned_url && setPlayingVideoUrl(webinar.video_presigned_url)}
                variant="gradient" 
                size="sm" 
                className="gap-2 px-6 h-9 rounded-lg shadow-sm font-bold"
                disabled={!webinar.video_presigned_url}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Watch
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                size="sm" 
                className="gap-2 px-6 h-9 rounded-lg cursor-not-allowed opacity-70 font-bold"
                disabled
              >
                <LockIcon className="h-3.5 w-3.5" />
                Locked
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Special Sessions</h1>
            <p className="mt-1 text-muted-foreground">Access exclusive workshops, guest lectures, and special course content</p>
          </div>
          
          {isAdminOrTeacher && (
            <Button onClick={() => handleOpenModal()} variant="gradient" className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              Add Session
            </Button>
          )}
        </div>

        {/* Batch Selection */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-card border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
               <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Selection Filter</p>
              <h3 className="font-bold text-foreground">{selectedBatchName || 'Select a batch'}</h3>
            </div>
          </div>
          
          <div className="flex-1 w-full sm:w-auto sm:max-w-[280px]">
            <Select 
              value={selectedBatchId?.toString()} 
              onValueChange={(val) => {
                const bId = Number(val);
                setSelectedBatchId(bId);
                const batch = batches.find(b => b.id === bId);
                if (batch) setSelectedBatchName(batch.name);
              }}
              disabled={loadingBatches || batches.length === 0}
            >
              <SelectTrigger className="w-full h-11 rounded-xl bg-background">
                <SelectValue placeholder="Select course batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map(batch => (
                  <SelectItem key={batch.id} value={batch.id.toString()}>{batch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="available" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit">
            <TabsTrigger value="available" className="gap-2 min-w-32 px-4 transition-all">
              <Archive className="h-4 w-4" />
              Available
              {availableTotal > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {availableTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2 min-w-32 px-4 transition-all">
              <Clock className="h-4 w-4" />
              Upcoming
              {upcomingTotal > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {upcomingTotal}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-0">
            {availableLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Loading sessions...</p>
              </div>
            ) : availableWebinars.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl bg-card/50">
                <Archive className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <h3 className="text-lg font-bold mb-1">No sessions available</h3>
                <p className="max-w-sm mx-auto">Once special sessions are uploaded and released, they will appear here in your list.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {availableWebinars.map(w => (
                  <RecordingCard key={w.id} webinar={w} canEdit={isAdminOrTeacher} />
                ))}
              </div>
            )}
            
            {availableTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-8">
                <Button variant="outline" size="sm" onClick={() => fetchAvailable(selectedBatchId!, availablePage - 1)} disabled={availablePage === 1}>Previous</Button>
                <span className="text-sm font-medium text-muted-foreground">Page {availablePage} of {availableTotalPages}</span>
                <Button variant="outline" size="sm" onClick={() => fetchAvailable(selectedBatchId!, availablePage + 1)} disabled={availablePage === availableTotalPages}>Next</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0">
            {upcomingLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Fetching upcoming sessions...</p>
              </div>
            ) : upcomingWebinars.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl bg-card/50">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <h3 className="text-lg font-bold mb-1">Nothing scheduled yet</h3>
                <p className="max-w-sm mx-auto">No upcoming special sessions are currently planned for this batch.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {upcomingWebinars.map(w => (
                  <RecordingCard key={w.id} webinar={w} canEdit={isAdminOrTeacher} isUpcoming={true} />
                ))}
              </div>
            )}
            
            {upcomingTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-8">
                <Button variant="outline" size="sm" onClick={() => fetchUpcoming(selectedBatchId!, upcomingPage - 1)} disabled={upcomingPage === 1}>Previous</Button>
                <span className="text-sm font-medium text-muted-foreground">Page {upcomingPage} of {upcomingTotalPages}</span>
                <Button variant="outline" size="sm" onClick={() => fetchUpcoming(selectedBatchId!, upcomingPage + 1)} disabled={upcomingPage === upcomingTotalPages}>Next</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
            <form onSubmit={handleSubmit}>
              <DialogHeader className="p-6 bg-muted/30 pb-4 border-b">
                <DialogTitle className="text-2xl font-bold">{editWebinar ? 'Edit Session' : 'Add Session'}</DialogTitle>
                <DialogDescription>Details for the special session or video resource.</DialogDescription>
              </DialogHeader>
              
              <div className="p-6 space-y-5">
                <div className="grid gap-2 relative pb-2">
                  <Label htmlFor="title" className="text-sm font-semibold">Session Title <span className="text-destructive">*</span></Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Guest Lecture: Industry Insights" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className={cn("h-11 rounded-xl", formErrors.title && "border-destructive")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type" className="text-sm font-semibold">Type</Label>
                    <Select value={formData.session_type} onValueChange={(v: any) => setFormData({...formData, session_type: v})}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="webinar">Webinar</SelectItem>
                        <SelectItem value="special_session">Special Session</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Release Date/Time <span className="text-destructive">*</span></Label>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <button type="button" className={cn("flex w-full justify-start items-center h-11 px-3 text-sm border rounded-xl bg-background", !formData.unlock_at && "text-muted-foreground", formErrors.unlock_at && "border-destructive")}>
                          <Calendar className="mr-2 h-4 w-4 opacity-50" />
                          {formData.unlock_at ? format(new Date(formData.unlock_at), "PPP p") : "Pick time"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarUI
                          mode="single"
                          selected={formData.unlock_at ? new Date(formData.unlock_at) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const current = formData.unlock_at ? new Date(formData.unlock_at) : new Date();
                            date.setHours(current.getHours());
                            date.setMinutes(current.getMinutes());
                            setFormData(p => ({ ...p, unlock_at: format(date, "yyyy-MM-dd'T'HH:mm") }));
                          }}
                        />
                        <div className="p-3 border-t flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <Input type="time" value={formData.unlock_at ? format(new Date(formData.unlock_at), "HH:mm") : ""} onChange={(e) => {
                            const [h, m] = e.target.value.split(':');
                            const current = formData.unlock_at ? new Date(formData.unlock_at) : new Date();
                            current.setHours(parseInt(h));
                            current.setMinutes(parseInt(m));
                            setFormData(p => ({ ...p, unlock_at: format(current, "yyyy-MM-dd'T'HH:mm") }));
                          }} className="h-9" />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
                  <Textarea id="description" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-xl resize-none" />
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Video File (.mp4) <span className="text-destructive">*</span></Label>
                  <div className={cn("border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all", formData.video_file || editWebinar?.video_file ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50")} onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4" onChange={(e) => e.target.files?.[0] && setFormData({...formData, video_file: e.target.files[0]})} />
                    <div className="flex flex-col items-center gap-2">
                      {formData.video_file ? (
                        <><CheckCircle className="h-8 w-8 text-primary" /><p className="text-sm font-medium">{formData.video_file.name}</p></>
                      ) : editWebinar?.video_file ? (
                        <><CheckCircle className="h-8 w-8 text-primary" /><p className="text-sm font-medium">Video Available</p><p className="text-xs text-muted-foreground">Click to replace</p></>
                      ) : (
                        <><Upload className="h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Click to upload video</p></>
                      )}
                    </div>
                  </div>
                </div>

                {uploadProgress >= 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold"><span className="text-primary uppercase tracking-widest">Uploading</span><span>{uploadProgress}%</span></div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 bg-muted/30 border-t gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : editWebinar ? 'Update Session' : 'Save Session'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteWebinarId} onOpenChange={() => setDeleteWebinarId(null)}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader><AlertDialogTitle>Delete Special Session?</AlertDialogTitle><AlertDialogDescription>This session will be permanently deleted. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Video Player */}
        <Dialog open={!!playingVideoUrl} onOpenChange={(open) => !open && setPlayingVideoUrl(null)}>
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-none" onOpenAutoFocus={(e) => e.preventDefault()}>
            {playingVideoUrl && <div className="aspect-video"><VideoPlayer url={playingVideoUrl} /></div>}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
