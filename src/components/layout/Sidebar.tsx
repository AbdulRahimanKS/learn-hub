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
    <div className="flex h-full flex-col gradient-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary/20">
          <GraduationCap className="h-6 w-6 text-sidebar-foreground" />
        </div>
        <span className="font-display text-xl font-bold text-sidebar-foreground">
          EduLearn
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
              <Button
                variant={isActive ? 'sidebar-active' : 'sidebar'}
                className={cn(
                  'w-full justify-start gap-3 h-11',
                  isActive && 'shadow-md'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border/30 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/20 p-3">
          <img
            src={user?.avatar}
            alt={user?.name}
            className="h-10 w-10 rounded-full ring-2 ring-sidebar-foreground/20"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70 capitalize">
              {user?.role}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link to="/settings" className="flex-1" onClick={() => setIsMobileOpen(false)}>
            <Button variant="sidebar" size="sm" className="w-full">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="sidebar" size="sm" className="flex-1" onClick={logout}>
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
