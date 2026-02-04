import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Users,
  GraduationCap,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Video,
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
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = user?.role === 'admin' 
    ? adminNavItems 
    : user?.role === 'teacher' 
    ? teacherNavItems 
    : studentNavItems;

  const NavContent = () => (
    <div className="flex h-full flex-col gradient-sidebar text-primary-foreground border-r border-border/60">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GraduationCap className="h-6 w-6" />
        </div>
        <span className="font-display text-xl font-bold text-foreground">
          EduLearn
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-6">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 h-11 transition-all duration-200',
                  isActive 
                    ? 'bg-primary/10 text-primary font-semibold shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border/60">
        <div className="flex items-center gap-3 rounded-xl bg-card/40 p-3 mb-3 border border-border/60 hover:bg-accent/40 transition-colors">
          <img
            src={user?.avatar}
            alt={user?.name}
            className="h-10 w-10 rounded-full ring-2 ring-background transition-all"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.name}
            </p>
            <p className="truncate text-xs text-muted-foreground capitalize">
              {user?.role}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/settings" className="flex-1" onClick={() => setIsMobileOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full bg-background border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 flex justify-center bg-background border border-border/60 rounded-md hover:bg-muted transition-colors">
            <ModeToggle />
          </div>
          <Button variant="ghost" size="sm" className="flex-1 bg-background border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="fixed left-4 top-4 z-50 rounded-lg bg-primary p-2 text-primary-foreground shadow-lg lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

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
          'fixed left-0 top-0 z-40 h-screen w-64 transform transition-transform duration-300 lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
