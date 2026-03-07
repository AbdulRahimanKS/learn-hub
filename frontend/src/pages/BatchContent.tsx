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
} from 'lucide-react';
import { batchApi, batchContentApi, BatchWeek } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function BatchContent() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [weeks, setWeeks] = useState<BatchWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [batchName, setBatchName] = useState('');

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
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    session_number: 1,
    weekday: '',
    video_file: null as File | null,
    thumbnail: null as File | null,
  });

  // Test Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [testForm, setTestForm] = useState({
    title: '',
    instructions: '',
    pass_percentage: 70,
  });

  // Delete Alert
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

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
        unlock_date: editUnlockDate ? `${editUnlockDate}T00:00:00Z` : null,
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
      setSessionForm({
        title: session.title,
        description: session.description || '',
        session_number: session.session_number,
        weekday: session.weekday || '',
        video_file: null,
        thumbnail: null,
      });
    } else {
      setEditingSession(null);
      setSessionForm({
        title: '',
        description: '',
        session_number: sessions.length + 1,
        weekday: '',
        video_file: null,
        thumbnail: null,
      });
    }
    setIsSessionModalOpen(true);
  };

  const handleSaveSession = async () => {
    if (!batchId || !activeTab) return;
    
    if (!sessionForm.weekday) {
      toast({ title: 'Validation Error', description: 'Please select a weekday.', variant: 'destructive' });
      return;
    }
    
    setIsSavingSession(true);
    try {
      const formData = new FormData();
      formData.append('title', sessionForm.title);
      formData.append('description', sessionForm.description);
      formData.append('session_number', sessionForm.session_number.toString());
      if (sessionForm.weekday) formData.append('weekday', sessionForm.weekday);
      if (sessionForm.video_file) formData.append('video_file', sessionForm.video_file);
      if (sessionForm.thumbnail) formData.append('thumbnail', sessionForm.thumbnail);

      if (editingSession) {
        await batchContentApi.updateSession(parseInt(batchId), parseInt(activeTab), editingSession.id, formData);
      } else {
        await batchContentApi.createSession(parseInt(batchId), parseInt(activeTab), formData);
      }
      
      toast({ title: 'Success', description: editingSession ? 'Session updated' : 'Session created' });
      setIsSessionModalOpen(false);
      fetchContent(parseInt(activeTab));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save session', variant: 'destructive' });
    } finally {
      setIsSavingSession(false);
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

  const handleOpenTestModal = () => {
    if (weeklyTest) {
      setTestForm({
        title: weeklyTest.title,
        instructions: weeklyTest.instructions || '',
        pass_percentage: weeklyTest.pass_percentage,
      });
    } else {
      setTestForm({
        title: `Week ${weeks.find(w => w.id.toString() === activeTab)?.week_number} Test`,
        instructions: '',
        pass_percentage: 70,
      });
    }
    setIsTestModalOpen(true);
  };

  const handleSaveTest = async () => {
    if (!batchId || !activeTab) return;
    setIsSavingTest(true);
    try {
      await batchContentApi.manageWeeklyTest(parseInt(batchId), parseInt(activeTab), testForm);
      toast({ title: 'Success', description: 'Test configured successfully' });
      setIsTestModalOpen(false);
      fetchContent(parseInt(activeTab));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save test settings', variant: 'destructive' });
    } finally {
      setIsSavingTest(false);
    }
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
          <div className="ml-auto">
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
        ) : weeks.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium">No content initialized</h3>
            <p className="text-muted-foreground mb-6">Initialize this batch with a course template first.</p>
            <Button variant="gradient" onClick={() => navigate('/batches')}>
              Go to Batches
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto flex-nowrap">
              {weeks.map(week => (
                <TabsTrigger key={week.id} value={week.id.toString()} className="whitespace-nowrap px-6">
                  Week {week.week_number}
                </TabsTrigger>
              ))}
            </TabsList>

            {weeks.map(week => (
              <TabsContent key={week.id} value={week.id.toString()} className="space-y-6 mt-4">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Week info card */}
                  <Card className="flex-1 shadow-card">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold">{week.title}</CardTitle>
                        <CardDescription>{week.description || 'No description provided.'}</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(week)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Week
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                          <Badge variant={week.is_unlocked ? "outline" : "secondary"}>
                            {week.is_unlocked ? 'Unlocked' : 'Scheduled'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="pt-4 border-t">
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Play className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold">Class Sessions</h3>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleOpenSessionModal()} disabled={!week.can_modify_content}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Session
                      </Button>
                   </div>
                   
                   {loadingContent ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                   ) : sessions.length === 0 ? (
                      <div className="text-center py-10 bg-muted/20 border border-dashed rounded-lg">
                        <p className="text-muted-foreground">No sessions in this week yet.</p>
                      </div>
                   ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[...sessions]
                          .sort((a, b) => {
                            const days: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
                            const dayA = days[a.weekday?.toLowerCase()] || 8;
                            const dayB = days[b.weekday?.toLowerCase()] || 8;
                            if (dayA !== dayB) return dayA - dayB;
                            return (a.session_number || 0) - (b.session_number || 0);
                          })
                          .map((session) => (
                          <Card key={session.id} className="overflow-hidden group hover:shadow-md transition-shadow flex flex-col h-full">
                            <div className="aspect-video bg-muted relative flex items-center justify-center flex-shrink-0">
                              {session.thumbnail ? (
                                <img src={session.thumbnail} alt={session.title} className="w-full h-full object-cover" />
                              ) : (
                                <Play className="h-10 w-10 text-muted-foreground/30" />
                              )}
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => handleOpenSessionModal(session)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setDeleteSessionId(session.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="absolute bottom-2 left-2 flex gap-1">
                                <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm border-0 font-mono">
                                  S{session.session_number}
                                </Badge>
                                {session.weekday && (
                                  <Badge variant="outline" className="bg-black/50 text-white backdrop-blur-sm border-0 capitalize text-xs">
                                    {session.weekday}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CardHeader className="p-4 flex-1">
                              <CardTitle className="text-sm font-semibold truncate leading-tight">{session.title}</CardTitle>
                              <CardDescription className="text-xs line-clamp-2 mt-1">{session.description || 'No description'}</CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                   )}
                </div>

                <div className="pt-8 mt-4 border-t">
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold">Weekly Test</h3>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleOpenTestModal} disabled={!week.can_modify_content}>
                        {weeklyTest ? <Settings className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        {weeklyTest ? 'Test Settings' : 'Add Test'}
                      </Button>
                   </div>
                   
                   {loadingContent ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                   ) : !weeklyTest ? (
                      <div className="text-center py-10 bg-muted/20 border border-dashed rounded-lg">
                        <p className="text-muted-foreground">No test configured for this week.</p>
                      </div>
                   ) : (
                      <Card className="bg-primary/5 border-primary/10 shadow-none">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {weeklyTest.title}
                            <Badge variant="outline" className="text-[10px] ml-2">REQUIRED</Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Passing score: {weeklyTest.pass_percentage}% | Questions: {weeklyTest.questions?.length || 0}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-3 pt-2">
                           <Button variant="outline" size="sm" className="bg-background" onClick={() => navigate(`/admin/batches/${batchId}/content/weeks/${activeTab}/test`)}>
                              Manage Questions
                           </Button>
                           <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {/* Handle delete test */}} disabled={!week.can_modify_content}>
                              Remove Test
                           </Button>
                        </CardContent>
                      </Card>
                   )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Edit Week Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Batch Week</DialogTitle>
            <DialogDescription>Modify title and schedule for this batch.</DialogDescription>
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
            <div className="space-y-2">
              <Label>Unlock Date</Label>
              <Input type="date" value={editUnlockDate} onChange={e => setEditUnlockDate(e.target.value)} />
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
      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Session' : 'Add New Session'}</DialogTitle>
            <DialogDescription>Create a session specific to this batch week.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Video Title <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="Enter video title"
                value={sessionForm.title} 
                onChange={e => setSessionForm({...sessionForm, title: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground font-normal text-xs ml-2">(Optional)</span></Label>
              <Textarea 
                value={sessionForm.description} 
                onChange={e => setSessionForm({...sessionForm, description: e.target.value})}
                placeholder="What will students learn in this session?"
                className="resize-none"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session Number <span className="text-destructive">*</span></Label>
                <Input 
                  type="number" 
                  min="1"
                  value={sessionForm.session_number} 
                  onChange={e => setSessionForm({...sessionForm, session_number: parseInt(e.target.value)})}
                />
              </div>

              <div className="space-y-2">
                <Label>Weekday Tag <span className="text-destructive">*</span></Label>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={sessionForm.weekday}
                  onChange={e => setSessionForm({...sessionForm, weekday: e.target.value})}
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
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Video File <span className="text-destructive">*</span> <span className="text-muted-foreground font-normal text-xs ml-1">(MP4 only)</span></Label>
                <div className="border border-input rounded-md p-1">
                   <Input 
                     type="file" 
                     className="border-0 shadow-none bg-transparent"
                     onChange={e => {
                       const file = e.target.files?.[0];
                       if (file && file.type !== 'video/mp4') {
                         toast({ title: 'Invalid format', description: 'Only MP4 videos are allowed.', variant: 'destructive' });
                         e.target.value = '';
                         return;
                       }
                       setSessionForm({...sessionForm, video_file: file || null});
                     }} 
                     accept="video/mp4" 
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Thumbnail <span className="text-muted-foreground font-normal text-xs ml-2">(Optional)</span></Label>
                <div className="border border-input rounded-md p-1">
                   <Input 
                     type="file" 
                     className="border-0 shadow-none bg-transparent"
                     onChange={e => setSessionForm({...sessionForm, thumbnail: e.target.files?.[0] || null})} 
                     accept="image/*" 
                   />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsSessionModalOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveSession} disabled={isSavingSession || !sessionForm.title}>
              {isSavingSession && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSession ? 'Save Changes' : 'Create Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Weekly Test Settings</DialogTitle>
            <DialogDescription>Configure the passing threshold and instructions for this batch's test.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Test Title</Label>
              <Input value={testForm.title} onChange={e => setTestForm({...testForm, title: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea value={testForm.instructions} onChange={e => setTestForm({...testForm, instructions: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Passing Percentage ({testForm.pass_percentage}%)</Label>
              <Input 
                type="range" 
                min="0" max="100" step="1" 
                value={testForm.pass_percentage} 
                onChange={e => setTestForm({...testForm, pass_percentage: parseInt(e.target.value)})} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsTestModalOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveTest} disabled={isSavingTest}>
              {isSavingTest && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Test Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
    </DashboardLayout>
  );
}
