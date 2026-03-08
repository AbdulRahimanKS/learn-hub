import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Loader2,
  CheckCircle2,
  CheckCircle,
  FileVideo,
  ChevronLeft,
  Upload,
  Lock,
  Unlock,
  Play
} from 'lucide-react';
import { webinarApi, Webinar } from '@/lib/webinar-api';
import { batchApi } from '@/lib/batch-api';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { courseModuleApi } from '@/lib/course-module-api';
import axios from 'axios';
import getBlobDuration from 'get-blob-duration';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

export default function WebinarManagement() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [batchName, setBatchName] = useState('');
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  // Scheduled tab state
  const [scheduledWebinars, setScheduledWebinars] = useState<Webinar[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledTotalPages, setScheduledTotalPages] = useState(1);

  // Passed tab state
  const [passedWebinars, setPassedWebinars] = useState<Webinar[]>([]);
  const [passedLoading, setPassedLoading] = useState(true);
  const [passedPage, setPassedPage] = useState(1);
  const [passedTotalPages, setPassedTotalPages] = useState(1);

  // Count badges (total for each tab, from first load)
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [passedTotal, setPassedTotal] = useState(0);

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
    session_type: 'webinar' as 'webinar' | 'special_session',
    description: '',
    unlock_at: '',
    duration_secs: 3600,
    video_file: null as File | null,
  });

  const fetchScheduled = useCallback(async (page = scheduledPage) => {
    if (!batchId) return;
    try {
      setScheduledLoading(true);
      const res = await webinarApi.getWebinars(parseInt(batchId), { tab: 'scheduled', page, page_size: 6 });
      if (res.success) {
        setScheduledWebinars(res.data);
        setScheduledTotalPages(res.total_pages);
        setScheduledTotal(res.total_items);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch scheduled webinars', variant: 'destructive' });
    } finally {
      setScheduledLoading(false);
    }
  }, [batchId, scheduledPage, toast]);

  const fetchPassed = useCallback(async (page = passedPage) => {
    if (!batchId) return;
    try {
      setPassedLoading(true);
      const res = await webinarApi.getWebinars(parseInt(batchId), { tab: 'passed', page, page_size: 6 });
      if (res.success) {
        setPassedWebinars(res.data);
        setPassedTotalPages(res.total_pages);
        setPassedTotal(res.total_items);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch past webinars', variant: 'destructive' });
    } finally {
      setPassedLoading(false);
    }
  }, [batchId, passedPage, toast]);

  const refetchAll = useCallback(() => {
    fetchScheduled(1);
    setScheduledPage(1);
    fetchPassed(1);
    setPassedPage(1);
  }, [fetchScheduled, fetchPassed]);

  const fetchBatchDetails = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await batchApi.getBatch(parseInt(batchId));
      if (res.success) {
        setBatchName(res.data.name);
      }
    } catch {}
  }, [batchId]);

  useEffect(() => { fetchScheduled(); }, [fetchScheduled]);
  useEffect(() => { fetchPassed(); }, [fetchPassed]);
  useEffect(() => { fetchBatchDetails(); }, [fetchBatchDetails]);

  const handleOpenModal = (webinar?: Webinar) => {
    if (webinar) {
      setEditWebinar(webinar);
      // If the existing unlock_at is in the past, clear it so the user must pick a new future time
      const existingUnlockAt = webinar.unlock_at ? new Date(webinar.unlock_at) : null;
      const unlockAtValue = existingUnlockAt && existingUnlockAt > new Date()
        ? format(existingUnlockAt, "yyyy-MM-dd'T'HH:mm")
        : '';
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
        session_type: 'webinar',
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
    if (!batchId) return;

    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Webinar title is required';
    if (!formData.unlock_at) {
      errors.unlock_at = 'Start time is required';
    } else if (new Date(formData.unlock_at) <= new Date()) {
      errors.unlock_at = 'Start time must be in the future';
    }
    if (!formData.video_file && !editWebinar?.video_file) errors.video_file = 'Video recording is required.';

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
          if (!etag) throw new Error("Storage server didn't return an ETag for the part.");
          
          uploadedParts.push({ ETag: etag, PartNumber: i + 1 });
        }

        const completeRes = await courseModuleApi.completeMultipartUpload(key, upload_id, uploadedParts);
        if (!completeRes.success) throw new Error("Failed to finalize upload.");
        
        finalVideoKey = completeRes.data.video_key;
        if (calculatedDurationSecs > 0) {
          formPayload.append('duration_secs', calculatedDurationSecs.toString());
        }
      }

      formPayload.append('title', formData.title);
      formPayload.append('session_type', formData.session_type);
      formPayload.append('description', formData.description);
      formPayload.append('unlock_at', new Date(formData.unlock_at).toISOString());
      if (finalVideoKey) {
        formPayload.append('video_file', finalVideoKey);
      }

      if (editWebinar) {
        await webinarApi.updateWebinar(parseInt(batchId), editWebinar.id, formPayload);
        toast({ title: 'Success', description: 'Webinar updated successfully', variant: 'success' });
      } else {
        await webinarApi.createWebinar(parseInt(batchId), formPayload);
        toast({ title: 'Success', description: 'Webinar created successfully', variant: 'success' });
      }
      setIsModalOpen(false);
      refetchAll();
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || err.message || 'Failed to save webinar', 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(-1);
    }
  };

  const confirmDelete = async () => {
    if (!batchId || !deleteWebinarId) return;
    try {
      await webinarApi.deleteWebinar(parseInt(batchId), deleteWebinarId);
      toast({ title: 'Success', description: 'Webinar deleted successfully', variant: 'success' });
      refetchAll();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete webinar', variant: 'destructive' });
    } finally {
      setDeleteWebinarId(null);
    }
  };


  const WebinarCard = ({ webinar, canEdit = true }: { webinar: Webinar, canEdit?: boolean }) => (
    <Card className="shadow-card overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col h-full">
      <div className="relative aspect-video">
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-20 mix-blend-overlay"></div>
          <Video className="h-12 w-12 text-white/20 mb-3" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        
        {/* Play button overlay — shown for any webinar with a recording */}
        {webinar.video_presigned_url && (
           <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center z-10">
              <div 
                className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center scale-90 group-hover:scale-110 opacity-0 group-hover:opacity-100 transition-all shadow-2xl cursor-pointer shadow-primary/50"
                onClick={() => setPlayingVideoUrl(webinar.video_presigned_url!)}
                title="Play Recording"
              >
                <Play className="h-6 w-6 fill-current ml-1" />
              </div>
            </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
          {/* Duration on the left */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-black/60 px-2.5 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-lg">
            <Clock className="h-3.5 w-3.5" />
            <span>{webinar.duration_secs > 0 ? (
                `${Math.floor(webinar.duration_secs / 3600).toString().padStart(2, '0')}:${(Math.floor(webinar.duration_secs % 3600 / 60)).toString().padStart(2, '0')}:${(webinar.duration_secs % 60).toString().padStart(2, '0')}`
              ) : '00:00:00'}</span>
          </div>

          {/* Type on the right */}
          <Badge className="bg-black/60 hover:bg-black/70 text-white font-bold text-[11px] h-6 px-2.5 border border-white/10 backdrop-blur-md shadow-lg">
            {webinar.session_type === 'special_session' ? 'Special Session' : 'Webinar'}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 flex flex-col flex-1 bg-card">
        <h3 className="font-bold text-foreground line-clamp-1 text-lg leading-tight">{webinar.title}</h3>
        {webinar.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {webinar.description}
          </p>
        )}
        {/* Date + inline edit/delete — always at the bottom */}
        <div className="flex items-center gap-2 mt-auto pt-4 text-sm font-medium text-primary">
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="flex-1">{format(new Date(webinar.unlock_at), "MMM d, yyyy 'at' h:mm a")}</span>
          {canEdit && (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.preventDefault(); handleOpenModal(webinar); }} title="Edit">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.preventDefault(); setDeleteWebinarId(webinar.id); }} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumbs & Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/batches')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {batchName ? `${batchName} - Webinars` : 'Webinar Management'}
            </h1>
            <p className="mt-1 text-muted-foreground">Schedule and manage live sessions for this batch</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="gradient" onClick={() => handleOpenModal()} className="shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </div>
        </div>

        <Tabs defaultValue="scheduled" className="w-full space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit">
            <TabsTrigger value="scheduled" className="gap-2 min-w-32 px-4">
              <Calendar className="h-4 w-4" />
              Scheduled
              {scheduledTotal > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {scheduledTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="passed" className="gap-2 min-w-32 px-4">
              <Clock className="h-4 w-4" />
              Passed
              {passedTotal > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {passedTotal}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="focus-visible:outline-none">
            {scheduledLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading webinars...</p>
              </div>
            ) : scheduledWebinars.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No upcoming webinars scheduled</h3>
                <p>Click &quot;Schedule&quot; to plan your first live session.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {scheduledWebinars.map(webinar => (
                    <WebinarCard key={webinar.id} webinar={webinar} />
                  ))}
                </div>
                {scheduledTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button variant="outline" size="sm" onClick={() => setScheduledPage(p => Math.max(1, p - 1))} disabled={scheduledPage === 1}>Previous</Button>
                    <div className="text-sm font-medium text-muted-foreground px-4">Page {scheduledPage} of {scheduledTotalPages}</div>
                    <Button variant="outline" size="sm" onClick={() => setScheduledPage(p => Math.min(scheduledTotalPages, p + 1))} disabled={scheduledPage === scheduledTotalPages}>Next</Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="passed" className="focus-visible:outline-none">
            {passedLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading webinars...</p>
              </div>
            ) : passedWebinars.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No past webinars</h3>
                <p>Webinars will appear here once they have passed their scheduled time.</p>
              </div>
            ) : (
              <div className="space-y-6 opacity-90 transition-opacity">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {passedWebinars.map(webinar => (
                    <WebinarCard key={webinar.id} webinar={webinar} canEdit={false} />
                  ))}
                </div>
                {passedTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button variant="outline" size="sm" onClick={() => setPassedPage(p => Math.max(1, p - 1))} disabled={passedPage === 1}>Previous</Button>
                    <div className="text-sm font-medium text-muted-foreground px-4">Page {passedPage} of {passedTotalPages}</div>
                    <Button variant="outline" size="sm" onClick={() => setPassedPage(p => Math.min(passedTotalPages, p + 1))} disabled={passedPage === passedTotalPages}>Next</Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent 
            className="sm:max-w-[550px] p-0 overflow-hidden rounded-3xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <form onSubmit={handleSubmit}>
              <DialogHeader className="p-6 bg-muted/30 pb-4">
                <DialogTitle className="text-2xl">{editWebinar ? 'Edit Webinar' : 'Schedule New Webinar'}</DialogTitle>
                <DialogDescription>
                  Enter the details for the webinar session.
                </DialogDescription>
              </DialogHeader>
              
              <div className="p-6 space-y-5">
                <div className="grid gap-2 relative pb-4">
                  <Label htmlFor="title" className="text-sm font-semibold">Title <span className="text-destructive">*</span></Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Advanced React Patterns" 
                    value={formData.title}
                    onChange={e => {
                      setFormData({...formData, title: e.target.value});
                      if (formErrors.title) setFormErrors(p => ({...p, title: ''}));
                    }}
                    className={`h-11 rounded-xl ${formErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {formErrors.title && <p className="text-xs text-destructive absolute bottom-0 left-0">{formErrors.title}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2 relative pb-4">
                    <Label htmlFor="type" className="text-sm font-semibold">Session Type</Label>
                    <Select 
                      value={formData.session_type} 
                      onValueChange={(v: any) => setFormData({...formData, session_type: v})}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="webinar">Webinar</SelectItem>
                        <SelectItem value="special_session">Special Session</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2 relative pb-4">
                    <Label className="text-sm font-semibold">Start Time <span className="text-destructive">*</span></Label>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full justify-start items-center h-11 px-3 py-2 text-sm font-normal bg-background hover:bg-transparent border border-input rounded-xl ring-offset-background placeholder:text-muted-foreground focus:outline-none",
                            !formData.unlock_at && "text-muted-foreground",
                            formErrors.unlock_at && "border-destructive text-destructive focus:ring-destructive"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4 opacity-50" />
                          {formData.unlock_at ? format(new Date(formData.unlock_at), "PPP p") : <span>Pick date & time</span>}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarUI
                          mode="single"
                          selected={formData.unlock_at ? new Date(formData.unlock_at) : undefined}
                          disabled={{ before: new Date() }}
                          onSelect={(date) => {
                            if (!date) return;
                            const current = formData.unlock_at ? new Date(formData.unlock_at) : new Date();
                            date.setHours(current.getHours() || 0);
                            date.setMinutes(current.getMinutes() || 0);
                            setFormData(p => ({ ...p, unlock_at: format(date, "yyyy-MM-dd'T'HH:mm") }));
                            if (formErrors.unlock_at) setFormErrors(p => ({ ...p, unlock_at: '' }));
                          }}
                          initialFocus
                        />
                        <div className="p-3 border-t flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Time:</span>
                          <Input 
                            type="time" 
                            value={formData.unlock_at ? format(new Date(formData.unlock_at), "HH:mm") : ""}
                            min={(() => {
                              if (!formData.unlock_at) return undefined;
                              const picked = new Date(formData.unlock_at);
                              const now = new Date();
                              // Only enforce min time if date is today
                              const pickedDate = picked.toDateString();
                              const nowDate = now.toDateString();
                              return pickedDate === nowDate ? format(now, 'HH:mm') : undefined;
                            })()}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const [h, m] = val.split(':');
                              const current = formData.unlock_at ? new Date(formData.unlock_at) : new Date();
                              current.setHours(parseInt(h));
                              current.setMinutes(parseInt(m));
                              // Reject if resulting datetime is in the past
                              if (current < new Date()) return;
                              setFormData(p => ({ ...p, unlock_at: format(current, "yyyy-MM-dd'T'HH:mm") }));
                              if (formErrors.unlock_at) setFormErrors(p => ({ ...p, unlock_at: '' }));
                            }}
                            className="h-9 w-32"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    {formErrors.unlock_at && <p className="text-xs text-destructive absolute bottom-0 left-0">{formErrors.unlock_at}</p>}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Provide a brief overview of what will be covered..." 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="rounded-xl resize-none"
                  />
                </div>

                <div className="grid gap-2 relative pb-4">
                  <Label>Video Recording <span className="text-destructive">*</span></Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${!formData.video_file && !editWebinar?.video_file ? (formErrors.video_file ? 'bg-destructive/5 border-destructive' : 'hover:bg-muted/50') : 'bg-primary/5 border-primary/20'}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="video/mp4"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setFormData({ ...formData, video_file: e.target.files[0] });
                          if (formErrors.video_file) setFormErrors(p => ({ ...p, video_file: '' }));
                        }
                      }}
                    />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      {formData.video_file ? (
                        <>
                          <div className="p-2 bg-primary/10 rounded-full">
                            <CheckCircle className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-sm font-medium text-primary line-clamp-1 px-4">{formData.video_file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(formData.video_file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </>
                      ) : editWebinar?.video_file ? (
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
                          <div className="text-xs text-muted-foreground">MP4 Format Only</div>
                        </>
                      )}
                    </div>
                  </div>
                  {formErrors.video_file && <p className="text-xs text-destructive absolute bottom-0 left-0">{formErrors.video_file}</p>}
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

              <DialogFooter className="p-6 bg-muted/30 pt-4 flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl px-8" disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 min-w-[140px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {uploadProgress >= 0 ? 'Uploading...' : 'Saving...'}
                    </>
                  ) : editWebinar ? 'Update Webinar' : 'Schedule Webinar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteWebinarId} onOpenChange={() => setDeleteWebinarId(null)}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Webinar?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this webinar? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
                Delete
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
      </div>
    </DashboardLayout>
  );
}
