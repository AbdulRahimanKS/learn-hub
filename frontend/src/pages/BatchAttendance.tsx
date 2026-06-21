import { useState, useCallback, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { batchApi, type Batch } from '@/lib/batch-api';
import {
  toStudentAttendanceRecord,
  computeAttendanceSummary,
  ATTENDANCE_THRESHOLD,
  ATTENDANCE_STATUS_CONFIG,
  type StudentAttendanceRecord,
} from '@/lib/attendance-api';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Loader2,
  User,
  ChevronRight,
  Download,
  ClipboardList,
  UserCheck,
  UserX,
  UserPlus,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

function formatEnrolledDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BatchAttendance() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');

  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(Number(id));
    setSelectedBatchName(batch.name);
    setCurrentPage(1);
    setSearch('');
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedBatchId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const res = await batchApi.getBatchStudents(
        selectedBatchId,
        { page: currentPage, page_size: 10, search: debouncedSearch },
        { signal: ctrl.signal },
      );
      if (ctrl.signal.aborted || reqId !== reqIdRef.current) return;
      if (res.success) {
        setRecords((res.data ?? []).map(toStudentAttendanceRecord));
        setTotalPages(res.total_pages ?? 1);
        setStats(res.stats ?? null);
      }
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
      toast({ title: 'Error', description: 'Failed to load attendance data.', variant: 'destructive' });
    } finally {
      if (reqId === reqIdRef.current && !ctrl.signal.aborted) setLoading(false);
    }
  }, [selectedBatchId, currentPage, debouncedSearch, toast]);

  useEffect(() => {
    if (selectedBatchId) fetchData();
  }, [selectedBatchId, fetchData]);

  const handleExport = async (fmt: 'xlsx' | 'csv') => {
    if (!selectedBatchId) return;
    setIsExporting(true);
    try {
      const res = await batchApi.getBatchStudents(selectedBatchId, { page: 1, page_size: 10000 });
      if (res.success && res.data?.length) {
        const rows = res.data.map(toStudentAttendanceRecord).map((r) => ({
          'Student Name': r.studentName,
          Email: r.studentEmail,
          'Enrollment Status': r.enrollmentStatus,
          'Total Videos': r.totalVideos,
          'Videos Completed': r.completedVideos,
          'Attendance %': r.attendancePercent,
          Status: ATTENDANCE_STATUS_CONFIG[r.attendanceStatus].label,
          'Enrolled At': formatEnrolledDate(r.enrolledAt),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `attendance_${selectedBatchId}.${fmt}`);
        toast({ title: 'Success', description: 'Report exported.', variant: 'success' });
      } else {
        toast({ title: 'Info', description: 'No students to export.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Export failed.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // Derive summary from currently loaded page (quick stats)
  const pageSummary = computeAttendanceSummary(records);

  // Stat cards use overall stats from API when available
  const totalEnrolled = stats?.total ?? pageSummary.totalStudents;
  const activeCount = stats?.active ?? 0;
  const completedCount = stats?.completed ?? 0;
  const droppedCount = stats?.dropped ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Batch Attendance
            </h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              Video completion–based attendance for each enrolled student
            </p>
          </div>
          {records.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting || loading} className="shrink-0 gap-2">
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>Download as Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')}>Download as CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ── Stat cards (show once a batch is selected and data returned) ── */}
        {stats && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                  <div className="p-2 sm:p-3 rounded-xl bg-primary/10 shrink-0">
                    <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{totalEnrolled}</p>
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-tight sm:normal-case">Total Enrolled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                  <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{activeCount}</p>
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-tight sm:normal-case">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                  <div className="p-2 sm:p-3 rounded-xl bg-info/10 shrink-0">
                    <Award className="h-5 w-5 sm:h-6 sm:w-6 text-info" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{completedCount}</p>
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-tight sm:normal-case">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                  <div className="p-2 sm:p-3 rounded-xl bg-destructive/10 shrink-0">
                    <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{droppedCount}</p>
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-tight sm:normal-case">Dropped</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Filters row ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students by name or email…"
              className="pl-10 h-10 sm:h-11 text-sm rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full min-w-0 shrink-0 sm:w-[min(280px,100%)] sm:max-w-[280px]">
            <BatchFilterCombobox
              value={selectedBatchId?.toString() ?? ''}
              selectedLabel={selectedBatchName}
              onValueChange={handleBatchChange}
              onReady={() => setLoading(false)}
              placeholder="Filter by batch"
              triggerIcon={<Filter className="h-4 w-4 text-primary" />}
              className="h-10 sm:h-11 border-primary text-primary text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* ── Attendance Table ── */}
        <Card className="shadow-card border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[24%] py-4">Student</TableHead>
                    <TableHead className="w-[13%]">Total Videos</TableHead>
                    <TableHead className="w-[13%]">Completed</TableHead>
                    <TableHead className="w-[22%]">Attendance</TableHead>
                    <TableHead className="w-[14%]">Status</TableHead>
                    <TableHead className="w-[14%] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-50 mb-2" />
                      </TableCell>
                    </TableRow>
                  ) : !selectedBatchId ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-[300px]">
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl mx-2">
                          <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-40" />
                          <h3 className="text-lg font-medium mb-1">Select a batch</h3>
                          <p className="text-sm max-w-sm mx-auto">
                            Use the filter above to choose a batch and view its attendance data.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-[300px]">
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl mx-2">
                          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium mb-1">
                            {debouncedSearch
                              ? `No students matching "${debouncedSearch}"`
                              : 'No students found'}
                          </h3>
                          <p className="text-sm max-w-sm mx-auto">
                            {debouncedSearch
                              ? 'Try different keywords.'
                              : 'There are no enrolled students in this batch yet.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((r) => (
                      <TableRow
                        key={r.enrollmentId}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() =>
                          navigate('/attendance/student', {
                            state: { enrollment: r, batchId: selectedBatchId, batchName: selectedBatchName },
                          })
                        }
                      >
                        {/* Student */}
                        <TableCell className="min-w-0">
                          <div className="flex items-center gap-3 py-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden">
                              {r.profilePicture ? (
                                <img src={r.profilePicture} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold text-primary">
                                  {r.studentName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{r.studentName}</p>
                              <p className="text-xs text-muted-foreground truncate">{r.studentEmail}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Total Videos */}
                        <TableCell>
                          <span className="font-medium tabular-nums">{r.totalVideos}</span>
                        </TableCell>

                        {/* Completed */}
                        <TableCell>
                          <span className="font-medium tabular-nums">{r.completedVideos}</span>
                          <span className="text-muted-foreground text-xs ml-1">/ {r.totalVideos}</span>
                        </TableCell>

                        {/* Attendance % bar */}
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-2 flex-1 min-w-0 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  r.attendancePercent >= 90
                                    ? 'bg-success'
                                    : r.attendancePercent >= 75
                                    ? 'bg-primary'
                                    : r.attendancePercent >= 50
                                    ? 'bg-orange-500'
                                    : 'bg-destructive',
                                )}
                                style={{ width: `${Math.min(100, r.attendancePercent)}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold tabular-nums text-foreground shrink-0 w-10 text-right">
                              {r.attendancePercent}%
                            </span>
                          </div>
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5 py-0 px-2 tracking-wide font-bold',
                              ATTENDANCE_STATUS_CONFIG[r.attendanceStatus].badgeClass,
                            )}
                          >
                            {ATTENDANCE_STATUS_CONFIG[r.attendanceStatus].label}
                          </Badge>
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/attendance/student', {
                                state: { enrollment: r, batchId: selectedBatchId, batchName: selectedBatchName },
                              });
                            }}
                          >
                            View <ChevronRight className="ml-1 h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Pagination ── */}
        {!loading && records.length > 0 && totalPages > 1 && (
          <div className="flex w-full items-center justify-center gap-2 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
