import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  Users as UsersIcon,
  GraduationCap,
  UserCheck,
  Edit,
  Power,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from '@/components/ui/switch';

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

const editUserFormSchema = z.object({
  name: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  phone: z.string().min(1, { message: "Phone number is required" }).refine((val) => val && isValidPhoneNumber(val), { message: "Please enter a valid phone number" })
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

// Debounce hook
export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Robustly extract error message from various Django/DRF error shapes
function getErrorMessage(error: any, fallback = 'Something went wrong'): string {
  const data = error?.response?.data;
  if (!data) return fallback;
  // DRF ServiceError / APIException → { detail: "..." }
  if (typeof data.detail === 'string') return data.detail;
  // DRF validation errors bundled as an object → { field: ["msg"] }
  if (typeof data.detail === 'object') return JSON.stringify(data.detail);
  // Some backends return { message: "..." }
  if (typeof data.message === 'string') return data.message;
  // Plain string body
  if (typeof data === 'string') return data;
  return fallback;
}

export default function Users() {
  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const debouncedSearch = useDebounce(searchQuery, 500);
  
  const [users, setUsers] = useState<ManageUser[]>([]);
  const [summary, setSummary] = useState<ManageUserSummary>({ total_teachers: 0, total_students: 0, total_active_students: 0, total_active_teachers: 0 });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<ManageUser | null>(null);
  // Delete state
  const [userToDelete, setUserToDelete] = useState<ManageUser | null>(null);
  const [deleteWarnings, setDeleteWarnings] = useState<{ type: string; message: string; batches: string[] }[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


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

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    mode: "onChange",
  });

  // A stable ref so imperative callers (onSubmit, toggleStatus etc.) can re-trigger
  // the reactive effect without needing fetchUsers in their own dep arrays.
  const triggerRefresh = () => setRefreshKey(k => k + 1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset to page 1 whenever the tab, search, or filter changes
  useEffect(() => {
    setCurrentPage(1);
    setUsers([]);
  }, [activeTab, debouncedSearch, filterActive]);

  // Main data-fetching effect — includes an AbortController so that if the tab
  // switches while a request is in-flight, the stale response is discarded.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const response = await userApi.manageList({
          role: activeTab === 'students' ? 'Student' : 'Teacher',
          search: debouncedSearch,
          is_active: filterActive === 'all' ? undefined : filterActive === 'active',
          paginate: true,
          page: currentPage,
          page_size: 6,
        });
        if (controller.signal.aborted) return;
        const data = response as PaginatedManageUsers;
        setUsers(data.data || []);
        setTotalPages(data.total_pages || 1);
        if (data.summary) setSummary(data.summary);
      } catch (error: any) {
        if (controller.signal.aborted) return;
        toast({ title: 'Error', description: getErrorMessage(error, 'Failed to fetch users'), variant: 'destructive' });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  // refreshKey is the manual-refresh escape hatch; all other deps drive normal reactive fetching
  }, [activeTab, debouncedSearch, filterActive, currentPage, refreshKey, toast]);

  const fetchUsers = () => triggerRefresh();


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
         toast({ title: 'Error', description: getErrorMessage(error, 'Failed to create user'), variant: 'destructive' });
    } finally {
        setSubmitting(false);
    }
  };

  const openEditModal = (user: ManageUser) => {
    setUserToEdit(user);
    editForm.reset({
      name: user.fullname,
      phone: `${user.phone_number_code}${user.contact_number}`
    });
    setIsEditUserOpen(true);
  };

  const onEditSubmit = async (data: EditUserFormValues) => {
    if (!userToEdit) return;
    const parsedPhone = parsePhoneNumber(data.phone);
    if (!parsedPhone) {
        toast({ title: 'Invalid Phone', description: 'Please enter a valid phone number', variant: 'destructive' });
        return;
    }
    setSubmitting(true);
    try {
        await userApi.manageUpdate(userToEdit.id, {
            fullname: data.name,
            phone_number_code: `+${parsedPhone.countryCallingCode}`,
            contact_number: parsedPhone.nationalNumber,
        });
        toast({ title: 'Success', description: 'User updated successfully', variant: 'success' });
        setIsEditUserOpen(false);
        fetchUsers();
    } catch (error: any) {
        toast({ title: 'Error', description: getErrorMessage(error, 'Failed to update user'), variant: 'destructive' });
    } finally {
        setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: ManageUser) => {
    try {
        await userApi.manageUpdate(user.id, {
            is_active: !user.is_active
        });
        toast({ title: 'Success', description: `User ${!user.is_active ? 'activated' : 'deactivated'} successfully`, variant: 'success' });
        fetchUsers();
    } catch (error: any) {
        toast({ title: 'Error', description: getErrorMessage(error, 'Failed to toggle status'), variant: 'destructive' });
    }
  };

  // Step 1: just open the dialog — no API call yet
  const openDeleteModal = (user: ManageUser) => {
    setUserToDelete(user);
    setDeleteWarnings(null);
  };

  // Step 2: called when user confirms inside dialog (phase 1 — dependency check)
  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await userApi.manageDelete(userToDelete.id, false);
      // No dependencies → deleted cleanly
      toast({ title: 'Deleted', description: 'User deleted successfully.', variant: 'success' });
      setUserToDelete(null);
      setDeleteWarnings(null);
      fetchUsers();
    } catch (error: any) {
      const data = error?.response?.data?.data;
      if (error?.response?.status === 409 && data?.requires_force) {
        // Show warnings in the same dialog — don't close it
        setDeleteWarnings(data.warnings);
      } else {
        toast({ title: 'Error', description: getErrorMessage(error, 'Failed to delete user'), variant: 'destructive' });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Step 3: called when user clicks "Proceed Anyway" (phase 2 — force delete)
  const handleForceDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await userApi.manageDelete(userToDelete.id, true);
      toast({ title: 'Deleted', description: 'User deleted successfully.', variant: 'success' });
      setUserToDelete(null);
      setDeleteWarnings(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to delete user'), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
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
                                value={field.value as any}
                                onChange={(v) => field.onChange(v || '')}
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

          {/* Edit User Modal */}
          <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
            <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user details</DialogDescription>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                  <div className="space-y-4">
                    <FormField
                      control={editForm.control}
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
                      control={editForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <PhoneInput
                                placeholder="Enter phone number"
                                value={field.value as any}
                                onChange={(v) => field.onChange(v || '')}
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
                    <Button type="button" variant="outline" onClick={() => { setIsEditUserOpen(false); editForm.reset(); }} disabled={submitting}>Cancel</Button>
                    <Button type="submit" variant="gradient" disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Delete — Warning / Confirmation Dialog */}
          <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open) { setUserToDelete(null); setDeleteWarnings(null); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {deleteWarnings && deleteWarnings.length > 0 ? 'Dependency Warning' : 'Confirm Deletion'}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    {deleteWarnings && deleteWarnings.length > 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Deleting <strong>{userToDelete?.fullname}</strong> may cause inconsistencies. Please review the dependencies below before proceeding.
                        </p>
                        {deleteWarnings.map((w, i) => (
                          <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            <p className="text-sm font-medium text-destructive">{w.message}</p>
                            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                              {w.batches.map((b) => <li key={b}>{b}</li>)}
                            </ul>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          If you proceed, the user will be permanently removed from active records. Their email will be freed for re-use.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete <strong>{userToDelete?.fullname}</strong>? This action cannot be undone.
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={deleteWarnings && deleteWarnings.length > 0 ? handleForceDelete : handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {deleteWarnings && deleteWarnings.length > 0 ? 'Proceed Anyway' : 'Yes, Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{summary.total_active_teachers}</p>
                  <p className="text-sm text-muted-foreground">Active Teachers</p>
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
          <div className="w-[180px] shrink-0">
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="border-primary text-primary">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Joined On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                        </TableRow>
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-[300px]">
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl mx-2">
                                    <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium mb-1">
                                        {searchQuery
                                          ? `No students matching "${searchQuery}"`
                                          : filterActive !== 'all'
                                          ? `No ${filterActive} students`
                                          : 'No students found'}
                                    </h3>
                                    <p className="max-w-sm mx-auto">
                                        {searchQuery
                                          ? `We couldn't find any students matching "${searchQuery}". Try different keywords.`
                                          : filterActive === 'active'
                                          ? "There are no active students at the moment."
                                          : filterActive === 'inactive'
                                          ? "There are no inactive students at the moment."
                                          : "You haven't added any students yet. Click 'Add User' to get started."}
                                    </p>
                                </div>
                            </TableCell>
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
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{student.email}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{student.phone_number_code} {student.contact_number}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(student.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.is_active ? 'default' : 'secondary'} className={student.is_active ? 'bg-success hover:bg-success/80' : ''}>
                            {student.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={student.is_active} onCheckedChange={() => toggleUserStatus(student)} title={student.is_active ? "Deactivate Student" : "Activate Student"} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEditModal(student)} title="Edit Student">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteModal(student)} title="Delete Student" disabled={isDeleting}>
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
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
                    <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-1">
                        {searchQuery
                          ? `No teachers matching "${searchQuery}"`
                          : filterActive !== 'all'
                          ? `No ${filterActive} teachers`
                          : 'No teachers found'}
                    </h3>
                    <p className="max-w-sm mx-auto">
                        {searchQuery
                          ? `We couldn't find any teachers matching "${searchQuery}". Try different keywords.`
                          : filterActive === 'active'
                          ? "There are no active teachers at the moment."
                          : filterActive === 'inactive'
                          ? "There are no inactive teachers at the moment."
                          : "You haven't added any teachers yet. Click 'Add User' to get started."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((teacher) => (
                    <Card key={teacher.id} className="shadow-card flex flex-col">
                    <CardContent className="p-5 flex flex-col h-full gap-4">
                        {/* Header: Avatar + Name + Email */}
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                {teacher.profile_picture ? (
                                    <img src={teacher.profile_picture} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-primary">
                                        {teacher.fullname.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-semibold text-foreground truncate">{teacher.fullname}</h3>
                                <p className="text-xs text-muted-foreground truncate">{teacher.email}</p>
                            </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-border/50 pt-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="font-medium text-foreground truncate">{teacher.phone_number_code} {teacher.contact_number}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Joined</p>
                                <p className="font-medium text-foreground">{new Date(teacher.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                        </div>

                        {/* Footer: Status toggle + Actions */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-auto">
                            <div className="flex items-center gap-2">
                                <Switch checked={teacher.is_active} onCheckedChange={() => toggleUserStatus(teacher)} title={teacher.is_active ? "Deactivate" : "Activate"} />
                                <Badge variant={teacher.is_active ? 'default' : 'secondary'} className={teacher.is_active ? 'bg-success hover:bg-success/80 text-xs' : 'text-xs'}>
                                    {teacher.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEditModal(teacher)} title="Edit Teacher">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteModal(teacher)} title="Delete Teacher" disabled={isDeleting}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
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
        {!loading && users.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm font-medium text-muted-foreground px-4">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
