// Fee Management API — types, status configs, and real API client.

import { apiClient } from './api';

export type FeeStatus = 'paid' | 'partial' | 'pending' | 'overdue';
export type PaymentMethod = 'upi' | 'bank_transfer' | 'cash' | 'card' | 'cheque' | 'other';
export type PaymentStatus = 'verified' | 'pending_verification' | 'rejected';
export type PendingStatus = 'due_soon' | 'due_today' | 'overdue';

// ── Status configs ────────────────────────────────────────────────────────────

export const FEE_STATUS_CONFIG: Record<FeeStatus, { label: string; badgeClass: string; chartColor: string }> = {
  paid:    { label: 'Paid',    badgeClass: 'bg-success/10 text-success border-success/30',              chartColor: '#10b981' },
  partial: { label: 'Partial', badgeClass: 'bg-primary/10 text-primary border-primary/30',              chartColor: '#3b82f6' },
  pending: { label: 'Pending', badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30',     chartColor: '#f97316' },
  overdue: { label: 'Overdue', badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',  chartColor: '#ef4444' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: 'UPI', bank_transfer: 'Bank Transfer', cash: 'Cash', card: 'Card', cheque: 'Cheque', other: 'Other',
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; badgeClass: string }> = {
  verified:             { label: 'Verified', badgeClass: 'bg-success/10 text-success border-success/30' },
  pending_verification: { label: 'Pending',  badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
  rejected:             { label: 'Rejected', badgeClass: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export const PENDING_STATUS_CONFIG: Record<PendingStatus, { label: string; badgeClass: string; rowClass: string }> = {
  due_soon:  { label: 'Due Soon',  badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30',    rowClass: '' },
  due_today: { label: 'Due Today', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',       rowClass: 'bg-amber-500/5' },
  overdue:   { label: 'Overdue',   badgeClass: 'bg-destructive/10 text-destructive border-destructive/30', rowClass: 'bg-destructive/5' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeeInstallment {
  id: number;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: FeeStatus;
  paidDate?: string;
  paymentId?: number;
}

export interface FeeStudent {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  profilePicture?: string;
  courseName: string;
  batchName: string;
  batchId: number;
  courseId: number;
  totalFee: number;
  paidAmount: number;
  balanceAmount: number;
  feeStatus: FeeStatus;
  enrolledAt: string;
  installments: FeeInstallment[];
}

export interface FeePayment {
  id: number;
  feeStudentId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  profilePicture?: string;
  batchName: string;
  batchId: number;
  courseName: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber: string;
  status: PaymentStatus;
  notes?: string;
  attachmentUrl?: string;
}

export interface PendingFee {
  id: number;
  feeStudentId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  profilePicture?: string;
  courseName: string;
  batchName: string;
  batchId: number;
  pendingAmount: number;
  dueDate: string;
  daysOverdue: number;
  pendingStatus: PendingStatus;
}

export interface FeeDashboardStats {
  totalStudents: number;
  totalFees: number;
  amountCollected: number;
  pendingAmount: number;
  overdueStudents: number;
  collectionRate: number;
}

export interface MonthlyCollectionPoint {
  month: string;
  collected: number;
  pending: number;
}

export interface RecentPayment {
  id: number;
  studentName: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
}

export interface AddPaymentData {
  feeStudentId: number;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber: string;
  notes?: string;
  attachmentFile?: File;
}

export interface MyFeeData {
  feeStudent: FeeStudent;
  payments: FeePayment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getPendingStatus(dueDate: string): PendingStatus {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due_today';
  return 'due_soon';
}

export function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

// ── Response mappers (snake_case API → camelCase TS) ──────────────────────────

function mapInstallment(raw: any): FeeInstallment {
  return {
    id:                 raw.id,
    installmentNumber:  raw.installment_number,
    dueDate:            raw.due_date,
    amount:             Number(raw.amount),
    status:             (raw.effective_status ?? raw.status) as FeeStatus,
    paidDate:           raw.paid_date ?? undefined,
  };
}

function mapFeeStudent(raw: any): FeeStudent {
  return {
    id:             raw.id,
    studentId:      raw.student_id,
    studentName:    raw.student_name,
    studentEmail:   raw.student_email,
    profilePicture: raw.profile_picture ?? undefined,
    courseName:     raw.course_name,
    batchName:      raw.batch_name,
    batchId:        raw.batch_id,
    courseId:       raw.course_id,
    totalFee:       Number(raw.total_fee),
    paidAmount:     Number(raw.paid_amount),
    balanceAmount:  Number(raw.balance_amount),
    feeStatus:      raw.fee_status as FeeStatus,
    enrolledAt:     raw.enrolled_at,
    installments:   (raw.installments ?? []).map(mapInstallment),
  };
}

function mapPayment(raw: any): FeePayment {
  return {
    id:              raw.id,
    feeStudentId:    raw.fee_student_id,
    studentId:       raw.student_id,
    studentName:     raw.student_name,
    studentEmail:    raw.student_email,
    batchName:       raw.batch_name,
    batchId:         raw.batch_id,
    courseName:      raw.course_name,
    amount:          Number(raw.amount),
    paymentDate:     raw.payment_date,
    method:          raw.method as PaymentMethod,
    referenceNumber: raw.reference_number ?? '',
    status:          raw.status as PaymentStatus,
    notes:           raw.notes ?? '',
    attachmentUrl:   raw.attachment_url ?? undefined,
  };
}

function mapPendingFee(raw: any): PendingFee {
  return {
    id:            raw.id,
    feeStudentId:  raw.fee_student_id,
    studentId:     raw.student_id,
    studentName:   raw.student_name,
    studentEmail:  raw.student_email,
    courseName:    raw.course_name,
    batchName:     raw.batch_name,
    batchId:       raw.batch_id,
    pendingAmount: Number(raw.pending_amount),
    dueDate:       raw.due_date,
    daysOverdue:   raw.days_overdue,
    pendingStatus: raw.pending_status as PendingStatus,
  };
}

// ── API client ────────────────────────────────────────────────────────────────

const BASE = '/api/fees/v1';

export const feeApi = {
  getDashboardStats: async (filters?: { batchId?: number; courseId?: number }) => {
    const params: Record<string, string> = {};
    if (filters?.batchId)  params.batch_id  = String(filters.batchId);
    if (filters?.courseId) params.course_id = String(filters.courseId);

    const res = await apiClient.get(`${BASE}/dashboard/`, { params });
    const d = res.data.data;

    const stats: FeeDashboardStats = {
      totalStudents:   d.stats.total_students,
      totalFees:       d.stats.total_fees,
      amountCollected: d.stats.amount_collected,
      pendingAmount:   d.stats.pending_amount,
      overdueStudents: d.stats.overdue_students,
      collectionRate:  d.stats.collection_rate,
    };

    const monthly: MonthlyCollectionPoint[] = (d.monthly ?? []).map((m: any) => ({
      month:     m.month,
      collected: m.collected,
      pending:   m.pending,
    }));

    const distribution = (d.distribution ?? []).map((item: any) => ({
      name:  item.status.charAt(0).toUpperCase() + item.status.slice(1),
      value: item.count,
      color: FEE_STATUS_CONFIG[item.status as FeeStatus]?.chartColor ?? '#888',
    }));

    const recentPayments: RecentPayment[] = (d.recent_payments ?? []).map((p: any) => ({
      id:          p.id,
      studentName: p.student_name,
      amount:      p.amount,
      method:      p.method as PaymentMethod,
      paymentDate: p.payment_date,
    }));

    return {
      data: { stats, monthly, distribution, recentPayments },
      success: true,
      message: res.data.message,
    };
  },

  getStudents: async (params?: {
    batchId?: number; courseId?: number; status?: FeeStatus | ''; search?: string;
    page?: number; pageSize?: number;
  }) => {
    const qp: Record<string, string> = {};
    if (params?.batchId)  qp.batch_id   = String(params.batchId);
    if (params?.courseId) qp.course_id  = String(params.courseId);
    if (params?.status)   qp.status     = params.status;
    if (params?.search)   qp.search     = params.search;
    if (params?.page)     qp.page       = String(params.page);
    if (params?.pageSize) qp.page_size  = String(params.pageSize);

    const res = await apiClient.get(`${BASE}/students/`, { params: qp });
    const d = res.data;

    return {
      data:        (d.data ?? []).map(mapFeeStudent),
      totalCount:  d.total_count ?? 0,
      totalPages:  d.total_pages ?? 1,
      currentPage: d.current_page ?? 1,
      stats:       d.stats ?? { total: 0, paid: 0, partial: 0, pending: 0, overdue: 0 },
      success:     d.success,
      message:     d.message,
    };
  },

  getStudentById: async (id: number) => {
    const res = await apiClient.get(`${BASE}/students/${id}/`);
    const d = res.data.data;
    return {
      data: {
        student:  mapFeeStudent(d.student),
        payments: (d.payments ?? []).map(mapPayment),
      },
      success: res.data.success,
      message: res.data.message,
    };
  },

  getPayments: async (params?: {
    batchId?: number; courseId?: number; studentName?: string;
    method?: PaymentMethod | ''; status?: PaymentStatus | '';
    dateFrom?: string; dateTo?: string;
    page?: number; pageSize?: number;
  }) => {
    const qp: Record<string, string> = {};
    if (params?.batchId)     qp.batch_id   = String(params.batchId);
    if (params?.courseId)    qp.course_id  = String(params.courseId);
    if (params?.studentName) qp.search     = params.studentName;
    if (params?.method)      qp.method     = params.method;
    if (params?.status)      qp.status     = params.status;
    if (params?.dateFrom)    qp.date_from  = params.dateFrom;
    if (params?.dateTo)      qp.date_to    = params.dateTo;
    if (params?.page)        qp.page       = String(params.page);
    if (params?.pageSize)    qp.page_size  = String(params.pageSize);

    const res = await apiClient.get(`${BASE}/payments/`, { params: qp });
    const d = res.data;

    return {
      data:        (d.data ?? []).map(mapPayment),
      totalCount:  d.total_count ?? 0,
      totalPages:  d.total_pages ?? 1,
      currentPage: d.current_page ?? 1,
      success:     d.success,
      message:     d.message,
    };
  },

  getPendingFees: async (params?: {
    batchId?: number; pendingStatus?: PendingStatus | '';
    dueDateFrom?: string; dueDateTo?: string;
  }) => {
    const qp: Record<string, string> = {};
    if (params?.batchId)       qp.batch_id       = String(params.batchId);
    if (params?.pendingStatus) qp.pending_status = params.pendingStatus;
    if (params?.dueDateFrom)   qp.due_date_from  = params.dueDateFrom;
    if (params?.dueDateTo)     qp.due_date_to    = params.dueDateTo;

    const res = await apiClient.get(`${BASE}/pending/`, { params: qp });
    return {
      data:    (res.data.data ?? []).map(mapPendingFee),
      success: res.data.success,
      message: res.data.message,
    };
  },

  addPayment: async (data: AddPaymentData) => {
    const formData = new FormData();
    formData.append('amount',            String(data.amount));
    formData.append('payment_date',      data.paymentDate);
    formData.append('method',            data.method);
    formData.append('reference_number',  data.referenceNumber ?? '');
    formData.append('notes',             data.notes ?? '');
    if (data.attachmentFile) {
      formData.append('attachment', data.attachmentFile);
    }

    const res = await apiClient.post(
      `${BASE}/students/${data.feeStudentId}/payments/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return {
      data:    mapPayment(res.data.data),
      success: res.data.success,
      message: res.data.message,
    };
  },

  getMyFees: async (batchId?: number) => {
    const params: Record<string, string> = {};
    if (batchId) params.batch_id = String(batchId);

    const res = await apiClient.get(`${BASE}/my/`, { params });
    const d = res.data.data;
    if (!d) {
      return { data: null, success: res.data.success, message: res.data.message };
    }
    return {
      data: {
        feeStudent: mapFeeStudent(d.fee_student),
        payments:   (d.payments ?? []).map(mapPayment),
      } as MyFeeData,
      success: res.data.success,
      message: res.data.message,
    };
  },

  getCoursesForFilter: async () => {
    const res = await apiClient.get('/api/courses/v1/courses/?paginate=false');
    const courses = (res.data.data ?? []).map((c: any) => ({ id: c.id, name: c.title }));
    return { data: courses, success: true, message: 'OK' };
  },
};
