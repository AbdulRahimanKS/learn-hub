import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Server, Cloud, CheckCircle2, Circle, Info } from 'lucide-react';
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

// Outlook Form Schema
const outlookSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  client_id: z.string().min(1, 'Client ID is required').uuid('Client ID must be a valid UUID'),
  client_secret: z.string().min(1, 'Client secret is required'),
  tenant_id: z.string().min(1, 'Tenant ID is required').uuid('Tenant ID must be a valid UUID'),
});

type SMTPFormValues = z.infer<typeof smtpSchema>;
type OutlookFormValues = z.infer<typeof outlookSchema>;

export default function EmailConfigPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(true);
  const [emailType, setEmailType] = React.useState<'smtp' | 'outlook'>('smtp');
  const [configurations, setConfigurations] = React.useState<EmailConfig[]>([]);
  const [smtpId, setSmtpId] = React.useState<number | undefined>();
  const [outlookId, setOutlookId] = React.useState<number | undefined>();
  const [smtpActive, setSmtpActive] = React.useState(false);
  const [outlookActive, setOutlookActive] = React.useState(false);

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

  // Outlook Form
  const outlookForm = useForm<OutlookFormValues>({
    resolver: zodResolver(outlookSchema),
    defaultValues: {
      email: '',
      client_id: '',
      client_secret: '',
      tenant_id: '',
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
          email_password: '',
        });
      }
      
      // Load Outlook config if exists
      const outlookCfg = configs.find(c => c.email_type === 'outlook');
      if (outlookCfg) {
        setOutlookId(outlookCfg.id);
        setOutlookActive(outlookCfg.status || false);
        outlookForm.reset({
          email: outlookCfg.email || '',
          client_id: outlookCfg.client_id || '',
          client_secret: '',
          tenant_id: outlookCfg.tenant_id || '',
        });
        if (outlookCfg.status) {
          setEmailType('outlook');
        }
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
        description: 'Please save the SMTP configuration first before activating it',
      });
      return;
    }

    try {
      await toggleEmailConfig(smtpId);
      toast({
        title: 'Configuration Activated',
        description: 'SMTP configuration is now active',
        variant: 'success',
        duration: 3000,
      });
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Activation Failed',
        description: error.message || 'Failed to activate SMTP configuration',
      });
    }
  };

  const handleDeactivateSMTP = async () => {
    if (!smtpId) return;

    try {
      await toggleEmailConfig(smtpId);
      toast({
        title: 'Configuration Deactivated',
        description: 'SMTP configuration has been deactivated',
        variant: 'success',
        duration: 3000,
      });
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deactivation Failed',
        description: error.message || 'Failed to deactivate SMTP configuration',
      });
    }
  };

  const handleActivateOutlook = async () => {
    if (!outlookId) {
      toast({
        variant: 'destructive',
        title: 'Configuration Not Saved',
        description: 'Please save the Outlook configuration first before activating it',
      });
      return;
    }

    try {
      await toggleEmailConfig(outlookId);
      toast({
        title: 'Configuration Activated',
        description: 'Outlook configuration is now active',
        variant: 'success',
        duration: 3000,
      });
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Activation Failed',
        description: error.message || 'Failed to activate Outlook configuration',
      });
    }
  };

  const handleDeactivateOutlook = async () => {
    if (!outlookId) return;

    try {
      await toggleEmailConfig(outlookId);
      toast({
        title: 'Configuration Deactivated',
        description: 'Outlook configuration has been deactivated',
        variant: 'success',
        duration: 3000,
      });
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deactivation Failed',
        description: error.message || 'Failed to deactivate Outlook configuration',
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
        description: 'SMTP email configuration saved successfully',
        variant: 'success',
        duration: 3000,
      });
      
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Failed to save SMTP configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitOutlook = async (data: OutlookFormValues) => {
    setLoading(true);
    try {
      const payload: EmailConfig = {
        email: data.email,
        email_type: 'outlook',
        client_id: data.client_id,
        client_secret: data.client_secret,
        tenant_id: data.tenant_id,
        status: false,
      };

      const saved = await saveEmailConfig(payload);
      setOutlookId(saved.id);
      
      toast({
        title: 'Configuration Saved',
        description: 'Outlook email configuration saved successfully',
        variant: 'success',
        duration: 3000,
      });
      
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Failed to save Outlook configuration',
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

        {/* Info Alert */}
        {activeConfig && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-300">
              Currently using <strong>{activeConfig.email_type.toUpperCase()}</strong> configuration ({activeConfig.email})
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={emailType} onValueChange={(value) => setEmailType(value as 'smtp' | 'outlook')} className="space-y-6">
          <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit">
            <TabsTrigger value="smtp" className="gap-2 w-32">
              <Server className="h-4 w-4" />
              SMTP
              {smtpActive && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="outlook" className="gap-2 w-32">
              <Cloud className="h-4 w-4" />
              Outlook
              {outlookActive && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            </TabsTrigger>
          </TabsList>

          {/* SMTP Configuration */}
          <TabsContent value="smtp">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <CardTitle>SMTP Server Settings</CardTitle>
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
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="noreply@example.com" type="email" {...field} />
                          </FormControl>
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
                              <Input placeholder="user@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={smtpForm.control}
                        name="email_password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Password</FormLabel>
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
          </TabsContent>

          {/* Outlook Configuration */}
          <TabsContent value="outlook">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-primary" />
                    <CardTitle>Microsoft Outlook Settings</CardTitle>
                  </div>
                  {outlookActive ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : outlookId ? (
                    <Badge variant="secondary">
                      <Circle className="h-3 w-3 mr-1" />
                      Inactive
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>Configure Microsoft 365 / Outlook for sending emails</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...outlookForm}>
                  <form onSubmit={outlookForm.handleSubmit(onSubmitOutlook)} className="space-y-6">
                    <FormField
                      control={outlookForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="noreply@example.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={outlookForm.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client ID (Application ID)</FormLabel>
                          <FormControl>
                            <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
                          </FormControl>
                          <FormDescription>From Azure App Registration</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={outlookForm.control}
                      name="client_secret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Secret</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••••••••" {...field} />
                          </FormControl>
                          <FormDescription>Secret value from Azure App Registration</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={outlookForm.control}
                      name="tenant_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant ID (Directory ID)</FormLabel>
                          <FormControl>
                            <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
                          </FormControl>
                          <FormDescription>From Azure Active Directory</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                      {outlookId && outlookActive && (
                        <Button type="button" variant="outline" onClick={handleDeactivateOutlook}>
                          <Circle className="h-4 w-4 mr-2" />
                          Deactivate
                        </Button>
                      )}
                      {outlookId && !outlookActive && (
                        <Button type="button" variant="outline" onClick={handleActivateOutlook}>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
