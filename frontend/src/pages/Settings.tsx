import * as React from "react"
import { useSearchParams } from 'react-router-dom';
import { format } from "date-fns"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import {
  User,
  Bell,
  Lock,
  Palette,
  Save,
  Upload,
  CalendarIcon,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { getUserProfile, updateUserProfile } from '@/lib/user-api';
import { changePassword } from '@/lib/auth-api';
import { cn } from "@/lib/utils"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ImageCropperModal } from '@/components/ImageCropperModal';

export default function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'profile';
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(
    user?.avatar && !user.avatar.includes('dicebear') ? user.avatar : undefined
  );
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null | undefined>(undefined);
  const [cropperSrc, setCropperSrc] = React.useState<string | null>(null);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAvatarError(null);
    
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setAvatarError("Please upload a valid JPG, PNG, or WebP image.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // Revert back to 2MB prior to crop
        setAvatarError("File size must be less than 2MB.");
        return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      setCropperSrc(objectUrl);
      
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (croppedFile: File, objectUrl: string) => {
    setAvatarFile(croppedFile);
    setAvatarPreview(objectUrl);
  };

  const handleChangePhotoClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-muted-foreground">Manage your account preferences</p>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit">
            <TabsTrigger value="profile" className="gap-2 w-32">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 w-32">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                     <AvatarImage src={avatarPreview} alt={user?.name} className="object-cover" />
                     <AvatarFallback className="bg-muted">
                        <User className="h-8 w-8 text-muted-foreground/50" />
                     </AvatarFallback>
                  </Avatar>
                  <div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/jpeg, image/png" 
                      onChange={handleFileChange}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleChangePhotoClick} className="hover:bg-background hover:text-foreground border-input text-muted-foreground">
                        <Upload className="h-4 w-4 mr-2" />
                        Change Photo
                      </Button>
                      {avatarPreview && (
                        <Button 
                          variant="ghost" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setAvatarPreview(undefined);
                            setAvatarError(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                            setAvatarFile(null);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {avatarError ? (
                        <p className="text-sm font-medium text-destructive mt-2">
                          {avatarError}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground mt-2">
                          JPG, PNG, WebP. Max 2MB.
                        </p>
                    )}
                  </div>
                </div>

                <ProfileForm user={user} avatarFile={avatarFile} setAvatarPreview={setAvatarPreview} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SecurityForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Cropper Modal */}
      {cropperSrc && (
        <ImageCropperModal
          isOpen={!!cropperSrc}
          onClose={() => setCropperSrc(null)}
          imageSrc={cropperSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </DashboardLayout>
  );
}



const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email(),
  phone: z.string().min(1, {
    message: "Phone number is required",
  }).refine((val) => isValidPhoneNumber(val), {
    message: "Please enter a valid phone number",
  }),
  address: z.string().optional(),
  dob: z.date().optional(),
  bio: z.string().max(160).optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

function ProfileForm({ user, avatarFile, setAvatarPreview }: { user: any, avatarFile?: File | null, setAvatarPreview: (url: string | undefined) => void }) {
  const { toast } = useToast()
  const { updateUser } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      bio: "",
      dob: undefined, 
    },
  })

  // Fetch profile data on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await getUserProfile();
        
        // Populate form with fetched data
        form.reset({
          name: profileData.fullname || "",
          email: profileData.email || "",
          phone: `${profileData.phone_number_code || ''}${profileData.contact_number || ''}`,
          address: profileData.profile.address || "",
          bio: profileData.profile.bio || "",
          dob: profileData.profile.date_of_birth ? new Date(profileData.profile.date_of_birth) : undefined,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load profile data. Please try again.",
        })
      }
    };

    fetchProfile();
  }, [form, toast]);

  async function onSubmit(data: ProfileFormValues) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Prepare API payload
      const parsedPhone = data.phone ? parsePhoneNumber(data.phone) : undefined;
      
      // Prepare API payload
      const updateData = {
        fullname: data.name,
        contact_number: parsedPhone ? parsedPhone.nationalNumber : data.phone,
        phone_number_code: parsedPhone ? `+${parsedPhone.countryCallingCode}` : undefined,
        address: data.address,
        bio: data.bio,
        date_of_birth: data.dob ? format(data.dob, "yyyy-MM-dd") : undefined,
        profile_picture: avatarFile,
      };

      const updatedProfile = await updateUserProfile(updateData);
      
      // Update global user context (e.g. for Header name and avatar)
      updateUser({
        name: updatedProfile.fullname,
        fullname: updatedProfile.fullname,
        avatar: updatedProfile.profile?.profile_picture || '',
      });

      // Update local avatar preview with server URL
      if (updatedProfile.profile?.profile_picture) {
        setAvatarPreview(updatedProfile.profile.profile_picture);
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
        variant: "success",
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update profile",
      })
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" {...field} disabled className="!bg-background !text-muted-foreground !border-input !opacity-100 cursor-not-allowed" />
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
                        countries={['IN']} 
                        countryCallingCodeEditable={false}
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
             <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, City, Country" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal hover:bg-background hover:text-foreground border-input text-foreground",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        captionLayout="dropdown-buttons"
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  placeholder="Tell us a little bit about yourself"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" variant="gradient" disabled={isSubmitting}>
           <Save className="h-4 w-4 mr-2" />
           {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </Form>
  )
}

const securityFormSchema = z.object({
  currentPassword: z.string().min(1, {
    message: "Current password is required.",
  }),
  newPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  confirmPassword: z.string().min(1, {
     message: "Please confirm your password.",
  }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type SecurityFormValues = z.infer<typeof securityFormSchema>

function SecurityForm() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const form = useForm<SecurityFormValues>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(data: SecurityFormValues) {
    setIsSubmitting(true)
    try {
      await changePassword({
        current_password: data.currentPassword,
        new_password: data.newPassword,
        confirm_password: data.confirmPassword,
      })
      
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully",
        variant: "success",
        duration: 3000,
      })
      
      // Reset form after successful password change
      form.reset()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to change password",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" variant="gradient" disabled={isSubmitting}>
            <Lock className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </Form>
  )
}
