import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AddPaymentSheet } from '@/components/fee/AddPaymentSheet';
import { useToast } from '@/hooks/use-toast';
import {
  feeApi, formatCurrency, FEE_STATUS_CONFIG, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_CONFIG,
  type FeeStudent, type FeePayment,
} from '@/lib/fee-api';
import {
  ArrowLeft, CreditCard, Loader2, Wallet, CheckCircle2, Clock, Calendar,
  GraduationCap, Mail, Receipt, BookOpen, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function FeeInstallmentStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'paid'    ? 'bg-success/10 text-success border-success/30' :
    status === 'overdue' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                           'bg-orange-500/10 text-orange-500 border-orange-500/30';
  return (
    <Badge variant="outline" className={cn('text-[10px] h-5 py-0 px-2 font-bold capitalize', cls)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function FeeStudentDetail() {
  const navigate = useNavigate();
  const { feeStudentId: feeStudentIdParam } = useParams<{ feeStudentId: string }>();
  const { toast } = useToast();

  const feeStudentId = feeStudentIdParam ? Number(feeStudentIdParam) : undefined;

  const [student, setStudent] = useState<FeeStudent | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await feeApi.getStudentById(id);
      if (res.success) {
        setStudent(res.data.student);
        setPayments(res.data.payments);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load student fee details.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (feeStudentId) load(feeStudentId);
    else setLoading(false);
  }, [feeStudentId, load]);

  if (!feeStudentId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-base font-medium text-foreground">No student selected</p>
          <Button variant="outline" onClick={() => navigate('/fees/students')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Students
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-base font-medium text-foreground">Student not found</p>
          <Button variant="outline" onClick={() => navigate('/fees/students')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Students
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const cfg = FEE_STATUS_CONFIG[student.feeStatus];
  const paidPct = student.totalFee > 0 ? Math.round((student.paidAmount / student.totalFee) * 100) : 0;
  const paidCount = student.installments.filter((i) => i.status === 'paid').length;
  const totalInstallments = student.installments.length;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Back + Actions ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/fees/students')} className="gap-2 self-start text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Students
          </Button>
          {student.balanceAmount > 0 && (
            <Button className="gap-2 shrink-0" onClick={() => setAddPaymentOpen(true)}>
              <CreditCard className="h-4 w-4" /> Add Payment
            </Button>
          )}
        </div>

        {/* ── Hero gradient card ── */}
        <Card className="relative overflow-hidden rounded-2xl border border-primary/20 bg-transparent shadow-card gradient-primary text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <CardContent className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 text-2xl font-black">
                {student.studentName.charAt(0)}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-2 mb-2">
                  <h2 className="text-xl font-bold">{student.studentName}</h2>
                  <Badge variant="outline" className="bg-white/10 text-primary-foreground border-white/20 text-[10px] h-5">
                    {cfg.label}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-primary-foreground/80">
                    <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{student.studentEmail}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-primary-foreground/80">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{student.courseName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-primary-foreground/80">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" /><span>{student.batchName}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-primary-foreground/70">Payment progress</p>
                    <p className="text-sm font-bold tabular-nums">{paidPct}% paid</p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Summary mini-cards ── */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: 'Total Fee', value: formatCurrency(student.totalFee), icon: Wallet, iconColor: 'text-primary', iconBg: 'bg-primary/10' },
            { label: 'Amount Paid', value: formatCurrency(student.paidAmount), icon: CheckCircle2, iconColor: 'text-success', iconBg: 'bg-success/10' },
            { label: 'Pending Amount', value: formatCurrency(student.balanceAmount), icon: Clock, iconColor: student.balanceAmount > 0 ? 'text-destructive' : 'text-muted-foreground', iconBg: student.balanceAmount > 0 ? 'bg-destructive/10' : 'bg-muted/40' },
            { label: 'Installments', value: `${paidCount} / ${totalInstallments}`, icon: Layers, iconColor: 'text-blue-500', iconBg: 'bg-blue-500/10' },
          ].map((c) => (
            <Card key={c.label} className="shadow-card">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-xl shrink-0', c.iconBg)}>
                    <c.icon className={cn('h-5 w-5', c.iconColor)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground tabular-nums truncate">{c.value}</p>
                    <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Installments ── */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" /> Installment Schedule
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-3">#</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.installments.map((inst) => (
                  <TableRow key={inst.id} className={cn(inst.status === 'overdue' && 'bg-destructive/5')}>
                    <TableCell className="font-semibold text-foreground">#{inst.installmentNumber}</TableCell>
                    <TableCell className="text-sm text-foreground">
                      {new Date(inst.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums text-foreground">{formatCurrency(inst.amount)}</TableCell>
                    <TableCell><FeeInstallmentStatusBadge status={inst.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inst.paidDate
                        ? new Date(inst.paidDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* ── Payment History ── */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Payment History
            </CardTitle>
          </CardHeader>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Receipt className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium text-foreground">No payments recorded yet</p>
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
                        <TableCell className="text-sm font-mono text-muted-foreground">{p.referenceNumber}</TableCell>
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

        {/* Add Payment Sheet */}
        <AddPaymentSheet
          open={addPaymentOpen}
          onClose={() => setAddPaymentOpen(false)}
          student={student}
          onSuccess={() => feeStudentId && load(feeStudentId)}
        />
      </div>
    </DashboardLayout>
  );
}
