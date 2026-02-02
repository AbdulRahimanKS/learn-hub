import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Send, Users, MessageSquare, Search } from 'lucide-react';

const mockBatches = [
  { id: 1, name: 'Python Basics', unread: 3 },
  { id: 2, name: 'Data Science', unread: 0 },
  { id: 3, name: 'Web Development', unread: 1 },
];

const mockMessages = [
  { id: 1, userId: '3', userName: 'Alex Thompson', message: 'Can someone explain the difference between lists and tuples?', timestamp: '10:30 AM', isCurrentUser: false },
  { id: 2, userId: '4', userName: 'Maria Garcia', message: 'Lists are mutable while tuples are immutable. You can change elements in a list but not in a tuple.', timestamp: '10:32 AM', isCurrentUser: false },
  { id: 3, userId: '2', userName: 'Prof. Michael Chen', message: 'Great explanation Maria! To add to that, tuples are also faster and use less memory because of their immutability.', timestamp: '10:35 AM', isCurrentUser: false },
  { id: 4, userId: '3', userName: 'Alex Thompson', message: 'Thank you! That makes sense now. When should I use one over the other?', timestamp: '10:38 AM', isCurrentUser: true },
  { id: 5, userId: '2', userName: 'Prof. Michael Chen', message: 'Use tuples when you have a collection of items that won\'t change, like coordinates (x, y). Use lists when you need to modify the collection.', timestamp: '10:40 AM', isCurrentUser: false },
  { id: 6, userId: '5', userName: 'John Smith', message: 'Quick question about tomorrow\'s live session - will it be recorded?', timestamp: '11:00 AM', isCurrentUser: false },
  { id: 7, userId: '2', userName: 'Prof. Michael Chen', message: 'Yes, all live sessions are recorded and will be available under the "Scheduled Videos" section after they end.', timestamp: '11:05 AM', isCurrentUser: false },
];

export default function Chat() {
  const { user } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState(mockBatches[0]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSendMessage = () => {
    if (message.trim()) {
      // In real app, send message to backend
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <div className="flex flex-col h-full gap-6 lg:flex-row">
          {/* Sidebar - Batch List */}
          <Card className="shadow-card lg:w-80 flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Batch Chats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="space-y-2">
                {mockBatches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatch(batch)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left',
                      selectedBatch.id === batch.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center',
                        selectedBatch.id === batch.id
                          ? 'bg-primary-foreground/20'
                          : 'bg-primary/10'
                      )}>
                        <MessageSquare className={cn(
                          'h-5 w-5',
                          selectedBatch.id === batch.id ? 'text-primary-foreground' : 'text-primary'
                        )} />
                      </div>
                      <span className="font-medium">{batch.name}</span>
                    </div>
                    {batch.unread > 0 && (
                      <Badge className="bg-destructive text-destructive-foreground">
                        {batch.unread}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="shadow-card flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedBatch.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">24 members online</p>
                </div>
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {mockMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-3',
                      msg.isCurrentUser && 'flex-row-reverse'
                    )}
                  >
                    <div className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                      msg.isCurrentUser ? 'bg-primary' : 'bg-muted'
                    )}>
                      <span className={cn(
                        'text-sm font-semibold',
                        msg.isCurrentUser ? 'text-primary-foreground' : 'text-foreground'
                      )}>
                        {msg.userName.charAt(0)}
                      </span>
                    </div>
                    <div className={cn(
                      'max-w-[70%]',
                      msg.isCurrentUser && 'text-right'
                    )}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={cn(
                          'text-sm font-medium',
                          msg.userId === '2' && 'text-primary'
                        )}>
                          {msg.isCurrentUser ? 'You' : msg.userName}
                        </span>
                        {msg.userId === '2' && (
                          <Badge variant="outline" className="text-xs">Teacher</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                      </div>
                      <div className={cn(
                        'inline-block p-3 rounded-2xl',
                        msg.isCurrentUser
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted rounded-tl-sm'
                      )}>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t flex-shrink-0">
              <div className="flex gap-3">
                <Input
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button variant="gradient" onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
