import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Users,
  GraduationCap,
  MessageSquare,
  BarChart3,
  Video,
  Mail,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Library,
  PlayCircle,
  ClipboardList,
  UserCheck,
} from 'lucide-react';

// ─── Nav item type definitions ────────────────────────────────────────────────

interface NavLinkDef {
  type?: 'link';
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavGroupDef {
  type: 'group';
  icon: React.ElementType;
  label: string;
  /** All child paths; used to detect whether the group should appear active. */
  paths: string[];
  children: NavLinkDef[];
}

type NavItemDef = NavLinkDef | NavGroupDef;

// ─── Attendance group (Admin + Teacher only) ──────────────────────────────────

const attendanceGroup: NavGroupDef = {
  type: 'group',
  icon: ClipboardList,
  label: 'Attendance',
  paths: ['/attendance/dashboard', '/attendance/batch', '/attendance/student'],
  children: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/attendance/dashboard' },
    { icon: Users, label: 'Batch Attendance', path: '/attendance/batch' },
    { icon: UserCheck, label: 'Student Attendance', path: '/attendance/student' },
  ],
};

// ─── Role-specific nav definitions ───────────────────────────────────────────

const adminNavItems: NavItemDef[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Library, label: 'Courses', path: '/admin-courses' },
  { icon: GraduationCap, label: 'Batches', path: '/batches' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
  attendanceGroup,
  { icon: Video, label: 'Live Sessions', path: '/live-sessions' },
  { icon: PlayCircle, label: 'Special Sessions', path: '/special-sessions' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: Mail, label: 'Email Configuration', path: '/email-config' },
];

const teacherNavItems: NavItemDef[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Library, label: 'Courses', path: '/admin-courses' },
  { icon: GraduationCap, label: 'My Batches', path: '/batches' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
  attendanceGroup,
  { icon: Video, label: 'Live Sessions', path: '/live-sessions' },
  { icon: PlayCircle, label: 'Special Sessions', path: '/special-sessions' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
];

const studentNavItems: NavItemDef[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'My Courses', path: '/courses' },
  { icon: ClipboardCheck, label: 'Assessments', path: '/assessments' },
  { icon: BarChart3, label: 'My Progress', path: '/progress' },
  { icon: Video, label: 'Live Sessions', path: '/live-sessions' },
  { icon: PlayCircle, label: 'Special Sessions', path: '/special-sessions' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // On mobile the sidebar is always fully expanded; isCollapsed applies desktop only.
  const realCollapsed = isCollapsed && !isMobileOpen;

  const navItems =
    user?.role === 'admin'
      ? adminNavItems
      : user?.role === 'teacher'
      ? teacherNavItems
      : studentNavItems;

  // Open any group whose child is the current page on first mount.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    navItems.forEach((item) => {
      if (item.type === 'group') {
        if (item.paths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
          s.add(item.label);
        }
      }
    });
    return s;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col text-foreground relative">
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-border/40 transition-all',
          realCollapsed ? 'justify-center' : 'gap-3',
        )}
      >
        <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          {!realCollapsed && (
            <span className="font-display font-bold text-lg truncate">EduLearn</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          // ── Group item ──────────────────────────────────────────────────────
          if (item.type === 'group') {
            const isGroupActive = item.paths.some(
              (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
            );
            const isOpen = openGroups.has(item.label);

            // Collapsed desktop: show group icon only, clicking navigates to first child.
            if (realCollapsed) {
              return (
                <Link
                  key={item.label}
                  to={item.children[0].path}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <div className="group relative flex items-center mb-1">
                    <div
                      className={cn(
                        'flex items-center w-full transition-all duration-200 rounded-md px-3 py-2 cursor-pointer justify-center',
                        isGroupActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isGroupActive
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {item.label}
                    </div>
                  </div>
                </Link>
              );
            }

            // Expanded: collapsible header + indented children.
            return (
              <div key={item.label} className="mb-1">
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'flex items-center w-full transition-all duration-200 rounded-md px-3 py-2 cursor-pointer gap-3',
                    isGroupActive && !isOpen
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isGroupActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="truncate text-sm flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180',
                      isGroupActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                </button>

                {/* Children */}
                {isOpen && (
                  <div className="ml-4 mt-0.5 border-l border-border/40 pl-3 space-y-0.5">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setIsMobileOpen(false)}
                        >
                          <div
                            className={cn(
                              'flex items-center w-full transition-all duration-200 rounded-md px-3 py-1.5 cursor-pointer gap-2.5',
                              isChildActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <child.icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isChildActive
                                  ? 'text-primary'
                                  : 'text-muted-foreground',
                              )}
                            />
                            <span className="truncate text-sm">{child.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // ── Regular link item (original behaviour preserved exactly) ────────
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
              <div className="group relative flex items-center">
                <div
                  className={cn(
                    'flex items-center w-full transition-all duration-200 mb-1 rounded-md px-3 py-2 cursor-pointer',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    realCollapsed ? 'justify-center' : 'justify-start gap-3',
                  )}
                  title={realCollapsed ? item.label : undefined}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
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
          className="fixed left-4 top-4 z-50 rounded-lg bg-primary h-10 w-10 flex items-center justify-center text-primary-foreground shadow-lg lg:hidden"
          onClick={() => setIsMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen transform transition-all duration-300 border-r border-border/40 gradient-sidebar shadow-sm',
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
          !isMobileOpen && (isCollapsed ? 'lg:w-20' : 'lg:w-64'),
        )}
      >
        <SidebarContent />

        {/* Desktop collapse toggle (floating) */}
        {!isMobileOpen && (
          <button
            onClick={toggleCollapse}
            className="absolute -right-4 top-6 z-50 hidden lg:flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
      </aside>
    </>
  );
}
