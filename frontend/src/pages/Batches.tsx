import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Search,
  Users,
  GraduationCap,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  BookOpen,
} from 'lucide-react';

const mockBatches = [
  {
    id: 1,
    name: 'Python Basics - Batch A',
    description: 'Introduction to Python programming for beginners',
    teacher: 'Prof. Michael Chen',
    students: 24,
    maxStudents: 30,
    progress: 65,
    currentWeek: 4,
    totalWeeks: 8,
    startDate: 'Jan 15, 2026',
    status: 'active',
  },
  {
    id: 2,
    name: 'Data Science Fundamentals',
    description: 'Learn data analysis and visualization',
    teacher: 'Prof. Michael Chen',
    students: 18,
    maxStudents: 25,
    progress: 40,
    currentWeek: 3,
    totalWeeks: 10,
    startDate: 'Feb 1, 2026',
    status: 'active',
  },
  {
    id: 3,
    name: 'Web Development Bootcamp',
    description: 'Full-stack web development with React and Node.js',
    teacher: 'Dr. Emily Watson',
    students: 32,
    maxStudents: 35,
    progress: 80,
    currentWeek: 6,
    totalWeeks: 8,
    startDate: 'Dec 1, 2025',
    status: 'active',
  },
  {
    id: 4,
    name: 'Machine Learning Basics',
    description: 'Introduction to ML algorithms and applications',
    teacher: 'Prof. James Lee',
    students: 28,
    maxStudents: 30,
    progress: 100,
    currentWeek: 8,
    totalWeeks: 8,
    startDate: 'Nov 1, 2025',
    status: 'completed',
  },
];

export default function Batches() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Batches</h1>
            <p className="mt-1 text-muted-foreground">Manage student batches and assignments</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Create Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Batch</DialogTitle>
                <DialogDescription>Set up a new student batch</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Batch Name</Label>
                  <Input id="name" placeholder="e.g., Python Basics - Batch B" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Brief description of the batch" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher">Assign Teacher</Label>
                    <select id="teacher" className="w-full h-10 px-3 rounded-lg border border-input bg-background">
                      <option value="">Select teacher</option>
                      <option value="1">Prof. Michael Chen</option>
                      <option value="2">Dr. Emily Watson</option>
                      <option value="3">Prof. James Lee</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStudents">Max Students</Label>
                    <Input id="maxStudents" type="number" placeholder="30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weeks">Duration (Weeks)</Label>
                    <Input id="weeks" type="number" placeholder="8" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button variant="gradient">Create Batch</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockBatches.length}</p>
                  <p className="text-sm text-muted-foreground">Total Batches</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <BookOpen className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {mockBatches.filter(b => b.status === 'active').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Batches</p>
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
                  <p className="text-2xl font-bold text-foreground">
                    {mockBatches.reduce((sum, b) => sum + b.students, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Calendar className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">71%</p>
                  <p className="text-sm text-muted-foreground">Avg Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Batches Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 content-start">
          {mockBatches.map((batch) => (
            <Card key={batch.id} className="shadow-card hover:shadow-lg transition-shadow h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight">{batch.name}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{batch.description}</p>
                  </div>
                  <Badge variant={batch.status === 'active' ? 'default' : 'secondary'}
                    className={`shrink-0 ${batch.status === 'active' ? 'bg-success' : ''}`}>
                    {batch.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Teacher */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground truncate">{batch.teacher}</span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">Week {batch.currentWeek}/{batch.totalWeeks}</span>
                      </div>
                      <Progress value={batch.progress} className="h-2" />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{batch.students}/{batch.maxStudents} students</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{batch.startDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 whitespace-nowrap">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add Students
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
