import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Users,
  ClipboardCheck,
  TrendingUp,
  Play,
  Calendar,
  Clock,
  Award,
  ArrowRight,
  Video,
  GraduationCap,
} from 'lucide-react';

// Mock data
const weeklyVideos = [
  { id: 1, title: 'Introduction to Python', duration: '45:00', completed: true },
  { id: 2, title: 'Variables and Data Types', duration: '38:00', completed: true },
  { id: 3, title: 'Control Flow Statements', duration: '52:00', completed: false },
  { id: 4, title: 'Functions and Modules', duration: '41:00', completed: false },
];

const upcomingEvents = [
  { id: 1, title: 'Live Q&A Session', type: 'live', date: 'Today, 3:00 PM' },
  { id: 2, title: 'Weekly Assessment', type: 'assessment', date: 'Tomorrow, 10:00 AM' },
  { id: 3, title: 'Python Advanced Webinar', type: 'webinar', date: 'Feb 5, 2:00 PM' },
];

const recentSubmissions = [
  { id: 1, student: 'Alex Thompson', assessment: 'Week 3 Test', score: 85, status: 'evaluated' },
  { id: 2, student: 'Maria Garcia', assessment: 'Week 3 Test', score: 92, status: 'evaluated' },
  { id: 3, student: 'John Smith', assessment: 'Week 3 Test', score: null, status: 'pending' },
];

export default function Dashboard() {
  const { user } = useAuth();

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="mt-1 text-muted-foreground">Here's what's happening in your platform today.</p>
        </div>
        <Button variant="gradient">
          <Video className="h-4 w-4" />
          Start Live Session
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Students', value: '248', icon: Users, change: '+12 this week', color: 'text-primary' },
          { label: 'Active Batches', value: '8', icon: GraduationCap, change: '2 ongoing', color: 'text-accent' },
          { label: 'Course Videos', value: '45', icon: BookOpen, change: '+5 this week', color: 'text-success' },
          { label: 'Pending Reviews', value: '12', icon: ClipboardCheck, change: 'Needs attention', color: 'text-warning' },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                  <p className={`text-xs mt-2 ${stat.color}`}>{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-primary/10`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Submissions & Upcoming Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>Latest assessment submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div key={submission.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border hover:bg-accent/20 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {submission.student.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{submission.student}</p>
                      <p className="text-sm text-muted-foreground">{submission.assessment}</p>
                    </div>
                  </div>
                  {submission.status === 'evaluated' ? (
                    <Badge variant="default" className="bg-success">
                      {submission.score}%
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Live sessions and webinars</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border hover:bg-accent/20 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      event.type === 'live' ? 'bg-destructive/10' : 
                      event.type === 'assessment' ? 'bg-warning/10' : 'bg-primary/10'
                    }`}>
                      {event.type === 'live' ? (
                        <Video className="h-5 w-5 text-destructive" />
                      ) : event.type === 'assessment' ? (
                        <ClipboardCheck className="h-5 w-5 text-warning" />
                      ) : (
                        <Play className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{event.title}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.date}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    {event.type === 'live' ? 'Join' : 'View'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const StudentDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="mt-1 text-muted-foreground">Continue your learning journey</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5">
            <Award className="h-4 w-4 mr-1.5" />
            Week 3
          </Badge>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="shadow-card gradient-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-primary-foreground/80">Current Week Progress</p>
              <h2 className="text-2xl font-bold mt-1">Python Fundamentals - Week 3</h2>
              <p className="text-primary-foreground/80 mt-2">2 of 4 videos completed</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-3xl font-bold">50%</div>
              <Progress value={50} className="w-32 h-2 bg-primary-foreground/20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Videos */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>This Week's Content</CardTitle>
            <CardDescription>Complete all videos to unlock the weekly assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyVideos.map((video, index) => (
                <div
                  key={video.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    video.completed ? 'bg-success/5 border-success/20' : 'bg-card hover:bg-muted/50 border-border'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    video.completed ? 'bg-success text-success-foreground' : 'bg-primary/10 text-primary'
                  }`}>
                    {video.completed ? '✓' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{video.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {video.duration}
                    </p>
                  </div>
                  <Button variant={video.completed ? 'outline' : 'default'} size="sm">
                    {video.completed ? 'Rewatch' : 'Watch'}
                    <Play className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Your schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:bg-accent/20 hover:shadow-sm transition-all">
                  <div className={`p-2 rounded-lg ${
                    event.type === 'live' ? 'bg-destructive/10' : 
                    event.type === 'assessment' ? 'bg-warning/10' : 'bg-primary/10'
                  }`}>
                    {event.type === 'live' ? (
                      <Video className="h-4 w-4 text-destructive" />
                    ) : event.type === 'assessment' ? (
                      <ClipboardCheck className="h-4 w-4 text-warning" />
                    ) : (
                      <Calendar className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Average Score', value: '87%', icon: TrendingUp, color: 'text-success' },
          { label: 'Videos Watched', value: '18', icon: Play, color: 'text-primary' },
          { label: 'Assessments Done', value: '6', icon: ClipboardCheck, color: 'text-accent' },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {user?.role === 'student' ? <StudentDashboard /> : <AdminDashboard />}
    </DashboardLayout>
  );
}
