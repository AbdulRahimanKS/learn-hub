import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Award,
  CheckCircle,
  Clock,
  Lock,
  Play,
  FileText,
  Download,
} from 'lucide-react';

const studentProgress = [
  { id: 1, name: 'Alex Thompson', batch: 'Python Basics', week: 4, videosCompleted: 14, totalVideos: 20, weeklyTests: 3, avgScore: 82, trend: 'up' },
  { id: 2, name: 'Maria Garcia', batch: 'Python Basics', week: 5, videosCompleted: 18, totalVideos: 20, weeklyTests: 4, avgScore: 88, trend: 'up' },
  { id: 3, name: 'John Smith', batch: 'Data Science', week: 3, videosCompleted: 10, totalVideos: 16, weeklyTests: 2, avgScore: 71, trend: 'down' },
  { id: 4, name: 'Sarah Wilson', batch: 'Web Development', week: 6, videosCompleted: 24, totalVideos: 24, weeklyTests: 6, avgScore: 95, trend: 'up' },
  { id: 5, name: 'David Brown', batch: 'Python Basics', week: 2, videosCompleted: 6, totalVideos: 20, weeklyTests: 1, avgScore: 65, trend: 'down' },
];

const weeklyProgress = [
  { week: 1, isUnlocked: true, videosCompleted: 4, totalVideos: 4, testScore: 85, isPassed: true },
  { week: 2, isUnlocked: true, videosCompleted: 4, totalVideos: 4, testScore: 78, isPassed: true },
  { week: 3, isUnlocked: true, videosCompleted: 3, totalVideos: 4, testScore: null, isPassed: false },
  { week: 4, isUnlocked: false, videosCompleted: 0, totalVideos: 5, testScore: null, isPassed: false },
  { week: 5, isUnlocked: false, videosCompleted: 0, totalVideos: 4, testScore: null, isPassed: false },
  { week: 6, isUnlocked: false, videosCompleted: 0, totalVideos: 5, testScore: null, isPassed: false },
];

export default function Progress() {
  const { user } = useAuth();

  const AdminProgress = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Student Progress</h1>
          <p className="mt-1 text-muted-foreground">Track student performance across batches</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">76%</p>
                <p className="text-sm text-muted-foreground">Avg Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">80%</p>
                <p className="text-sm text-muted-foreground">Avg Test Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <CheckCircle className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">68%</p>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">12</p>
                <p className="text-sm text-muted-foreground">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search students..." className="pl-10" />
        </div>
        <Button variant="outline" className="shrink-0 gap-2">
          <Filter className="h-4 w-4" />
          Filter by Batch
        </Button>
      </div>

      {/* Progress Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Current Week</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Tests Passed</TableHead>
                <TableHead>Avg Score</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentProgress.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {student.name.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">{student.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{student.batch}</Badge>
                  </TableCell>
                  <TableCell>Week {student.week}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(student.videosCompleted / student.totalVideos) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {student.videosCompleted}/{student.totalVideos}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{student.weeklyTests}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${
                      student.avgScore >= 80 ? 'text-success' :
                      student.avgScore >= 70 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {student.avgScore}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {student.trend === 'up' ? (
                      <TrendingUp className="h-5 w-5 text-success" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const StudentProgress = () => (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Progress</h1>
        <p className="mt-1 text-muted-foreground">Track your learning journey</p>
      </div>

      {/* Overall Stats */}
      <Card className="shadow-card gradient-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="grid gap-6 sm:grid-cols-4">
            <div>
              <p className="text-primary-foreground/80 text-sm">Overall Progress</p>
              <p className="text-3xl font-bold mt-1">58%</p>
              <ProgressBar value={58} className="mt-2 h-2 bg-primary-foreground/20" />
            </div>
            <div>
              <p className="text-primary-foreground/80 text-sm">Videos Watched</p>
              <p className="text-3xl font-bold mt-1">11/26</p>
            </div>
            <div>
              <p className="text-primary-foreground/80 text-sm">Tests Passed</p>
              <p className="text-3xl font-bold mt-1">2/6</p>
            </div>
            <div>
              <p className="text-primary-foreground/80 text-sm">Average Score</p>
              <p className="text-3xl font-bold mt-1">82%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Progress */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Weekly Progress</CardTitle>
          <CardDescription>Complete each week's content to unlock the next</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {weeklyProgress.map((week) => (
              <div
                key={week.week}
                className={`p-4 rounded-lg border ${
                  week.isUnlocked ? 'bg-card border-border' : 'bg-muted/50 border-border/50'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      week.isPassed ? 'bg-success text-success-foreground' :
                      week.isUnlocked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {week.isPassed ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : week.isUnlocked ? (
                        <span className="text-lg font-bold">{week.week}</span>
                      ) : (
                        <Lock className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${week.isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Week {week.week}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Play className="h-3.5 w-3.5" />
                          {week.videosCompleted}/{week.totalVideos} videos
                        </span>
                        {week.testScore !== null && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            Test: {week.testScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {week.isUnlocked && (
                      <>
                        <div className="hidden sm:block w-32">
                          <ProgressBar 
                            value={(week.videosCompleted / week.totalVideos) * 100} 
                            className="h-2"
                          />
                        </div>
                        <Button 
                          variant={week.isPassed ? 'outline' : 'default'} 
                          size="sm"
                        >
                          {week.isPassed ? 'Review' : week.videosCompleted === week.totalVideos ? 'Take Test' : 'Continue'}
                        </Button>
                      </>
                    )}
                    {!week.isUnlocked && (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Feedback */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
          <CardDescription>Feedback from your weekly assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground">Week 2 Assessment - 78%</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Good understanding of control flow concepts. Consider reviewing nested loops and 
                    list comprehensions for better efficiency in your solutions.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground">Week 1 Assessment - 85%</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Excellent work on Python basics! Strong grasp of variables and data types. 
                    Keep up the great work!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardLayout>
      {user?.role === 'student' ? <StudentProgress /> : <AdminProgress />}
    </DashboardLayout>
  );
}
