import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  Clock,
  Calendar,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Eye,
  Edit,
  Award,
  Users,
} from 'lucide-react';

const mockAssessments = {
  postClass: [
    { id: 1, title: 'Variables Quiz', week: 1, video: 'Variables and Data Types', questions: 10, submissions: 45, avgScore: 78, status: 'active' },
    { id: 2, title: 'Control Flow Quiz', week: 1, video: 'Control Flow Statements', questions: 8, submissions: 42, avgScore: 82, status: 'active' },
    { id: 3, title: 'Functions Quiz', week: 1, video: 'Functions and Modules', questions: 12, submissions: 38, avgScore: 75, status: 'active' },
  ],
  weekly: [
    { id: 4, title: 'Week 1 Assessment', week: 1, questions: 20, submissions: 48, avgScore: 72, passingScore: 70, dueDate: 'Jan 28, 2026', status: 'completed' },
    { id: 5, title: 'Week 2 Assessment', week: 2, questions: 25, submissions: 32, avgScore: 68, passingScore: 70, dueDate: 'Feb 4, 2026', status: 'active' },
    { id: 6, title: 'Week 3 Assessment', week: 3, questions: 20, submissions: 0, avgScore: 0, passingScore: 70, dueDate: 'Feb 11, 2026', status: 'scheduled' },
  ],
  pendingReview: [
    { id: 1, student: 'Alex Thompson', assessment: 'Week 2 Assessment', submittedAt: '2 hours ago', autoScore: 85 },
    { id: 2, student: 'Maria Garcia', assessment: 'Week 2 Assessment', submittedAt: '3 hours ago', autoScore: 78 },
    { id: 3, student: 'John Smith', assessment: 'Week 2 Assessment', submittedAt: '5 hours ago', autoScore: 92 },
  ],
};

const studentAssessments = [
  { id: 1, title: 'Variables Quiz', type: 'post-class', score: 85, maxScore: 100, status: 'completed', feedback: 'Great understanding of variables!' },
  { id: 2, title: 'Control Flow Quiz', type: 'post-class', score: 90, maxScore: 100, status: 'completed', feedback: 'Excellent work on loops!' },
  { id: 3, title: 'Week 1 Assessment', type: 'weekly', score: 78, maxScore: 100, status: 'completed', feedback: 'Good overall performance. Review file handling concepts.' },
  { id: 4, title: 'Functions Quiz', type: 'post-class', score: null, maxScore: 100, status: 'pending', dueDate: 'Today, 11:59 PM' },
  { id: 5, title: 'Week 2 Assessment', type: 'weekly', score: null, maxScore: 100, status: 'available', dueDate: 'Feb 4, 2026' },
];

export default function Assessments() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const AdminAssessments = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Assessments</h1>
          <p className="mt-1 text-muted-foreground">Manage tests and evaluate submissions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="h-4 w-4" />
              Create Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Assessment</DialogTitle>
              <DialogDescription>Set up a new quiz or weekly test</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Assessment Title</Label>
                <Input id="title" placeholder="Enter assessment title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select id="type" className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="post-class" className="bg-background text-foreground">Post-Class Quiz</option>
                    <option value="weekly" className="bg-background text-foreground">Weekly Test</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week">Week</Label>
                  <Input id="week" type="number" placeholder="1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input id="passingScore" type="number" placeholder="70" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="datetime-local" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Upload Questions (.ipynb or JSON)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button variant="gradient">Create Assessment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">12</p>
                <p className="text-sm text-muted-foreground">Active Tests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mockAssessments.pendingReview.length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">76%</p>
                <p className="text-sm text-muted-foreground">Avg Pass Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="weekly" className="space-y-6">
        <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto h-auto p-1">
          <TabsTrigger value="weekly">Weekly Tests</TabsTrigger>
          <TabsTrigger value="post-class">Post-Class Quizzes</TabsTrigger>
          <TabsTrigger value="review">
            Pending Review
            <Badge variant="destructive" className="ml-2">{mockAssessments.pendingReview.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="space-y-4">
            {mockAssessments.weekly.map((test) => (
              <Card key={test.id} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        test.status === 'completed' ? 'bg-success/10' :
                        test.status === 'active' ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <FileText className={`h-6 w-6 ${
                          test.status === 'completed' ? 'text-success' :
                          test.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{test.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {test.questions} questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {test.submissions} submissions
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Due: {test.dueDate}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-4">
                      {test.submissions > 0 && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">{test.avgScore}%</p>
                          <p className="text-xs text-muted-foreground">Avg Score</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          test.status === 'completed' ? 'default' :
                          test.status === 'active' ? 'secondary' : 'outline'
                        } className={test.status === 'completed' ? 'bg-success' : ''}>
                          {test.status}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="post-class">
          <div className="space-y-4">
            {mockAssessments.postClass.map((quiz) => (
              <Card key={quiz.id} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{quiz.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Video: {quiz.video}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span>{quiz.questions} questions</span>
                        <span>{quiz.submissions} submissions</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{quiz.avgScore}%</p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review">
          <div className="space-y-4">
            {mockAssessments.pendingReview.map((item) => (
              <Card key={item.id} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{item.student.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{item.student}</h3>
                        <p className="text-sm text-muted-foreground">{item.assessment}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Submitted {item.submittedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">AI Score</p>
                        <p className="text-lg font-bold text-foreground">{item.autoScore}%</p>
                      </div>
                      <Button variant="gradient" size="sm">
                        Review & Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  const StudentAssessments = () => (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Assessments</h1>
        <p className="mt-1 text-muted-foreground">View your quizzes and test results</p>
      </div>

      {/* Progress Card */}
      <Card className="shadow-card gradient-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-primary-foreground/80">Overall Performance</p>
              <h2 className="text-3xl font-bold mt-1">84%</h2>
              <p className="text-primary-foreground/80 mt-2">Average score across all assessments</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-primary-foreground/80">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-primary-foreground/80">Pending</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessments List */}
      <div className="space-y-4">
        {studentAssessments.map((assessment) => (
          <Card key={assessment.id} className="shadow-card">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    assessment.status === 'completed' ? 'bg-success/10' :
                    assessment.status === 'pending' ? 'bg-warning/10' : 'bg-primary/10'
                  }`}>
                    {assessment.status === 'completed' ? (
                      <CheckCircle className="h-6 w-6 text-success" />
                    ) : assessment.status === 'pending' ? (
                      <Clock className="h-6 w-6 text-warning" />
                    ) : (
                      <FileText className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{assessment.title}</h3>
                    <Badge variant="outline" className="mt-2">
                      {assessment.type === 'weekly' ? 'Weekly Test' : 'Post-Class Quiz'}
                    </Badge>
                    {assessment.feedback && (
                      <p className="text-sm text-muted-foreground mt-2">{assessment.feedback}</p>
                    )}
                    {assessment.dueDate && assessment.status !== 'completed' && (
                      <p className="text-sm text-warning mt-2 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Due: {assessment.dueDate}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {assessment.score !== null ? (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{assessment.score}%</p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                  ) : (
                    <Badge variant={assessment.status === 'pending' ? 'secondary' : 'default'}>
                      {assessment.status === 'pending' ? 'In Progress' : 'Available'}
                    </Badge>
                  )}
                  <Button
                    variant={assessment.status === 'completed' ? 'outline' : 'gradient'}
                    size="sm"
                  >
                    {assessment.status === 'completed' ? 'View Results' : 'Start'}
                  </Button>
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
      {user?.role === 'student' ? <StudentAssessments /> : <AdminAssessments />}
    </DashboardLayout>
  );
}
