import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Video,
  Play,
  Lock,
  Loader2,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { webinarApi, Webinar } from '@/lib/webinar-api';
import { batchApi } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, addSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VideoPlayer } from '@/components/VideoPlayer';

export default function StudentWebinars() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchName, setBatchName] = useState('');
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const fetchStudentBatch = useCallback(async () => {
    try {
      const res = await batchApi.getBatches({ paginate: false });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setBatchId(res.data[0].id);
        setBatchName(res.data[0].name);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  }, []);

  const fetchWebinars = useCallback(async (id: number) => {
    try {
      const res = await webinarApi.getWebinars(id);
      if (res.success) {
        setWebinars(res.data);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch webinars', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStudentBatch();
  }, [fetchStudentBatch]);

  useEffect(() => {
    if (batchId) {
      fetchWebinars(batchId);
    }
  }, [batchId, fetchWebinars]);

  const isLocked = (webinar: Webinar) => {
    return isAfter(new Date(webinar.unlock_at), new Date());
  };

  const isPastWebinar = (webinar: Webinar) => {
    const endTime = addSeconds(new Date(webinar.unlock_at), webinar.duration_secs);
    return isBefore(endTime, new Date());
  };

  const upcomingWebinars = webinars.filter(w => !isPastWebinar(w));
  const passedWebinars = webinars.filter(w => isPastWebinar(w));

  // Pagination states
  const ITEMS_PER_PAGE = 6;
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [passedPage, setPassedPage] = useState(1);

  const paginatedUpcoming = upcomingWebinars.slice((upcomingPage - 1) * ITEMS_PER_PAGE, upcomingPage * ITEMS_PER_PAGE);
  const totalUpcomingPages = Math.ceil(upcomingWebinars.length / ITEMS_PER_PAGE);

  const paginatedPassed = passedWebinars.slice((passedPage - 1) * ITEMS_PER_PAGE, passedPage * ITEMS_PER_PAGE);
  const totalPassedPages = Math.ceil(passedWebinars.length / ITEMS_PER_PAGE);

  const WebinarCard = ({ webinar }: { webinar: Webinar }) => {
    const locked = isLocked(webinar);
    const hasRecording = !!webinar.video_presigned_url;
    
    return (
      <Card className={cn(
        "shadow-card overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col h-full",
        locked && "opacity-80"
      )}>
        <div className="relative aspect-video">
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-300 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-20 mix-blend-overlay"></div>
            
            {locked && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
                <Lock className="h-8 w-8 text-foreground/50" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Locked</span>
              </div>
            )}
            <Video className="h-12 w-12 text-white/20 mb-3" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          
          {/* Play button overlay — shown for any webinar with a recording */}
          {!locked && hasRecording && (
             <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center z-10">
                <div 
                  className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center scale-90 group-hover:scale-110 opacity-0 group-hover:opacity-100 transition-all shadow-2xl cursor-pointer shadow-primary/50 pointer-events-auto"
                  onClick={() => setPlayingVideoUrl(webinar.video_presigned_url!)}
                  title="Play Recording"
                >
                  <Play className="h-6 w-6 fill-current ml-1" />
                </div>
              </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
            {/* Duration on the left */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-black/60 px-2.5 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-lg" style={{ pointerEvents: 'auto' }}>
              <Clock className="h-3.5 w-3.5" />
              <span>{webinar.duration_secs > 0 ? (
                  `${Math.floor(webinar.duration_secs / 3600).toString().padStart(2, '0')}:${(Math.floor(webinar.duration_secs % 3600 / 60)).toString().padStart(2, '0')}:${(webinar.duration_secs % 60).toString().padStart(2, '0')}`
                ) : '00:00:00'}</span>
            </div>

            {/* Type on the right */}
            <Badge className="bg-black/60 hover:bg-black/70 text-white font-bold text-[11px] h-6 px-2.5 border border-white/10 backdrop-blur-md shadow-lg pointer-events-auto">
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

          <div className="flex items-center gap-2 mt-auto pt-4 text-sm font-medium text-primary">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="flex-1">{format(new Date(webinar.unlock_at), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          
          {/* Join link placeholder for live sessions not yet passed */}
          {!locked && !isPastWebinar(webinar) && (
            <div className="mt-4 pt-4 border-t border-border/50 text-center">
              <Button variant="outline" className="w-full font-bold shadow-sm" disabled>
                Join Link Pending
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Breadcrumbs & Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {batchName ? `${batchName} - Webinars` : 'Webinars'}
            </h1>
            <p className="mt-1 text-muted-foreground">Join live sessions and watch expert webinars exclusively for your batch</p>
          </div>
        </div>

        <Tabs defaultValue="upcoming" className="w-full space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit mb-4">
            <TabsTrigger value="upcoming" className="gap-2 min-w-32 px-4">
              <Calendar className="h-4 w-4" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="passed" className="gap-2 min-w-32 px-4">
              <Clock className="h-4 w-4" />
              Passed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="focus-visible:outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium text-muted-foreground">Finding sessions...</p>
              </div>
            ) : upcomingWebinars.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No upcoming webinars scheduled</h3>
                <p>When new live sessions are planned, they will appear here.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedUpcoming.map(webinar => (
                    <WebinarCard key={webinar.id} webinar={webinar} />
                  ))}
                </div>
                {totalUpcomingPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-6">
                    <Button variant="outline" size="sm" onClick={() => setUpcomingPage(p => Math.max(1, p - 1))} disabled={upcomingPage === 1}>Previous</Button>
                    <span className="text-sm font-medium text-muted-foreground w-20 text-center">Page {upcomingPage} of {totalUpcomingPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setUpcomingPage(p => Math.min(totalUpcomingPages, p + 1))} disabled={upcomingPage === totalUpcomingPages}>Next</Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="passed" className="focus-visible:outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : passedWebinars.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No past webinars</h3>
                <p>Webinars will appear here once they have passed their scheduled time.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedPassed.map(webinar => (
                    <WebinarCard key={webinar.id} webinar={webinar} />
                  ))}
                </div>
                {totalPassedPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-6">
                    <Button variant="outline" size="sm" onClick={() => setPassedPage(p => Math.max(1, p - 1))} disabled={passedPage === 1}>Previous</Button>
                    <span className="text-sm font-medium text-muted-foreground w-20 text-center">Page {passedPage} of {totalPassedPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPassedPage(p => Math.min(totalPassedPages, p + 1))} disabled={passedPage === totalPassedPages}>Next</Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
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
