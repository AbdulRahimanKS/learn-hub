import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { useToast } from '@/hooks/use-toast';
import {
  feeApi, formatCurrency, FEE_STATUS_CONFIG, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_CONFIG,
  type FeeStudent, type FeePayment,
} from '@/lib/fee-api';
import type { Batch } from '@/lib/batch-api';
import {
  Wallet, CheckCircle2, Clock, Loader2, BookOpen, Calendar,
  Receipt, Filter, Layers, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function InstallmentRow({ inst }: { inst: FeeStudent['installments'][number] }) {
  const isPaid = inst.status === 'paid';
  const isOverdue = inst.status === 'overdue';

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border p-4 transition-colors',
        isPaid    ? 'bg-success/5 border-success/20' :
        isOverdue ? 'bg-destructive/5 border-destructive/20' :
                    'bg-muted/40 border-border/60',
      )}
    >
      {/* Number badge */}
      <div
        className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black',
          isPaid    ? 'bg-success/10 text-success' :
          isOverdue ? 'bg-destructive/10 text-destructive' :
                      'bg-primary/10 text-primary',
        )}
      >
        {isPaid ? <CheckCircle2 className="h-5 w-5" /> : <span>#{inst.installmentNumber}</span>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">Installment {inst.installmentNumber}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Due: {new Date(inst.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {inst.paidDate && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <p className="text-xs text-success">
                Paid: {new Date(inst.paidDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Amount + status */}
      <div className="text-right shrink-0">
        <p className="font-bold tabular-nums text-foreground">{formatCurrency(inst.amount)}</p>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] h-5 py-0 px-2 font-bold mt-1',
            isPaid    ? 'bg-success/10 text-success border-success/30' :
            isOverdue ? 'bg-destructive/10 text-destructive border-destructive/30' :
                        'bg-orange-500/10 text-orange-500 border-orange-500/30',
          )}
        >
          {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
        </Badge>
      </div>
    </div>
  );
}

export default function MyFees() {
  const { toast } = useToast();

  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [student, setStudent] = useState<FeeStudent | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(id ? Number(id) : undefined);
    setSelectedBatchName(batch.name);
  }, []);

  const load = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await feeApi.getMyFees(selectedBatchId);
      if (res.success) {
        setStudent(res.data.feeStudent);
        setPayments(res.data.payments);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load your fee details.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, toast]);

  useEffect(() => { if (selectedBatchId) load(); }, [selectedBatchId, load]);

  const cfg = student ? FEE_STATUS_CONFIG[student.feeStatus] : null;
  const paidPct = student && student.totalFee > 0 ? Math.round((student.paidAmount / student.totalFee) * 100) : 0;
  const overdueInstallments = student?.installments.filter((i) => i.status === 'overdue') ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">My Fees</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              View your fee structure, installments, and payment history
            </p>
          </div>
          <div className="w-full sm:w-[min(280px,100%)] shrink-0">
            <BatchFilterCombobox
              value={selectedBatchId?.toString() ?? ''}
              selectedLabel={selectedBatchName}
              onValueChange={handleBatchChange}
              onReady={() => setLoading(false)}
              placeholder="Select batch"
              triggerIcon={<BookOpen className="h-4 w-4 text-primary" />}
              className="h-10 sm:h-11 border-primary text-primary text-xs sm:text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !selectedBatchId ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
              <Wallet className="h-8 w-8 opacity-40 text-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">Select a batch to view your fees</p>
            <p className="text-sm mt-1">Use the selector above to choose a batch</p>
          </div>
        ) : !student ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-base font-medium text-foreground">No fee data found for this batch</p>
          </div>
        ) : (
          <>
            {/* ── Overdue alert ── */}
            {overdueInstallments.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    You have {overdueInstallments.length} overdue installment{overdueInstallments.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Please clear overdue amounts as soon as possible to avoid further penalties.
                  </p>
                </div>
              </div>
            )}

            {/* ── Gradient summary card ── */}
            <Card className="relative overflow-hidden rounded-2xl border border-primary/20 bg-transparent shadow-card gradient-primary text-primary-foreground">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
              </div>
              <CardContent className="relative z-10 p-5 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <p className="font-semibold text-primary-foreground/80 text-sm">{student.courseName} · {student.batchName}</p>
                  {cfg && (
                    <Badge variant="outline" className="bg-white/10 text-primary-foreground border-white/20 text-[10px] h-5">
                      {cfg.label}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  {/* Total fee */}
                  <div className="sm:border-r sm:border-white/20 sm:pr-6">
                    <p className="text-xs sm:text-sm font-semibold text-primary-foreground/80">Total Fee</p>
                    <p className="font-display text-2xl sm:text-4xl font-black tabular-nums mt-1">
                      {formatCurrency(student.totalFee)}
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-primary-foreground/70">{paidPct}% paid</p>
                  </div>
                  {/* Paid */}
                  <div className="sm:border-r sm:border-white/20 sm:pr-6">
                    <p className="text-xs sm:text-sm font-semibold text-primary-foreground/80">Amount Paid</p>
                    <p className="font-display text-2xl sm:text-4xl font-black tabular-nums mt-1 text-emerald-300">
                      {formatCurrency(student.paidAmount)}
                    </p>
                  </div>
                  {/* Pending */}
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-primary-foreground/80">Pending Amount</p>
                    <p className={cn('font-display text-2xl sm:text-4xl font-black tabular-nums mt-1', student.balanceAmount > 0 ? 'text-red-300' : 'text-emerald-300')}>
                      {formatCurrency(student.balanceAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Installment timeline ── */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-primary" /> Installment Schedule
                </CardTitle>
                <CardDescription>Your payment installments and their current status</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {student.installments.map((inst) => (
                  <InstallmentRow key={inst.id} inst={inst} />
                ))}
              </CardContent>
            </Card>

            {/* ── Payment history ── */}
            <Card className="shadow-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4 text-primary" /> Payment History
                </CardTitle>
                <CardDescription>All payments you have made</CardDescription>
              </CardHeader>
              {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Receipt className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium text-foreground">No payments made yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="py-3">Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => {
                        const pCfg = PAYMENT_STATUS_CONFIG[p.status];
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm text-foreground">
                              {new Date(p.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell className="font-bold tabular-nums text-success">{formatCurrency(p.amount)}</TableCell>
                            <TableCell className="text-sm text-foreground">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{p.referenceNumber}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px] h-5 py-0 px-2 font-bold', pCfg.badgeClass)}>
                                {pCfg.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
