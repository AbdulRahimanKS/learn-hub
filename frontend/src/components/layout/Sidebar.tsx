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
  ChevronLeft,
  ChevronRight,
  Library,
} from 'lucide-react';

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Library, label: 'Courses', path: '/admin-courses' },
  { icon: GraduationCap, label: 'Batches', path: '/batches' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: Video, label: 'Live Sessions', path: '/live-sessions' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: Mail, label: 'Email Configuration', path: '/email-config' },
];

const teacherNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Library, label: 'Courses', path: '/admin-courses' },
  { icon: GraduationCap, label: 'My Batches', path: '/batches' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
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

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // On mobile, if the menu is open, we always want the full expanded view.
  // We only respect isCollapsed on desktop (when isMobileOpen is false).
  const realCollapsed = isCollapsed && !isMobileOpen;

  const navItems = user?.role === 'admin' 
    ? adminNavItems 
    : user?.role === 'teacher' 
    ? teacherNavItems 
    : studentNavItems;

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-background text-foreground relative">
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-border/40 transition-all",
        realCollapsed ? "justify-center" : "gap-3"
      )}>
        <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          {!realCollapsed && (
            <span className="font-display font-bold text-lg truncate">
              EduLearn
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
              <div key={item.path} className="group relative flex items-center">
                 <div
                  className={cn(
                    'flex items-center w-full transition-all duration-200 mb-1 rounded-md px-3 py-2 cursor-pointer',
                     isActive 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                     realCollapsed ? 'justify-center' : 'justify-start gap-3'
                  )}
                  title={realCollapsed ? item.label : undefined}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!realCollapsed && <span className="truncate text-sm">{item.label}</span>}
                </div>
                {/* Tooltip for collapsed state */}
                {realCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        {item.label}
                    </div>
                )}
              </div>
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
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen transform transition-all duration-300 border-r border-border/40 bg-background shadow-sm',
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
          !isMobileOpen && (isCollapsed ? 'lg:w-20' : 'lg:w-64')
        )}
      >
        <SidebarContent />
        
        {/* Desktop Toggle Button (Floating) */}
        {!isMobileOpen && (
          <button
            onClick={toggleCollapse}
            className="absolute -right-3 top-6 z-50 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronLeft className="h-3 w-3 text-muted-foreground" />}
          </button>
        )}
      </aside>
    </>
  );
}
