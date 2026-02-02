import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Video,
  Calendar,
  Clock,
  Users,
  Play,
  Radio,
  Settings,
  Edit,
  Trash2,
} from 'lucide-react';

const mockSessions = {
  upcoming: [
    { id: 1, title: 'Python Q&A Session', description: 'Open discussion and doubt clearing', batch: 'Python Basics', scheduledAt: 'Today, 3:00 PM', duration: '60 min', attendees: 24 },
    { id: 2, title: 'Weekly Code Review', description: 'Review student projects and provide feedback', batch: 'Data Science', scheduledAt: 'Tomorrow, 10:00 AM', duration: '90 min', attendees: 18 },
    { id: 3, title: 'Industry Expert Talk', description: 'Guest speaker from Google', batch: 'All Batches', scheduledAt: 'Feb 5, 2:00 PM', duration: '60 min', attendees: 86 },
  ],
  past: [
    { id: 4, title: 'Introduction Session', batch: 'Python Basics', date: 'Jan 28, 2026', duration: '45 min', attendees: 22, recorded: true },
    { id: 5, title: 'Data Visualization Workshop', batch: 'Data Science', date: 'Jan 25, 2026', duration: '90 min', attendees: 15, recorded: true },
    { id: 6, title: 'Debugging Best Practices', batch: 'Web Development', date: 'Jan 22, 2026', duration: '60 min', attendees: 28, recorded: false },
  ],
};

export default function LiveSessions() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Live Sessions</h1>
            <p className="mt-1 text-muted-foreground">Schedule and manage live classes</p>
          </div>
          <div className="flex gap-3">
            <Button variant="gradient" className="gap-2">
              <Radio className="h-4 w-4" />
              Go Live Now
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Session
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Schedule Live Session</DialogTitle>
                  <DialogDescription>Create a new live session for your students</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Session Title</Label>
                    <Input id="title" placeholder="e.g., Weekly Q&A Session" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" placeholder="Brief description of the session" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="batch">Batch</Label>
                      <select id="batch" className="w-full h-10 px-3 rounded-lg border border-input bg-background">
                        <option value="">Select batch</option>
                        <option value="python">Python Basics</option>
                        <option value="datascience">Data Science</option>
                        <option value="webdev">Web Development</option>
                        <option value="all">All Batches</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <select id="duration" className="w-full h-10 px-3 rounded-lg border border-input bg-background">
                        <option value="30">30 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                        <option value="120">2 hours</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input id="time" type="time" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="record" className="rounded border-border" defaultChecked />
                    <Label htmlFor="record" className="text-sm">Record this session</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button variant="gradient">Schedule Session</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockSessions.upcoming.length}</p>
                  <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <Video className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockSessions.past.filter(s => s.recorded).length}</p>
                  <p className="text-sm text-muted-foreground">Recorded Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent/10">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">128</p>
                  <p className="text-sm text-muted-foreground">Total Attendees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Sessions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockSessions.upcoming.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-4 p-4 rounded-xl border border-border sm:flex-row sm:items-center sm:justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Video className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{session.title}</h3>
                      <p className="text-sm text-muted-foreground">{session.description}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{session.batch}</Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {session.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {session.attendees} expected
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium text-foreground">{session.scheduledAt}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="gradient" size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Past Sessions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Past Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockSessions.past.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-4 p-4 rounded-xl border border-border sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${session.recorded ? 'bg-success/10' : 'bg-muted'}`}>
                      <Video className={`h-6 w-6 ${session.recorded ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{session.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline">{session.batch}</Badge>
                        <span>{session.date}</span>
                        <span>{session.duration}</span>
                        <span>{session.attendees} attended</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.recorded ? (
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        Recorded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Recorded
                      </Badge>
                    )}
                    {session.recorded && (
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        Watch
                      </Button>
                    )}
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
