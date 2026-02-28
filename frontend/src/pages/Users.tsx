import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Users as UsersIcon,
  GraduationCap,
  UserCheck,
  MessageSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { userApi, ManageUser, PaginatedManageUsers, ManageUserSummary } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';

const addUserFormSchema = z.object({
  userType: z.enum(['teacher', 'student']),
  name: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().min(1, { message: "Phone number is required" }).refine((val) => val && isValidPhoneNumber(val), { message: "Please enter a valid phone number" })
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

// Debounce hook
export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function Users() {
  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  
  const [users, setUsers] = useState<ManageUser[]>([]);
  const [summary, setSummary] = useState<ManageUserSummary>({ total_teachers: 0, total_students: 0, total_active_students: 0 });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedStudentEmail, setSelectedStudentEmail] = useState<any>(null);
  const [emailBody, setEmailBody] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    mode: "onChange",
    defaultValues: {
      userType: 'student',
      name: '',
      email: '',
      phone: '',
    },
  });

  const watchedUserType = form.watch("userType");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userApi.manageList({
        role: activeTab === 'students' ? 'Student' : 'Teacher',
        search: debouncedSearch,
        paginate: true,
        page: currentPage,
        page_size: 10
      });
      const data = response as PaginatedManageUsers;
      setUsers(data.data || []);
      setTotalPages(data.total_pages || 1);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error: any) {
       toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to fetch users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, currentPage, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch]);


  const onSubmit = async (data: AddUserFormValues) => {
    const parsedPhone = parsePhoneNumber(data.phone);
    if (!parsedPhone) {
        toast({ title: 'Invalid Phone', description: 'Please enter a valid phone number', variant: 'destructive' });
        return;
    }

    setSubmitting(true);
    try {
        await userApi.manageCreate({
            phone_number_code: `+${parsedPhone.countryCallingCode}`,
            contact_number: parsedPhone.nationalNumber,
            fullname: data.name,
            email: data.email,
            role: data.userType === 'student' ? 'Student' : 'Teacher',
        });
        toast({ title: 'Success', description: 'User created successfully', variant: 'success' });
        setIsAddUserOpen(false);
        form.reset();
        fetchUsers();
    } catch (error: any) {
         toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to create user', variant: 'destructive' });
    } finally {
        setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await userApi.manageDelete(userToDelete);
      toast({ title: 'Success', description: 'User deleted successfully', variant: 'success' });
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to delete user', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">User Management</h1>
            <p className="mt-1 text-muted-foreground">Manage teachers and students</p>
          </div>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Create a new teacher or student account</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="userType"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>User Type</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={field.value === 'teacher' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => field.onChange('teacher')}
                              >
                                <GraduationCap className="h-4 w-4 mr-2" />
                                Teacher
                              </Button>
                              <Button
                                type="button"
                                variant={field.value === 'student' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => field.onChange('student')}
                              >
                                <UsersIcon className="h-4 w-4 mr-2" />
                                Student
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="user@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <PhoneInput
                                placeholder="Enter phone number"
                                value={field.value}
                                onChange={field.onChange}
                                defaultCountry="IN"
                                international
                                className={cn(
                                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                  "[&>.PhoneInputCountry]:mr-2 [&>.PhoneInputCountry]:flex [&>.PhoneInputCountry]:items-center [&>.PhoneInputCountryIcon]:w-6 [&>.PhoneInputCountryIcon]:h-4 [&>.PhoneInputCountryIcon--border]:border-none [&>.PhoneInputCountrySelect]:w-full [&>.PhoneInputCountrySelect]:h-full [&>.PhoneInputCountrySelect]:opacity-0 [&>.PhoneInputInput]:flex-1 [&>.PhoneInputInput]:bg-transparent [&>.PhoneInputInput]:border-none [&>.PhoneInputInput]:outline-none [&>.PhoneInputInput]:placeholder-muted-foreground"
                                )}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                    <Button type="button" variant="outline" onClick={() => { setIsAddUserOpen(false); form.reset(); }} disabled={submitting}>Cancel</Button>
                    <Button type="submit" variant="gradient" disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Add User
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Email Modal */}
          <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Send Email</DialogTitle>
                <DialogDescription>
                  Send a direct email to {selectedStudentEmail?.fullname} ({selectedStudentEmail?.email}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="Enter email subject" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <div className="bg-background">
                    <ReactQuill 
                      theme="snow" 
                      value={emailBody} 
                      onChange={setEmailBody} 
                      className="h-[350px] mb-12"
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>Cancel</Button>
                <Button variant="gradient" onClick={() => setIsEmailModalOpen(false)}>Send Email</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={!!userToDelete} onOpenChange={open => { if (!open) setUserToDelete(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The user will be permanently removed/deactivated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{summary.total_teachers}</p>
                  <p className="text-sm text-muted-foreground">Teachers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent/10">
                  <UsersIcon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{summary.total_students}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <UserCheck className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{summary.total_active_students}</p>
                  <p className="text-sm text-muted-foreground">Active Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="shrink-0 gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit">
            <TabsTrigger value="students" className="gap-2 w-32">
              <UsersIcon className="h-4 w-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="teachers" className="gap-2 w-32">
              <GraduationCap className="h-4 w-4" />
              Teachers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <Card className="shadow-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                        </TableRow>
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students found.</TableCell>
                        </TableRow>
                    ) : users.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                {student.profile_picture ? (
                                    <img src={student.profile_picture} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-semibold text-primary">
                                        {student.fullname.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{student.fullname}</p>
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{student.phone_number_code} {student.contact_number}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">-</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.is_active ? 'default' : 'secondary'} className={student.is_active ? 'bg-success hover:bg-success/80' : ''}>
                            {student.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/chat?user=${student.id}`)} title="Message in Chat">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8" 
                              title="Send Email"
                              onClick={() => {
                                setSelectedStudentEmail(student);
                                setIsEmailModalOpen(true);
                              }}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete Student" onClick={() => setUserToDelete(student.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teachers">
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    <h3 className="text-lg font-medium mb-1">No teachers found</h3>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((teacher) => (
                    <Card key={teacher.id} className="shadow-card">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                {teacher.profile_picture ? (
                                    <img src={teacher.profile_picture} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-primary">
                                        {teacher.fullname.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <div>
                            <h3 className="font-semibold text-foreground truncate max-w-[150px]">{teacher.fullname}</h3>
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">{teacher.email}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setUserToDelete(teacher.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <Badge variant={teacher.is_active ? 'default' : 'secondary'} className={teacher.is_active ? 'bg-success hover:bg-success/80' : ''}>
                            {teacher.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-sm font-medium">{teacher.phone_number_code} {teacher.contact_number}</span>
                        </div>
                        </div>
                    </CardContent>
                    </Card>
                ))}
                </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
