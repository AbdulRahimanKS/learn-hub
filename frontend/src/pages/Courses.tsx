import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Clock,
  Lock,
  CheckCircle,
  Calendar,
  Video,
  Award,
} from 'lucide-react';

const courseContent = {
  week1: {
    title: 'Python Basics',
    description: 'Introduction to Python programming fundamentals',
    videos: [
      { id: 1, title: 'Introduction to Python', duration: '45:00', completed: true, thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400' },
      { id: 2, title: 'Variables and Data Types', duration: '38:00', completed: true, thumbnail: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400' },
      { id: 3, title: 'Control Flow Statements', duration: '52:00', completed: true, thumbnail: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400' },
      { id: 4, title: 'Functions and Modules', duration: '41:00', completed: true, thumbnail: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400' },
    ],
    testCompleted: true,
    testScore: 85,
  },
  week2: {
    title: 'Advanced Python',
    description: 'Object-oriented programming and file handling',
    videos: [
      { id: 5, title: 'Object-Oriented Programming', duration: '55:00', completed: true, thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400' },
      { id: 6, title: 'File Handling', duration: '42:00', completed: true, thumbnail: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400' },
      { id: 7, title: 'Exception Handling', duration: '35:00', completed: false, thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400' },
      { id: 8, title: 'Regular Expressions', duration: '48:00', completed: false, thumbnail: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=400' },
    ],
    testCompleted: false,
    testScore: null,
  },
  week3: {
    title: 'Data Structures',
    description: 'Working with complex data structures',
    videos: [
      { id: 9, title: 'Lists and Tuples Deep Dive', duration: '50:00', completed: false, thumbnail: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=400' },
      { id: 10, title: 'Dictionaries and Sets', duration: '45:00', completed: false, thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400' },
      { id: 11, title: 'Stack and Queue', duration: '40:00', completed: false, thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400' },
    ],
    testCompleted: false,
    testScore: null,
    isLocked: true,
  },
};



export default function Courses() {
  const [selectedWeek, setSelectedWeek] = useState('week2');

  const currentWeek = courseContent[selectedWeek as keyof typeof courseContent];
  const isLocked = 'isLocked' in currentWeek && currentWeek.isLocked;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Courses</h1>
          <p className="mt-1 text-muted-foreground">Continue learning at your own pace</p>
        </div>

        {/* Course Overview Card */}
        <Card className="shadow-card gradient-primary text-primary-foreground overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-primary-foreground/20 text-primary-foreground mb-3">
                  Python Fundamentals
                </Badge>
                <h2 className="text-2xl font-bold">Continue where you left off</h2>
                <p className="text-primary-foreground/80 mt-2">
                  Week 2: Exception Handling
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span>10/15 videos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    <span>1/3 tests passed</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <p className="text-4xl font-bold">67%</p>
                  <p className="text-primary-foreground/80">Complete</p>
                </div>
                <Button variant="hero-outline" size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Continue Learning
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Week Navigation */}
        <Tabs value={selectedWeek} onValueChange={setSelectedWeek}>
          <TabsList className="bg-muted/50 h-auto p-1 flex-wrap">
            {Object.entries(courseContent).map(([key, week]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-background px-4 py-2"
                disabled={'isLocked' in week && week.isLocked}
              >
                <div className="flex items-center gap-2">
                  {'isLocked' in week && week.isLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : week.testCompleted ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : null}
                  <span className="capitalize">{key.replace('week', 'Week ')}</span>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(courseContent).map(([key, week]) => (
            <TabsContent key={key} value={key} className="mt-6">
              <Card className="shadow-card mb-6">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>{week.title}</CardTitle>
                      <CardDescription>{week.description}</CardDescription>
                    </div>
                    {week.testCompleted && (
                      <Badge variant="default" className="bg-success w-fit">
                        <Award className="h-4 w-4 mr-1" />
                        Test Score: {week.testScore}%
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLocked ? (
                    <div className="text-center py-12">
                      <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-foreground mb-2">Week Locked</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Complete the previous week's videos and pass the weekly test with at least 70% 
                        to unlock this week's content.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {week.videos.map((video, index) => (
                        <div
                          key={video.id}
                          className="group relative rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="aspect-video relative">
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
                            
                            {video.completed && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="h-6 w-6 text-success fill-success-foreground" />
                              </div>
                            )}

                            <button className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-3 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                              <Play className="h-5 w-5" />
                            </button>

                            <div className="absolute bottom-2 left-2 right-2">
                              <Badge variant="secondary" className="bg-foreground/80 text-background text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {video.duration}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-foreground text-sm line-clamp-2">{video.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {!isLocked && !week.testCompleted && (
                <Card className="shadow-card border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">Weekly Assessment</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Complete all videos to unlock the weekly test. Score 70% or higher to proceed.
                        </p>
                      </div>
                      <Button
                        variant="gradient"
                        disabled={week.videos.some(v => !v.completed)}
                      >
                        {week.videos.some(v => !v.completed) ? (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Locked
                          </>
                        ) : (
                          'Start Test'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>


      </div>
    </DashboardLayout>
  );
}
