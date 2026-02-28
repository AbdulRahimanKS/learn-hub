import React, { useState, useEffect, useCallback } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  GraduationCap,
  Calendar,
  Edit,
  Trash2,
  Filter,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { batchApi, userApi, Batch, BatchFormData, BatchUser, BatchSummary } from '@/lib/batch-api';
import { courseApi, Course } from '@/lib/course-api';
import { useToast } from '@/hooks/use-toast';

// Debounce hook
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const STATUS_CHOICES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'bg-blue-500',
  active: 'bg-success',
  on_hold: 'bg-warning',
  completed: 'bg-muted-foreground',
  cancelled: 'bg-destructive',
};

const initialForm: BatchFormData = {
  name: '',
  description: '',
  course: null,
  teacher: null,
  co_teachers: [],
  max_students: 30,
  start_date: null,
  end_date: null,
  duration_weeks: 8,
  status: 'upcoming',
  is_active: true,
  is_online: true,
  meeting_platform: '',
  location: '',
  is_free: true,
  fee_amount: null,
};

export default function AdminBatches() {
  const { toast } = useToast();

  // Data State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<BatchUser[]>([]);

  // Search / Filter / Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounceValue(searchQuery, 500);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 6;

  // Summary stats
  const [summary, setSummary] = useState<BatchSummary>({
    total_batches: 0,
    active_batches: 0,
    upcoming_batches: 0,
    on_hold_batches: 0,
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
      if (statusFilter !== 'all') params.is_active = statusFilter === 'active';

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
      const res = await courseApi.getCourses({ paginate: true, page, search, page_size: 10 });
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
      const res = await userApi.listByRole('Teacher', search, true, page);
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
      const res = await userApi.listByRole('Teacher', search, true, page);
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
    if ((formData.max_students ?? 0) < 1) errors.max_students = 'Max students must be at least 1.';
    if ((formData.duration_weeks ?? 0) < 1) errors.duration_weeks = 'Duration must be at least 1 week.';
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date)
      errors.end_date = 'End date must be after start date.';
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
        setFormData({
          name: d.name || '',
          description: d.description || '',
          course: d.course ?? null,
          teacher: d.teacher ?? null,
          co_teachers: d.co_teachers ?? [],
          max_students: d.max_students ?? 30,
          start_date: d.start_date ?? null,
          end_date: d.end_date ?? null,
          duration_weeks: d.duration_weeks ?? 8,
          status: d.status ?? 'upcoming',
          is_active: d.is_active ?? true,
          is_online: d.is_online ?? true,
          meeting_platform: d.meeting_platform ?? '',
          location: d.location ?? '',
          is_free: d.is_free ?? true,
          fee_amount: d.fee_amount ?? null,
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
        fee_amount: formData.is_free ? null : (formData.fee_amount || null),
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

  // Re-fetch summary whenever batches change (create/delete/toggle)
  const handleToggleActive = async (batch: Batch) => {
    try {
      await batchApi.toggleActive(batch.id);
      toast({ title: 'Updated', description: `Batch ${batch.is_active ? 'deactivated' : 'activated'} successfully`, variant: 'success' });
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

  // Stat cards — sourced from API summary (avg progress is static for now)
  const statsCards = [
    { label: 'Total Batches',   value: summary.total_batches,  icon: GraduationCap, color: 'bg-primary/10 text-primary' },
    { label: 'Active Batches',  value: summary.active_batches,  icon: BookOpen,      color: 'bg-success/10 text-success' },
    { label: 'Total Students',  value: summary.total_students,  icon: Users,         color: 'bg-accent/10 text-accent' },
    { label: 'Avg Progress',    value: '—',                     icon: Calendar,      color: 'bg-warning/10 text-warning' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Batches</h1>
            <p className="mt-1 text-muted-foreground">Manage student batches and assignments</p>
          </div>
          <Button variant="gradient" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4" />
            Create Batch
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shrink-0 gap-2">
                <Filter className="h-4 w-4" />
                {statusFilter === 'all' ? 'All Status' : statusFilter === 'active' ? 'Active' : 'Inactive'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                <DropdownMenuRadioItem value="all">All Status</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="inactive">Inactive</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
                    <Badge className={`shrink-0 ${STATUS_COLOR[batch.status] || 'bg-muted'} text-white`}>
                      {STATUS_CHOICES.find(s => s.value === batch.status)?.label ?? batch.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Teacher */}
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm text-foreground truncate">{batch.teacher_name ?? 'No teacher assigned'}</span>
                      </div>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">Week {batch.current_week}/{batch.duration_weeks}</span>
                        </div>
                        <Progress value={batch.progress_percent} className="h-2" />
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{batch.enrolled_count}/{batch.max_students}</span>
                          {batch.is_full && <Badge variant="outline" className="text-xs ml-1 text-destructive border-destructive">Full</Badge>}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{batch.start_date ?? 'No date set'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4">
                      <Switch
                        checked={batch.is_active}
                        onCheckedChange={() => handleToggleActive(batch)}
                        className="data-[state=unchecked]:bg-muted"
                      />
                      <span className="text-xs text-muted-foreground">{batch.is_active ? 'Active' : 'Inactive'}</span>
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(batch)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteBatchId(batch.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ─── */}
      <Dialog open={isModalOpen} onOpenChange={open => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                              // hack to close popover natively if needed since onselect doesnt always auto-close in manual mode
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
            </div>

            {/* Primary Teacher */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label>Primary Teacher <span className="text-destructive">*</span></Label>
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

            {/* Dates + Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label>Start Date</Label>
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
                      }}
                      disabled={(date) => {
                        if (formData.end_date) return format(date, "yyyy-MM-dd") > formData.end_date;
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label>End Date</Label>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full justify-between items-center h-10 px-3 py-2 text-sm font-normal bg-background hover:bg-transparent border border-input rounded-md ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                        !formData.end_date && "text-muted-foreground",
                        formErrors.end_date && "border-destructive text-destructive"
                      )}
                    >
                      {formData.end_date ? format(new Date(formData.end_date), "PPP") : <span>Pick a date</span>}
                      <Calendar className="ml-auto h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={formData.end_date ? new Date(formData.end_date) : undefined}
                      onSelect={(date) => {
                        const dateStr = date ? format(date, "yyyy-MM-dd") : null;
                        setFormData(p => ({ ...p, end_date: dateStr }));
                        if (formErrors.end_date) setFormErrors(p => ({ ...p, end_date: '' }));
                      }}
                      disabled={(date) => {
                        if (formData.start_date) return format(date, "yyyy-MM-dd") < formData.start_date;
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {formErrors.end_date && <p className="text-xs text-destructive">{formErrors.end_date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-weeks">Duration (Weeks) <span className="text-destructive">*</span></Label>
                <Input
                  id="batch-weeks"
                  type="number"
                  min={1}
                  value={formData.duration_weeks ?? 8}
                  onChange={e => {
                    setFormData(p => ({ ...p, duration_weeks: parseInt(e.target.value) || 1 }));
                    if (formErrors.duration_weeks) setFormErrors(p => ({ ...p, duration_weeks: '' }));
                  }}
                />
                {formErrors.duration_weeks && <p className="text-xs text-destructive">{formErrors.duration_weeks}</p>}
              </div>
            </div>

            {/* Max Students + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label htmlFor="batch-status">Status</Label>
                <select
                  id="batch-status"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus-visible:outline-none"
                  value={formData.status ?? 'upcoming'}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                >
                  {STATUS_CHOICES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Switch
                id="batch-active"
                checked={formData.is_active ?? true}
                onCheckedChange={v => setFormData(p => ({ ...p, is_active: v }))}
              />
              <div>
                <Label htmlFor="batch-active" className="font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive batches are hidden from students and teachers</p>
              </div>
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
              This action cannot be undone. The batch will be permanently removed. Batches with active enrollments cannot be deleted.
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
    </DashboardLayout>
  );
}
