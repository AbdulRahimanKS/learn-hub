import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Video,
  VideoIcon,
  Calendar as CalendarIcon,
  Clock,
  Play,
  PlayCircle as PlayCircleIcon,
  Settings,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  BookOpen,
  Info,
  Lock as LockIcon,
} from 'lucide-react';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { liveSessionApi, LiveSession } from '@/lib/live-session-api';
import type { Batch } from '@/lib/batch-api';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const liveSessionSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  description: z.string().optional(),
  date: z.date({ required_error: "Date is required." }),
  time: z.string().min(1, { message: "Time is required." }),
  duration_mins: z.coerce.number().min(1, { message: "Duration is required." }),
}).refine((data) => {
  if (!data.date || !data.time) return true;
  const now = new Date();
  const selectedDateTime = new Date(data.date);
  const [hours, minutes] = data.time.split(':').map(Number);
  selectedDateTime.setHours(hours, minutes, 0, 0);
  
  // Return true if the selected date/time is at least now
  return selectedDateTime >= now;
}, {
  message: "Session time cannot be in the past",
  path: ["time"],
});

type LiveSessionFormValues = z.infer<typeof liveSessionSchema>;

export default function LiveSessions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isStudent = user?.role === 'student';
  const isAdminOrTeacher = !isStudent;

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  
  const [activeTab, setActiveTab] = useState('upcoming');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<LiveSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<LiveSessionFormValues>({
    resolver: zodResolver(liveSessionSchema),
    defaultValues: {
      title: '',
      description: '',
      date: undefined,
      time: '',
      duration_mins: 60,
    },
  });

  const handleLiveBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(Number(id));
    setSelectedBatchName(batch.name);
    setCurrentPage(1);
  }, []);

  const fetchSessions = useCallback(async (batchId: number, tab: string, page: number) => {
    setLoading(true);
    try {
      const res = await liveSessionApi.getSessions(batchId, {
        tab,
        page,
        page_size: 5,
      });
      setSessions(res.data || []);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch live sessions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchSessions(selectedBatchId, activeTab, currentPage);
    }
  }, [selectedBatchId, activeTab, currentPage, fetchSessions]);

  const handleCreateOrUpdate = async (values: LiveSessionFormValues) => {
    if (!selectedBatchId) return;
    setSubmitting(true);
    try {
      // Combine date and time into a single Date object (local time)
      const scheduled_at = new Date(values.date);
      const [hours, minutes] = values.time.split(':').map(Number);
      scheduled_at.setHours(hours, minutes, 0, 0);
      
      const payload = {
        title: values.title,
        description: values.description,
        // .toISOString() correctly converts the local Date object to UTC string before sending
        scheduled_at: scheduled_at.toISOString(),
        duration_mins: values.duration_mins,
      };

      if (editingSession) {
        await liveSessionApi.updateSession(selectedBatchId, editingSession.id, payload);
        toast({ title: 'Success', description: 'Live session updated successfully', variant: 'success' });
      } else {
        await liveSessionApi.createSession(selectedBatchId, payload);
        toast({ title: 'Success', description: 'Live session scheduled successfully', variant: 'success' });
      }
      setIsDialogOpen(false);
      fetchSessions(selectedBatchId, activeTab, currentPage);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save session', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!sessionToDelete || !selectedBatchId) return;
    setSubmitting(true);
    try {
      await liveSessionApi.deleteSession(selectedBatchId, sessionToDelete.id);
      toast({ title: 'Deleted', description: 'Live session deleted', variant: 'success' });
      setSessionToDelete(null);
      fetchSessions(selectedBatchId, activeTab, currentPage);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete session', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    setEditingSession(null);
    form.reset({
      title: '',
      description: '',
      date: undefined,
      time: '',
      duration_mins: 60,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (session: LiveSession) => {
    setEditingSession(session);
    const dt = new Date(session.scheduled_at);
    form.reset({
      title: session.title,
      description: session.description,
      date: new Date(session.scheduled_at),
      time: format(new Date(session.scheduled_at), 'HH:mm'),
      duration_mins: session.duration_mins,
    });
    setIsDialogOpen(true);
  };

  const handleJoin = (session: LiveSession) => {
    const jitsiUrl = `https://meet.jit.si/${session.meeting_room}`;
    window.open(jitsiUrl, '_blank');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Live Sessions</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
               {isStudent ? 'View and join your live classes' : 'Schedule and manage live classes'}
            </p>
          </div>
          
          {isAdminOrTeacher && (
            <Button onClick={openCreateDialog} variant="gradient" className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Schedule Live Session
            </Button>
          )}
        </div>

        {/* Batch Selection */}
        <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-card border shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
               <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Course Batch</p>
              <h3
                className="truncate font-bold text-foreground"
                title={selectedBatchName || undefined}
              >
                {selectedBatchName || 'Select a batch'}
              </h3>
            </div>
          </div>
          
          <div className="w-full min-w-0 sm:w-[min(280px,100%)] sm:max-w-[280px]">
            <BatchFilterCombobox
              value={selectedBatchId?.toString() ?? ''}
              selectedLabel={selectedBatchName}
              onValueChange={handleLiveBatchChange}
              placeholder="Select course batch"
              className="h-10 sm:h-11 border-primary text-primary text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Main Content with Tabs for Admins */}
        <div className="space-y-6">
          {isAdminOrTeacher ? (
            <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setCurrentPage(1); }} className="w-full space-y-6">
              <TabsList className="h-10 sm:h-12 bg-background p-1 border border-border/50 rounded-lg flex w-full sm:w-fit">
                <TabsTrigger value="upcoming" className="flex-1 sm:flex-initial gap-2 min-w-0 sm:min-w-32 px-3 sm:px-4 text-[13px] sm:text-sm transition-all">
                  <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="past" className="flex-1 sm:flex-initial gap-2 min-w-0 sm:min-w-32 px-3 sm:px-4 text-[13px] sm:text-sm transition-all">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Past
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="mt-0">
                <Card className="shadow-card">
                  <CardContent className="pt-6">
                    <SessionList
                      sessions={sessions}
                      loading={loading}
                      isAdmin={true}
                      onEdit={openEditDialog}
                      onDelete={setSessionToDelete}
                      onJoin={handleJoin}
                      activeTab={activeTab}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="past" className="mt-0">
                <Card className="shadow-card">
                  <CardContent className="pt-6">
                    <SessionList
                      sessions={sessions}
                      loading={loading}
                      isAdmin={true}
                      onEdit={openEditDialog}
                      onDelete={setSessionToDelete}
                      onJoin={handleJoin}
                      activeTab={activeTab}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Upcoming Sessions</h2>
              </div>
              <Card className="shadow-card">
                <CardContent className="pt-6">
                  <SessionList
                    sessions={sessions}
                    loading={loading}
                    isAdmin={false}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onJoin={handleJoin}
                    activeTab="upcoming"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pagination */}
          {!loading && sessions.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm font-medium text-muted-foreground w-20 text-center">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingSession ? 'Edit Live Session' : 'Schedule Live Session'}</DialogTitle>
              <DialogDescription>
                {editingSession ? 'Update the details of your live session.' : 'Fill in the details to schedule a new live class.'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateOrUpdate)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>Session Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Weekly Q&A Session" {...field} autoFocus={false} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description of the session" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-10 px-3 text-left font-normal bg-background border-input text-foreground hover:bg-background hover:text-foreground focus:ring-1 focus:ring-ring focus:border-primary",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <div className="relative w-full">
                            <Input
                              type="time"
                              name={field.name}
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              ref={(node) => {
                                field.ref(node);
                                timeInputRef.current = node;
                              }}
                              className="h-10 w-full block pr-10 dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none"
                            />
                            <button
                              type="button"
                              aria-label="Open time picker"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/70 hover:text-foreground focus:outline-none"
                              onClick={() => {
                                const inputEl = timeInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
                                if (!inputEl) return;
                                inputEl.focus();
                                try {
                                  if (typeof inputEl.showPicker === 'function') {
                                    inputEl.showPicker();
                                    return;
                                  }
                                } catch {
                                  // Some browsers/modes can throw for showPicker; fall back to click.
                                }
                                inputEl.click();
                              }}
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="duration_mins"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (Minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="60" 
                            {...field} 
                            className="h-10 w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button type="submit" variant="gradient" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingSession ? 'Update Session' : 'Schedule Session'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the live session <strong>{sessionToDelete?.title}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Yes, Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

function SessionList({ sessions, loading, isAdmin, onEdit, onDelete, onJoin, activeTab }: { 
  sessions: LiveSession[], 
  loading: boolean, 
  isAdmin: boolean,
  onEdit: (s: LiveSession) => void,
  onDelete: (s: LiveSession) => void,
  onJoin: (s: LiveSession) => void,
  activeTab?: string
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    const isPast = activeTab === 'past';
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl bg-card/50">
        <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-1">
          {isPast ? 'No past sessions' : 'No upcoming sessions'}
        </h3>
        <p className="max-w-xs mx-auto">
          {isAdmin 
            ? (isPast 
                ? 'Your completed live sessions will appear here.' 
                : 'Schedule your first live session to get started classes for this batch.')
            : (isPast 
                ? 'Completed live sessions for this batch will appear here.' 
                : 'When new sessions are scheduled, they will appear here for you to join.')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sessions.map((session) => {
        const isUpcoming = new Date(session.scheduled_at) > new Date();
        const isPast = activeTab === 'past';
        const canEdit = isAdmin && !isPast && !session.can_join;

        return (
          <div key={session.id} className="group flex flex-col gap-4 rounded-xl border border-border bg-muted/20 sm:bg-muted/40 p-3.5 sm:p-4 transition-all hover:bg-accent/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
              {/* Top/Left: Icon & Content */}
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="shrink-0">
                  <div 
                     className={cn(
                       "h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-colors",
                       session.can_join 
                        ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer" 
                        : "bg-muted text-muted-foreground"
                     )}
                     onClick={() => session.can_join && onJoin(session)}
                  >
                    {session.can_join ? <PlayCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-foreground truncate text-base sm:text-lg">{session.title}</h3>
                    {session.is_live && (
                      <Badge className="w-fit bg-primary text-primary-foreground animate-pulse border-none text-[10px] h-4.5 px-2">
                        Live Now
                      </Badge>
                    )}
                  </div>
                  
                  {session.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mb-1.5 sm:mb-2">
                      {session.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span>{format(new Date(session.scheduled_at), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span>{format(new Date(session.scheduled_at), "h:mm a")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span>{session.duration_mins} mins</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom/Right: Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t border-border/50 pt-3 sm:border-t-0 sm:pt-0">
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => onEdit(session)}>
                      <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(session)}>
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                )}

                {session.can_join ? (
                  <Button 
                    onClick={() => onJoin(session)}
                    variant="gradient" 
                    size="sm" 
                    className="h-9 sm:h-10 grow sm:grow-0 rounded-xl px-5 sm:px-6 font-bold shadow-none hover:shadow-none text-xs sm:text-sm"
                  >
                    <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                    Join Now
                  </Button>
                ) : (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-9 sm:h-10 grow sm:grow-0 rounded-xl px-4 sm:px-6 cursor-not-allowed font-bold opacity-70 text-xs sm:text-sm"
                    disabled
                  >
                    {isUpcoming ? (
                      <><Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Upcoming</>
                    ) : (
                      <><Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Ended</>
                    )}
                  </Button>
                )}
              </div>
          </div>
        );
      })}
    </div>
  );
}
