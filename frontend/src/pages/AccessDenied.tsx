import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardContent className="pt-12 pb-12 text-center space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this resource.
            </p>
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact your administrator.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button 
              variant="gradient"
              className="flex-1"
              onClick={() => navigate('/dashboard')}
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
