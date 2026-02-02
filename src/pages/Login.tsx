import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '@/types';
import { GraduationCap, Shield, User, BookOpen, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const success = await login(email, password, selectedRole);
    
    if (success) {
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  const roleConfig = {
    admin: {
      icon: Shield,
      title: 'Administrator',
      description: 'Manage teachers, students, and content',
      color: 'from-primary to-purple-600',
    },
    teacher: {
      icon: BookOpen,
      title: 'Teacher',
      description: 'Create content and evaluate students',
      color: 'from-accent to-blue-500',
    },
    student: {
      icon: User,
      title: 'Student',
      description: 'Access courses and assessments',
      color: 'from-success to-emerald-500',
    },
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <h1 className="font-display text-4xl font-bold text-white">EduLearn</h1>
          </div>
          
          <h2 className="font-display text-5xl font-bold text-white leading-tight mb-6">
            Transform Your
            <br />
            Learning Journey
          </h2>
          
          <p className="text-xl text-white/80 max-w-md">
            Access world-class courses, interactive assessments, and live sessions. 
            Join thousands of learners achieving their goals.
          </p>
          
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { value: '50+', label: 'Courses' },
              { value: '1000+', label: 'Students' },
              { value: '95%', label: 'Success Rate' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-3 lg:hidden mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-foreground">EduLearn</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="font-display text-3xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-2 text-muted-foreground">Sign in to continue your learning journey</p>
          </div>

          <Card className="border-0 shadow-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl">Choose your role</CardTitle>
              <CardDescription>Select how you want to sign in</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="student" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Student</span>
                  </TabsTrigger>
                  <TabsTrigger value="teacher" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Teacher</span>
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </TabsTrigger>
                </TabsList>

                {Object.entries(roleConfig).map(([role, config]) => (
                  <TabsContent key={role} value={role} className="mt-0">
                    <div className={`p-4 rounded-lg bg-gradient-to-r ${config.color} mb-6`}>
                      <div className="flex items-center gap-3">
                        <config.icon className="h-6 w-6 text-white" />
                        <div>
                          <h3 className="font-semibold text-white">{config.title}</h3>
                          <p className="text-sm text-white/80">{config.description}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Demo: Enter any credentials to sign in
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
