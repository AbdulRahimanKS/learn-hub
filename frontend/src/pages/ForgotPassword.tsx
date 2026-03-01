import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModeToggle } from '@/components/mode-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { requestPasswordReset } from '@/lib/password-reset-api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setGeneralError('');

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');
    
    try {
      await requestPasswordReset(email);
      // Navigate to Verify OTP page, passing email in state
      // Using replace: true prevents going back to this page with back button if desired,
      // but for this specific flow, usually we allow going back to correct email.
      // However, per user request, we'll enforce forward flow logic.
      navigate('/verify-otp', { state: { email } });
    } catch (error: any) {
      setGeneralError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex relative">
      <div className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </div>
      {/* Left Side - Hero/Branding */}
      <div className="hidden lg:flex w-1/2 gradient-sidebar relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-5 mix-blend-multiply" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
            <span className="text-4xl font-bold tracking-tight text-foreground">EduLearn</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight text-foreground">
            Recover Access <br /> to Your Learning Journey.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Don't worry, it happens to the best of us. We'll help you reset your password and get you back to learning in no time.
          </p>
        </div>
        
        {/* Decorative circles */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl ml-10" />
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-muted">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Forgot password?</h2>
            <p className="text-muted-foreground">
              Enter your email address and we'll send you a recovery code.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  className={`pl-10 h-11 ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  autoComplete="email"
                />
              </div>
              {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
            </div>

            {generalError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                <svg className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-destructive flex-1">{generalError}</p>
              </div>
            )}

            <Button 
              type="submit" 
              variant="gradient"
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button 
              variant="link" 
              className="text-muted-foreground hover:text-foreground gap-2"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
