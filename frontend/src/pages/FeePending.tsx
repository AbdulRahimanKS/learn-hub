import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { AddPaymentSheet } from '@/components/fee/AddPaymentSheet';
import { useToast } from '@/hooks/use-toast';
import {
  feeApi, formatCurrency, FEE_STATUS_CONFIG, PENDING_STATUS_CONFIG,
  type PendingFee, type FeeStudent, type PendingStatus,
} from '@/lib/fee-api';
import type { Batch } from '@/lib/batch-api';
import {
  AlertTriangle, Filter, Loader2, Clock, CalendarRange,
  CreditCard, Eye, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FeePending() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<PendingStatus | ''>('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');

  const [pendingList, setPendingList] = useState<PendingFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentTarget, setPaymentTarget] = useState<FeeStudent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feeApi.getPendingFees({
        batchId: selectedBatchId,
        pendingStatus: statusFilter,
        dueDateFrom,
        dueDateTo,
      });
      if (res.success) setPendingList(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load pending fees.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, statusFilter, dueDateFrom, dueDateTo, toast]);

  useEffect(() => { load(); }, [load]);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(id ? Number(id) : undefined);
    setSelectedBatchName(batch.name);
  }, []);

  async function openPayment(pf: PendingFee) {
    try {
      const res = await feeApi.getStudentById(pf.feeStudentId);
      if (res.success) setPaymentTarget(res.data.student);
    } catch {
      toast({ title: 'Error', description: 'Could not load student details.', variant: 'destructive' });
    }
  }

  const overdueCount = pendingList.filter((p) => p.pendingStatus === 'overdue').length;
  const dueTodayCount = pendingList.filter((p) => p.pendingStatus === 'due_today').length;
  const dueSoonCount = pendingList.filter((p) => p.pendingStatus === 'due_soon').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Pending Fees</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Outstanding installments requiring attention
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3">
          <BatchFilterCombobox
            value={selectedBatchId?.toString() ?? ''}
            selectedLabel={selectedBatchName}
            onValueChange={handleBatchChange}
            placeholder="All Batches"
            triggerIcon={<Filter className="h-4 w-4 text-primary" />}
            className="h-10 border-primary text-primary text-xs"
            defaultSelectFirst={false}
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PendingStatus | '')}>
            <SelectTrigger className="h-10 w-[160px] rounded-xl text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="due_soon">Due Soon</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} className="h-10 w-[140px] rounded-xl text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} className="h-10 w-[140px] rounded-xl text-xs" />
          </div>
          {(selectedBatchId || statusFilter || dueDateFrom || dueDateTo) && (
            <Button variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground" onClick={() => {
              setSelectedBatchId(undefined); setSelectedBatchName('');
              setStatusFilter(''); setDueDateFrom(''); setDueDateTo('');
            }}>
              Clear filters
            </Button>
          )}
        </div>

        {/* ── Summary mini-cards ── */}
        {!loading && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
            <Card className={cn('shadow-card', overdueCount > 0 && 'border-destructive/30')}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-destructive/10 shrink-0">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums text-foreground">{overdueCount}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={cn('shadow-card', dueTodayCount > 0 && 'border-amber-500/30')}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 shrink-0">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums text-foreground">{dueTodayCount}</p>
                    <p className="text-xs text-muted-foreground">Due Today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500/10 shrink-0">
                    <Users className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums text-foreground">{dueSoonCount}</p>
                    <p className="text-xs text-muted-foreground">Due Soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Alert banner for overdue ── */}
        {!loading && overdueCount > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {overdueCount} installment{overdueCount !== 1 ? 's' : ''} overdue
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                These payments have passed their due dates. Contact students to collect outstanding amounts.
              </p>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <Card className="shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pendingList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center">
                <Clock className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-sm font-medium text-foreground">No pending fees</p>
              <p className="text-xs">All installments are up to date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[22%] py-4">Student</TableHead>
                    <TableHead className="w-[15%]">Course</TableHead>
                    <TableHead className="w-[10%]">Batch</TableHead>
                    <TableHead className="w-[13%]">Pending Amount</TableHead>
                    <TableHead className="w-[12%]">Due Date</TableHead>
                    <TableHead className="w-[11%]">Days Overdue</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[7%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingList.map((pf) => {
                    const cfg = PENDING_STATUS_CONFIG[pf.pendingStatus];
                    return (
                      <TableRow key={pf.id} className={cn('transition-colors hover:bg-muted/30', cfg.rowClass)}>
                        <TableCell className="min-w-0">
                          <div className="flex items-center gap-3 py-1 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                              <span className="text-sm font-bold text-primary">{pf.studentName.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground text-sm truncate">{pf.studentName}</p>
                              <p className="text-xs text-muted-foreground truncate">{pf.studentEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground truncate">{pf.courseName}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{pf.batchName}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-bold tabular-nums text-destructive">{formatCurrency(pf.pendingAmount)}</p>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {new Date(pf.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          {pf.daysOverdue > 0 ? (
                            <p className="text-sm font-bold text-destructive tabular-nums">{pf.daysOverdue}d</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px] h-5 py-0 px-2 font-bold', cfg.badgeClass)}>
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Record Payment"
                              onClick={() => openPayment(pf)}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="View Fee Profile"
                              onClick={() => navigate(`/fees/students/${pf.feeStudentId}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <AddPaymentSheet
          open={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          student={paymentTarget}
          onSuccess={load}
        />
      </div>
    </DashboardLayout>
  );
}
