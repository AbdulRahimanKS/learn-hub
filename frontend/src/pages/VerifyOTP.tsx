import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, KeyRound, Timer } from 'lucide-react';
import { verifyOTP, requestPasswordReset } from '@/lib/password-reset-api';

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 10); // 10 minutes in seconds

  useEffect(() => {
    // Check if email was passed in state
    if (!location.state?.email) {
      navigate('/forgot-password', { replace: true });
      return;
    }
    setEmail(location.state.email);
  }, [location, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setTimeLeft(60 * 10); // Reset timer
      // Optional: Show toast success message
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await verifyOTP(email, otp);
      // Navigate to Reset Password page
      // Using replace: true to prevent going back to OTP page
      navigate('/reset-password', { 
        state: { email, otp },
        replace: true 
      });
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Hero/Branding */}
      <div className="hidden lg:flex w-1/2 gradient-sidebar items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-5 mix-blend-multiply" />
        
        <div className="relative z-10 max-w-xl space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
            <span className="text-4xl font-bold tracking-tight text-foreground">EduLearn</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight text-foreground">
            Verify Your <br /> Identity.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
             We've sent a secure code to your email. Enter it to verify it's really you and secure your account.
          </p>
        </div>
        
        {/* Decorative circles */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl ml-10" />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Verify OTP</h2>
            <p className="text-muted-foreground">
              We've sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP Code</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => {
                    // Only allow numbers
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setOtp(value);
                    if (error) setError('');
                  }}
                  className={`pl-10 h-11 text-center font-mono text-xl tracking-widest ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                <svg className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-destructive flex-1">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-muted-foreground">
                <Timer className="h-4 w-4 mr-1" />
                <span>Expires in {formatTime(timeLeft)}</span>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                className="text-primary hover:text-primary/80 font-medium"
                disabled={isResending || timeLeft > 0} 
                onClick={handleResendOTP}
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
