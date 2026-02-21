import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Server, CheckCircle2, Circle, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { listEmailConfigs, saveEmailConfig, toggleEmailConfig, EmailConfig } from '@/lib/email-api';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';

// SMTP Form Schema
const smtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  email_host: z.string().min(1, 'SMTP host is required'),
  email_port: z.string().min(1, 'SMTP port is required').regex(/^\d+$/, 'Port must be a number'),
  email_user: z.string().min(1, 'SMTP username is required'),
  email_password: z.string().min(1, 'SMTP password is required'),
});

type SMTPFormValues = z.infer<typeof smtpSchema>;

export default function EmailConfigPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(true);
  const [configurations, setConfigurations] = React.useState<EmailConfig[]>([]);
  const [smtpId, setSmtpId] = React.useState<number | undefined>();
  const [smtpActive, setSmtpActive] = React.useState(false);

  // SMTP Form
  const smtpForm = useForm<SMTPFormValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      email: '',
      email_host: '',
      email_port: '587',
      email_user: '',
      email_password: '',
    },
  });

  // Fetch existing configurations on mount
  const fetchConfigurations = async () => {
    try {
      const configs = await listEmailConfigs();
      setConfigurations(configs);
      
      // Load SMTP config if exists
      const smtpCfg = configs.find(c => c.email_type === 'smtp');
      if (smtpCfg) {
        setSmtpId(smtpCfg.id);
        setSmtpActive(smtpCfg.status || false);
        smtpForm.reset({
          email: smtpCfg.email || '',
          email_host: smtpCfg.email_host || '',
          email_port: smtpCfg.email_port || '587',
          email_user: smtpCfg.email_user || '',
          email_password: '', // Do not populate password for security
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch email configs:', error);
    } finally {
      setFetching(false);
    }
  };

  React.useEffect(() => {
    fetchConfigurations();
  }, []);

  const handleActivateSMTP = async () => {
    if (!smtpId) {
      toast({
        variant: 'destructive',
        title: 'Configuration Not Saved',
        description: 'Please save the configuration first before activating it',
      });
      return;
    }

    try {
      await toggleEmailConfig(smtpId);
      toast({
        title: 'Configuration Activated',
        description: 'Email configuration is now active',
        variant: 'success',
        duration: 3000,
      });
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Activation Failed',
        description: error.message || 'Failed to activate configuration',
      });
    }
  };

  const handleDeactivateSMTP = async () => {
    if (!smtpId) return;

    try {
      await toggleEmailConfig(smtpId);
      toast({
        title: 'Configuration Deactivated',
        description: 'Email configuration has been deactivated',
        variant: 'success',
        duration: 3000,
      });
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deactivation Failed',
        description: error.message || 'Failed to deactivate configuration',
      });
    }
  };

  const onSubmitSMTP = async (data: SMTPFormValues) => {
    setLoading(true);
    try {
      const payload: EmailConfig = {
        email: data.email,
        email_type: 'smtp',
        email_host: data.email_host,
        email_port: data.email_port,
        email_user: data.email_user,
        email_password: data.email_password,
        status: false,
      };

      const saved = await saveEmailConfig(payload);
      setSmtpId(saved.id);
      
      toast({
        title: 'Configuration Saved',
        description: 'Email configuration saved successfully',
        variant: 'success',
        duration: 3000,
      });
      
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Failed to save configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </DashboardLayout>
    );
  }

  const activeConfig = configurations.find(c => c.status);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Email Configuration</h1>
          <p className="mt-1 text-muted-foreground">Configure email settings for system notifications</p>
        </div>


        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <CardTitle>SMTP Server Settings (Gmail)</CardTitle>
              </div>
              {smtpActive ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : smtpId ? (
                <Badge variant="secondary">
                  <Circle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              ) : null}
            </div>
            <CardDescription>Configure your SMTP server for sending emails</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...smtpForm}>
              <form onSubmit={smtpForm.handleSubmit(onSubmitSMTP)} className="space-y-6">
                <FormField
                  control={smtpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="noreply@gmail.com" 
                          type="email" 
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>The email address that will appear as the sender</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={smtpForm.control}
                    name="email_host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp.gmail.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={smtpForm.control}
                    name="email_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Port</FormLabel>
                        <FormControl>
                          <Input placeholder="587" {...field} />
                        </FormControl>
                        <FormDescription>Common ports: 587 (TLS), 465 (SSL), 25</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={smtpForm.control}
                    name="email_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Username</FormLabel>
                        <FormControl>
                          <Input placeholder="user@gmail.com" {...field} />
                        </FormControl>
                        <FormDescription>Usually same as sender email</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={smtpForm.control}
                    name="email_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Password (App Password)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                  {smtpId && smtpActive && (
                    <Button type="button" variant="outline" onClick={handleDeactivateSMTP}>
                      <Circle className="h-4 w-4 mr-2" />
                      Deactivate
                    </Button>
                  )}
                  {smtpId && !smtpActive && (
                    <Button type="button" variant="outline" onClick={handleActivateSMTP}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Set as Active
                    </Button>
                  )}
                  <Button type="submit" variant="gradient" disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
