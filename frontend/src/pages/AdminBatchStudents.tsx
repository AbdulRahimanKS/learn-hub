import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Filter,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { batchApi, Batch, BatchUser, BatchWeek, batchContentApi } from '@/lib/batch-api';
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
import { Checkbox } from '@/components/ui/checkbox';

/** Same debounce as Admin Batches list search. */
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/**
 * Show roster delete (trash) only before the batch start day and before the first week unlock time
 * (matches backend `batch_roster_delete_window_closed`).
 */
function canShowRosterDeleteTrash(
  startDate: string | null | undefined,
  weeks: Pick<BatchWeek, 'week_number' | 'unlock_date'>[],
): boolean {
  if (!startDate) return false;
  const now = new Date();
  const dayPart = startDate.split('T')[0];
  const parts = dayPart.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [y, m, d] = parts;
  const startDay = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today >= startDay) return false;

  const ordered = [...weeks]
    .filter((w) => w.unlock_date)
    .sort((a, b) => a.week_number - b.week_number);
  const first = ordered[0];
  if (first?.unlock_date) {
    const unlock = new Date(first.unlock_date);
    if (!Number.isNaN(unlock.getTime()) && now >= unlock) return false;
  }
  return true;
}

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
  const debouncedStudentSearch = useDebounceValue(studentSearch, 500);
  const [addingStudentId, setAddingStudentId] = useState<number | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [enrolledSearch, setEnrolledSearch] = useState('');
  const debouncedEnrolledSearch = useDebounceValue(enrolledSearch, 500);
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, dropped: 0 });
  const [selectedEnrollments, setSelectedEnrollments] = useState<number[]>([]);

  // Confirmation modal states
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [individualConfirm, setIndividualConfirm] = useState<{ isOpen: boolean; enrollmentId: number; status: string } | null>(null);
  const [individualLoading, setIndividualLoading] = useState<number | null>(null);
  const [deleteEnrollmentConfirm, setDeleteEnrollmentConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<number | null>(null);

  // Pagination for enrolled students
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  /** Match User Management list (`Users.tsx` uses page_size: 6). */
  const pageSize = 6;

  // Pagination for available students (add-students modal only — separate from enrolled list page size)
  const [availableCurrentPage, setAvailableCurrentPage] = useState(1);
  const [totalAvailablePages, setTotalAvailablePages] = useState(1);
  const [totalAvailableItems, setTotalAvailableItems] = useState(0);
  const availablePageSize = 6;

  const [batchWeeks, setBatchWeeks] = useState<BatchWeek[]>([]);

  const fetchBatchDetails = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await batchApi.getBatches({ paginate: false });
      const allBatches = (res as any).data || res;
      const found = allBatches.find((b: Batch) => b.id === parseInt(batchId));
      if (found) {
        setBatch(found);
        try {
          const wr = await batchContentApi.getWeeks(parseInt(batchId, 10));
          if (wr.success && Array.isArray(wr.data)) setBatchWeeks(wr.data);
          else setBatchWeeks([]);
        } catch {
          setBatchWeeks([]);
        }
      } else {
        toast({ title: 'Error', description: 'Batch not found', variant: 'destructive' });
        navigate('/batches');
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch batch details', variant: 'destructive' });
    }
  }, [batchId, navigate, toast]);

  const fetchEnrolledStudents = useCallback(async (page: number = 1, search: string = '', status: string = 'all') => {
    if (!batchId) return;
    try {
      setLoading(true);
      const res = await batchApi.getBatchStudents(parseInt(batchId), { 
        page, 
        page_size: pageSize,
        search: search || undefined,
        status: status === 'all' ? undefined : status
      });
      setEnrolledStudents(res.data || []);
      setTotalPages(res.total_pages || 1);
      setCurrentPage(res.current_page || page);
      if (res.stats) {
        setStats(res.stats);
      }
      
      // We only clear selection when search or filter changes, not on page change
      // But fetchEnrolledStudents is called for all three. 
      // Handled by the useEffect below for resets.
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch enrolled students', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [batchId, toast, pageSize]);

  const fetchAvailableStudents = useCallback(async (search?: string, page: number = 1) => {
    if (!batchId) return;
    try {
      setAvailableLoading(true);
      const res = await batchApi.getAvailableStudents({
        search,
        page,
        page_size: availablePageSize,
        batch_id: parseInt(batchId, 10),
      });
      if ('current_page' in res) {
        setAvailableStudents(res.data || []);
        setAvailableCurrentPage(res.current_page);
        setTotalAvailablePages(res.total_pages);
        setTotalAvailableItems(typeof res.total_items === 'number' ? res.total_items : (res.data || []).length);
      } else {
        const list = res.data || [];
        setAvailableStudents(list);
        setTotalAvailablePages(1);
        setAvailableCurrentPage(1);
        setTotalAvailableItems(list.length);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch available students', variant: 'destructive' });
    } finally {
      setAvailableLoading(false);
    }
  }, [availablePageSize, toast, batchId]);

  useEffect(() => {
    fetchBatchDetails();
  }, [fetchBatchDetails]);

  useEffect(() => {
    fetchEnrolledStudents(1, debouncedEnrolledSearch, statusFilter);
    setSelectedEnrollments([]); // Clear selection when search/filter actually changes
  }, [fetchEnrolledStudents, debouncedEnrolledSearch, statusFilter]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    fetchAvailableStudents(debouncedStudentSearch, availableCurrentPage);
  }, [isAddModalOpen, debouncedStudentSearch, availableCurrentPage, fetchAvailableStudents]);

  const allowRemoveFromRoster = canShowRosterDeleteTrash(batch?.start_date ?? undefined, batchWeeks);

  const handleRemoveEnrollment = async () => {
    if (!batchId || !deleteEnrollmentConfirm) return;
    try {
      setDeletingEnrollmentId(deleteEnrollmentConfirm.id);
      await batchApi.removeStudentEnrollment(parseInt(batchId), deleteEnrollmentConfirm.id);
      toast({ title: 'Removed', description: `${deleteEnrollmentConfirm.name} was removed from this batch.`, variant: 'success' });
      setDeleteEnrollmentConfirm(null);
      await fetchEnrolledStudents(currentPage, debouncedEnrolledSearch, statusFilter);
      await fetchBatchDetails();
    } catch (err: any) {
      toast({
        title: 'Cannot remove',
        description: err.response?.data?.detail || 'Failed to remove student from batch',
        variant: 'destructive',
      });
    } finally {
      setDeletingEnrollmentId(null);
    }
  };

  const handleAddStudent = async (studentId: number) => {
    if (!batchId) return;
    try {
      setAddingStudentId(studentId);
      await batchApi.addStudent(parseInt(batchId), studentId);
      toast({ title: 'Success', description: 'Student added to batch successfully', variant: 'success' });
      fetchEnrolledStudents(currentPage, debouncedEnrolledSearch, statusFilter);
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

  const handleToggleWeekUnlock = async (enrollmentId: number, weekNumber: number, action: 'unlock' | 'revoke') => {
    if (!batchId) return;
    try {
      await batchApi.toggleWeekUnlock(parseInt(batchId), enrollmentId, weekNumber, action);
      toast({ 
        title: 'Success', 
        description: `Week ${weekNumber} ${action === 'unlock' ? 'unlocked' : 'revoked'} successfully`, 
        variant: 'success' 
      });
      fetchEnrolledStudents(currentPage, debouncedEnrolledSearch, statusFilter);
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || `Failed to ${action} week`, 
        variant: 'destructive' 
      });
    }
  };

  const handleUpdateEnrollment = async (enrollmentId: number, data: { status?: string }) => {
    if (!batchId) return;
    
    // Irreversible statuses: confirm before completing or dropping
    if (
      (data.status === 'completed' || data.status === 'dropped') &&
      !individualConfirm?.isOpen
    ) {
      setIndividualConfirm({ isOpen: true, enrollmentId, status: data.status! });
      return;
    }

    try {
      setIndividualLoading(enrollmentId);
      await batchApi.updateStudentEnrollment(parseInt(batchId), enrollmentId, data);
      toast({ title: 'Success', description: 'Student enrollment updated', variant: 'success' });
      fetchEnrolledStudents(currentPage, debouncedEnrolledSearch, statusFilter);
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || 'Failed to update student enrollment', 
        variant: 'destructive' 
      });
    } finally {
      setIndividualLoading(null);
      setIndividualConfirm(null);
    }
  };

  const handleBulkComplete = async () => {
    if (!batchId) return;
    try {
      setIsBulkUpdating(true);
      // If we have selections, use them. Otherwise pass undefined to update all active students
      const idsToUpdate = selectedEnrollments.length > 0 ? selectedEnrollments : undefined;
      
      const res = await batchApi.bulkUpdateStudents(parseInt(batchId), 'completed', idsToUpdate);
      toast({ 
        title: 'Success', 
        description: res.message || `Successfully updated students`, 
        variant: 'success' 
      });
      setIsBulkConfirmOpen(false);
      setSelectedEnrollments([]);
      fetchEnrolledStudents(1, debouncedEnrolledSearch, statusFilter);
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.response?.data?.detail || 'Failed to bulk update students', 
        variant: 'destructive' 
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    const activeEnrollmentsOnPage = enrolledStudents
      .filter(e => e.status === 'active')
      .map(e => e.id);

    if (checked) {
      // Add only those not already in selection
      setSelectedEnrollments(prev => {
        const newIds = activeEnrollmentsOnPage.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    } else {
      // Remove only those that are on the current page
      setSelectedEnrollments(prev => prev.filter(id => !activeEnrollmentsOnPage.includes(id)));
    }
  };

  const toggleSelect = (enrollmentId: number, checked: boolean) => {
    if (checked) {
      setSelectedEnrollments(prev => [...prev, enrollmentId]);
    } else {
      setSelectedEnrollments(prev => prev.filter(id => id !== enrollmentId));
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
          <div className="flex items-center gap-3">
            {enrolledStudents.length > 0 && stats.active > 0 && (
              <Button 
                variant="outline" 
                className="gap-2 border-primary/25 text-primary hover:bg-primary hover:text-primary-foreground dark:border-primary/40"
                onClick={() => setIsBulkConfirmOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {selectedEnrollments.length > 0 
                    ? `Mark Selected (${selectedEnrollments.length}) Completed` 
                    : 'Mark All Active Completed'}
                </span>
                <span className="sm:hidden">
                  {selectedEnrollments.length > 0 
                    ? `Mark (${selectedEnrollments.length})` 
                    : 'Mark All'}
                </span>
              </Button>
            )}
            <Dialog
              open={isAddModalOpen}
              onOpenChange={(open) => {
                setIsAddModalOpen(open);
                if (open) {
                  setAvailableCurrentPage(1);
                }
              }}
            >
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
                  Students already on this roster (any status) and anyone in another active batch are hidden.
                  Paginated ({availablePageSize} per page) when needed.
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
                      setAvailableCurrentPage(1);
                    }}
                  />
                </div>
                 <div className="flex-1 overflow-y-auto border rounded-xl m-1">
                  {availableLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : availableStudents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl m-3">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-1 text-foreground">
                        {totalAvailableItems > 0
                          ? 'No students on this page'
                          : debouncedStudentSearch.trim()
                            ? 'No students matching your search'
                            : 'No available students'}
                      </h3>
                      <p className="max-w-sm mx-auto px-2">
                        {totalAvailableItems > 0
                          ? `${totalAvailableItems} student${totalAvailableItems !== 1 ? 's' : ''} match your criteria — try another page or go back to the first page.`
                          : debouncedStudentSearch.trim()
                            ? "We couldn't find any students matching your search. Try different keywords."
                            : 'Everyone who can be added may already be on this batch or in another active batch.'}
                      </p>
                      {totalAvailableItems > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-6"
                          onClick={() => setAvailableCurrentPage(1)}
                        >
                          Go to first page
                        </Button>
                      )}
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
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {s.profile_picture ? (
                                    <img src={s.profile_picture} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-semibold text-primary">
                                      {s.fullname.charAt(0)}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium text-foreground">{s.fullname}</span>
                              </div>
                            </TableCell>
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
                    
                    {!availableLoading && availableStudents.length > 0 && totalAvailablePages > 1 && (
                      <div className="flex items-center justify-center gap-2 px-4 py-3 border-t bg-muted/20">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={availableCurrentPage === 1}
                          onClick={() => setAvailableCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <div className="text-sm font-medium text-muted-foreground px-4">
                          Page {availableCurrentPage} of {totalAvailablePages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={availableCurrentPage === totalAvailablePages}
                          onClick={() =>
                            setAvailableCurrentPage((p) => Math.min(totalAvailablePages, p + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    )}
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total} <span className="text-sm font-normal text-muted-foreground">/ {batch?.max_students || '-'}</span></p>
                  <p className="text-sm text-muted-foreground font-medium">Capacity</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                  <p className="text-sm text-muted-foreground font-medium">Active Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Trophy className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground font-medium">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  batch?.status === 'ACTIVE' ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                )}>
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground capitalize">{batch?.status?.toLowerCase() || '-'}</p>
                  <p className="text-sm text-muted-foreground font-medium">Batch Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students by name or email..."
              value={enrolledSearch}
              onChange={(e) => setEnrolledSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2 bg-card border border-border px-3 h-10 rounded-md">
              <Checkbox 
                id="select-all" 
                checked={
                  enrolledStudents.length > 0 && 
                  enrolledStudents.filter(e => e.status === 'active').length > 0 && 
                  enrolledStudents.filter(e => e.status === 'active').every(e => selectedEnrollments.includes(e.id))
                }
                onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                disabled={enrolledStudents.filter(e => e.status === 'active').length === 0}
              />
              <label 
                htmlFor="select-all" 
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Select All Active
              </label>
            </div>
            <div className="w-[180px] shrink-0">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 border-primary text-primary">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="completed">Completed Only</SelectItem>
                  <SelectItem value="dropped">Dropped Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card className="shadow-card border-none bg-card overflow-hidden">
          <CardContent className="p-0">
            {loading && enrolledStudents.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !loading && stats.total === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl m-6">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1 text-foreground">No students in this batch yet</h3>
                <p className="max-w-sm mx-auto">
                  You haven&apos;t added any students. Click &quot;Add Students&quot; above to enroll your first student.
                </p>
              </div>
            ) : !loading && stats.total > 0 && enrolledStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl m-6">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1 text-foreground">
                  {debouncedEnrolledSearch.trim()
                    ? 'No students matching your search'
                    : statusFilter !== 'all'
                      ? statusFilter === 'active'
                        ? 'No active students'
                        : statusFilter === 'completed'
                          ? 'No completed students'
                          : statusFilter === 'dropped'
                            ? 'No dropped students'
                            : 'No students match this filter'
                      : 'No students on this page'}
                </h3>
                <p className="max-w-sm mx-auto">
                  {debouncedEnrolledSearch.trim()
                    ? "We couldn't find any students matching your search. Try different keywords."
                    : statusFilter !== 'all'
                      ? statusFilter === 'active'
                        ? "There are no active students in this batch with the current filters."
                        : statusFilter === 'completed'
                          ? "There are no completed students in this batch with the current filters."
                          : statusFilter === 'dropped'
                            ? "There are no dropped students in this batch with the current filters."
                            : 'Try adjusting your filters.'
                      : 'There are no results on this page. Use the pagination below to choose another page.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/40">
                {enrolledStudents.map((enrollment) => {
                  const isExpanded = expandedStudentId === enrollment.id;
                  const weekStatusRows = Array.isArray(enrollment.weeks_access_status)
                    ? [...enrollment.weeks_access_status].sort((a: any, b: any) => (a.week_number || 0) - (b.week_number || 0))
                    : [];
                  
                  return (
                  <div key={enrollment.id} className="bg-card overflow-hidden transition-all duration-300">
                    {/* Collapsed Header / Standard Row */}
                    <div 
                      className="p-4 flex flex-col md:flex-row gap-6 md:items-center cursor-pointer hover:bg-muted/10 transition-colors"
                      onClick={() => setExpandedStudentId(isExpanded ? null : enrollment.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2 sm:gap-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedEnrollments.includes(enrollment.id)}
                            onCheckedChange={(checked) => toggleSelect(enrollment.id, !!checked)}
                            disabled={enrollment.status !== 'active'}
                            className={cn(enrollment.status !== 'active' && "opacity-20")}
                          />
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 border border-primary/20 shadow-inner overflow-hidden">
                            {enrollment.profile_picture ? (
                              <img
                                src={enrollment.profile_picture}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              enrollment.student_name.charAt(0).toUpperCase()
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-lg text-foreground truncate">{enrollment.student_name}</h3>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Mail className="h-3.5 w-3.5 mr-1.5 shrink-0 opacity-70" />
                            <span className="truncate">{enrollment.student_email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Unified Stats Area */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 mt-4 md:mt-0 items-end">
                        <div className="flex flex-col gap-1 w-full group">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-[10px] text-muted-foreground font-bold tracking-tight group-hover:text-foreground transition-colors">Deliverable weeks</span>
                            <span className="text-xs font-bold">{enrollment.weeks_completed} <span className="text-[10px] text-muted-foreground font-normal">/ {enrollment.total_weeks}</span></span>
                          </div>
                          <Progress value={enrollment.total_weeks ? (enrollment.weeks_completed / enrollment.total_weeks) * 100 : 0} className="h-1 bg-primary/10" />
                        </div>
                        
                        <div className="flex flex-col gap-1 w-full group">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-[10px] text-muted-foreground font-bold tracking-tight group-hover:text-foreground transition-colors">Tests</span>
                            <span className="text-xs font-bold">{enrollment.weekly_tests_submitted} <span className="text-[10px] text-muted-foreground font-normal">/ {enrollment.total_weekly_tests}</span></span>
                          </div>
                          <Progress value={enrollment.total_weekly_tests ? (enrollment.weekly_tests_submitted / enrollment.total_weekly_tests) * 100 : 0} className="h-1 bg-success/20 [&>div]:bg-success" />
                        </div>

                        <div className="flex flex-col gap-1 w-full group col-span-2 md:col-span-1">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-[10px] text-muted-foreground font-bold tracking-tight group-hover:text-foreground transition-colors">Progress</span>
                            <span className="text-xs font-bold">{Math.round(enrollment.overall_progress || 0)}%</span>
                          </div>
                          <Progress
                            value={enrollment.overall_progress || 0}
                            className={cn(
                              "h-1 bg-slate-200/80 dark:bg-slate-700/60",
                              enrollment.overall_progress >= 80
                                ? "[&>div]:bg-emerald-500"
                                : enrollment.overall_progress >= 50
                                  ? "[&>div]:bg-indigo-500"
                                  : "[&>div]:bg-blue-500"
                            )}
                          />
                        </div>
                      </div>
                      
                      <div
                        className="flex flex-shrink-0 items-center justify-end gap-2 w-full md:w-auto mt-3 md:mt-0 md:ml-4 md:mr-2 relative z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <div className="hidden md:block min-w-[100px]">
                          {individualLoading === enrollment.id ? (
                            <div className="h-9 flex items-center justify-center text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            <Select
                              value={enrollment.status}
                              onValueChange={(val) => handleUpdateEnrollment(enrollment.id, { status: val })}
                              disabled={enrollment.status === 'completed' || enrollment.status === 'dropped'}
                            >
                              <SelectTrigger className={cn(
                                "h-9 px-4 text-xs font-semibold rounded-lg border border-border shadow-sm",
                                enrollment.status === 'active' ? "bg-success/5 text-success border-success/20 hover:bg-success/10" : 
                              enrollment.status === 'completed' ? "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 opacity-80" :
                              enrollment.status === 'dropped' ? "bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10 opacity-80" :
                                "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active" className="text-xs font-medium">Active</SelectItem>
                                <SelectItem 
                                  value="completed" 
                                  className="text-xs font-medium"
                                  disabled={enrollment.status !== 'active' && enrollment.status !== 'completed'}
                                >
                                  Completed {enrollment.status === 'dropped' && "(Active status required)"}
                                </SelectItem>
                                <SelectItem
                                value="dropped"
                                className="text-xs font-medium"
                                disabled={enrollment.status !== 'active' && enrollment.status !== 'dropped'}
                              >
                                Dropped {enrollment.status === 'completed' && '(Active status required)'}
                              </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {allowRemoveFromRoster && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove from roster (only before batch start and first week unlock)"
                            onClick={() =>
                              setDeleteEnrollmentConfirm({
                                id: enrollment.id,
                                name: enrollment.student_name,
                              })
                            }
                            disabled={deletingEnrollmentId === enrollment.id}
                          >
                            {deletingEnrollmentId === enrollment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="hidden md:flex flex-shrink-0 ml-0 items-center justify-center p-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>

                    {/* Expandable "Unlocked Content" Panel */}
                    <div 
                      className={cn(
                        "transition-all duration-300 ease-in-out border-t border-border/40 bg-muted/5",
                        isExpanded ? "max-h-[1000px] opacity-100 py-6 px-6 block" : "max-h-0 opacity-0 py-0 px-6 overflow-hidden hidden"
                      )}
                    >
                      <div className="flex flex-col gap-6">
                        
                        {/* Granular Week Access Card */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold tracking-tight text-muted-foreground flex items-center gap-2">
                               Course access control
                            </h4>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-success" />
                                <span className="text-[10px] font-medium text-muted-foreground">Unlocked</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                <span className="text-[10px] font-medium text-muted-foreground">Locked</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {weekStatusRows.map((weekStatus: any) => {
                              const weekNo = weekStatus?.week_number;
                              
                              const isManual = weekStatus?.is_manually_unlocked;
                              const isSystem = weekStatus?.is_system_unlocked;
                              const isUnlocked = isManual || isSystem;
                              const isRevokable = weekStatus?.is_revokable;
                              const isDropped = enrollment.status === 'dropped';

                              return (
                                <div key={weekNo} className={cn(
                                  "py-3 px-4 rounded-xl border flex items-center justify-between transition-all group",
                                  isUnlocked ? "bg-background border-success/20 ring-1 ring-success/5 shadow-sm" : "bg-muted/20 border-border/40"
                                )}>
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "flex items-center justify-center h-9 w-9 rounded-lg shadow-sm transition-all",
                                      isUnlocked ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                      {isUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={cn(
                                        "text-sm font-bold",
                                        isUnlocked ? "text-foreground" : "text-muted-foreground"
                                      )}>Week {weekNo}</span>
                                      <span className={cn(
                                        "text-[10px] font-medium leading-tight",
                                        isSystem ? "text-success" : isManual ? "text-primary" : "text-muted-foreground"
                                      )}>
                                        {isSystem ? 'Standard Access' : isManual ? 'Manual Access' : 'Locked'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {isSystem ? (
                                      <div className="h-8 px-3 flex items-center">
                                        <CheckCircle2 className="h-4 w-4 text-success" />
                                      </div>
                                    ) : isManual ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn(
                                          "h-8 px-3 text-[11px] font-bold",
                                          isRevokable && !isDropped ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground opacity-50 cursor-not-allowed"
                                        )}
                                        onClick={() => isRevokable && !isDropped && handleToggleWeekUnlock(enrollment.id, weekNo, 'revoke')}
                                        disabled={!isRevokable || isDropped}
                                        title={!isRevokable ? "Cannot revoke: student has already interacted with this week" : ""}
                                      >
                                        Revoke
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn(
                                          "h-8 border-primary/25 px-3 text-[11px] font-bold text-primary",
                                          "hover:bg-primary hover:text-primary-foreground dark:border-primary/40",
                                          isDropped && "opacity-50 cursor-not-allowed"
                                        )}
                                        onClick={() => !isDropped && handleToggleWeekUnlock(enrollment.id, weekNo, 'unlock')}
                                        disabled={isDropped}
                                      >
                                        Unlock now
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {weekStatusRows.length === 0 && (
                            <div className="p-8 text-center bg-muted/5 rounded-2xl border border-dashed border-border">
                              <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                              <p className="text-sm font-medium text-muted-foreground">No weeks configured for this course yet.</p>
                            </div>
                          )}
                          
                          <div className="mt-6 flex items-start gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
                            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="text-xs text-primary/80 leading-relaxed">
                              <p className="font-bold mb-1 tracking-tight">Access rules help</p>
                              <ul className="list-disc pl-4 space-y-1">
                                <li><strong>Standard Access:</strong> Automatically granted based on start date and previous week assessment results.</li>
                                <li><strong>Manual Access:</strong> Explicitly granted by an admin/teacher. These bypass standard requirements.</li>
                                <li><strong>Revoke:</strong> Only possible for manual unlocks if the student hasn't started video sessions or attempted tests.</li>
                              </ul>
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
          
          {/* Pagination — same pattern as User Management (`Users.tsx`) */}
          {!loading && enrolledStudents.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => fetchEnrolledStudents(currentPage - 1, debouncedEnrolledSearch, statusFilter)}
              >
                Previous
              </Button>
              <div className="text-sm font-medium text-muted-foreground px-4">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages || loading}
                onClick={() => fetchEnrolledStudents(currentPage + 1, debouncedEnrolledSearch, statusFilter)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        {/* Bulk Update Confirmation */}
        <AlertDialog open={isBulkConfirmOpen} onOpenChange={setIsBulkConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedEnrollments.length > 0 
                  ? `Mark ${selectedEnrollments.length} selected students as completed?` 
                  : 'Mark all active students as completed?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 pt-2">
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 shrink-0 text-foreground/70" />
                    <div>
                      <strong className="text-foreground">Note:</strong> This will only update students with{' '}
                      <strong className="text-foreground">Active</strong> status. Dropped or already completed students
                      will not be affected.
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p className="text-sm font-medium text-destructive leading-relaxed">
                      <span className="font-semibold">Warning:</span> This action is <strong>irreversible</strong>. Once
                      marked as completed, you cannot change them back to active or dropped.
                    </p>
                  </div>
                </div>
                <p>
                  {selectedEnrollments.length > 0 
                    ? `You are about to mark ${selectedEnrollments.length} selected active students as 'Completed'.`
                    : `This will update all ${stats.active} currently active students in this batch to 'Completed' status.`}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkUpdating}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  handleBulkComplete();
                }}
                disabled={isBulkUpdating}
                className="bg-primary hover:bg-primary/90"
              >
                {isBulkUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Bulk Completion
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove enrollment (before batch start only) */}
        <AlertDialog
          open={!!deleteEnrollmentConfirm}
          onOpenChange={(open) => !open && setDeleteEnrollmentConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Remove from batch?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  This will delete <strong className="text-foreground">{deleteEnrollmentConfirm?.name}</strong>&apos;s
                  enrollment for this batch. They can be added again from the available students list.
                </p>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p className="text-sm font-medium text-destructive leading-relaxed">
                      <span className="font-semibold">Warning:</span> Roster removal is only allowed before the batch start
                      day and before the first week&apos;s unlock. After that, use <strong>Dropped</strong> instead of
                      deleting the row.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Batch start: <span className="font-medium text-foreground">{batch?.start_date ?? '—'}</span>
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingEnrollmentId !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleRemoveEnrollment();
                }}
                disabled={deletingEnrollmentId !== null}
              >
                {deletingEnrollmentId !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove from batch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Individual Status Change Confirmation (completed / dropped — one-way) */}
        <AlertDialog 
          open={!!individualConfirm} 
          onOpenChange={(open) => !open && setIndividualConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {individualConfirm?.status === 'dropped'
                  ? 'Mark student as dropped?'
                  : 'Mark student as completed?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 pt-2">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p className="text-sm font-medium text-destructive leading-relaxed">
                      <span className="font-semibold">Warning:</span> This action is <strong>irreversible</strong>.{' '}
                      {individualConfirm?.status === 'dropped'
                        ? 'Once dropped, status cannot be changed back to active or completed.'
                        : 'Once completed, status cannot be changed back to active or dropped.'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {individualConfirm?.status === 'dropped'
                    ? "Are you sure you want to mark this student as 'Dropped'?"
                    : "Are you sure you want to mark this student as 'Completed'?"}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (individualConfirm) {
                    handleUpdateEnrollment(individualConfirm.enrollmentId, { status: individualConfirm.status });
                  }
                }}
                className={
                  individualConfirm?.status === 'dropped'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary hover:bg-primary/90'
                }
              >
                {individualConfirm?.status === 'dropped' ? 'Mark as Dropped' : 'Mark as Completed'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
