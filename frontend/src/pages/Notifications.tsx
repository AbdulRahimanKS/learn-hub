import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Check, Trash2, Bell, AlertCircle } from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/notifications-api';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchNotifications = async (page = currentPage) => {
    try {
      const res = await notificationsApi.getNotifications({ page, page_size: 10, paginate: true });
      if (res.success) {
        // Handle both paginated and non-paginated responses for safety
        const data = res.data;
        if ('data' in data && Array.isArray(data.data)) {
          setNotifications(data.data);
          setTotalPages(data.total_pages || 1);
          setCurrentPage(data.current_page || 1);
        } else if (Array.isArray(data)) {
          setNotifications(data);
          setTotalPages(1);
        }
      }
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(currentPage), 60000); // 1-min polling
    return () => clearInterval(interval);
  }, [currentPage]);

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
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">Stay updated with your latest alerts and messages.</p>
          </div>
          {notifications.some(n => !n.is_read) && (
            <Button variant="outline" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-2" /> Mark all as read
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
               <Bell className="h-10 w-10 animate-pulse mb-4 text-primary/40" />
               <p>Loading notifications...</p>
             </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-lg font-medium text-foreground">You're all caught up!</p>
              <p className="text-sm">There are no new notifications right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-5 transition-colors cursor-pointer hover:bg-muted/50 ${!notif.is_read ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm text-white ${getNotificationColor(notif.notification_type)}`}
                      >
                        <AlertCircle className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-semibold ${!notif.is_read ? 'text-foreground' : 'text-foreground/80'}`}>
                          {notif.title}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-sm ${!notif.is_read ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                        {notif.message}
                      </p>
                      {notif.action_url && (
                        <p className="text-xs text-primary font-medium mt-2">Click to view details &rarr;</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && notifications.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm font-medium text-muted-foreground px-4">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
