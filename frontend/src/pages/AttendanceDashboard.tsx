import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { batchApi, type Batch } from '@/lib/batch-api';
import {
  toStudentAttendanceRecord,
  computeAttendanceSummary,
  computeWeeklyTrend,
  computeAttendanceDistribution,
  ATTENDANCE_THRESHOLD,
  ATTENDANCE_STATUS_CONFIG,
  type StudentAttendanceRecord,
} from '@/lib/attendance-api';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Loader2,
  ChevronRight,
  BarChart3,
  ClipboardList,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Stat card (same token as Dashboard.tsx) ─────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  sub?: string;
  subColor?: string;
  urgent?: boolean;
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, sub, subColor, urgent, onClick }: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden shadow-card transition-all duration-300 group',
        onClick && 'hover:shadow-lg cursor-pointer',
        urgent && 'border-orange-400/50 dark:border-orange-500/40',
      )}
      onClick={onClick}
    >
      {urgent && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400" />
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
            {sub && (
              <p className={cn('text-sm mt-2 font-medium', subColor ?? 'text-muted-foreground')}>
                {sub}
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-xl transition-transform group-hover:scale-110', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom tooltip for charts ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
          {p.name}: <span className="font-bold">{p.value}%</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AttendanceDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(Number(id));
    setSelectedBatchName(batch.name);
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await batchApi.getBatchStudents(selectedBatchId, { page: 1, page_size: 500 });
      if (res.success) {
        setRecords((res.data ?? []).map(toStudentAttendanceRecord));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load attendance data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, toast]);

  useEffect(() => {
    if (selectedBatchId) fetchData();
  }, [selectedBatchId, fetchData]);

  const summary = computeAttendanceSummary(records);
  const trendData = computeWeeklyTrend(records);
  const distributionData = computeAttendanceDistribution(records);

  // Per-week bar chart: avg attendance per week
  const weekBarData = trendData.map((t) => ({
    week: t.weekLabel.replace(/^Week\s+/i, 'W'),
    'Attendance %': t.attendancePercent,
  }));

  // Below threshold list (top 5 most critical)
  const belowThreshold = records
    .filter((r) => r.enrollmentStatus !== 'dropped' && r.attendancePercent < ATTENDANCE_THRESHOLD)
    .sort((a, b) => a.attendancePercent - b.attendancePercent)
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-7 pb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Attendance Dashboard
            </h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              Attendance overview derived from video completion across your batches
            </p>
          </div>
          <div className="w-full sm:w-[min(280px,100%)] shrink-0">
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

        {/* ── Loading / Empty state ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !selectedBatchId ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
              <ClipboardList className="h-8 w-8 opacity-40 text-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">Select a batch to view attendance</p>
            <p className="text-sm mt-1">Use the filter above to choose a batch</p>
          </div>
        ) : (
          <>
            {/* ── A. Summary Stats ── */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Students"
                value={summary.totalStudents}
                icon={Users}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                sub="Active enrollments"
              />
              <StatCard
                label="Avg Attendance"
                value={`${summary.avgAttendancePercent}%`}
                icon={TrendingUp}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
                sub={summary.avgAttendancePercent >= ATTENDANCE_THRESHOLD ? 'Above threshold ✓' : 'Below threshold'}
                subColor={summary.avgAttendancePercent >= ATTENDANCE_THRESHOLD ? 'text-emerald-500 font-semibold' : 'text-orange-500 font-semibold'}
              />
              <StatCard
                label="Below Threshold"
                value={summary.belowThreshold}
                icon={AlertTriangle}
                iconColor="text-orange-500"
                iconBg="bg-orange-500/10"
                sub={summary.belowThreshold > 0 ? `Below ${ATTENDANCE_THRESHOLD}%` : 'All above threshold ✓'}
                subColor={summary.belowThreshold > 0 ? 'text-orange-500 font-semibold' : 'text-emerald-500 font-semibold'}
                urgent={summary.belowThreshold > 0}
                onClick={() => navigate('/attendance/batch')}
              />
              <StatCard
                label="Top Student"
                value={`${summary.bestStudentPercent}%`}
                icon={Award}
                iconColor="text-violet-500"
                iconBg="bg-violet-500/10"
                sub={summary.bestStudentName !== '—' ? summary.bestStudentName.split(' ')[0] : '—'}
              />
            </div>

            {/* ── B. Charts row ── */}
            <div className="grid gap-6 lg:grid-cols-3">

              {/* Weekly Attendance Trend (line chart, spans 2 cols) */}
              <Card className="shadow-card lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <CardTitle>Attendance Trend</CardTitle>
                      <CardDescription>Average attendance percentage per week</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/attendance/batch')}
                      className="gap-1 text-xs"
                    >
                      View Details <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {trendData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <BarChart3 className="h-10 w-10 opacity-30 mb-3" />
                      <p className="text-sm font-medium text-foreground">No week data yet</p>
                      <p className="text-xs mt-1">Attendance trend will appear once weeks are published</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis
                          dataKey="weekLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: string) => v.replace(/^Week\s+/i, 'W')}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="attendancePercent"
                          name="Attendance"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Attendance Distribution (pie chart) */}
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle>Distribution</CardTitle>
                  <CardDescription>Students by attendance level</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {distributionData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <BarChart3 className="h-10 w-10 opacity-30 mb-3" />
                      <p className="text-sm">No data yet</p>
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {distributionData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
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
                      <div className="space-y-2 mt-2">
                        {distributionData.map((d) => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="font-bold tabular-nums text-foreground">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── C. Week-wise bar chart + Below Threshold list ── */}
            <div className="grid gap-6 lg:grid-cols-3">

              {/* Week-wise bar chart */}
              <Card className="shadow-card lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle>Week-wise Attendance</CardTitle>
                  <CardDescription>Average completion percentage per week across all students</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {weekBarData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <BarChart3 className="h-10 w-10 opacity-30 mb-3" />
                      <p className="text-sm font-medium text-foreground">No week data yet</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={weekBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                        <XAxis
                          dataKey="week"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="Attendance %" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Students below threshold */}
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Needs Attention
                      </CardTitle>
                      <CardDescription>Below {ATTENDANCE_THRESHOLD}% threshold</CardDescription>
                    </div>
                    {belowThreshold.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/attendance/batch')}
                        className="gap-1 text-xs"
                      >
                        All <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5">
                  {belowThreshold.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                        <Award className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="text-sm font-medium text-foreground">All students on track</p>
                      <p className="text-xs mt-1 text-center">Everyone is above {ATTENDANCE_THRESHOLD}%</p>
                    </div>
                  ) : (
                    belowThreshold.map((r) => (
                      <button
                        key={r.enrollmentId}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border hover:bg-orange-500/5 hover:border-orange-500/20 transition-all text-left group"
                        onClick={() =>
                          navigate('/attendance/student', {
                            state: { enrollment: r, batchId: selectedBatchId, batchName: selectedBatchName },
                          })
                        }
                      >
                        <div className="h-9 w-9 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                          <span className="text-xs font-bold text-orange-500">
                            {r.studentName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.studentName}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{r.attendancePercent}% attendance</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-5 py-0 px-2 font-bold shrink-0',
                            ATTENDANCE_STATUS_CONFIG[r.attendanceStatus].badgeClass,
                          )}
                        >
                          {ATTENDANCE_STATUS_CONFIG[r.attendanceStatus].label}
                        </Badge>
                      </button>
                    ))
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
