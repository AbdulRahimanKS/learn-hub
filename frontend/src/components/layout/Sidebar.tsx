import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Users,
  GraduationCap,
  Calendar,
  MessageSquare,
  BarChart3,
  Video,
  Mail,
  Menu,
  X,
} from 'lucide-react';

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'Content', path: '/content' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: GraduationCap, label: 'Batches', path: '/batches' },
  { icon: Video, label: 'Live Sessions', path: '/live-sessions' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: Mail, label: 'Email Configuration', path: '/email-config' },
];

const teacherNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'Content', path: '/content' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: GraduationCap, label: 'My Batches', path: '/batches' },
  { icon: Video, label: 'Live Sessions', path: '/live-sessions' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
];

const studentNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'My Courses', path: '/courses' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: Calendar, label: 'Schedule', path: '/schedule' },
  { icon: BarChart3, label: 'My Progress', path: '/progress' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
];

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = user?.role === 'admin' 
    ? adminNavItems 
    : user?.role === 'teacher' 
    ? teacherNavItems 
    : studentNavItems;

  const NavContent = () => (
    <div className="flex h-full flex-col gradient-sidebar text-primary-foreground border-r border-border/40">
      {/* Logo */}
      <div className={cn(
        "flex items-center justify-between px-6 py-6 transition-all"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold text-foreground truncate">
            EduLearn
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start transition-all duration-200 mb-1 gap-3 h-11 px-3',
                  isActive 
                    ? 'bg-primary/10 text-primary font-semibold shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
                title={item.label}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      {!isMobileOpen && (
        <button
          className="fixed left-4 top-4 z-50 rounded-lg bg-primary p-2 text-primary-foreground shadow-lg lg:hidden"
          onClick={() => setIsMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 transform transition-all duration-300 border-r border-border/40 bg-background',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
