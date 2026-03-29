import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Send, Users, MessageSquare, Search, Paperclip, Download, Loader2, X } from 'lucide-react';
import { chatApi, ChatMessage } from '@/lib/chat-api';
import { chatSocket } from '@/lib/chat-socket';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface Batch {
  id: number;
  name: string;
  unread_count?: number;
  course?: number;
  course_name?: string;
}

export default function Chat() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Input states
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Loading and Pagination
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [batchesPage, setBatchesPage] = useState(1);
  const [hasMoreBatches, setHasMoreBatches] = useState(false);

  // References
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBatches = async (pageNum = 1, append = false) => {
    setIsLoadingBatches(true);
    try {
      const res = await chatApi.getBatches(pageNum, searchQuery);
      const batchResults = res.data || [];
      
      if (append) {
        setBatches(prev => [...prev, ...batchResults]);
      } else {
        setBatches(batchResults);
        if (batchResults.length > 0 && !selectedBatch) {
          setSelectedBatch(batchResults[0]);
        }
      }
      
      setHasMoreBatches(!!res.next);
      setBatchesPage(pageNum);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // Load Batches
  useEffect(() => {
    // Add debounce for search
    const timer = setTimeout(() => {
      fetchBatches(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadMoreBatches = () => {
    if (hasMoreBatches && !isLoadingBatches) {
      fetchBatches(batchesPage + 1, true);
    }
  };

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      loadMoreBatches();
    }
  };

  // Load Messages and bind Websocket
  useEffect(() => {
    if (!selectedBatch) return;

    chatSocket.connect(selectedBatch.id);

    const handleNewMessage = (msg: ChatMessage) => {
      setMessages(prev => {
        // Prevent duplicates
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Scroll to bottom
      setTimeout(() => {
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          } else {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
          }
        }
      }, 100);
    };

    const unsubscribe = chatSocket.subscribe(handleNewMessage);

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await chatApi.getMessages(selectedBatch.id, 1);
        
        const messageResults = Array.isArray(res.data) ? [...res.data].reverse() : [];
        
        setMessages(messageResults); // API returns newest first, we reverse to display chronologically
        setHasMore(!!res.next);
        setPage(1);

        setTimeout(() => {
          if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              viewport.scrollTop = viewport.scrollHeight;
            } else {
              scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            }
          }
        }, 100);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();

    // Mark as read when entering batch or receiving messages while in it
    const markRead = async () => {
      try {
        await chatApi.markAsRead(selectedBatch.id);
        // Clear unread count locally for this batch
        setBatches(current => 
          current.map(b => b.id === selectedBatch.id ? { ...b, unread_count: 0 } : b)
        );
      } catch (err) {
        console.error('Failed to mark messages as read', err);
      }
    };
    
    markRead();

    return () => {
      unsubscribe();
      chatSocket.disconnect();
    };
  }, [selectedBatch]);

  const loadMoreMessages = async () => {
    if (!selectedBatch || isLoadingMessages || !hasMore) return;
    
    // Preserve scroll position
    const scrollNode = (scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement) || scrollAreaRef.current;
    const oldScrollHeight = scrollNode ? scrollNode.scrollHeight : 0;

    setIsLoadingMessages(true);
    try {
      const nextPage = page + 1;
      const res = await chatApi.getMessages(selectedBatch.id, nextPage);
      const olderMessages = Array.isArray(res.data) ? [...res.data].reverse() : [];
      
      setMessages(prev => [...olderMessages, ...prev]);
      setHasMore(!!res.next);
      setPage(nextPage);

      // Adjust scroll to maintain position relative to the old content
      setTimeout(() => {
        if (scrollNode) {
          scrollNode.scrollTop = scrollNode.scrollHeight - oldScrollHeight;
        }
      }, 0);
    } catch (err) {
      console.error('Failed to load older messages', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop === 0) {
      loadMoreMessages();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !file) return;
    if (!selectedBatch) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await chatApi.sendMessage(
        selectedBatch.id, 
        message, 
        file || undefined,
        (progressEvent) => {
          if (progressEvent.total) {
            const currentProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(currentProgress);
          }
        }
      );
      
      // Clear inputs
      setMessage('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert(err?.response?.data?.message || 'Failed to send message/file. Check size limit.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed, using fallback:', err);
      // Fallback to opening in a new tab if fetch fails (e.g. CORS)
      window.open(url, '_blank');
    }
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { [key: string]: ChatMessage[] } = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;

    messages.forEach(msg => {
      const msgDate = new Date(msg.sent_at);
      const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate()).getTime();
      
      let groupLabel = '';
      if (msgDay === today) groupLabel = 'Today';
      else if (msgDay === yesterday) groupLabel = 'Yesterday';
      else {
        groupLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(msgDate);
      }

      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push(msg);
    });

    return groups;
  };

  const groupedMessages = groupMessagesByDate();

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <div className="flex flex-col h-full gap-6 lg:flex-row">
          {/* Sidebar - Batch List */}
          <Card className="shadow-card flex h-full min-h-0 flex-shrink-0 flex-col lg:max-h-full lg:w-80">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Batch Chats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 overflow-hidden flex flex-col">
              <div className="relative mb-3 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {/* Native scroll so overflow + onScroll (load more) work reliably; Radix ScrollArea scrolls an inner viewport */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
                onScroll={handleSidebarScroll}
              >
                {isLoadingBatches ? (
                  <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : batches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No batches found.</p>
                ) : (
                  <div className="space-y-2">
                    {batches.map((batch) => (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => setSelectedBatch(batch)}
                        title={batch.name}
                        className={cn(
                          'w-full min-w-0 max-w-full overflow-hidden flex items-center gap-2 p-3 rounded-lg transition-colors text-left',
                          selectedBatch?.id === batch.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="flex flex-1 min-w-0 items-center gap-3 overflow-hidden">
                          <div className={cn(
                            'h-10 w-10 shrink-0 rounded-full flex items-center justify-center',
                            selectedBatch?.id === batch.id
                              ? 'bg-primary-foreground/20'
                              : 'bg-primary/10'
                          )}>
                            <MessageSquare className={cn(
                              'h-5 w-5',
                              selectedBatch?.id === batch.id ? 'text-primary-foreground' : 'text-primary'
                            )} />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col overflow-hidden text-left">
                            <span className="block truncate text-sm font-medium">{batch.name}</span>
                            {batch.course_name ? (
                              <span className="block truncate text-[10px] opacity-80">{batch.course_name}</span>
                            ) : null}
                          </div>
                        </div>
                        {(batch.unread_count || 0) > 0 ? (
                          <Badge className="shrink-0 bg-destructive text-destructive-foreground rounded-full h-5 min-w-5 flex items-center justify-center px-1 text-[10px] border-none">
                            {batch.unread_count}
                          </Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="shadow-card flex-1 flex flex-col min-h-0 bg-background">
            {selectedBatch ? (
              <>
                <CardHeader className="border-b flex-shrink-0 bg-background/50 backdrop-blur-md min-w-0">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate" title={selectedBatch.name}>
                        {selectedBatch.name}
                      </CardTitle>
                      {selectedBatch.course_name ? (
                        <p className="mt-1 truncate text-sm text-muted-foreground" title={selectedBatch.course_name}>
                          {selectedBatch.course_name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                
                {/* Messages View */}
                <ScrollArea 
                  className="flex-1 p-4" 
                  ref={scrollAreaRef}
                  onScrollCapture={handleScroll}
                >
                  {hasMore && (
                    <div className="flex justify-center mb-4">
                      {isLoadingMessages ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-muted-foreground cursor-pointer hover:underline" onClick={loadMoreMessages}>
                          Load older messages
                        </span>
                      )}
                    </div>
                  )}

                  <div className="space-y-6">
                    {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                      <div key={dateLabel} className="space-y-4">
                        <div className="flex justify-center w-full my-4">
                           <span className="bg-background/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-muted-foreground shadow-sm border">
                             {dateLabel}
                           </span>
                        </div>
                        {msgs.map((msg) => {
                          const isCurrentUser = msg.sender?.email === user?.email;
                          return (
                          <div
                            key={msg.id}
                            className={cn(
                              'flex gap-3',
                              isCurrentUser && 'flex-row-reverse'
                            )}
                          >
                            <div className={cn(
                              'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden',
                              isCurrentUser ? 'bg-primary' : 'bg-muted border border-border/50 shadow-sm'
                            )}>
                              {msg.sender?.profile_picture ? (
                                <img
                                  src={msg.sender.profile_picture}
                                  alt={msg.sender.fullname}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className={cn(
                                  'text-sm font-semibold uppercase',
                                  isCurrentUser ? 'text-primary-foreground' : 'text-foreground'
                                )}>
                                  {msg.sender?.fullname?.charAt(0) || '@'}
                                </span>
                              )}
                            </div>
                            <div className={cn(
                              'max-w-[75%] lg:max-w-[60%]',
                              isCurrentUser && 'text-right'
                            )}>
                              <div className={cn("flex items-baseline gap-2 mb-1", isCurrentUser && 'justify-end')}>
                                <span className={cn(
                                  'text-sm font-medium',
                                  msg.sender?.role?.toLowerCase() === 'teacher' && 'text-primary'
                                )}>
                                  {isCurrentUser ? 'You' : msg.sender?.fullname}
                                </span>
                                {msg.sender?.role?.toLowerCase() === 'teacher' && !isCurrentUser && (
                                  <Badge variant="outline" className="text-[10px] px-1 h-4">Teacher</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric' }).format(new Date(msg.sent_at))}
                                </span>
                              </div>
                              <div className={cn(
                                'inline-block p-3 rounded-2xl shadow-sm relative text-sm',
                                isCurrentUser
                                  ? 'bg-primary bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-sm'
                                  : 'bg-background border border-border/40 rounded-tl-sm'
                              )}>
                                {msg.attachment && (
                                  <div className="mb-2">
                                     <div className={cn(
                                       "flex items-center gap-3 p-2 rounded-xl border",
                                       isCurrentUser ? "bg-primary-foreground/10 border-primary-foreground/20" : "bg-muted border-border/40"
                                     )}>
                                        <div className="p-2 bg-background/20 rounded-lg">
                                           <Paperclip className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 overflow-hidden min-w-0 text-left">
                                           <p className="text-xs font-medium truncate">{msg.attachment_name || 'Attached File'}</p>
                                        </div>
                                        <Button 
                                          title="Download"
                                          size="icon" 
                                          variant="ghost" 
                                          className={cn("h-8 w-8 hover:bg-background/20", isCurrentUser ? "text-primary-foreground" : "text-foreground")}
                                          onClick={() => downloadFile(msg.attachment as string, msg.attachment_name || 'download')}
                                        >
                                           <Download className="h-4 w-4" />
                                        </Button>
                                     </div>
                                  </div>
                                )}
                                {msg.message && <p className="text-sm whitespace-pre-wrap text-left leading-relaxed">{msg.message}</p>}
                              </div>
                            </div>
                          </div>
                        )})}
                      </div>
                    ))}
                    {!isLoadingMessages && messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                        <p>No messages yet. Be the first to say hi!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* File Upload Preview */}
                {file && (
                   <div className="px-4 py-2 border-t bg-background/50 backdrop-blur-md flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                         <Paperclip className="h-5 w-5 text-primary" />
                       </div>
                       <div>
                         <p className="text-sm font-medium">{file.name}</p>
                         <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                       </div>
                     </div>
                     {!isUploading && (
                       <Button size="icon" variant="ghost" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                          <X className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                )}

                {/* Message Input */}
                <div className="p-4 border-t bg-background flex-shrink-0">
                  <div className="flex gap-3 items-end">
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected) {
                           if (selected.size > 100 * 1024 * 1024) {
                               alert("File exceeds maximum allowed size of 100MB");
                               if (fileInputRef.current) fileInputRef.current.value = '';
                               return;
                           }
                           setFile(selected);
                        }
                      }}
                    />
                    <Button 
                       type="button" 
                       variant="outline" 
                       size="icon" 
                       className="shrink-0 h-10 w-10 rounded-xl"
                       onClick={() => fileInputRef.current?.click()}
                       disabled={isUploading}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 relative">
                        <Input
                          placeholder="Type a message..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="h-10 rounded-xl shadow-sm border-border/50 text-sm"
                          disabled={isUploading}
                        />
                    </div>
                    {isUploading && file ? (
                       <div className="shrink-0 w-10 h-10 flex items-center justify-center relative">
                          <CircularProgressbar
                             value={uploadProgress}
                             styles={buildStyles({
                               pathColor: `hsl(var(--primary))`,
                               trailColor: `hsl(var(--primary)/0.2)`,
                             })}
                             className="w-10 h-10"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                             <span className="text-[10px] font-semibold text-primary">{uploadProgress}%</span>
                          </div>
                       </div>
                    ) : (
                      <Button onClick={handleSendMessage} disabled={(!message.trim() && !file) || isUploading} className="shrink-0 h-10 w-10 rounded-xl p-0 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-none">
                        <Loader2 className={cn("h-4 w-4 animate-spin absolute", isUploading && !file ? "opacity-100" : "opacity-0")} />
                        <Send className={cn("h-4 w-4 transition-opacity", isUploading && !file ? "opacity-0" : "opacity-100")} />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-background/50 rounded-xl m-4 border border-dashed border-border">
                  <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Select a Batch to Start Chatting</h3>
                  <p className="text-sm max-w-sm">Choose a batch from the sidebar to view conversations, share files, and interact with other members.</p>
               </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
