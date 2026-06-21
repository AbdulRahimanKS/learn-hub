import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { useToast } from '@/hooks/use-toast';
import {
  feeApi, formatCurrency, FEE_STATUS_CONFIG, PAYMENT_METHOD_LABELS,
  type FeeDashboardStats, type MonthlyCollectionPoint, type RecentPayment,
} from '@/lib/fee-api';
import type { Batch } from '@/lib/batch-api';
import {
  Users, TrendingUp, CheckCircle2, Clock, AlertTriangle, Loader2,
  Wallet, BarChart3, Filter, CalendarRange, Receipt,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-sm min-w-[140px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  sub?: string;
  subColor?: string;
  urgent?: boolean;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, sub, subColor, urgent }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden shadow-card transition-all duration-300', urgent && 'border-orange-400/50 dark:border-orange-500/40')}>
      {urgent && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400" />}
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
            {sub && <p className={cn('text-xs mt-1.5 font-medium', subColor ?? 'text-muted-foreground')}>{sub}</p>}
          </div>
          <div className={cn('p-3 rounded-xl shrink-0', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeeDashboard() {
  const { toast } = useToast();

  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [stats, setStats] = useState<FeeDashboardStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyCollectionPoint[]>([]);
  const [distribution, setDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recent, setRecent] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feeApi.getDashboardStats({ batchId: selectedBatchId, courseId: courseId ? Number(courseId) : undefined });
      if (res.success) {
        setStats(res.data.stats);
        setMonthly(res.data.monthly);
        setDistribution(res.data.distribution);
        setRecent(res.data.recentPayments);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load dashboard data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, courseId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(id ? Number(id) : undefined);
    setSelectedBatchName(batch.name);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Fee Dashboard</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">Financial overview and collection summary</p>
          </div>
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
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="h-10 w-[180px] rounded-xl text-xs">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Courses</SelectItem>
              <SelectItem value="1">Full Stack Development</SelectItem>
              <SelectItem value="2">Data Science</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-[140px] rounded-xl text-xs" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-[140px] rounded-xl text-xs" />
          </div>
          {(selectedBatchId || courseId || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 text-xs text-muted-foreground"
              onClick={() => { setSelectedBatchId(undefined); setSelectedBatchName(''); setCourseId(''); setDateFrom(''); setDateTo(''); }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Total Students"
                value={String(stats?.totalStudents ?? 0)}
                icon={Users}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                sub={`${stats?.collectionRate ?? 0}% collection rate`}
              />
              <StatCard
                label="Total Fees"
                value={formatCurrency(stats?.totalFees ?? 0)}
                icon={Wallet}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
              />
              <StatCard
                label="Amount Collected"
                value={formatCurrency(stats?.amountCollected ?? 0)}
                icon={CheckCircle2}
                iconColor="text-success"
                iconBg="bg-success/10"
                sub={`${stats?.collectionRate ?? 0}% of total`}
                subColor="text-success"
              />
              <StatCard
                label="Pending Amount"
                value={formatCurrency(stats?.pendingAmount ?? 0)}
                icon={Clock}
                iconColor="text-orange-500"
                iconBg="bg-orange-500/10"
                urgent={(stats?.pendingAmount ?? 0) > 0}
              />
              <StatCard
                label="Overdue Students"
                value={String(stats?.overdueStudents ?? 0)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                iconBg="bg-destructive/10"
                sub={(stats?.overdueStudents ?? 0) > 0 ? 'Needs immediate attention' : 'All clear'}
                subColor={(stats?.overdueStudents ?? 0) > 0 ? 'text-destructive' : 'text-success'}
                urgent={(stats?.overdueStudents ?? 0) > 0}
              />
            </div>

            {/* ── Charts row ── */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Collection Trend (area) */}
              <Card className="shadow-card lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Collection Trend
                  </CardTitle>
                  <CardDescription>Monthly collected vs pending amounts</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthly} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="pending" name="Pending" stroke="#f97316" strokeWidth={2.5} strokeDasharray="5 3" dot={{ fill: '#f97316', r: 3, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Distribution pie */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Fee Distribution
                  </CardTitle>
                  <CardDescription>Students by fee status</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex flex-col items-center">
                  {distribution.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={distribution} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="value">
                            {distribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${value} students`, name]}
                            contentStyle={{
                              background: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '0.75rem',
                              fontSize: 12,
                              color: 'hsl(var(--popover-foreground))',
                            }}
                            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-full grid grid-cols-2 gap-1.5 mt-2">
                        {distribution.map((d) => (
                          <div key={d.name} className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                            <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                            <span className="text-xs font-bold text-foreground ml-auto tabular-nums">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-10 text-center text-muted-foreground text-sm">No data</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Bottom row: Bar chart + Recent payments ── */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Monthly bar chart */}
              <Card className="shadow-card lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Monthly Collection Summary
                  </CardTitle>
                  <CardDescription>Collected vs pending breakdown by month</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthly} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="pending" name="Pending" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent payments */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4 text-primary" />
                    Recent Payments
                  </CardTitle>
                  <CardDescription>Latest payment transactions</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {recent.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No payments yet</div>
                  ) : (
                    <div className="space-y-3">
                      {recent.map((p) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{p.studentName}</p>
                            <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[p.method]} · {new Date(p.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                          </div>
                          <p className="text-sm font-bold text-success tabular-nums shrink-0">{formatCurrency(p.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
