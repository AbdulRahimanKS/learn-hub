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
import { format, isAfter, isBefore, addMinutes } from 'date-fns';
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
    const endTime = addMinutes(new Date(webinar.unlock_at), webinar.duration_mins);
    return isBefore(endTime, new Date());
  };

  const upcomingWebinars = webinars.filter(w => !isPastWebinar(w));
  const passedWebinars = webinars.filter(w => isPastWebinar(w));

  const WebinarCard = ({ webinar }: { webinar: Webinar }) => {
    const locked = isLocked(webinar);
    
    return (
      <Card className={cn(
        "overflow-hidden border-border/50 hover:shadow-lg transition-all group rounded-3xl",
        locked && "opacity-80"
      )}>
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-64 h-40 bg-muted flex items-center justify-center relative group">
              {locked ? (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Locked</span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center z-10">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all shadow-xl">
                    <Play className="h-6 w-6 fill-current ml-1" />
                  </div>
                </div>
              )}
              <Video className="h-12 w-12 text-muted-foreground/30" />
              <Badge 
                variant="secondary" 
                className="absolute top-4 left-4 text-[10px] uppercase tracking-wider font-semibold z-20 backdrop-blur-md bg-background/50"
              >
                {webinar.session_type.replace('_', ' ')}
              </Badge>
            </div>
            
            <div className="flex-1 p-6 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-foreground leading-tight">{webinar.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{webinar.description || 'Join our online session to learn more about this topic.'}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>{format(new Date(webinar.unlock_at), 'PPP')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{format(new Date(webinar.unlock_at), 'p')} • {webinar.duration_mins} mins</span>
                </div>
                {!locked && webinar.video_file && (
                   <Badge variant="outline" className="bg-success/5 text-success border-success/20 ml-auto">
                    Recording Available
                  </Badge>
                )}
              </div>

              {!locked && (
                <div className="mt-6 flex items-center gap-3">
                  <Button className="rounded-full px-8 shadow-lg shadow-primary/20">
                    {isPastWebinar(webinar) ? 'Watch Recording' : 'Join Session'}
                  </Button>
                  {!isPastWebinar(webinar) && (
                    <p className="text-xs text-primary font-semibold animate-pulse">Live now!</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-10 max-w-5xl mx-auto pb-20">
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

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-full bg-muted p-1 mb-8">
            <TabsTrigger value="upcoming" className="rounded-full px-8 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="passed" className="rounded-full px-8 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
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
              <div className="text-center py-24 bg-muted/30 border-2 border-dashed border-border/60 rounded-[3rem] px-6">
                <div className="mx-auto w-24 h-24 bg-background rounded-full flex items-center justify-center mb-6 shadow-xl">
                  <Calendar className="h-10 w-10 text-primary/40" />
                </div>
                <h3 className="text-2xl font-bold mb-3">All caught up!</h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">No upcoming webinars at the moment. We'll notify you when a new session is scheduled.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {upcomingWebinars.map(webinar => (
                  <WebinarCard key={webinar.id} webinar={webinar} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="passed" className="focus-visible:outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : passedWebinars.length === 0 ? (
              <div className="text-center py-24 bg-muted/30 border-2 border-dashed border-border/60 rounded-[3rem] px-6">
                <div className="mx-auto w-24 h-24 bg-background rounded-full flex items-center justify-center mb-6 shadow-xl">
                  <Video className="h-10 w-10 text-primary/40" />
                </div>
                <h3 className="text-2xl font-bold mb-3">No past records</h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">Recorded webinars will appear here once they're completed.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {passedWebinars.map(webinar => (
                  <WebinarCard key={webinar.id} webinar={webinar} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
