import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Mail, Save, Send, ShieldCheck, Server } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailConfig() {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // Mock initial state
  const [config, setConfig] = useState({
    host: 'smtp.example.com',
    port: '587',
    username: 'user@example.com',
    password: '',
    fromEmail: 'noreply@example.com',
    fromName: 'EduLearn System',
    secure: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setConfig(prev => ({ ...prev, [id]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setConfig(prev => ({ ...prev, secure: checked }));
  };

  const handleSave = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast.success('Email configuration saved successfully');
  };

  const handleTest = async () => {
    setTesting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTesting(false);
    toast.success('Test email sent successfully to your registered address');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Email Configuration</h1>
          <p className="mt-1 text-muted-foreground">Configure SMTP settings for system emails</p>
        </div>

        <div className="grid gap-6">
          {/* SMTP Settings */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <CardTitle>SMTP Server Settings</CardTitle>
              </div>
              <CardDescription>Enter the details of your outgoing mail server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input 
                    id="host" 
                    placeholder="smtp.gmail.com" 
                    value={config.host}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">SMTP Port</Label>
                  <Input 
                    id="port" 
                    placeholder="587" 
                    value={config.port}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border border-border bg-muted/30 gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Use Secure Connection (SSL/TLS)</p>
                    <p className="text-sm text-muted-foreground">Recommended for production environments</p>
                  </div>
                </div>
                <Switch 
                  checked={config.secure}
                  onCheckedChange={handleSwitchChange}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">SMTP Username</Label>
                  <Input 
                    id="username" 
                    placeholder="user@example.com" 
                    value={config.username}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">SMTP Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••••••••" 
                    value={config.password}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sender Settings */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>Sender Information</CardTitle>
              </div>
              <CardDescription>How emails will appear to recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fromName">Sender Name</Label>
                  <Input 
                    id="fromName" 
                    placeholder="EduLearn System" 
                    value={config.fromName}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromEmail">Sender Email</Label>
                  <Input 
                    id="fromEmail" 
                    type="email" 
                    placeholder="noreply@example.com" 
                    value={config.fromEmail}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
                <Button variant="outline" onClick={handleTest} disabled={testing || loading} className="w-full sm:w-auto">
                  <Send className="h-4 w-4 mr-2" />
                  {testing ? 'Sending...' : 'Send Test Email'}
                </Button>
                <Button variant="gradient" onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
