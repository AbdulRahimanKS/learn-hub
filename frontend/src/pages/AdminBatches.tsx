import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Users,
  GraduationCap,
  Calendar,
  Edit,
  Trash2,
  Filter,
  Clock,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Check,
  LayoutGrid,
  CloudDownload,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { batchApi, userApi, Batch, BatchFormData, BatchUser, BatchSummary } from '@/lib/batch-api';
import { courseApi, Course } from '@/lib/course-api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Debounce hook
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const initialForm: BatchFormData = {
  name: '',
  description: '',
  course: null,
  teacher: null,
  co_teachers: [],
  max_students: 30,
  start_date: null,
  status: 'ACTIVE',
};

export default function AdminBatches() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Data State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<BatchUser[]>([]);

  // Search / Filter / Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounceValue(searchQuery, 500);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 6;

  // Summary stats
  const [summary, setSummary] = useState<BatchSummary>({
    total_batches: 0,
    active_batches: 0,
    completed_batches: 0,
    total_students: 0,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editBatchId, setEditBatchId] = useState<number | null>(null);
  const [deleteBatchId, setDeleteBatchId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<BatchFormData>(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Async Course Search State
  const [courseSearch, setCourseSearch] = useState('');
  const debouncedCourseSearch = useDebounceValue(courseSearch, 300);
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [coursePage, setCoursePage] = useState(1);
  const [hasMoreCourses, setHasMoreCourses] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  
  // Async Primary Teacher Search State
  const [primaryTeacherSearch, setPrimaryTeacherSearch] = useState('');
  const debouncedPrimaryTeacherSearch = useDebounceValue(primaryTeacherSearch, 300);
  const [primaryTeachersList, setPrimaryTeachersList] = useState<BatchUser[]>([]);
  const [primaryTeacherPage, setPrimaryTeacherPage] = useState(1);
  const [hasMorePrimaryTeachers, setHasMorePrimaryTeachers] = useState(false);
  const [isLoadingPrimaryTeachers, setIsLoadingPrimaryTeachers] = useState(false);

  // Async Co-Teacher Search State
  const [coTeacherSearch, setCoTeacherSearch] = useState('');
  const debouncedCoTeacherSearch = useDebounceValue(coTeacherSearch, 300);
  const [coTeachersList, setCoTeachersList] = useState<BatchUser[]>([]);
  const [coTeacherPage, setCoTeacherPage] = useState(1);
  const [hasMoreCoTeachers, setHasMoreCoTeachers] = useState(false);
  const [isLoadingCoTeachers, setIsLoadingCoTeachers] = useState(false);
  
  // Push Content State
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [pushTargetBatchId, setPushTargetBatchId] = useState<number | null>(null);
  const [pushSourceType, setPushSourceType] = useState<'course' | 'batch'>('course');
  const [pushSourceId, setPushSourceId] = useState<number | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  // ──────────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        search: debouncedSearch,
        paginate: true,
        page: currentPage,
        page_size: pageSize,
      };
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await batchApi.getBatches(params);
      if (res.success) {
        const paginatedData = res as any;
        setBatches(paginatedData.data);
        setTotalPages(paginatedData.total_pages || 1);
      }
    } catch (err: any) {
      toast({
        title: 'Error fetching batches',
        description: err.response?.data?.detail || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, currentPage, toast]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await batchApi.getBatchSummary();
      setSummary(data);
    } catch (_) {}
  }, []);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter]);
  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Async Courses Fetching
  useEffect(() => {
    setCoursePage(1);
    setCoursesList([]);
  }, [debouncedCourseSearch]);

  const fetchAsyncCourses = useCallback(async (page: number, search: string) => {
    try {
      setIsLoadingCourses(true);
      const res = await courseApi.getCourses({ paginate: true, page, search, page_size: 10, is_active: true });
      const pagedData = res as any;
      setHasMoreCourses(pagedData.next !== null);
      setCoursesList(prev => page === 1 ? pagedData.data : [...prev, ...pagedData.data]);
      
      setCourses(prev => {
        const merged = [...prev];
        pagedData.data.forEach((newItem: Course) => {
          if (!merged.find(t => t.id === newItem.id)) merged.push(newItem);
        });
        return merged;
      });
    } catch (_) {} finally { setIsLoadingCourses(false); }
  }, []);

  useEffect(() => { fetchAsyncCourses(coursePage, debouncedCourseSearch); }, [coursePage, debouncedCourseSearch, fetchAsyncCourses]);

  // Async Primary Teachers Fetching
  useEffect(() => {
    setPrimaryTeacherPage(1);
    setPrimaryTeachersList([]);
  }, [debouncedPrimaryTeacherSearch]);

  const fetchAsyncPrimaryTeachers = useCallback(async (page: number, search: string) => {
    try {
      setIsLoadingPrimaryTeachers(true);
      const res = await userApi.listByRole('Teacher', search, true, page, true);
      const pagedData = res as any;
      setHasMorePrimaryTeachers(pagedData.next !== null);
      setPrimaryTeachersList(prev => page === 1 ? pagedData.data : [...prev, ...pagedData.data]);
      
      setTeachers(prev => {
        const merged = [...prev];
        pagedData.data.forEach((newTeacher: BatchUser) => {
          if (!merged.find(t => t.id === newTeacher.id)) merged.push(newTeacher);
        });
        return merged;
      });
    } catch (_) {} finally { setIsLoadingPrimaryTeachers(false); }
  }, []);

  useEffect(() => { fetchAsyncPrimaryTeachers(primaryTeacherPage, debouncedPrimaryTeacherSearch); }, [primaryTeacherPage, debouncedPrimaryTeacherSearch, fetchAsyncPrimaryTeachers]);

  // Async Co-Teachers Fetching
  useEffect(() => {
    setCoTeacherPage(1);
    setCoTeachersList([]);
  }, [debouncedCoTeacherSearch]);

  const fetchAsyncTeachers = useCallback(async (page: number, search: string) => {
    try {
      setIsLoadingCoTeachers(true);
      const res = await userApi.listByRole('Teacher', search, true, page, true);
      const pagedData = res as any;
      
      setHasMoreCoTeachers(pagedData.next !== null);
      setCoTeachersList(prev => page === 1 ? pagedData.data : [...prev, ...pagedData.data]);
      
      // Update the master dictionary of teachers so ID-to-Name resolution always works
      setTeachers(prev => {
        const merged = [...prev];
        pagedData.data.forEach((newTeacher: BatchUser) => {
          if (!merged.find(t => t.id === newTeacher.id)) merged.push(newTeacher);
        });
        return merged;
      });
    } catch (_) {} finally {
      setIsLoadingCoTeachers(false);
    }
  }, []);

  useEffect(() => {
    fetchAsyncTeachers(coTeacherPage, debouncedCoTeacherSearch);
  }, [coTeacherPage, debouncedCoTeacherSearch, fetchAsyncTeachers]);

  // ──────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Batch name is required.';
    else if (formData.name.length > 255) errors.name = 'Batch name must be 255 characters or less.';
    if (!formData.course) errors.course = 'A course must be selected for this batch.';
    if (!formData.teacher) errors.teacher = 'Primary teacher is required.';
    if (!formData.start_date) errors.start_date = 'Start date is required.';
    if ((formData.max_students ?? 0) < 1) errors.max_students = 'Max students must be at least 1.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ──────────────────────────────────────────────
  // Modal Helpers
  // ──────────────────────────────────────────────
  const resetForm = () => {
    setFormData(initialForm);
    setFormErrors({});
    setEditBatchId(null);
  };

  const handleOpenModal = async (batch?: Batch) => {
    if (batch) {
      setEditBatchId(batch.id);
      try {
        const res = await batchApi.getBatch(batch.id);
        const d = res.data as any;
        
        // Populate inactive fields into the local cache if they aren't already present
        if (d.course && d.course_name) {
          setCourses(prev => prev.find(c => c.id === d.course) ? prev : [...prev, { id: d.course, title: d.course_name } as Course]);
        }
        const newTeachers: BatchUser[] = [];
        if (d.teacher && d.teacher_name) {
          newTeachers.push({ id: d.teacher, fullname: d.teacher_name, email: d.teacher_email || '' } as BatchUser);
        }
        if (d.co_teacher_details?.length) {
          newTeachers.push(...d.co_teacher_details);
        }
        if (newTeachers.length > 0) {
          setTeachers(prev => {
            const merged = [...prev];
            newTeachers.forEach(nt => { if (!merged.find(t => t.id === nt.id)) merged.push(nt); });
            return merged;
          });
        }

        setFormData({
          name: d.name || '',
          description: d.description || '',
          course: d.course ?? null,
          teacher: d.teacher ?? null,
          co_teachers: d.co_teachers ?? [],
          max_students: d.max_students ?? 30,
          start_date: d.start_date ?? null,
          status: d.status ?? 'ACTIVE',
        });
      } catch (_) {
        toast({ title: 'Error', description: 'Failed to load batch details', variant: 'destructive' });
        return;
      }
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      const payload: BatchFormData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
      };

      if (editBatchId) {
        await batchApi.updateBatch(editBatchId, payload);
        toast({ title: 'Success', description: 'Batch updated successfully', variant: 'success' });
      } else {
        await batchApi.createBatch(payload);
        toast({ title: 'Success', description: 'Batch created successfully', variant: 'success' });
      }
      setIsModalOpen(false);
      fetchBatches();
      fetchSummary();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to save batch';
      setFormErrors({ server: msg });
      toast({ title: 'Submission Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteBatchId) return;
    try {
      await batchApi.deleteBatch(deleteBatchId);
      toast({ title: 'Deleted', description: 'Batch deleted successfully', variant: 'success' });
      fetchBatches();
      fetchSummary();
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.response?.data?.detail || 'Failed to delete batch',
        variant: 'destructive',
      });
    } finally {
      setDeleteBatchId(null);
    }
  };

  const handlePushContent = async () => {
    if (!pushTargetBatchId || !pushSourceId) return;
    try {
      setIsPushing(true);
      const res = await batchApi.cloneContent(
        pushTargetBatchId,
        pushSourceType === 'course' ? pushSourceId : undefined,
        pushSourceType === 'batch' ? pushSourceId : undefined
      );
      if (res.success) {
        toast({ title: 'Success', description: 'Content pushed successfully', variant: 'success' });
        setIsPushModalOpen(false);
        fetchBatches();
      }
    } catch (err: any) {
      toast({
        title: 'Push Failed',
        description: err.response?.data?.detail || 'Failed to push content',
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  // Re-fetch summary whenever batches change (create/delete/toggle)
  // Updated logic for toggling through some status state (e.g. ACTIVE -> COMPLETED) if ever called
  const handleToggleActive = async (batch: Batch) => {
    try {
      const newStatus = batch.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
      await batchApi.updateStatus(batch.id, newStatus);
      toast({ title: 'Updated', description: `Batch status changed to ${newStatus}`, variant: 'success' });
      fetchBatches();
      fetchSummary();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to update status', variant: 'destructive' });
    }
  };

  // ──────────────────────────────────────────────
  // Co-teacher helpers
  // ──────────────────────────────────────────────
  const addCoTeacher = (t: BatchUser) => {
    setFormData(prev => ({ ...prev, co_teachers: [...(prev.co_teachers || []), t.id] }));
  };
  const removeCoTeacher = (id: number) => {
    setFormData(prev => ({ ...prev, co_teachers: (prev.co_teachers || []).filter(c => c !== id) }));
  };
  const getTeacherName = (id: number) => teachers.find(t => t.id === id)?.fullname ?? `Teacher #${id}`;

  // Stat cards — sourced from API summary
  const statsCards = [
    { label: 'Total Batches',     value: summary.total_batches,     icon: GraduationCap, color: 'bg-primary/10 text-primary' },
    { label: 'Active Batches',    value: summary.active_batches,    icon: BookOpen,      color: 'bg-success/10 text-success' },
    { label: 'Completed Batches', value: summary.completed_batches, icon: Check,         color: 'bg-primary/10 text-primary' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Batches</h1>
            <p className="mt-1 text-muted-foreground">Manage student batches</p>
          </div>
          <Button variant="gradient" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4" />
            Create Batch
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {statsCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${color.split(' ')[0]}`}>
                    <Icon className={`h-6 w-6 ${color.split(' ')[1]}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                  </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search batches..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-[180px] shrink-0">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="border-primary text-primary">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                <SelectItem value="ACTIVE">Active Only</SelectItem>
                <SelectItem value="COMPLETED">Completed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Batch Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {searchQuery ? 'No matching batches' : 'No batches yet'}
            </h3>
            <p>
              {searchQuery
                ? "We couldn't find any batches matching your search. Try different keywords."
                : "You haven't created any batches. Click 'Create Batch' to get started."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map(batch => (
              <Card key={batch.id} className="shadow-card hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg leading-tight truncate">{batch.name}</CardTitle>
                      {batch.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{batch.description}</p>
                      )}
                    </div>
                    {/* Status badge top-right of card header */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium shrink-0",
                        batch.status === 'ACTIVE' && "text-green-600 border-green-500/50 bg-green-500/10",
                        batch.status === 'COMPLETED' && "text-blue-600 border-blue-500/50 bg-blue-500/10",
                      )}
                    >
                      {batch.status === 'ACTIVE' ? 'Active' : 'Completed'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <div className="space-y-4 flex-1 flex flex-col justify-between p-6 pt-0">
                    <div className="space-y-3">
                      {/* Teacher */}
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm text-foreground truncate">{batch.teacher_name ?? 'No teacher assigned'}</span>
                      </div>

                      {/* Progress */}
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>{(batch as any).weeks_count ?? 0} week{((batch as any).weeks_count ?? 0) !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <Progress value={batch.progress_percent} className="h-2" />
                      </div>

                      {/* Stats row: enrolled + date */}
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-border mt-2">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{batch.enrolled_count}/{batch.max_students}</span>
                          {batch.is_full && <Badge variant="outline" className="text-xs ml-1 text-destructive border-destructive">Full</Badge>}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{batch.start_date ? new Date(batch.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date set'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions (Footer) */}
                  <div className="flex items-center justify-between gap-2 px-4 py-3 mt-auto border-t border-border/60 bg-muted/40 rounded-b-xl">
                    {/* Left: Nav pills */}
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/batches/${batch.id}/students`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Students
                      </Link>
                      <Link
                        to={`/admin/batches/${batch.id}/content`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Content
                      </Link>
                    </div>

                    {/* Right: Icon actions */}
                    <div className="flex items-center gap-0.5">
                      <button
                        title="Push Content"
                        onClick={() => { setPushTargetBatchId(batch.id); setIsPushModalOpen(true); }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <CloudDownload className="h-4 w-4" />
                      </button>
                      <button
                        title="Edit Batch"
                        onClick={() => handleOpenModal(batch)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        title="Delete Batch"
                        onClick={() => setDeleteBatchId(batch.id)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && batches.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm font-medium text-muted-foreground px-4">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ─── */}
      <Dialog open={isModalOpen} onOpenChange={open => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editBatchId ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
            <DialogDescription>{editBatchId ? 'Update the batch details below.' : 'Fill in the details to create a new batch.'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Server Error */}
            {formErrors.server && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
                {formErrors.server}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="batch-name">Batch Name <span className="text-destructive">*</span></Label>
              <Input
                id="batch-name"
                autoFocus={false}
                value={formData.name}
                onChange={e => {
                  setFormData(p => ({ ...p, name: e.target.value }));
                  if (formErrors.name) setFormErrors(p => ({ ...p, name: '' }));
                }}
                placeholder="e.g. Python Basics – Batch A"
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="batch-desc">Description</Label>
              <Textarea
                id="batch-desc"
                value={formData.description ?? ''}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the batch"
                rows={3}
              />
            </div>

            {/* Course */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label>Course <span className="text-destructive">*</span></Label>
              {editBatchId ? (
                <Input
                  disabled
                  value={courses.find(c => c.id === formData.course)?.title ?? formData.course_name ?? ''}
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        className={cn(
                          "flex w-full justify-between items-center h-10 px-3 py-2 text-sm font-normal bg-background hover:bg-transparent border border-input rounded-md ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                          !formData.course && "text-muted-foreground",
                          formErrors.course && "border-destructive text-destructive"
                        )}
                      >
                        <span className="truncate">{formData.course ? courses.find(c => c.id === formData.course)?.title : "— Select Course —"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search courses..." 
                          value={courseSearch} 
                          onValueChange={setCourseSearch} 
                        />
                        <CommandList>
                          <CommandEmpty>{isLoadingCourses ? "Loading..." : "No course found."}</CommandEmpty>
                          <CommandGroup>
                            {coursesList.map(c => (
                              <CommandItem
                                key={c.id}
                                value={c.id.toString()}
                                onSelect={() => {
                                  setFormData(p => ({ ...p, course: c.id }));
                                  if (formErrors.course) setFormErrors(p => ({ ...p, course: '' }));
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.course === c.id ? "opacity-100" : "opacity-0")} />
                                {c.title}
                              </CommandItem>
                            ))}
                            {hasMoreCourses && (
                              <CommandItem 
                                value="load-more"
                                onSelect={() => setCoursePage(p => p + 1)}
                                className="justify-center text-primary font-medium cursor-pointer py-2 mt-1"
                              >
                                {isLoadingCourses ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load more..."}
                                {isLoadingCourses ? "Loading" : ""}
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {formErrors.course && <p className="text-xs text-destructive">{formErrors.course}</p>}
                </>
              )}
            </div>

            {/* Primary Teacher */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label>Primary Teacher <span className="text-destructive">*</span></Label>
              {editBatchId && !isAdmin ? (
                <Input
                  disabled
                  value={formData.teacher ? getTeacherName(formData.teacher) : '—'}
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        className={cn(
                          "flex w-full justify-between items-center h-10 px-3 py-2 text-sm font-normal bg-background hover:bg-transparent border border-input rounded-md ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                          !formData.teacher && "text-muted-foreground",
                          formErrors.teacher && "border-destructive text-destructive"
                        )}
                      >
                        <span className="truncate">{formData.teacher ? getTeacherName(formData.teacher) : "— Select Primary Teacher —"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search teachers..." 
                          value={primaryTeacherSearch} 
                          onValueChange={setPrimaryTeacherSearch} 
                        />
                        <CommandList>
                          <CommandEmpty>{isLoadingPrimaryTeachers ? "Loading..." : "No teacher found."}</CommandEmpty>
                          <CommandGroup>
                            {primaryTeachersList.map(t => (
                              <CommandItem
                                key={t.id}
                                value={t.id.toString()}
                                onSelect={() => {
                                  setFormData(p => ({ ...p, teacher: t.id, co_teachers: (p.co_teachers || []).filter(c => c !== t.id) }));
                                  if (formErrors.teacher) setFormErrors(p => ({ ...p, teacher: '' }));
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.teacher === t.id ? "opacity-100" : "opacity-0")} />
                                {t.fullname} <span className="text-muted-foreground text-xs ml-1">({t.email})</span>
                              </CommandItem>
                            ))}
                            {hasMorePrimaryTeachers && (
                              <CommandItem 
                                value="load-more"
                                onSelect={() => setPrimaryTeacherPage(p => p + 1)}
                                className="justify-center text-primary font-medium cursor-pointer py-2 mt-1"
                              >
                                {isLoadingPrimaryTeachers ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load more..."}
                                {isLoadingPrimaryTeachers ? "Loading" : ""}
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {formErrors.teacher && <p className="text-xs text-destructive">{formErrors.teacher}</p>}
                </>
              )}
            </div>

            {/* Co-teachers */}
            <div className="space-y-1.5">
              <Label>Co-Teachers</Label>
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="flex w-full justify-between items-center h-auto min-h-10 px-3 py-2 text-sm font-normal bg-background hover:bg-transparent border border-input rounded-md ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex flex-wrap gap-1">
                      {(formData.co_teachers || []).length > 0 ? (
                        (formData.co_teachers || []).map(id => (
                          <Badge key={id} variant="secondary" className="mr-1 mb-1 font-medium bg-primary/10 text-primary">
                            {getTeacherName(id)}
                            <X className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeCoTeacher(id); }} />
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground mt-0.5">Select co-teachers...</span>
                      )}
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search teachers..." 
                      value={coTeacherSearch} 
                      onValueChange={setCoTeacherSearch} 
                    />
                    <CommandList>
                      <CommandEmpty>{isLoadingCoTeachers ? "Loading..." : "No teacher found."}</CommandEmpty>
                      <CommandGroup>
                        {coTeachersList.filter(t => t.id !== formData.teacher).map(t => (
                          <CommandItem
                            key={t.id}
                            value={t.id.toString()}
                            onSelect={() => {
                              if (formData.co_teachers?.includes(t.id)) removeCoTeacher(t.id);
                              else addCoTeacher(t);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.co_teachers?.includes(t.id) ? "opacity-100" : "opacity-0")} />
                            {t.fullname} <span className="text-muted-foreground text-xs ml-1">({t.email})</span>
                          </CommandItem>
                        ))}
                        {hasMoreCoTeachers && (
                          <CommandItem 
                            value="load-more"
                            onSelect={() => setCoTeacherPage(p => p + 1)}
                            className="justify-center text-primary font-medium cursor-pointer py-2 mt-1"
                          >
                            {isLoadingCoTeachers ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load more..."}
                            {isLoadingCoTeachers ? "Loading" : ""}
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Dates & Requirements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 flex flex-col justify-start">
                <Label>Start Date <span className="text-destructive">*</span> <span className="text-muted-foreground font-normal text-xs ml-2">(Must be a Monday)</span></Label>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full justify-between items-center h-10 px-3 py-2 text-sm font-normal bg-background hover:bg-transparent border border-input rounded-md ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                        !formData.start_date && "text-muted-foreground"
                      )}
                    >
                      {formData.start_date ? format(new Date(formData.start_date), "PPP") : <span>Pick a date</span>}
                      <Calendar className="ml-auto h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={formData.start_date ? new Date(formData.start_date) : undefined}
                      onSelect={(date) => {
                        const dateStr = date ? format(date, "yyyy-MM-dd") : null;
                        setFormData(p => ({ ...p, start_date: dateStr }));
                        if (formErrors.start_date) setFormErrors(p => ({ ...p, start_date: '' }));
                      }}
                      disabled={(date) => {
                        // Rule: Must be a Monday
                        if (date.getDay() !== 1) return true; 
                        // Rule: Cannot be in the past
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (date < today) return true;
                        
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {formErrors.start_date && <p className="text-xs text-destructive">{formErrors.start_date}</p>}
              </div>

              <div className="space-y-1.5 flex flex-col justify-start">
                <Label htmlFor="batch-max">Max Students <span className="text-destructive">*</span></Label>
                <Input
                  id="batch-max"
                  type="number"
                  min={1}
                  value={formData.max_students ?? 30}
                  onChange={e => {
                    setFormData(p => ({ ...p, max_students: parseInt(e.target.value) || 1 }));
                    if (formErrors.max_students) setFormErrors(p => ({ ...p, max_students: '' }));
                  }}
                />
                {formErrors.max_students && <p className="text-xs text-destructive">{formErrors.max_students}</p>}
              </div>

              {editBatchId && (
                <div className="space-y-1.5 flex flex-col justify-start">
                  <Label>Status</Label>
                  <Select value={formData.status || 'INACTIVE'} onValueChange={(val: any) => setFormData(p => ({ ...p, status: val }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => { resetForm(); setIsModalOpen(false); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editBatchId ? 'Update Batch' : 'Create Batch'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBatchId} onOpenChange={open => { if (!open) setDeleteBatchId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The batch will be permanently removed. Note: Batches cannot be deleted if their start date has already passed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Push Content Modal ─── */}
      <Dialog open={isPushModalOpen} onOpenChange={setIsPushModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Push Content to Batch</DialogTitle>
            <DialogDescription>
              Select a source course or batch to clone content from. This will copy all weeks, sessions, and tests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select value={pushSourceType} onValueChange={(v: any) => { setPushSourceType(v); setPushSourceId(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Course Template</SelectItem>
                  <SelectItem value="batch">Existing Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Source {pushSourceType === 'course' ? 'Course' : 'Batch'}</Label>
              <Select value={pushSourceId?.toString() || ""} onValueChange={(v) => setPushSourceId(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${pushSourceType}`} />
                </SelectTrigger>
                <SelectContent>
                  {pushSourceType === 'course' ? (
                    courses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>)
                  ) : (
                    batches
                      .filter(b => b.id !== pushTargetBatchId && b.course === batches.find(t => t.id === pushTargetBatchId)?.course)
                      .map(b => (
                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning-foreground flex gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <p>Cloning content will recalculate unlock dates based on the target batch start date.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsPushModalOpen(false)} disabled={isPushing}>Cancel</Button>
            <Button variant="gradient" onClick={handlePushContent} disabled={isPushing || !pushSourceId}>
              {isPushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CloudDownload className="h-4 w-4 mr-2" />}
              Push Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
