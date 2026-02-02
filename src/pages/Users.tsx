import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Users as UsersIcon,
  GraduationCap,
  UserCheck,
} from 'lucide-react';

const mockTeachers = [
  { id: 1, name: 'Prof. Michael Chen', email: 'michael@elearn.com', batches: ['Python Basics', 'Data Science'], students: 48, joinedAt: 'Jan 2024' },
  { id: 2, name: 'Dr. Emily Watson', email: 'emily@elearn.com', batches: ['Web Development'], students: 32, joinedAt: 'Feb 2024' },
  { id: 3, name: 'Prof. James Lee', email: 'james@elearn.com', batches: ['Machine Learning'], students: 28, joinedAt: 'Mar 2024' },
];

const mockStudents = [
  { id: 1, name: 'Alex Thompson', email: 'alex@email.com', batch: 'Python Basics', progress: 75, avgScore: 82, status: 'active' },
  { id: 2, name: 'Maria Garcia', email: 'maria@email.com', batch: 'Python Basics', progress: 90, avgScore: 88, status: 'active' },
  { id: 3, name: 'John Smith', email: 'john@email.com', batch: 'Data Science', progress: 45, avgScore: 71, status: 'active' },
  { id: 4, name: 'Sarah Wilson', email: 'sarah@email.com', batch: 'Web Development', progress: 100, avgScore: 95, status: 'completed' },
  { id: 5, name: 'David Brown', email: 'david@email.com', batch: 'Python Basics', progress: 30, avgScore: 65, status: 'at-risk' },
];

export default function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userType, setUserType] = useState<'teacher' | 'student'>('student');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">User Management</h1>
            <p className="mt-1 text-muted-foreground">Manage teachers and students</p>
          </div>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Create a new teacher or student account</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>User Type</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={userType === 'teacher' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setUserType('teacher')}
                    >
                      <GraduationCap className="h-4 w-4 mr-2" />
                      Teacher
                    </Button>
                    <Button
                      variant={userType === 'student' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setUserType('student')}
                    >
                      <UsersIcon className="h-4 w-4 mr-2" />
                      Student
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Enter full name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="user@example.com" />
                </div>
                {userType === 'student' && (
                  <div className="space-y-2">
                    <Label htmlFor="batch">Assign to Batch</Label>
                    <select id="batch" className="w-full h-10 px-3 rounded-lg border border-input bg-background">
                      <option value="">Select a batch</option>
                      <option value="python">Python Basics</option>
                      <option value="datascience">Data Science</option>
                      <option value="webdev">Web Development</option>
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <Input id="password" type="password" placeholder="Create a password" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                <Button variant="gradient">Add User</Button>
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
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockTeachers.length}</p>
                  <p className="text-sm text-muted-foreground">Teachers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent/10">
                  <UsersIcon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockStudents.length}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <UserCheck className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {mockStudents.filter(s => s.status === 'active').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="students" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <Card className="shadow-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Avg Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {student.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{student.name}</p>
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.batch}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${student.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{student.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{student.avgScore}%</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            student.status === 'active' ? 'default' :
                            student.status === 'completed' ? 'secondary' : 'destructive'
                          } className={
                            student.status === 'active' ? 'bg-success' :
                            student.status === 'completed' ? '' : ''
                          }>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teachers">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockTeachers.map((teacher) => (
                <Card key={teacher.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">
                            {teacher.name.split(' ').slice(-1)[0].charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{teacher.name}</h3>
                          <p className="text-sm text-muted-foreground">{teacher.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {teacher.batches.map((batch) => (
                          <Badge key={batch} variant="secondary">{batch}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{teacher.students} students</span>
                        <span>Joined {teacher.joinedAt}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
