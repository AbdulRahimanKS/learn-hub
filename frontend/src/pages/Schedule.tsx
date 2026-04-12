import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Video,
  FileText,
  Play,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const todayEvents = [
  { id: 1, title: 'Exception Handling', type: 'video', time: 'Anytime', description: 'Week 2 - Video 3' },
  { id: 2, title: 'Live Q&A Session', type: 'live', time: '3:00 PM', description: 'Python Basics batch' },
  { id: 3, title: 'Functions Quiz', type: 'assessment', time: '11:59 PM', description: 'Due today' },
];

const upcomingEvents = [
  { id: 1, title: 'Weekly Assessment', type: 'assessment', date: 'Tomorrow', time: '10:00 AM', description: 'Week 2 Test' },
  { id: 2, title: 'Regular Expressions', type: 'video', date: 'Tomorrow', time: 'Anytime', description: 'Week 2 - Video 4' },
  { id: 3, title: 'Advanced Python Webinar', type: 'webinar', date: 'Feb 5', time: '2:00 PM', description: 'Special session' },
  { id: 4, title: 'Weekly Code Review', type: 'live', date: 'Feb 6', time: '10:00 AM', description: 'Review session' },
  { id: 5, title: 'Week 3 Content', type: 'unlock', date: 'After Week 2 Test', time: '', description: 'Data Structures' },
];

const calendarDays = [
  { day: 27, events: [] },
  { day: 28, events: ['video'] },
  { day: 29, events: ['video', 'assessment'] },
  { day: 30, events: [] },
  { day: 31, events: ['live'] },
  { day: 1, events: [], isCurrentMonth: true },
  { day: 2, events: ['video', 'live', 'assessment'], isToday: true, isCurrentMonth: true },
  { day: 3, events: ['assessment'], isCurrentMonth: true },
  { day: 4, events: ['video'], isCurrentMonth: true },
  { day: 5, events: ['webinar'], isCurrentMonth: true },
  { day: 6, events: ['live'], isCurrentMonth: true },
  { day: 7, events: [], isCurrentMonth: true },
  { day: 8, events: ['video'], isCurrentMonth: true },
];

export default function Schedule() {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'live':
        return <Video className="h-4 w-4" />;
      case 'webinar':
        return <Video className="h-4 w-4" />;
      case 'assessment':
        return <FileText className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'bg-primary text-primary-foreground';
      case 'live':
        return 'bg-destructive text-destructive-foreground';
      case 'webinar':
        return 'bg-accent text-accent-foreground';
      case 'assessment':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'bg-primary/10 text-primary';
      case 'live':
        return 'bg-destructive/10 text-destructive';
      case 'webinar':
        return 'bg-accent/10 text-accent';
      case 'assessment':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">My Schedule</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">View your upcoming classes and deadlines</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Bell className="h-4 w-4 mr-2" />
            Set Reminders
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Today's Schedule */}
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Schedule
              </CardTitle>
              <CardDescription>Sunday, February 2, 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border bg-muted/20 sm:bg-transparent hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 flex-1">
                      <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${getEventBadgeColor(event.type)}`}>
                        {getEventIcon(event.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{event.title}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{event.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:text-right gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                      <div>
                        <p className="font-bold sm:font-medium text-sm sm:text-base text-foreground">{event.time}</p>
                        <Badge variant="outline" className="mt-0.5 sm:mt-1 capitalize text-[10px] h-5">
                          {event.type}
                        </Badge>
                      </div>
                      <Button variant={event.type === 'live' ? 'gradient' : 'outline'} size="sm" className="h-8 sm:h-9 px-4 text-xs font-bold">
                        {event.type === 'live' ? 'Join' : event.type === 'assessment' ? 'Start' : 'Watch'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mini Calendar */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>February 2026</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="p-2 text-muted-foreground font-medium">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, i) => (
                  <button
                    key={i}
                    className={`p-2 rounded-lg transition-colors relative ${
                      day.isToday
                        ? 'bg-primary text-primary-foreground font-bold'
                        : day.isCurrentMonth
                        ? 'hover:bg-muted'
                        : 'text-muted-foreground/50'
                    }`}
                  >
                    {day.day}
                    {day.events.length > 0 && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {day.events.slice(0, 3).map((type, j) => (
                          <div
                            key={j}
                            className={`w-1 h-1 rounded-full ${
                              type === 'video' ? 'bg-primary' :
                              type === 'live' ? 'bg-destructive' :
                              type === 'assessment' ? 'bg-warning' :
                              'bg-accent'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Video</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Live</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Test</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Webinar</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Events
            </CardTitle>
            <CardDescription>What's next in your learning journey</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 sm:space-y-3">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl border border-transparent hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${getEventBadgeColor(event.type)}`}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                  </div>
                  <div className="text-right text-[11px] sm:text-sm shrink-0">
                    <p className="font-bold sm:font-medium text-foreground">{event.date}</p>
                    {event.time && <p className="text-muted-foreground font-medium">{event.time}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
