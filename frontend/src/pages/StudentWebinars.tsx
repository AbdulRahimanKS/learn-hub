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
  CheckCircle2,
} from 'lucide-react';
import { webinarApi, Webinar } from '@/lib/webinar-api';
import { batchApi } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, addSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function StudentWebinars() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [batchId, setBatchId] = useState<number | null>(null);

  const fetchStudentBatch = useCallback(async () => {
    try {
      const res = await batchApi.getBatches({ paginate: false });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setBatchId(res.data[0].id);
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
    
    return (
      <Card className={cn(
        "shadow-card overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col h-full",
        locked && "opacity-80"
      )}>
        <div className="relative aspect-video">
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-300 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-20 mix-blend-overlay"></div>
            
            {locked ? (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
                <Lock className="h-8 w-8 text-foreground/50" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Locked</span>
              </div>
            ) : (
              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center z-10">
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center scale-90 group-hover:scale-110 opacity-0 group-hover:opacity-100 transition-all shadow-2xl cursor-pointer shadow-primary/50">
                  <Play className="h-6 w-6 fill-current ml-1" />
                </div>
              </div>
            )}
            <Video className="h-12 w-12 text-white/20 mb-3" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
            {/* Duration on the left */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-black/60 px-2.5 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-lg" style={{ pointerEvents: 'auto' }}>
              <Clock className="h-3.5 w-3.5" />
              <span>{webinar.duration_secs > 0 ? (
                  `${Math.floor(webinar.duration_secs / 3600).toString().padStart(2, '0')}:${(Math.floor(webinar.duration_secs % 3600 / 60)).toString().padStart(2, '0')}:${(webinar.duration_secs % 60).toString().padStart(2, '0')}`
                ) : '00:00:00'}</span>
            </div>

            {/* Type on the right */}
            {webinar.session_type === 'special_session' && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] h-6 px-2.5 border-0 shadow-lg pointer-events-auto">
                Special Session
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-5 flex flex-col justify-between flex-1 bg-card">
          <div>
            <h3 className="font-bold text-foreground line-clamp-1 text-lg leading-tight">{webinar.title}</h3>
            {webinar.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {webinar.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-4 text-sm font-medium text-amber-600 dark:text-amber-500">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{format(new Date(webinar.unlock_at), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
          </div>

          <div className="flex flex-col mt-6 pt-4 border-t border-border/50 gap-3">
             <div className="flex items-center justify-between">
                {!locked && webinar.video_file && (
                   <div className="flex items-center gap-1.5 text-xs font-bold text-success/80 bg-success/10 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Recording Available
                  </div>
                )}
             </div>

            {!locked && (
              <Button variant="gradient" className="w-full font-bold shadow-md h-10 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                {isPastWebinar(webinar) ? 'Watch Recording' : 'Join Live Session'}
                <Play className="h-4 w-4 ml-2 fill-current opacity-70 group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-10 pb-20">
        <div className="space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold tracking-wide uppercase">
            Interactive Learning
          </div>
          <h1 className="text-5xl font-black tracking-tighter sm:text-6xl italic">WEBINARS</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Live sessions and expert webinars exclusively for your batch. 
            Connect, learn, and grow with our community.
          </p>
        </div>

        <Tabs defaultValue="upcoming" className="w-full space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit mb-4">
            <TabsTrigger value="upcoming" className="gap-2 min-w-32 px-4">
              <Calendar className="h-4 w-4" />
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="passed" className="gap-2 min-w-32 px-4">
              <Clock className="h-4 w-4" />
              Past Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="focus-visible:outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium text-muted-foreground">Finding sessions...</p>
              </div>
            ) : upcomingWebinars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/20 border-2 border-dashed rounded-xl">
                <Video className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground">No upcoming webinars currently scheduled</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">When new webinars are scheduled, they will appear right here.</p>
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
              <div className="flex flex-col items-center justify-center py-20 bg-muted/20 border-2 border-dashed rounded-xl grayscale opacity-60">
                <Video className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground">No past webinars found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">Once you attend or miss a webinar, its recording and details will be saved here.</p>
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
      </div>
    </DashboardLayout>
  );
}
