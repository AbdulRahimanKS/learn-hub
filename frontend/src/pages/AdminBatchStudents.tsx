import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  UserPlus,
  CheckCircle2,
  Mail,
  Calendar as CalendarIcon,
  Trophy,
} from 'lucide-react';
import { batchApi, Batch, BatchUser } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function AdminBatchStudents() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<BatchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [addingStudentId, setAddingStudentId] = useState<number | null>(null);

  // Pagination for enrolled students
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 5;

  const fetchBatchDetails = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await batchApi.getBatches({ paginate: false });
      const allBatches = (res as any).data || res;
      const found = allBatches.find((b: Batch) => b.id === parseInt(batchId));
      if (found) setBatch(found);
      else {
        toast({ title: 'Error', description: 'Batch not found', variant: 'destructive' });
        navigate('/batches');
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch batch details', variant: 'destructive' });
    }
  }, [batchId, navigate, toast]);

  const fetchEnrolledStudents = useCallback(async (page: number) => {
    if (!batchId) return;
    try {
      setLoading(true);
      const res = await batchApi.getBatchStudents(parseInt(batchId), { page, page_size: pageSize });
      setEnrolledStudents(res.data || []);
      setTotalPages(res.total_pages || 1);
      setCurrentPage(res.current_page || page);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch enrolled students', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [batchId, toast]);

  const fetchAvailableStudents = useCallback(async (search?: string) => {
    try {
      setAvailableLoading(true);
      const res = await batchApi.getAvailableStudents(search);
      setAvailableStudents(res.data || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch available students', variant: 'destructive' });
    } finally {
      setAvailableLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBatchDetails();
  }, [fetchBatchDetails]);

  useEffect(() => {
    fetchEnrolledStudents(1);
  }, [fetchEnrolledStudents]);

  useEffect(() => {
    if (isAddModalOpen) {
      fetchAvailableStudents();
    }
  }, [isAddModalOpen, fetchAvailableStudents]);

  const handleAddStudent = async (studentId: number) => {
    if (!batchId) return;
    try {
      setAddingStudentId(studentId);
      await batchApi.addStudent(parseInt(batchId), studentId);
      toast({ title: 'Success', description: 'Student added to batch successfully', variant: 'success' });
      fetchEnrolledStudents(currentPage);
      fetchAvailableStudents(studentSearch);
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || 'Failed to add student', 
        variant: 'destructive' 
      });
    } finally {
      setAddingStudentId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {/* Breadcrumb + Back */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <button
            onClick={() => navigate('/batches')}
            className="hover:text-foreground transition-colors"
          >
            Batches
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Batch Students</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/batches')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {batch?.name}
              </h1>
              <p className="mt-1 text-muted-foreground">Manage students enrolled in this batch</p>
            </div>
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Add Students
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Students to Batch</DialogTitle>
                <DialogDescription>
                  Select from available students who are not currently assigned to any active batch.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-hidden flex flex-col gap-4 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students by name or email..."
                    className="pl-10"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      fetchAvailableStudents(e.target.value);
                    }}
                  />
                </div>
                <div className="flex-1 overflow-y-auto border rounded-xl">
                  {availableLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : availableStudents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>{studentSearch ? 'No matching students found.' : 'No available students found.'}</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableStudents.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.fullname}</TableCell>
                            <TableCell className="text-muted-foreground">{s.email}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1"
                                onClick={() => handleAddStudent(s.id)}
                                disabled={addingStudentId === s.id}
                              >
                                {addingStudentId === s.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3" />
                                )}
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Capacity</p>
                    <p className="text-xl font-bold">{batch?.enrolled_count ?? enrolledStudents.length} / {batch?.max_students}</p>
                </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-xl font-bold">{batch?.is_active ? 'Active' : 'Inactive'}</p>
                </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Available Seats</p>
                    <p className="text-xl font-bold">{(batch?.max_students || 0) - (batch?.enrolled_count ?? enrolledStudents.length)}</p>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Students Display - List View with Progress */}
        <Card className="shadow-card border-none bg-card">
          <CardHeader className="pb-3 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Students & Progress
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-none text-xs">
                  {batch?.enrolled_count ?? enrolledStudents.length} Students
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && enrolledStudents.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : enrolledStudents.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No students enrolled in this batch yet.</p>
                <Button variant="link" className="text-primary mt-2" onClick={() => setIsAddModalOpen(true)}>
                  Add your first student
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {enrolledStudents.map((enrollment) => (
                  <div key={enrollment.id} className="p-6 transition-colors hover:bg-muted/30">
                    <div className="flex flex-col gap-6">
                      {/* Top Row: Name and Progress Bar */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                            {enrollment.student_name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-foreground truncate">{enrollment.student_name}</h3>
                              <Badge variant="outline" className={cn(
                                "text-[10px] h-4 py-0",
                                enrollment.status === 'active' ? "bg-success/5 text-success border-success/20" : "bg-muted text-muted-foreground border-border"
                              )}>
                                {enrollment.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground mt-0.5">
                              <Mail className="h-3 w-3 mr-1.5 shrink-0" />
                              <span className="truncate">{enrollment.student_email}</span>
                            </div>
                          </div>
                          
                          {/* Progress Line and Percentage */}
                          <div className="flex flex-col items-end gap-1.5 w-[200px] shrink-0">
                            <div className="flex items-center justify-end gap-2 text-primary">
                              <span className="text-sm font-bold">{Math.round(enrollment.overall_progress)}%</span>
                              <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Overall</span>
                            </div>
                            <Progress value={enrollment.overall_progress} className="h-1.5 bg-muted" />
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Weeks Completed</p>
                          <p className="font-bold text-foreground">{enrollment.weeks_completed} / {enrollment.total_weeks}</p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Weekly Tests</p>
                          <p className="font-bold text-foreground">
                            {enrollment.weekly_tests_submitted} / {enrollment.total_weekly_tests} <span className="text-[10px] font-normal text-muted-foreground ml-1">submitted</span>
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Class Quizzes</p>
                          <p className="font-bold text-foreground">
                            {enrollment.quizzes_done} / {enrollment.total_quizzes} <span className="text-[10px] font-normal text-muted-foreground ml-1">done</span>
                          </p>
                        </div>
                        <div className="bg-success/5 rounded-lg p-3 border border-success/10">
                          <p className="text-[10px] uppercase font-semibold text-success/70 mb-1">Marks</p>
                          <p className="font-bold text-success flex items-center gap-1.5">
                            {enrollment.marks_obtained} / {enrollment.total_marks}
                            {enrollment.total_marks > 0 && (
                              <span className="text-[10px] font-normal text-success/60">
                                ({Math.round((enrollment.marks_obtained / enrollment.total_marks) * 100)}%)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{enrolledStudents.length}</span> students
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1 || loading}
                  onClick={() => fetchEnrolledStudents(currentPage - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <Button
                      key={i}
                      variant={currentPage === i + 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => fetchEnrolledStudents(i + 1)}
                      className={cn("h-8 w-8 p-0 text-xs", currentPage === i + 1 ? "bg-primary text-primary-foreground" : "")}
                      disabled={loading}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages || loading}
                  onClick={() => fetchEnrolledStudents(currentPage + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
