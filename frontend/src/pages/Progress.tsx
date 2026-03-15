import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';
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
  Search,
  BookOpen,
  Filter,
  TrendingUp,
  Award,
  CheckCircle,
  Clock,
  Lock,
  Play,
  FileText,
  Download,
  Loader2,
  VideoIcon
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { batchApi, batchContentApi, BatchWeek } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

export default function Progress() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  
  // Shared loading
  const [loading, setLoading] = useState(true);

  // --- Admin State ---
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- Student State ---
  const [weeks, setWeeks] = useState<BatchWeek[]>([]);
  const [studentStats, setStudentStats] = useState({
    totalVideos: 0,
    videosWatched: 0,
    totalTests: 0,
    testsPassed: 0,
    avgScore: 0,
    overallProgress: 0
  });

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Batches
  const fetchBatches = useCallback(async () => {
    try {
      const res = await batchApi.getBatches({ paginate: false });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setBatches(res.data);
        setSelectedBatchId(res.data[0].id);
        setSelectedBatchName(res.data[0].name);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      toast({ title: 'Error', description: 'Failed to fetch batches', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Fetch Students for Admin
  const fetchAdminData = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await batchApi.getBatchStudents(selectedBatchId, { 
        page: currentPage, 
        page_size: 10,
        search: debouncedSearch
      });
      if (res.success) {
        setStudents(res.data || []);
        setTotalPages(res.total_pages || 1);
        setStats(res.stats || null);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch student progress', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, currentPage, debouncedSearch, toast]);

  // Fetch Weeks for Student
  const fetchStudentData = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await batchContentApi.getWeeks(selectedBatchId);
      if (res.success) {
        const fetchedWeeks = res.data || [];
        setWeeks(fetchedWeeks);
        
        let tVideos = 0;
        let vWatched = 0;
        let tTests = 0;
        let tPassed = 0;
        let totalScore = 0;
        let scoredTests = 0;

        fetchedWeeks.forEach(w => {
          const sessions = w.class_sessions || [];
          tVideos += sessions.length;
          vWatched += sessions.filter(s => s.is_completed).length;

          if (w.weekly_test) {
            tTests++;
            if (w.weekly_test.is_passed) tPassed++;
            const score = w.weekly_test.latest_submission?.score;
            if (score !== undefined && score !== null) {
              totalScore += score;
              scoredTests++;
            }
          }
        });

        const overall = (tVideos + tTests) > 0 
          ? Math.round(((vWatched + tPassed) / (tVideos + tTests)) * 100) 
          : 0;

        setStudentStats({
          totalVideos: tVideos,
          videosWatched: vWatched,
          totalTests: tTests,
          testsPassed: tPassed,
          avgScore: scoredTests > 0 ? Math.round(totalScore / scoredTests) : 0,
          overallProgress: overall
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch your progress', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, toast]);

  useEffect(() => {
    if (selectedBatchId) {
      if (isStudent) {
        fetchStudentData();
      } else {
        fetchAdminData();
      }
    }
  }, [selectedBatchId, isStudent, fetchAdminData, fetchStudentData]);

  // Export full report
  const handleExportBatchProgress = async (format: 'csv' | 'xlsx') => {
    if (!selectedBatchId) return;
    setIsExporting(true);
    try {
      // Fetch a large page_size to get all students for export
      const res = await batchApi.getBatchStudents(selectedBatchId, { 
        page: 1, 
        page_size: 10000 
      });
      if (res.success && res.data && res.data.length > 0) {
        const allStudents = res.data;
        
        const exportData = allStudents.map((st: any) => ({
          'Student Name': st.student_name,
          'Email': st.student_email,
          'Status': st.status,
          'Overall Progress %': st.overall_progress || 0,
          'Tests Passed': st.weekly_tests_submitted || 0,
          'Total Tests': st.total_weekly_tests || 0,
          'Videos Watched': st.videos_watched || 0,
          'Total Videos': st.total_videos || 0,
          'Enrolled Date': new Date(st.enrolled_at).toLocaleDateString()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Progress Report");

        if (format === 'csv') {
          XLSX.writeFile(wb, `batch_progress_${selectedBatchId}.csv`);
        } else {
          XLSX.writeFile(wb, `batch_progress_${selectedBatchId}.xlsx`);
        }
        
        toast({ title: 'Success', description: 'Report exported successfully.', variant: 'success' });
      } else {
        toast({ title: 'Info', description: 'No students to export.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to export report.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const AdminProgress = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-foreground">Student Progress</h1>
          <p className="mt-1 text-muted-foreground">Track student performance across batches</p>
        </div>
        
        {/* Export Button */}
        {students.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting || loading} className="shrink-0 gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportBatchProgress('xlsx')}>
                Download as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportBatchProgress('csv')}>
                Download as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-sm font-medium text-muted-foreground">Total Enrolled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                  <p className="text-sm font-medium text-muted-foreground">Completed Course</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Award className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                  <p className="text-sm font-medium text-muted-foreground">Active Learners</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <Clock className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.dropped}</p>
                  <p className="text-sm font-medium text-muted-foreground">Dropped / Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search students by name or email..." 
            className="pl-10 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="w-[220px] shrink-0">
          <Select 
            value={selectedBatchId?.toString()} 
            onValueChange={(val) => {
              const bId = Number(val);
              setSelectedBatchId(bId);
              const selectedBatch = batches.find(b => b.id === bId);
              if (selectedBatch) {
                setSelectedBatchName(selectedBatch.name);
              }
              setCurrentPage(1);
              setSearch('');
            }}
            disabled={batches.length === 0}
          >
            <SelectTrigger className="h-10 border-primary text-primary">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Batch" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {batches.map(batch => (
                <SelectItem key={batch.id} value={batch.id.toString()}>
                  {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress Table */}
      <Card className="shadow-card border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4">Student</TableHead>
                  <TableHead>Enrollment Status</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Tests Passed</TableHead>
                  <TableHead>Overall Progress</TableHead>
                  <TableHead className="text-right">Enrolled At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                     <TableCell colSpan={6} className="py-12 text-center">
                       <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-50 mb-2" />
                       <p className="text-sm text-muted-foreground">Loading progress...</p>
                     </TableCell>
                   </TableRow>
                ) : students.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                       No students found in this batch matching your criteria.
                     </TableCell>
                   </TableRow>
                ) : students.map((enrollment: any) => (
                  <TableRow key={enrollment.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/batches/${selectedBatchId}/students`)}>
                    <TableCell>
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-sm font-bold text-primary">
                            {enrollment.student_name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                           <p className="font-bold text-foreground truncate">{enrollment.student_name}</p>
                           <p className="text-xs text-muted-foreground truncate">{enrollment.student_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[10px] h-5 py-0 px-2 tracking-wide font-bold capitalize",
                        enrollment.status === 'active' ? "bg-success/10 text-success border-success/30" : 
                        enrollment.status === 'completed' ? "bg-primary/10 text-primary border-primary/30" :
                        enrollment.status === 'dropped' ? "bg-destructive/10 text-destructive border-destructive/30" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                         {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <span className="font-medium">
                         {enrollment.videos_watched || 0}
                       </span>
                       <span className="text-muted-foreground text-xs ml-1">
                         / {enrollment.total_videos || 0}
                       </span>
                    </TableCell>
                    <TableCell>
                       <span className="font-medium">
                         {enrollment.weekly_tests_submitted || 0}
                       </span>
                       <span className="text-muted-foreground text-xs ml-1">
                         / {enrollment.total_weekly_tests || 0}
                       </span>
                    </TableCell>
                    <TableCell className="w-1/4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              enrollment.overall_progress >= 100 ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, enrollment.overall_progress || 0)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-foreground">
                          {enrollment.overall_progress || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                       {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {!loading && students.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm font-medium text-muted-foreground w-20 text-center">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const StudentProgress = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Progress</h1>
          <p className="mt-1 text-muted-foreground">Track your learning journey for this program</p>
        </div>
        <div className="w-[220px] shrink-0">
          <Select 
            value={selectedBatchId?.toString()} 
            onValueChange={(val) => {
              const bId = Number(val);
              setSelectedBatchId(bId);
              const selectedBatch = batches.find(b => b.id === bId);
              if (selectedBatch) {
                setSelectedBatchName(selectedBatch.name);
              }
            }}
            disabled={batches.length === 0}
          >
            <SelectTrigger className="h-10 border-primary text-primary">
              <div className="flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select course batch" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {batches.map(batch => (
                <SelectItem key={batch.id} value={batch.id.toString()}>
                  {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 border rounded-2xl bg-card">
           <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
           <p className="text-muted-foreground font-medium">Calculating progress...</p>
        </div>
      ) : (
        <>
          {/* Overall Stats */}
          <Card className="shadow-xl bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] text-white overflow-hidden border-none rounded-2xl">
            <CardContent className="p-6 md:p-8 relative">
              <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-5 hidden md:block">
                 <TrendingUp className="h-48 w-48" />
              </div>
              <div className="grid gap-8 sm:grid-cols-4 relative z-10">
                <div className="sm:border-r sm:border-white/20 pr-4">
                  <p className="text-white/70 text-sm font-bold tracking-widest uppercase">Overall Progress</p>
                  <div className="flex items-end gap-2 mt-2">
                    <p className="text-4xl md:text-5xl font-black font-display">{studentStats.overallProgress}%</p>
                  </div>
                  <ProgressBar value={studentStats.overallProgress} className="mt-4 h-2 bg-white/20" />
                </div>
                <div>
                  <p className="text-white/70 text-sm font-bold tracking-widest uppercase">Videos Watched</p>
                  <div className="flex items-baseline gap-1 mt-2">
                     <p className="text-3xl md:text-4xl font-black font-display">{studentStats.videosWatched}</p>
                     <p className="text-white/70 font-bold">/ {studentStats.totalVideos}</p>
                  </div>
                </div>
                <div>
                  <p className="text-white/70 text-sm font-bold tracking-widest uppercase">Tests Passed</p>
                  <div className="flex items-baseline gap-1 mt-2">
                     <p className="text-3xl md:text-4xl font-black font-display">{studentStats.testsPassed}</p>
                     <p className="text-white/70 font-bold">/ {studentStats.totalTests}</p>
                  </div>
                </div>
                <div>
                  <p className="text-white/70 text-sm font-bold tracking-widest uppercase">Average Score</p>
                  <div className="flex items-baseline gap-1 mt-2">
                     <p className="text-3xl md:text-4xl font-black font-display">{studentStats.avgScore}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Progress */}
          <div className="space-y-4">
             <div className="flex items-center gap-3 mb-2">
                <Award className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-display font-black">Weekly Breakdown</h3>
             </div>
             
             {weeks.length === 0 ? (
               <div className="py-12 border-2 border-dashed border-border/50 text-center rounded-2xl bg-card">
                  <p className="text-muted-foreground">No weeks have been published for this batch yet.</p>
               </div>
             ) : (
               weeks.map((week) => {
                 const totalWeekVids = week.class_sessions?.length || 0;
                 const completedWeekVids = week.class_sessions?.filter(s => s.is_completed).length || 0;
                 const weekTestScore = week.weekly_test?.latest_submission?.score;
                 const isWeekPassed = week.weekly_test?.is_passed;

                 return (
                  <div
                    key={week.id}
                    className={cn(
                      "p-5 rounded-2xl border transition-all",
                      week.is_unlocked 
                        ? "bg-card border-border shadow-card hover:border-primary/30 hover:shadow-md" 
                        : "bg-muted/30 border-border/40 opacity-75"
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start sm:items-center gap-4">
                        <div className={cn(
                          "flex shrink-0 h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-colors",
                          isWeekPassed ? 'bg-success/10 text-success' :
                          week.is_unlocked ? 'bg-primary/10 text-primary' : 'bg-muted border border-border text-muted-foreground'
                        )}>
                          {isWeekPassed ? (
                            <CheckCircle className="h-7 w-7" />
                          ) : week.is_unlocked ? (
                            <span className="text-xl font-black font-display">{week.week_number}</span>
                          ) : (
                            <Lock className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={cn("font-bold text-lg", week.is_unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                              Week {week.week_number}: {week.title}
                            </h3>
                            {isWeekPassed && <Badge className="bg-success text-white font-bold h-5 text-[10px]">PASSED</Badge>}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-1 text-xs font-bold text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <VideoIcon className="h-4 w-4 opacity-70" />
                              <span className={week.is_unlocked ? 'text-foreground' : ''}>{completedWeekVids}/{totalWeekVids}</span> videos watched
                            </span>
                            {week.weekly_test && (
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-4 w-4 opacity-70" />
                                Test: {weekTestScore !== undefined && weekTestScore !== null ? (
                                   <span className={isWeekPassed ? 'text-success' : 'text-warning'}>{weekTestScore}%</span>
                                ) : 'Not Attempted'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 justify-end border-t sm:border-t-0 pt-4 sm:pt-0">
                        {week.is_unlocked && (
                          <>
                            <div className="hidden lg:block w-32 mr-2">
                              <ProgressBar 
                                value={totalWeekVids > 0 ? (completedWeekVids / totalWeekVids) * 100 : 0} 
                                className="h-2"
                              />
                            </div>
                            <Button 
                              variant={isWeekPassed ? 'outline' : 'gradient'} 
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => navigate(`/batches/${selectedBatchId}`)}
                            >
                              {isWeekPassed ? 'Review' : completedWeekVids === totalWeekVids ? 'Take Test' : 'Continue Learning'}
                            </Button>
                          </>
                        )}
                        {!week.is_unlocked && (
                          <Badge variant="outline" className="text-muted-foreground bg-muted/50 border-border/50 shadow-sm py-1.5 px-3">
                            <Lock className="h-3 w-3 mr-1.5" />
                            Locked
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                 );
               })
             )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
         {/* Student-specific Top Control (Wait, they wanted batch selector under My Progress) */}
         {/* We will handle Student view batch selector inline where the My Progress header is */}
         
         {/* Content Layer based on Role */}
         <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
           {isStudent ? <StudentProgress /> : <AdminProgress />}
         </div>
      </div>
    </DashboardLayout>
  );
}
