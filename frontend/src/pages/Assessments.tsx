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
  Clock,
  Calendar,
  Search,
  FileText,
  CheckCircle,
  AlertCircle,
  Eye,
  Users,
} from 'lucide-react';

const mockAssessments = {
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
  { id: 3, title: 'Week 1 Assessment', type: 'weekly', score: 78, maxScore: 100, status: 'completed', feedback: 'Good overall performance. Review file handling concepts.' },
  { id: 5, title: 'Week 2 Assessment', type: 'weekly', score: null, maxScore: 100, status: 'available', dueDate: 'Feb 4, 2026' },
];

export default function Assessments() {
  const { user } = useAuth();

  const AdminAssessments = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Assessments</h1>
          <p className="mt-1 text-muted-foreground">Manage and evaluate student submissions</p>
        </div>
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
        <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit h-auto justify-start overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-hide">
          <TabsTrigger value="weekly">Weekly Tests</TabsTrigger>
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
        <p className="mt-1 text-muted-foreground">View your test results</p>
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
                      Weekly Test
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
