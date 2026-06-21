import { useState, useRef } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  feeApi, formatCurrency, FEE_STATUS_CONFIG,
  type FeeStudent, type PaymentMethod, type AddPaymentData,
} from '@/lib/fee-api';
import {
  CreditCard, Upload, X, CheckCircle, Loader2, Receipt, User,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  student: FeeStudent | null;
  onSuccess?: () => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Card' },
  { value: 'other',         label: 'Other' },
];

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_MB = 5;

export function AddPaymentSheet({ open, onClose, student, onSuccess }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setMethod('');
    setReference('');
    setNotes('');
    setAttachedFile(null);
    setErrors({});
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount greater than 0';
    else if (student && amt > student.balanceAmount) errs.amount = `Amount exceeds balance (${formatCurrency(student.balanceAmount)})`;
    if (!paymentDate) errs.paymentDate = 'Payment date is required';
    else if (paymentDate > new Date().toISOString().split('T')[0]) errs.paymentDate = 'Date cannot be in the future';
    if (!method) errs.method = 'Select a payment method';
    if (method !== 'cash' && !reference.trim()) errs.reference = 'Reference / transaction ID is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only PDF, JPG, JPEG, PNG allowed.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: 'File too large', description: `Maximum file size is ${MAX_FILE_MB} MB.`, variant: 'destructive' });
      return;
    }
    setAttachedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !validate()) return;
    setSubmitting(true);
    try {
      const data: AddPaymentData = {
        feeStudentId: student.id,
        amount: parseFloat(amount),
        paymentDate,
        method: method as PaymentMethod,
        referenceNumber: reference.trim(),
        notes: notes.trim() || undefined,
        attachmentFile: attachedFile ?? undefined,
      };
      await feeApi.addPayment(data);
      toast({ title: 'Payment recorded', description: `${formatCurrency(parseFloat(amount))} recorded for ${student.studentName}.` });
      onSuccess?.();
      handleClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to record payment. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const cfg = student ? FEE_STATUS_CONFIG[student.feeStatus] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-full sm:max-w-[520px] overflow-y-auto border-l border-border p-0',
          '[&>button]:right-4 [&>button]:top-4 [&>button]:z-10',
          '[&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full',
          '[&>button]:border-0 [&>button]:bg-transparent [&>button]:shadow-none',
          '[&>button]:text-primary-foreground [&>button]:opacity-85',
          '[&>button]:transition-none [&>button]:hover:bg-transparent [&>button]:hover:opacity-85',
        )}
      >
        {/* Gradient header */}
        <div className="relative overflow-hidden gradient-primary text-primary-foreground shadow-card border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <SheetHeader className="relative space-y-0 p-6 pb-5 pr-14 pt-5 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold text-primary-foreground">Add Payment</SheetTitle>
                <SheetDescription className="text-primary-foreground/70 text-xs mt-0.5">
                  Record a new payment entry
                </SheetDescription>
              </div>
            </div>
            {student && (
              <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{student.studentName}</p>
                  <p className="text-xs text-primary-foreground/70 truncate">{student.studentEmail}</p>
                </div>
                {cfg && (
                  <Badge variant="outline" className="shrink-0 bg-white/10 text-primary-foreground border-white/20 text-[10px]">
                    {cfg.label}
                  </Badge>
                )}
              </div>
            )}
          </SheetHeader>
        </div>

        {/* Balance summary */}
        {student && (
          <div className="flex items-center gap-4 px-6 py-4 bg-muted/30 border-b border-border/60">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total Fee</p>
              <p className="font-bold text-foreground tabular-nums">{formatCurrency(student.totalFee)}</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="font-bold text-success tabular-nums">{formatCurrency(student.paidAmount)}</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-destructive tabular-nums">{formatCurrency(student.balanceAmount)}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₹</span>
              <Input
                id="pay-amount"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })); }}
                className={cn('pl-7 h-11 rounded-xl', errors.amount && 'border-destructive focus-visible:ring-destructive')}
              />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">
              Payment Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-date"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={paymentDate}
              onChange={(e) => { setPaymentDate(e.target.value); setErrors((p) => ({ ...p, paymentDate: '' })); }}
              className={cn('h-11 rounded-xl', errors.paymentDate && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label>
              Payment Method <span className="text-destructive">*</span>
            </Label>
            <Select
              value={method}
              onValueChange={(v) => { setMethod(v as PaymentMethod); setErrors((p) => ({ ...p, method: '' })); }}
            >
              <SelectTrigger className={cn('h-11 rounded-xl', errors.method && 'border-destructive')}>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.method && <p className="text-xs text-destructive">{errors.method}</p>}
          </div>

          {/* Reference / Transaction ID */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">
              Reference / Transaction ID{' '}
              {method !== 'cash' && <span className="text-destructive">*</span>}
              {method === 'cash' && <span className="text-muted-foreground text-xs">(optional for cash)</span>}
            </Label>
            <Input
              id="pay-ref"
              placeholder={
                method === 'upi' ? 'UPI transaction ID' :
                method === 'bank_transfer' ? 'NEFT / IMPS reference' :
                method === 'card' ? 'Card transaction ID' :
                'Reference number'
              }
              value={reference}
              onChange={(e) => { setReference(e.target.value); setErrors((p) => ({ ...p, reference: '' })); }}
              className={cn('h-11 rounded-xl', errors.reference && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.reference && <p className="text-xs text-destructive">{errors.reference}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="pay-notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl resize-none min-h-[80px]"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-1.5">
            <Label>Payment Proof <span className="text-muted-foreground text-xs">(optional — PDF, JPG, PNG · max {MAX_FILE_MB} MB)</span></Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            {attachedFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-3">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                <p className="flex-1 min-w-0 text-sm text-foreground font-medium truncate">{attachedFile.name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => { setAttachedFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 p-4 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Click to upload proof</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG up to {MAX_FILE_MB} MB</p>
                </div>
              </button>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 rounded-xl"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 rounded-xl gap-2"
              disabled={submitting || !student}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</>
              ) : (
                <><CreditCard className="h-4 w-4" /> Record Payment</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
