import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  FileVideo,
} from 'lucide-react';
import { webinarApi, Webinar } from '@/lib/webinar-api';
import { batchApi } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

export default function WebinarManagement() {
  const { batchId } = useParams<{ batchId: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [batchName, setBatchName] = useState('');
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editWebinar, setEditWebinar] = useState<Webinar | null>(null);
  const [deleteWebinarId, setDeleteWebinarId] = useState<number | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    session_type: 'webinar' as 'webinar' | 'special_session',
    description: '',
    unlock_at: '',
    duration_mins: 60,
    video_file: null as File | null,
  });

  const fetchWebinars = useCallback(async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      const res = await webinarApi.getWebinars(parseInt(batchId));
      if (res.success) {
        setWebinars(res.data);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch webinars', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [batchId, toast]);

  const fetchBatchDetails = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await batchApi.getBatch(parseInt(batchId));
      if (res.success) {
        setBatchName(res.data.name);
      }
    } catch (err) {}
  }, [batchId]);

  useEffect(() => {
    fetchWebinars();
    fetchBatchDetails();
  }, [fetchWebinars, fetchBatchDetails]);

  const handleOpenModal = (webinar?: Webinar) => {
    if (webinar) {
      setEditWebinar(webinar);
      setFormData({
        title: webinar.title,
        session_type: webinar.session_type,
        description: webinar.description || '',
        unlock_at: webinar.unlock_at ? format(new Date(webinar.unlock_at), "yyyy-MM-dd'T'HH:mm") : '',
        duration_mins: webinar.duration_mins,
        video_file: null,
      });
    } else {
      setEditWebinar(null);
      setFormData({
        title: '',
        session_type: 'webinar',
        description: '',
        unlock_at: '',
        duration_mins: 60,
        video_file: null,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId) return;

    try {
      setIsSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title);
      data.append('session_type', formData.session_type);
      data.append('description', formData.description);
      data.append('unlock_at', new Date(formData.unlock_at).toISOString());
      data.append('duration_mins', formData.duration_mins.toString());
      if (formData.video_file) {
        data.append('video_file', formData.video_file);
      }

      if (editWebinar) {
        await webinarApi.updateWebinar(parseInt(batchId), editWebinar.id, data);
        toast({ title: 'Success', description: 'Webinar updated successfully' });
      } else {
        await webinarApi.createWebinar(parseInt(batchId), data);
        toast({ title: 'Success', description: 'Webinar created successfully' });
      }
      setIsModalOpen(false);
      fetchWebinars();
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || 'Failed to save webinar', 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!batchId || !deleteWebinarId) return;
    try {
      await webinarApi.deleteWebinar(parseInt(batchId), deleteWebinarId);
      toast({ title: 'Success', description: 'Webinar deleted successfully' });
      fetchWebinars();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete webinar', variant: 'destructive' });
    } finally {
      setDeleteWebinarId(null);
    }
  };

  const isPastWebinar = (webinar: Webinar) => {
    const endTime = addMinutes(new Date(webinar.unlock_at), webinar.duration_mins);
    return isBefore(endTime, new Date());
  };

  const scheduledWebinars = webinars.filter(w => !isPastWebinar(w));
  const passedWebinars = webinars.filter(w => isPastWebinar(w));

  const WebinarCard = ({ webinar, canEdit = true }: { webinar: Webinar, canEdit?: boolean }) => (
    <Card className="overflow-hidden border-border/50 hover:shadow-md transition-all group">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="w-full sm:w-48 h-32 bg-muted flex items-center justify-center relative">
            <Video className="h-10 w-10 text-muted-foreground/40" />
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-semibold"
            >
              {webinar.session_type.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-start justify-between">
                <h4 className="font-semibold text-foreground line-clamp-1">{webinar.title}</h4>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenModal(webinar)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteWebinarId(webinar.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{webinar.description || 'No description provided.'}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{format(new Date(webinar.unlock_at), 'PPP')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>{format(new Date(webinar.unlock_at), 'p')} • {webinar.duration_mins} mins</span>
              </div>
              {webinar.video_file && (
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Recording Available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Breadcrumbs & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link to="/batches" className="hover:text-primary flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Batches
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">{batchName}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Webinar Management</h1>
            <p className="text-muted-foreground">Schedule and manage webinars for this batch.</p>
          </div>
          <Button variant="gradient" size="lg" onClick={() => handleOpenModal()} className="shadow-lg shadow-primary/20">
            <Plus className="h-5 w-5 mr-2" />
            Schedule Webinar
          </Button>
        </div>

        <Tabs defaultValue="scheduled" className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-8 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="scheduled" className="rounded-lg data-[state=active]:shadow-sm">
              Scheduled
              {scheduledWebinars.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {scheduledWebinars.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="passed" className="rounded-lg data-[state=active]:shadow-sm">
              Passed
              {passedWebinars.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {passedWebinars.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="focus-visible:outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading webinars...</p>
              </div>
            ) : scheduledWebinars.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 border-2 border-dashed border-border/60 rounded-3xl">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No scheduled webinars</h3>
                <p className="text-muted-foreground mb-6 max-w-xs mx-auto">You haven't scheduled any upcoming webinars for this batch yet.</p>
                <Button variant="outline" onClick={() => handleOpenModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Now
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {scheduledWebinars.map(webinar => (
                  <WebinarCard key={webinar.id} webinar={webinar} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="passed" className="focus-visible:outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading webinars...</p>
              </div>
            ) : passedWebinars.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 border-2 border-dashed border-border/60 rounded-3xl">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Video className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No past webinars</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">Webinars will appear here once they have passed their scheduled time.</p>
              </div>
            ) : (
              <div className="grid gap-4 opacity-80 hover:opacity-100 transition-opacity">
                {passedWebinars.map(webinar => (
                  <WebinarCard key={webinar.id} webinar={webinar} canEdit={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-3xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader className="p-6 bg-muted/30 pb-4">
                <DialogTitle className="text-2xl">{editWebinar ? 'Edit Webinar' : 'Schedule New Webinar'}</DialogTitle>
                <DialogDescription>
                  Enter the details for the webinar session.
                </DialogDescription>
              </DialogHeader>
              
              <div className="p-6 space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-sm font-semibold">Webinar Title <span className="text-destructive">*</span></Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Advanced React Patterns" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
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
                  <div className="grid gap-2">
                    <Label htmlFor="duration" className="text-sm font-semibold">Duration (mins)</Label>
                    <Input 
                      id="duration" 
                      type="number" 
                      value={formData.duration_mins}
                      onChange={e => setFormData({...formData, duration_mins: parseInt(e.target.value) || 60})}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="unlock_at" className="text-sm font-semibold">Start Time <span className="text-destructive">*</span></Label>
                  <Input 
                    id="unlock_at" 
                    type="datetime-local" 
                    value={formData.unlock_at}
                    onChange={e => setFormData({...formData, unlock_at: e.target.value})}
                    required
                    className="h-11 rounded-xl"
                  />
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

                <div className="grid gap-2">
                  <Label htmlFor="video" className="text-sm font-semibold">Video Recording (Optional)</Label>
                  <div className="flex items-center gap-3">
                    <Input 
                      id="video" 
                      type="file" 
                      accept="video/*"
                      onChange={e => setFormData({...formData, video_file: e.target.files?.[0] || null})}
                      className="h-11 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    />
                  </div>
                  {editWebinar?.video_file && !formData.video_file && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <FileVideo className="h-3 w-3" />
                      Current file: {editWebinar.video_file.split('/').pop()}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="p-6 bg-muted/30 pt-4 flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl px-8">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 min-w-[140px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
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
      </div>
    </DashboardLayout>
  );
}
