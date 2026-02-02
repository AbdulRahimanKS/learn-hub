import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Play,
  Clock,
  Calendar,
  Upload,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Video,
} from 'lucide-react';

const mockContent = {
  week1: [
    { id: 1, title: 'Introduction to Python', description: 'Getting started with Python programming', duration: '45:00', thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400', isScheduled: false, isLocked: false },
    { id: 2, title: 'Variables and Data Types', description: 'Understanding Python variables', duration: '38:00', thumbnail: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400', isScheduled: false, isLocked: false },
    { id: 3, title: 'Control Flow Statements', description: 'If-else and loops in Python', duration: '52:00', thumbnail: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400', isScheduled: false, isLocked: false },
    { id: 4, title: 'Functions and Modules', description: 'Creating reusable code', duration: '41:00', thumbnail: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400', isScheduled: false, isLocked: false },
  ],
  week2: [
    { id: 5, title: 'Object-Oriented Programming', description: 'Classes and objects in Python', duration: '55:00', thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400', isScheduled: false, isLocked: true },
    { id: 6, title: 'File Handling', description: 'Reading and writing files', duration: '42:00', thumbnail: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400', isScheduled: false, isLocked: true },
    { id: 7, title: 'Exception Handling', description: 'Error handling in Python', duration: '35:00', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400', isScheduled: false, isLocked: true },
  ],
  scheduled: [
    { id: 8, title: 'Advanced Python Webinar', description: 'Special session on advanced topics', duration: '90:00', thumbnail: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400', isScheduled: true, scheduledFor: 'Feb 5, 2026 at 2:00 PM', isLocked: false },
  ],
};

export default function Content() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const VideoCard = ({ video }: { video: typeof mockContent.week1[0] }) => (
    <Card className="shadow-card overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-video">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
        
        {video.isLocked && (
          <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center backdrop-blur-sm">
            <Lock className="h-8 w-8 text-primary-foreground" />
          </div>
        )}
        
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <Badge variant="secondary" className="bg-foreground/80 text-background">
            <Clock className="h-3 w-3 mr-1" />
            {video.duration}
          </Badge>
          {video.isScheduled && (
            <Badge className="bg-warning text-warning-foreground">
              <Calendar className="h-3 w-3 mr-1" />
              Scheduled
            </Badge>
          )}
        </div>

        <button className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          <Play className="h-6 w-6" />
        </button>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1">{video.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
        
        {'scheduledFor' in video && (
          <p className="text-xs text-warning mt-2 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {(video as { scheduledFor: string }).scheduledFor}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {video.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Course Content</h1>
            <p className="mt-1 text-muted-foreground">Manage your weekly video content</p>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Upload Video
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload New Video</DialogTitle>
                <DialogDescription>Add a new video to your course content</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Video Title</Label>
                  <Input id="title" placeholder="Enter video title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Enter video description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week">Week Number</Label>
                  <Input id="week" type="number" placeholder="1" />
                </div>
                <div className="space-y-2">
                  <Label>Video File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      MP4, WebM up to 500MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="scheduled" className="rounded border-border" />
                  <Label htmlFor="scheduled" className="text-sm">Schedule for later</Label>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                <Button variant="gradient">Upload Video</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="week1" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="week1">Week 1</TabsTrigger>
            <TabsTrigger value="week2">Week 2</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          </TabsList>

          <TabsContent value="week1">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mockContent.week1.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="week2">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mockContent.week2.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scheduled">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mockContent.scheduled.map((video) => (
                <VideoCard key={video.id} video={video as any} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
