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
  Info,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Settings2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { batchApi, Batch, BatchUser } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

  // Pagination for enrolled students
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 5;

  // Pagination for available students
  const [availableCurrentPage, setAvailableCurrentPage] = useState(1);
  const [totalAvailablePages, setTotalAvailablePages] = useState(1);
  const availablePageSize = 5;

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

  const fetchAvailableStudents = useCallback(async (search?: string, page: number = 1) => {
    try {
      setAvailableLoading(true);
      const res = await batchApi.getAvailableStudents({
        search,
        page,
        page_size: availablePageSize,
      });
      if ('current_page' in res) {
        setAvailableStudents(res.data || []);
        setAvailableCurrentPage(res.current_page);
        setTotalAvailablePages(res.total_pages);
      } else {
        setAvailableStudents(res.data || []);
        setTotalAvailablePages(1);
        setAvailableCurrentPage(1);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch available students', variant: 'destructive' });
    } finally {
      setAvailableLoading(false);
    }
  }, [availablePageSize, toast]);

  useEffect(() => {
    fetchBatchDetails();
  }, [fetchBatchDetails]);

  useEffect(() => {
    fetchEnrolledStudents(1);
  }, [fetchEnrolledStudents]);

  useEffect(() => {
    if (isAddModalOpen) {
      fetchAvailableStudents(studentSearch, availableCurrentPage);
    }
  }, [isAddModalOpen, fetchAvailableStudents, availableCurrentPage]);

  const handleAddStudent = async (studentId: number) => {
    if (!batchId) return;
    try {
      setAddingStudentId(studentId);
      await batchApi.addStudent(parseInt(batchId), studentId);
      toast({ title: 'Success', description: 'Student added to batch successfully', variant: 'success' });
      fetchEnrolledStudents(currentPage);
      fetchAvailableStudents(studentSearch, availableCurrentPage);
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

  const handleUpdateEnrollment = async (enrollmentId: number, data: { status?: string, current_week_unlocked?: number }) => {
    if (!batchId) return;
    try {
      await batchApi.updateStudentEnrollment(parseInt(batchId), enrollmentId, data);
      toast({ title: 'Success', description: 'Student enrollment updated', variant: 'success' });
      fetchEnrolledStudents(currentPage);
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || 'Failed to update student enrollment', 
        variant: 'destructive' 
      });
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

              <div className="px-1 pt-2">
                <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-lg py-2 px-3">
                  <Info className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs text-primary/80 leading-relaxed m-0 p-0">
                    Students will receive their login credentials via email once they are added to this batch.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col gap-4 pt-4 px-1">
                <div className="relative mx-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students by name or email..."
                    className="pl-10"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      fetchAvailableStudents(e.target.value, 1);
                    }}
                  />
                </div>
                 <div className="flex-1 overflow-y-auto border rounded-xl m-1">
                  {availableLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : availableStudents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>{studentSearch ? 'No matching students found.' : 'No available students found.'}</p>
                    </div>
                  ) : (
                    <>
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
                    
                    {totalAvailablePages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={availableCurrentPage === 1 || availableLoading}
                            onClick={() => setAvailableCurrentPage(p => p - 1)}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <span className="text-[10px] text-muted-foreground px-2">
                            Page {availableCurrentPage} of {totalAvailablePages}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={availableCurrentPage === totalAvailablePages || availableLoading}
                            onClick={() => setAvailableCurrentPage(p => p + 1)}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    </>
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
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  batch?.status === 'ACTIVE' ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                )}>
                    {batch?.status === 'ACTIVE' ? <CheckCircle2 className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-xl font-bold capitalize">
                      {batch?.status ? batch.status.toLowerCase() : 'Loading...'}
                    </p>
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
              <div className="flex flex-col gap-4">
                {enrolledStudents.map((enrollment) => {
                  const isExpanded = expandedStudentId === enrollment.id;
                  
                  return (
                  <div key={enrollment.id} className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md">
                    {/* Collapsed Header / Standard Row */}
                    <div 
                      className="p-5 flex flex-col md:flex-row gap-6 md:items-center cursor-pointer hover:bg-muted/10 transition-colors"
                      onClick={() => setExpandedStudentId(isExpanded ? null : enrollment.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 border border-primary/20 shadow-inner">
                          {enrollment.student_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-foreground truncate">{enrollment.student_name}</h3>
                            <Badge variant="outline" className={cn(
                              "text-[10px] h-5 py-0 px-2 uppercase tracking-wide font-bold",
                              enrollment.status === 'active' ? "bg-success/10 text-success border-success/30" : 
                              enrollment.status === 'completed' ? "bg-primary/10 text-primary border-primary/30" :
                              enrollment.status === 'dropped' ? "bg-destructive/10 text-destructive border-destructive/30" :
                              "bg-muted text-muted-foreground border-border"
                            )}>
                              {enrollment.status}
                            </Badge>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Mail className="h-3.5 w-3.5 mr-1.5 shrink-0 opacity-70" />
                            <span className="truncate">{enrollment.student_email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Unified Stats Area */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 mt-4 md:mt-0 items-end">
                        <div className="flex flex-col gap-1 w-full relative group">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">Weeks</span>
                            <span className="text-sm font-bold">{enrollment.weeks_completed} <span className="text-xs text-muted-foreground font-normal">/ {enrollment.total_weeks}</span></span>
                          </div>
                          <Progress value={enrollment.total_weeks ? (enrollment.weeks_completed / enrollment.total_weeks) * 100 : 0} className="h-1.5 bg-primary/10" />
                        </div>
                        
                        <div className="flex flex-col gap-1 w-full relative group">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">Tests</span>
                            <span className="text-sm font-bold">{enrollment.weekly_tests_submitted} <span className="text-xs text-muted-foreground font-normal">/ {enrollment.total_weekly_tests}</span></span>
                          </div>
                          <Progress value={enrollment.total_weekly_tests ? (enrollment.weekly_tests_submitted / enrollment.total_weekly_tests) * 100 : 0} className="h-1.5 bg-success/20 [&>div]:bg-success" />
                        </div>

                        <div className="flex flex-col gap-1 w-full relative group col-span-2 md:col-span-1">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">Overall</span>
                            <span className="text-sm font-bold">{Math.round(enrollment.overall_progress || 0)}%</span>
                          </div>
                          <Progress value={enrollment.overall_progress || 0} className="h-1.5 bg-accent/20 [&>div]:bg-accent" />
                        </div>
                      </div>
                      
                      <div className="hidden md:flex flex-shrink-0 ml-4 items-center justify-center p-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mr-2 relative z-10" onClick={(e) => { e.stopPropagation(); }}>
                        <Select
                          value={enrollment.status}
                          onValueChange={(val) => handleUpdateEnrollment(enrollment.id, { status: val })}
                        >
                          <SelectTrigger className={cn(
                            "h-8 px-3 text-[11px] uppercase font-bold tracking-wider rounded border border-border/70",
                            enrollment.status === 'active' ? "bg-success/5 text-success hover:bg-success/10" : 
                            enrollment.status === 'completed' ? "bg-primary/5 text-primary hover:bg-primary/10" :
                            enrollment.status === 'dropped' ? "bg-destructive/5 text-destructive hover:bg-destructive/10" :
                            "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active" className="text-xs font-semibold">ACTIVE</SelectItem>
                            <SelectItem value="completed" className="text-xs font-semibold">COMPLETED</SelectItem>
                            <SelectItem value="dropped" className="text-xs font-semibold">DROPPED</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="hidden md:flex flex-shrink-0 ml-2 items-center justify-center p-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>

                    {/* Expandable "Unlocked Content" Panel */}
                    <div 
                      className={cn(
                        "transition-all duration-300 ease-in-out border-t border-border/40 bg-muted/10",
                        isExpanded ? "max-h-[1000px] opacity-100 py-6 px-5 block" : "max-h-0 opacity-0 py-0 px-5 overflow-hidden hidden"
                      )}
                    >
                      <div className="flex flex-col xl:flex-row gap-6">
                        
                        {/* Scrollable list of weeks representation */}
                        <div className="flex-1">
                          <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-muted-foreground">Unlocked Content Map</h4>
                          <div className="bg-background rounded-xl border border-border/40 p-1 divide-y divide-border/30 max-h-60 overflow-y-auto">
                            {Array.from({ length: enrollment.total_weeks || 0 }).map((_, i) => {
                              const weekNo = i + 1;
                              const isUnlocked = weekNo <= (enrollment.current_week_unlocked || 0);
                              return (
                                <div key={weekNo} className="py-2.5 px-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "flex items-center justify-center h-7 w-7 rounded-md",
                                      isUnlocked ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                                    )}>
                                      {isUnlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                    </div>
                                    <span className={cn(
                                      "text-sm font-medium",
                                      isUnlocked ? "text-foreground" : "text-muted-foreground"
                                    )}>Week {weekNo}</span>
                                  </div>
                                  {isUnlocked && <Badge variant="secondary" className="bg-success/10 text-success text-[10px] font-medium border-none px-2 h-5">Access Granted</Badge>}
                                </div>
                              );
                            })}
                            {(!enrollment.total_weeks || enrollment.total_weeks === 0) && (
                              <div className="p-4 text-sm text-center text-muted-foreground">No weeks configured for this course yet.</div>
                            )}
                          </div>
                        </div>

                        {/* Right quick management panel */}
                        <div className="w-full xl:w-[320px] flex flex-col gap-4">
                          <div className="bg-background rounded-xl border border-border/40 p-5 shadow-sm">
                            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-foreground flex items-center gap-2">
                              <Settings2 className="h-4 w-4 text-primary" /> Management
                            </h4>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Overall Status</label>
                                <Select
                                  value={enrollment.status}
                                  onValueChange={(val) => handleUpdateEnrollment(enrollment.id, { status: val })}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="dropped">Dropped</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Maximum Unlocked Week Number</label>
                                <div className="flex gap-2">
                                  <Input 
                                    type="number" 
                                    min={1} 
                                    max={enrollment.total_weeks || 1}
                                    defaultValue={enrollment.current_week_unlocked || 1}
                                    className="w-20 font-mono text-center"
                                    onBlur={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val) && val !== enrollment.current_week_unlocked) {
                                        handleUpdateEnrollment(enrollment.id, { current_week_unlocked: val });
                                      }
                                    }}
                                  />
                                  <Button 
                                    variant="secondary" 
                                    className="flex-1 font-semibold"
                                    onClick={() => {
                                      const next = (enrollment.current_week_unlocked || 0) + 1;
                                      if (next <= (enrollment.total_weeks || 1)) {
                                        handleUpdateEnrollment(enrollment.id, { current_week_unlocked: next });
                                      } else {
                                        toast({ description: "All available weeks are already unlocked.", variant: "default" })
                                      }
                                    }}
                                  >
                                    + Unlock Next Week
                                  </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                                  Sets the maximum week content accessible by this student. The system will automatically respect standard drip-feed time limitations until this value is met.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                  );
                })}
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
