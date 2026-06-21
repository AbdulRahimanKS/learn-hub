import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { AddPaymentSheet } from '@/components/fee/AddPaymentSheet';
import { useToast } from '@/hooks/use-toast';
import {
  feeApi, formatCurrency, FEE_STATUS_CONFIG,
  type FeeStudent, type FeeStatus,
} from '@/lib/fee-api';
import type { Batch } from '@/lib/batch-api';
import {
  Users, Search, Filter, Download, Loader2, MoreVertical,
  Eye, CreditCard, Edit, UserCheck, UserX, GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 10;

export default function FeeStudents() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeeStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  const [students, setStudents] = useState<FeeStudent[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, partial: 0, pending: 0, overdue: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<FeeStudent | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const reqRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStudents = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const res = await feeApi.getStudents({
        batchId: selectedBatchId,
        status: statusFilter,
        search: debouncedSearch,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      if (ctrl.signal.aborted || id !== reqRef.current) return;
      if (res.success) {
        setStudents(res.data);
        setStats(res.stats as typeof stats);
        setTotalPages(res.totalPages ?? 1);
        setTotalCount(res.totalCount ?? 0);
      }
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      toast({ title: 'Error', description: 'Failed to load students.', variant: 'destructive' });
    } finally {
      if (id === reqRef.current && !ctrl.signal.aborted) setLoading(false);
    }
  }, [selectedBatchId, statusFilter, debouncedSearch, currentPage, toast]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(id ? Number(id) : undefined);
    setSelectedBatchName(batch.name);
    setCurrentPage(1);
  }, []);

  async function handleExport(format: 'xlsx' | 'csv') {
    setIsExporting(true);
    try {
      const res = await feeApi.getStudents({
        batchId: selectedBatchId, status: statusFilter,
        search: debouncedSearch, page: 1, pageSize: 10000,
      });
      const rows = res.data.map((s) => ({
        'Student Name': s.studentName,
        'Email': s.studentEmail,
        'Course': s.courseName,
        'Batch': s.batchName,
        'Total Fee': s.totalFee,
        'Paid Amount': s.paidAmount,
        'Balance': s.balanceAmount,
        'Status': FEE_STATUS_CONFIG[s.feeStatus].label,
        'Enrolled On': new Date(s.enrolledAt).toLocaleDateString('en-GB'),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fee Report');
      XLSX.writeFile(wb, `fee_students.${format}`);
    } catch {
      toast({ title: 'Export failed', description: 'Could not export data.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Students</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              Fee status across all enrolled students
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting} className="gap-2 shrink-0">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>Download as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>Download as CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 sm:h-11 text-sm rounded-xl"
            />
          </div>
          <BatchFilterCombobox
            value={selectedBatchId?.toString() ?? ''}
            selectedLabel={selectedBatchName}
            onValueChange={handleBatchChange}
            placeholder="All Batches"
            triggerIcon={<Filter className="h-4 w-4 text-primary" />}
            className="h-10 sm:h-11 w-full sm:w-[200px] border-primary text-primary text-xs sm:text-sm"
            defaultSelectFirst={false}
          />
          <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v as FeeStatus); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 sm:h-11 w-full sm:w-[160px] rounded-xl text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Total', value: stats.total, icon: Users, iconColor: 'text-primary', iconBg: 'bg-primary/10' },
            { label: 'Paid', value: stats.paid, icon: UserCheck, iconColor: 'text-success', iconBg: 'bg-success/10' },
            { label: 'Partial', value: stats.partial, icon: GraduationCap, iconColor: 'text-blue-500', iconBg: 'bg-blue-500/10' },
            { label: 'Pending', value: stats.pending, icon: UserX, iconColor: 'text-orange-500', iconBg: 'bg-orange-500/10' },
            { label: 'Overdue', value: stats.overdue, icon: UserX, iconColor: 'text-destructive', iconBg: 'bg-destructive/10' },
          ].map((c) => (
            <Card key={c.label} className="shadow-card">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-xl shrink-0', c.iconBg)}>
                    <c.icon className={cn('h-5 w-5', c.iconColor)} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{c.value}</p>
                    <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Table ── */}
        <Card className="shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center">
                <Users className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-sm font-medium text-foreground">No students found</p>
              <p className="text-xs">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="table-fixed">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[22%] py-4">Student</TableHead>
                      <TableHead className="w-[15%]">Course</TableHead>
                      <TableHead className="w-[12%]">Batch</TableHead>
                      <TableHead className="w-[12%]">Total Fee</TableHead>
                      <TableHead className="w-[11%]">Paid</TableHead>
                      <TableHead className="w-[11%]">Balance</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[7%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const cfg = FEE_STATUS_CONFIG[s.feeStatus];
                      return (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => navigate(`/fees/students/${s.id}`)}
                        >
                          <TableCell className="min-w-0">
                            <div className="flex items-center gap-3 py-1 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden">
                                {s.profilePicture ? (
                                  <img src={s.profilePicture} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-sm font-bold text-primary">{s.studentName.charAt(0)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-foreground text-sm truncate">{s.studentName}</p>
                                <p className="text-xs text-muted-foreground truncate">{s.studentEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-foreground truncate">{s.courseName}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-foreground">{s.batchName}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(s.totalFee)}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-semibold tabular-nums text-success">{formatCurrency(s.paidAmount)}</p>
                          </TableCell>
                          <TableCell>
                            <p className={cn('text-sm font-semibold tabular-nums', s.balanceAmount > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                              {formatCurrency(s.balanceAmount)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] h-5 py-0 px-2 font-bold', cfg.badgeClass)}>
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/fees/students/${s.id}`); }}>
                                  <Eye className="h-4 w-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                {s.balanceAmount > 0 && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPaymentTarget(s); }}>
                                    <CreditCard className="h-4 w-4 mr-2" /> Add Payment
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit Fee Structure
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                  <p className="text-xs text-muted-foreground">
                    {totalCount} student{totalCount !== 1 ? 's' : ''} · Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Add Payment Sheet */}
        <AddPaymentSheet
          open={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          student={paymentTarget}
          onSuccess={fetchStudents}
        />
      </div>
    </DashboardLayout>
  );
}
