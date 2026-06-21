import { useState, useCallback, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { useToast } from '@/hooks/use-toast';
import {
  feeApi, formatCurrency, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_CONFIG,
  type FeePayment, type PaymentMethod, type PaymentStatus,
} from '@/lib/fee-api';
import type { Batch } from '@/lib/batch-api';
import {
  Search, Filter, Download, Loader2, Receipt, CalendarRange, Eye, MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 10;

export default function FeePayments() {
  const { toast } = useToast();

  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPayments = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const res = await feeApi.getPayments({
        batchId: selectedBatchId,
        studentName: debouncedSearch,
        method: methodFilter,
        status: statusFilter,
        dateFrom, dateTo,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      if (ctrl.signal.aborted || id !== reqRef.current) return;
      if (res.success) {
        setPayments(res.data);
        setTotalPages(res.totalPages ?? 1);
        setTotalCount(res.totalCount ?? 0);
      }
    } catch (err: any) {
      if (err?.name === 'CanceledError') return;
      toast({ title: 'Error', description: 'Failed to load payments.', variant: 'destructive' });
    } finally {
      if (id === reqRef.current && !ctrl.signal.aborted) setLoading(false);
    }
  }, [selectedBatchId, debouncedSearch, methodFilter, statusFilter, dateFrom, dateTo, currentPage, toast]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(id ? Number(id) : undefined);
    setSelectedBatchName(batch.name);
    setCurrentPage(1);
  }, []);

  async function handleExport(format: 'xlsx' | 'csv') {
    setIsExporting(true);
    try {
      const res = await feeApi.getPayments({
        batchId: selectedBatchId, studentName: debouncedSearch,
        method: methodFilter, status: statusFilter,
        dateFrom, dateTo, page: 1, pageSize: 10000,
      });
      const rows = res.data.map((p) => ({
        'Student': p.studentName,
        'Email': p.studentEmail,
        'Batch': p.batchName,
        'Course': p.courseName,
        'Amount': p.amount,
        'Payment Date': new Date(p.paymentDate).toLocaleDateString('en-GB'),
        'Method': PAYMENT_METHOD_LABELS[p.method],
        'Reference': p.referenceNumber,
        'Status': PAYMENT_STATUS_CONFIG[p.status].label,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payments');
      XLSX.writeFile(wb, `fee_payments.${format}`);
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
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Payments</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">All recorded payment transactions</p>
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 sm:h-11 rounded-xl"
              />
            </div>
            <BatchFilterCombobox
              value={selectedBatchId?.toString() ?? ''}
              selectedLabel={selectedBatchName}
              onValueChange={handleBatchChange}
              placeholder="All Batches"
              triggerIcon={<Filter className="h-4 w-4 text-primary" />}
              className="h-10 sm:h-11 border-primary text-primary text-xs sm:text-sm"
              defaultSelectFirst={false}
            />
            <Select value={methodFilter || 'all'} onValueChange={(v) => { setMethodFilter(v === 'all' ? '' : v as PaymentMethod); setCurrentPage(1); }}>
              <SelectTrigger className="h-10 sm:h-11 w-[160px] rounded-xl text-sm">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v as PaymentStatus); setCurrentPage(1); }}>
              <SelectTrigger className="h-10 sm:h-11 w-[160px] rounded-xl text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending_verification">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="h-10 w-[140px] rounded-xl text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="h-10 w-[140px] rounded-xl text-xs" />
            {(selectedBatchId || methodFilter || statusFilter || dateFrom || dateTo || debouncedSearch) && (
              <Button variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground" onClick={() => {
                setSelectedBatchId(undefined); setSelectedBatchName(''); setSearch('');
                setMethodFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setCurrentPage(1);
              }}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <Card className="shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center">
                <Receipt className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-sm font-medium text-foreground">No payments found</p>
              <p className="text-xs">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="table-fixed">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[22%] py-4">Student</TableHead>
                      <TableHead className="w-[14%]">Course / Batch</TableHead>
                      <TableHead className="w-[12%]">Amount</TableHead>
                      <TableHead className="w-[12%]">Payment Date</TableHead>
                      <TableHead className="w-[12%]">Method</TableHead>
                      <TableHead className="w-[16%]">Reference</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[2%] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const pCfg = PAYMENT_STATUS_CONFIG[p.status];
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="min-w-0">
                            <div className="flex items-center gap-3 py-1 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                <span className="text-sm font-bold text-primary">{p.studentName.charAt(0)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-foreground text-sm truncate">{p.studentName}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.studentEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-medium text-foreground truncate">{p.courseName}</p>
                            <p className="text-xs text-muted-foreground">{p.batchName}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-bold tabular-nums text-success">{formatCurrency(p.amount)}</p>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {new Date(p.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                          <TableCell>
                            <p className="text-xs font-mono text-muted-foreground truncate">{p.referenceNumber}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] h-5 py-0 px-2 font-bold', pCfg.badgeClass)}>
                              {pCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" /> View
                                </DropdownMenuItem>
                                {p.attachmentUrl && (
                                  <DropdownMenuItem>
                                    <Download className="h-4 w-4 mr-2" /> Download Attachment
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                  <p className="text-xs text-muted-foreground">
                    {totalCount} payment{totalCount !== 1 ? 's' : ''} · Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
