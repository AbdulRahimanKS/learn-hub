import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Bell, KeyRound, LogOut, Sun, Moon, Search, Check } from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/notifications-api';
import { formatDistanceToNow } from 'date-fns';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleTheme = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getNotifications();
      if (res.success) {
        setNotifications(res.data);
      }
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await notificationsApi.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (err) {}
    }
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch(err) {}
  };

  const getNotificationColor = (type: string) => {
    switch(type) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'info':
      default: return 'bg-blue-500';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/40 bg-background/80 px-6 backdrop-blur-md transition-all">
      {/* Left Section: Search */}
      <div className="flex flex-1 items-center gap-4 ml-12 lg:ml-0">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search"
            className="w-full bg-background pl-9 md:w-[300px] lg:w-[400px] rounded-xl focus-visible:ring-primary/20"
          />
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full border border-border focus-visible:ring-0 focus-visible:ring-offset-0">
              <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive border-2 border-background"></span>
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel className="font-normal flex justify-between items-center">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  You have {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); markAllRead(); }}>
                  <Check className="h-3 w-3 mr-1" /> Mark all read
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-y-auto">
               {notifications.length === 0 ? (
                 <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
               ) : (
                 notifications.slice(0, 5).map(notif => (
                   <DropdownMenuItem 
                     key={notif.id} 
                     className={`cursor-pointer flex flex-col items-start gap-1 p-3 ${!notif.is_read ? 'bg-muted/30' : ''}`}
                     onClick={() => handleNotificationClick(notif)}
                   >
                     <div className="flex items-center gap-2 w-full">
                       {!notif.is_read && <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getNotificationColor(notif.notification_type)}`} />}
                       <span className={`font-medium text-sm ${!notif.is_read ? '' : 'text-muted-foreground'}`}>{notif.title}</span>
                       <span className="ml-auto text-xs text-muted-foreground">
                         {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                       </span>
                     </div>
                     <p className={`text-xs line-clamp-2 pl-4 ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                       {notif.message}
                     </p>
                   </DropdownMenuItem>
                 ))
               )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-center justify-center text-primary font-medium focus:text-primary" onClick={() => navigate('/notifications')}>
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={user?.avatar && !user.avatar.includes('dicebear') ? user.avatar : undefined} alt={user?.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile Management</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings?tab=security')}>
              <KeyRound className="mr-2 h-4 w-4" />
              <span>Change Password</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <div className="flex items-center justify-between px-2 py-1.5 local-stop-propagation" onClick={(e) => e.stopPropagation()}>
               <div className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <Label htmlFor="theme-mode" className="text-sm cursor-pointer">Dark Mode</Label>
               </div>
               <Switch 
                  id="theme-mode" 
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
               />
            </div>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
