import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Check, Bell, Loader2, Info, CircleCheck, TriangleAlert, CircleX } from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/notifications-api';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 10;

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchNotifications = async (page: number = currentPage) => {
    try {
      const res = await notificationsApi.getNotifications({ page, page_size: PAGE_SIZE, paginate: true });
      if (res.success && res.data !== undefined) {
        const body = res as { data: Notification[]; total_pages?: number; current_page?: number; total_items?: number };
        const list = Array.isArray(body.data) ? body.data : [];
        setNotifications(list);
        setTotalPages(body.total_pages ?? 1);
        setCurrentPage(body.current_page ?? 1);
        setTotalItems(body.total_items ?? list.length);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(currentPage);
    const interval = setInterval(() => fetchNotifications(currentPage), 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when page changes; interval uses current page
  }, [currentPage]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await notificationsApi.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch {
        // ignore
      }
    }
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'success': return { icon: CircleCheck, iconClass: 'text-emerald-600 dark:text-emerald-500' };
      case 'warning': return { icon: TriangleAlert, iconClass: 'text-amber-600 dark:text-amber-500' };
      case 'error': return { icon: CircleX, iconClass: 'text-red-600 dark:text-red-500' };
      case 'info':
      default: return { icon: Info, iconClass: 'text-muted-foreground' };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Notifications</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">Your notification history.</p>
          </div>
          {notifications.some(n => !n.is_read) && (
            <Button variant="outline" onClick={markAllRead} size="sm" className="h-9 sm:h-10 shrink-0 text-xs sm:text-sm">
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" /> Mark all as read
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64" aria-busy="true" aria-label="Loading">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-muted-foreground">
              <div className="bg-muted/50 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 sm:mb-5 ring-4 ring-muted">
                <Bell className="h-8 w-8 sm:h-10 sm:h-10 opacity-60" />
              </div>
              <p className="text-base sm:text-lg font-semibold text-foreground">You're all caught up</p>
              <p className="text-xs sm:text-sm mt-1">New alerts and updates will appear here.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/60">
                {notifications.map((notif) => {
                  const style = getNotificationStyle(notif.notification_type);
                  const Icon = style.icon;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`group flex gap-3 sm:gap-4 p-4 sm:p-5 transition-colors cursor-pointer hover:bg-muted/40 ${!notif.is_read ? 'bg-muted/30' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-muted/50 ${style.iconClass}`}>
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-semibold text-sm sm:text-base ${!notif.is_read ? 'text-foreground' : 'text-foreground/85'}`}>
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <span className="inline-flex h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden />
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className={`text-sm mt-1 ${!notif.is_read ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                          {notif.message}
                        </p>
                        {notif.action_url && (
                          <p className="text-xs text-primary font-medium mt-2 group-hover:underline">View details &rarr;</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-4 bg-muted/20 border-t border-border/60">
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
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
