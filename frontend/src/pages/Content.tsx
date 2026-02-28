import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Play,
  Clock,
  Calendar,
  Upload,
  Search,
  Filter,
  Edit,
  Trash2,
  Lock,
  Unlock,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  CheckCircle,
} from 'lucide-react';

const mockWeeks = [
  {
    id: 'w1',
    weekNumber: 1,
    title: 'Python Basics',
    description: 'Core syntax and data types',
    videos: [
      { id: 1, title: 'Introduction to Python', description: 'Getting started with Python programming', duration: '45:00', thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400', isScheduled: false, isLocked: false },
      { id: 2, title: 'Variables and Data Types', description: 'Understanding Python variables', duration: '38:00', thumbnail: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400', isScheduled: false, isLocked: false },
      { id: 3, title: 'Control Flow Statements', description: 'If-else and loops in Python', duration: '52:00', thumbnail: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400', isScheduled: false, isLocked: false },
    ],
    test: {
      id: 't1',
      title: 'Week 1 Assessment: Python Basics',
      questions: 10,
    }
  },
  {
    id: 'w2',
    weekNumber: 2,
    title: 'Advanced Python',
    description: 'Object-Oriented Programming and File Handlers',
    videos: [
      { id: 5, title: 'Object-Oriented Programming', description: 'Classes and objects in Python', duration: '55:00', thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400', isScheduled: false, isLocked: true },
      { id: 6, title: 'File Handling', description: 'Reading and writing files', duration: '42:00', thumbnail: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400', isScheduled: false, isLocked: true },
    ],
    test: null
  }
];

const mockScheduled = [
  { id: 8, title: 'Advanced Python Webinar', description: 'Special session on advanced topics', duration: '90:00', thumbnail: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400', isScheduled: true, scheduledFor: 'Feb 5, 2026 at 2:00 PM', isLocked: false },
];

export default function Content() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [testType, setTestType] = useState<'text' | 'ipynb'>('text');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoCard = ({ video }: { video: any }) => (
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
      <CardContent className="p-4 flex flex-col justify-between flex-1">
        <div>
          <h3 className="font-semibold text-foreground line-clamp-1">{video.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
          
          {'scheduledFor' in video && (
            <p className="text-xs text-warning mt-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {video.scheduledFor}
            </p>
          )}
        </div>

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
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin-courses')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">Course Content</h1>
              <p className="mt-1 text-muted-foreground">Manage your weekly video content and assessments</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsWeekOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Week
            </Button>
            <Button variant="gradient" onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
          </div>
        </div>

        {/* Global Search & Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos and tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Content Tabs for Weeks */}
        <Tabs defaultValue={mockWeeks[0].id} className="space-y-6">
          <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto">
            {mockWeeks.map(week => (
              <TabsTrigger key={week.id} value={week.id} className="whitespace-nowrap">
                Week {week.weekNumber}: {week.title}
              </TabsTrigger>
            ))}
            <TabsTrigger value="scheduled">Scheduled Videos</TabsTrigger>
          </TabsList>

          {mockWeeks.map(week => (
            <TabsContent key={week.id} value={week.id} className="space-y-6 mt-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Week {week.weekNumber}: {week.title}</h2>
                  <p className="text-muted-foreground text-sm">{week.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsTestOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    {week.test ? 'Edit Test' : 'Add Weekly Test'}
                  </Button>
                </div>
              </div>

              {/* Videos Grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {week.videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>

              {/* Weekly Test Display Card */}
              <div className="mt-8 pt-8 border-t border-border">
                <h3 className="text-lg font-semibold mb-4">Weekly Assessment</h3>
                {week.test ? (
                  <Card className="shadow-sm border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{week.test.title}</CardTitle>
                          <CardDescription>{week.test.questions} Questions</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setIsTestOpen(true)}><Edit className="h-4 w-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/80 mt-2">
                        This test will be automatically unlocked when students complete the preceding videos for the week.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/20">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h4 className="font-medium text-foreground mb-1">No Assessment Configured</h4>
                    <p className="text-sm text-muted-foreground mb-4">Add a weekly test that students must pass to proceed to the next week.</p>
                    <Button variant="outline" onClick={() => setIsTestOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Weekly Test
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}

          <TabsContent value="scheduled" className="mt-4">
            <h2 className="text-xl font-bold text-foreground mb-6">Upcoming Scheduled Content</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mockScheduled.map((video) => (
                <VideoCard key={video.id} video={video as any} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Video Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
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
            
            {/* Week Selection instead of text input */}
            <div className="space-y-2">
              <Label>Select Week</Label>
              <Select defaultValue={mockWeeks[0].id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a week" />
                </SelectTrigger>
                <SelectContent>
                  {mockWeeks.map((week) => (
                    <SelectItem key={week.id} value={week.id}>
                      Week {week.weekNumber}: {week.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Add Week Modal */}
      <Dialog open={isWeekOpen} onOpenChange={setIsWeekOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Week</DialogTitle>
            <DialogDescription>Add a new module week for the course curriculum.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="weekTitle">Week Title</Label>
              <Input id="weekTitle" placeholder="e.g. Loops & Statements" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekDesc">Description (Optional)</Label>
              <Textarea id="weekDesc" placeholder="Brief outline of topics..." />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsWeekOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={() => setIsWeekOpen(false)}>Create Week</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Test Modal */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly Test Configuration</DialogTitle>
            <DialogDescription>Create a test that students must pass completing this week's content.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Test Title</Label>
              <Input defaultValue="Week Assessment" />
            </div>

            <div className="space-y-3">
              <Label>Question Format</Label>
              <div className="flex gap-2 p-1 bg-muted rounded-lg w-max">
                <Button 
                  variant={testType === 'text' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTestType('text')}
                  className="rounded-md"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Text Questions
                </Button>
                <Button 
                  variant={testType === 'ipynb' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTestType('ipynb')}
                  className="rounded-md"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload .ipynb File
                </Button>
              </div>
            </div>

            {testType === 'ipynb' ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/10">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Upload Jupyter Notebook (.ipynb)
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    The notebook text and cells will be converted to test questions. Upload your file to preview.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-muted p-3 border-b flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Question 1</h4>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      <span>Question Text</span>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary flex items-center h-5">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Add Image / Chart
                      </Button>
                    </Label>
                    <Textarea placeholder="Type your question here..." />
                  </div>
                  
                  {/* Options */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm">Multiple Choice Options</Label>
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="flex items-center gap-3">
                        <input type="radio" name="q1_correct" className="mt-1" />
                        <Input placeholder={`Option ${idx}`} className="h-9 flex-1" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-muted/30 p-3 border-t">
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Question
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">Changes are saved automatically</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsTestOpen(false)}>Cancel</Button>
              <Button variant="gradient" onClick={() => setIsTestOpen(false)}>Save Assessment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
