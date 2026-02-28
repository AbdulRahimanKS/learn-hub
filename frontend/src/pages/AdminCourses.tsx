import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from '@/components/ui/switch';
import { ImageCropperModal } from '@/components/ImageCropperModal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  BookOpen,
  Calendar,
  Edit,
  Filter,
  Trash2,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { courseApi, Course } from '@/lib/course-api';
import { useToast } from '@/hooks/use-toast';

// Basic debounce hook if it doesn't exist
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearInterval(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function AdminCourses() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounceValue(searchQuery, 500);

  // Filtering & Pagination State
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 6;

  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editCourseId, setEditCourseId] = useState<number | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'beginner',
    tags: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Image Upload State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { 
        search: debouncedSearch, 
        paginate: true,
        page: currentPage,
        page_size: pageSize
      };
      
      if (statusFilter !== 'all') {
        params.is_active = statusFilter === 'active';
      }

      const res = await courseApi.getCourses(params);
      if (res.success) {
        const paginatedData = res as any;
        setCourses(paginatedData.data);
        setTotalPages(paginatedData.total_pages || 1);
      }
    } catch (err: any) {
      toast({
        title: "Error fetching courses",
        description: err.response?.data?.detail || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, currentPage, toast]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Fetch when dependencies change
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError(null);
    
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setImageError("Please upload a valid JPG, PNG, or WebP image");
        return;
      }
      if (file.size > 2 * 1024 * 1024) { 
        setImageError("Image size must be less than 2MB");
        return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      setCropperSrc(objectUrl);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImagePreview(null);
    setThumbnailFile(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = (croppedFile: File, objectUrl: string) => {
    setThumbnailFile(croppedFile);
    setImagePreview(objectUrl);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    if (formErrors[id]) {
      setFormErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, isActive: checked }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = "Course Title is required.";
    } else if (formData.title.length > 255) {
      errors.title = "Course Title must be 255 characters or less.";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      difficulty: 'beginner',
      tags: '',
      isActive: true,
    });
    setFormErrors({});
    setImagePreview(null);
    setThumbnailFile(null);
    setImageError(null);
    setEditCourseId(null);
  };

  const handleOpenModal = (course?: Course) => {
    if (course) {
      setEditCourseId(course.id);
      setFormData({
        title: course.title,
        description: course.description || '',
        difficulty: course.difficulty_level,
        tags: course.tags.map(t => t.name).join(', '),
        isActive: course.is_active,
      });
      setImagePreview(course.thumbnail);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      const submitData = new FormData();
      submitData.append('title', formData.title.trim());
      submitData.append('description', formData.description.trim());
      submitData.append('difficulty_level', formData.difficulty);
      submitData.append('is_active', formData.isActive ? 'true' : 'false');
      
      const tagArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagArray.length === 0) {
        submitData.append('tags_input', ''); // Explicitly send empty string so backend doesn't omit key
      } else {
        tagArray.forEach(tag => {
          submitData.append('tags_input', tag);
        });
      }

      // Special case for removing existing thumbnail when updating
      if (editCourseId && !thumbnailFile && imagePreview === null) {
          submitData.append('thumbnail', '');
      } else if (thumbnailFile) {
          submitData.append('thumbnail', thumbnailFile);
      }

      if (editCourseId) {
        await courseApi.updateCourse(editCourseId, submitData);
        toast({ title: "Success", description: "Course updated successfully", variant: "success" });
      } else {
        await courseApi.createCourse(submitData);
        toast({ title: "Success", description: "Course created successfully", variant: "success" });
      }
      
      setIsModalOpen(false);
      fetchCourses();
    } catch (err: any) {
      setFormErrors({ server: err.response?.data?.detail || "Failed to save course" });
      toast({
        title: "Submission Error",
        description: err.response?.data?.detail || "Failed to save course",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteCourseId(id);
  };

  const confirmDelete = async () => {
    if (!deleteCourseId) return;
    
    try {
      await courseApi.deleteCourse(deleteCourseId);
      toast({ title: "Success", description: "Course deleted successfully", variant: "success" });
      setDeleteCourseId(null);
      fetchCourses();
    } catch (err: any) {
      toast({
        title: "Delete Error",
        description: err.response?.data?.detail || "Failed to delete course",
        variant: "destructive",
      });
      setDeleteCourseId(null);
    }
  };


  const handleToggleActive = async (id: number) => {
    try {
      await courseApi.toggleActive(id);
      toast({ 
        title: "Success", 
        description: "Course status updated", 
        variant: "success",
      });
      fetchCourses();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Course Management</h1>
            <p className="mt-1 text-muted-foreground">Add, edit and manage your platform's courses</p>
          </div>
          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="gradient" onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editCourseId ? 'Edit Course' : 'Add New Course'}</DialogTitle>
                <DialogDescription>Define the curriculum details for the course.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {formErrors.server && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                    {formErrors.server}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-1 md:col-span-2 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className={formErrors.title ? "text-destructive" : ""}>Course Title <span className="text-destructive">*</span></Label>
                      <Input 
                        id="title" 
                        placeholder="e.g., Complete Python Analytics" 
                        value={formData.title}
                        onChange={handleInputChange}
                        className={formErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {formErrors.title && <p className="text-xs text-destructive">{formErrors.title}</p>}
                    </div>
                    
                    <div className="space-y-2">
                       <Label>Course Status</Label>
                       <div className="flex items-center space-x-2 pt-2">
                         <Switch 
                           id="is-active" 
                           checked={formData.isActive}
                           onCheckedChange={handleSwitchChange}
                         />
                         <Label htmlFor="isActive" className="cursor-pointer font-normal">Active (allow new batches)</Label>
                       </div>
                    </div>
                  </div>

                  {/* Thumbnail Upload */}
                  <div className="space-y-2">
                    <Label>Thumbnail</Label>
                    <div 
                      className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center text-center hover:border-primary/50 transition-colors cursor-pointer relative overflow-hidden group bg-muted/30"
                      onClick={() => !imagePreview && fileInputRef.current?.click()}
                    >
                      {imagePreview ? (
                        <>
                           <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <Button 
                                type="button"
                                variant="secondary" 
                                size="sm" 
                                className="h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                              >
                                Change
                              </Button>
                              <Button 
                                type="button"
                                variant="destructive" 
                                size="sm" 
                                className="h-8"
                                onClick={handleRemoveImage}
                              >
                                Remove
                              </Button>
                           </div>
                        </>
                      ) : (
                        <div className="p-4">
                          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-muted-foreground">Upload Image</p>
                        </div>
                      )}
                    </div>
                    {imageError ? (
                      <p className="text-xs text-destructive text-center">{imageError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        JPG, PNG, WebP. Max 2MB.
                      </p>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/jpeg, image/png, image/webp" 
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Brief outline of the course topic..."
                    value={formData.description}
                    onChange={handleInputChange} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty Level</Label>
                    <select 
                      id="difficulty" 
                      value={formData.difficulty}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="beginner" className="bg-background text-foreground">Beginner</option>
                      <option value="intermediate" className="bg-background text-foreground">Intermediate</option>
                      <option value="advanced" className="bg-background text-foreground">Advanced</option>
                    </select>
                  </div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input 
                    id="tags" 
                    placeholder="e.g. python, scripting"
                    value={formData.tags}
                    onChange={handleInputChange} 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button variant="gradient" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editCourseId ? 'Save Changes' : 'Create Course'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="shrink-0 gap-2">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <DropdownMenuRadioItem value="all">All Courses</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="active">Active Only</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="inactive">Inactive Only</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
        </div>

        {/* Course Cards Array */}
        {courses.length === 0 ? (
           <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-xl">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">
                {searchQuery ? "No matching courses" : "No courses yet"}
              </h3>
              <p>
                {searchQuery 
                  ? "We couldn't find any courses matching your search. Try different keywords."
                  : "You haven't added any courses. Click 'Add Course' to get started."}
              </p>
           </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="flex flex-col shadow-card hover:shadow-lg transition-all duration-300">
                <div className="relative aspect-video w-full overflow-hidden rounded-t-xl group bg-muted flex items-center justify-center">
                  {course.thumbnail ? (
                    <img 
                      src={course.thumbnail} 
                      alt={course.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                  
                  {/* Top overlay badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge variant="secondary" className="bg-background/95 backdrop-blur font-semibold border-none text-foreground border border-black/10">
                      {course.course_code}
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Badge 
                      className={`font-semibold shadow-sm cursor-pointer ${course.is_active ? 'bg-success text-success-foreground hover:bg-success/90 border-none' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-none'}`}
                      onClick={() => handleToggleActive(course.id)}
                    >
                      {course.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Floating Action Buttons */}
                  <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 bg-background/90 backdrop-blur hover:bg-background shadow-md text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin-courses/${course.id}/content`);
                      }}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Content
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="h-8 w-8 rounded-full bg-background/90 backdrop-blur hover:bg-background shadow-md text-primary"
                      onClick={() => handleOpenModal(course)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="h-8 w-8 rounded-full bg-background/90 backdrop-blur hover:bg-destructive hover:text-destructive-foreground shadow-md text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(course.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <CardHeader className="flex-1 pb-3">
                  <CardTitle className="text-xl line-clamp-1 leading-tight" title={course.title}>
                    {course.title}
                  </CardTitle>

                  {course.description && (
                    <CardDescription className="mt-2 line-clamp-2" title={course.description}>
                      {course.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex gap-2 flex-wrap mb-2 h-6 overflow-hidden">
                    {course.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs capitalize">
                        {tag.name}
                      </Badge>
                    ))}
                    {course.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{course.tags.length - 3}</Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/40 mt-auto">
                    <div className="flex items-center gap-1.5 font-medium">
                      <BookOpen className="h-4 w-4 text-primary/70" />
                      <span className="capitalize">{course.difficulty_level}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && courses.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
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
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
      
      {cropperSrc && (
        <ImageCropperModal
          isOpen={!!cropperSrc}
          onClose={() => setCropperSrc(null)}
          imageSrc={cropperSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={16 / 9}
          cropShape="rect"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteCourseId !== null} onOpenChange={(open) => !open && setDeleteCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}
