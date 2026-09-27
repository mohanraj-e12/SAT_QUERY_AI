import React, { useState, useEffect } from 'react';
import {
  Satellite,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.js';

interface AuthPageProps {
  onAuthSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if user followed a password reset recovery link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setMode('reset');
    }
  }, []);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMsg(supabaseConfigError || 'Supabase authentication service is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid grant') ||
          error.message.toLowerCase().includes('invalid email or password')
        ) {
          setErrorMsg('Invalid email or password.');
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMsg('Please verify your email address before signing in.');
        } else {
          setErrorMsg(error.message || 'Authentication failed. Please verify your credentials.');
        }
        return;
      }

      if (data?.session) {
        setSuccessMsg('Authenticated successfully! Redirecting...');
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }
    } catch (err: any) {
      console.error('[Auth Sign In Error]', err);
      setErrorMsg('An unexpected error occurred during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Please choose a stronger password (minimum 6 characters).');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMsg(supabaseConfigError || 'Supabase authentication service is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('user already exists') ||
          error.status === 422
        ) {
          setErrorMsg('An account with this email already exists.');
        } else if (error.message.toLowerCase().includes('weak')) {
          setErrorMsg('Please choose a stronger password.');
        } else {
          setErrorMsg(error.message || 'Unable to create account. Please try again.');
        }
        return;
      }

      if (data?.session) {
        setSuccessMsg('Account created successfully! Welcome to SatQuery AI.');
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      } else if (data?.user) {
        setSuccessMsg(
          'Account created successfully! If email confirmation is required, please check your inbox to verify your email before signing in.'
        );
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      console.error('[Auth Sign Up Error]', err);
      setErrorMsg('An unexpected error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMsg(supabaseConfigError || 'Supabase authentication service is not configured.');
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setErrorMsg(error.message || 'Unable to send password reset email. Please try again.');
        return;
      }

      setSuccessMsg(
        'Password reset instructions sent! Please check your email inbox to proceed with changing your password.'
      );
    } catch (err: any) {
      console.error('[Auth Forgot Password Error]', err);
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!password || !confirmPassword) {
      setErrorMsg('Please enter and confirm your new password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Please choose a password with at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMsg(supabaseConfigError || 'Supabase authentication service is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to update password. Please request a new reset link.');
        return;
      }

      setSuccessMsg('Your password has been changed successfully! Redirecting...');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setMode('signin');
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }, 1500);
    } catch (err: any) {
      console.error('[Auth Reset Password Error]', err);
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFormAction = (e: React.FormEvent) => {
    if (mode === 'signin') return handleSignIn(e);
    if (mode === 'signup') return handleSignUp(e);
    if (mode === 'forgot') return handleForgotPassword(e);
    if (mode === 'reset') return handleResetPassword(e);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF9F4] px-4 py-12 selection:bg-[#FD1843] selection:text-white">
      {/* Background Subtle Ambient Glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden opacity-30">
        <div className="h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-[#FD1843]/15 to-transparent blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* SatQuery AI Brand Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-2.5 mb-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FD1843]/10 border border-[#FD1843]/30 text-[#FD1843] shadow-sm">
              <Satellite className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FD1843] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FD1843]"></span>
              </span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  SatQuery <span className="text-[#FD1843]">AI</span>
                </span>
                <span className="rounded bg-[#FD1843]/10 border border-[#FD1843]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#FD1843] font-semibold">
                  RS-VLM v2.4
                </span>
              </div>
            </div>
          </div>
          <p className="font-mono text-xs font-medium text-slate-500">
            Intelligent Remote Sensing Earth Observation Platform
          </p>
        </div>

        {/* Configuration Warning if Supabase is unconfigured */}
        {!isSupabaseConfigured() && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-mono text-amber-800 shadow-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Supabase Configuration Required</p>
              <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                {supabaseConfigError || 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured in your environment.'}
              </p>
            </div>
          </div>
        )}

        {/* Main Authentication Card */}
        <div className="rounded-2xl border border-[#eeddd3] bg-white p-7 shadow-lg shadow-[#FD1843]/5 backdrop-blur-xl">
          {/* Back button when in Forgot or Reset mode */}
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#FD1843] hover:underline mb-4 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          )}

          {/* Mode Switcher Tabs (Shown for Sign In and Sign Up) */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-1 font-mono text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`rounded-lg py-2 transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-[#FD1843] font-bold shadow-xs border border-[#eeddd3]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`rounded-lg py-2 transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-[#FD1843] font-bold shadow-xs border border-[#eeddd3]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Header Description */}
          <div className="mb-6">
            <h2 className="text-lg font-bold font-mono text-slate-900">
              {mode === 'signin' && 'Welcome Back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Set New Password'}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {mode === 'signin' && 'Sign in to access satellite imagery, live AOI telemetry, and AI vision tools.'}
              {mode === 'signup' && 'Register a registered Supabase account to access the SatQuery AI workstation.'}
              {mode === 'forgot' && 'Enter your email address and we will send you a secure link to reset your password.'}
              {mode === 'reset' && 'Choose a strong new password for your SatQuery AI station account.'}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-mono text-rose-800 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-mono text-emerald-800 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{successMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={renderFormAction} className="space-y-4">
            {/* Email Field (Visible in signin, signup, and forgot modes) */}
            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="analyst@satellite.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#eeddd3] bg-[#FFF9F4] py-2.5 pl-9 pr-3.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#FD1843] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Password Field (Visible in signin, signup, and reset modes) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-semibold text-slate-700">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[11px] font-mono font-semibold text-[#FD1843] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#eeddd3] bg-[#FFF9F4] py-2.5 pl-9 pr-10 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#FD1843] focus:bg-white focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password Field (Visible in signup and reset modes) */}
            {(mode === 'signup' || mode === 'reset') && (
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1.5">
                  {mode === 'reset' ? 'Confirm New Password' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#eeddd3] bg-[#FFF9F4] py-2.5 pl-9 pr-10 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#FD1843] focus:bg-white focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#FD1843] py-2.5 px-4 text-xs font-mono font-bold text-white shadow-md shadow-[#FD1843]/20 hover:bg-[#e0143a] focus:outline-none focus:ring-2 focus:ring-[#FD1843] focus:ring-offset-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'signin' && 'Sign In'}
                      {mode === 'signup' && 'Create Account'}
                      {mode === 'forgot' && 'Send Reset Link'}
                      {mode === 'reset' && 'Update Password'}
                    </span>
                    {mode === 'forgot' ? (
                      <KeyRound className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    )}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Toggle Helper Link */}
          <div className="mt-6 border-t border-[#eeddd3] pt-4 text-center">
            {mode === 'signin' && (
              <p className="text-xs font-mono text-slate-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#FD1843] hover:underline cursor-pointer"
                >
                  Create account
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p className="text-xs font-mono text-slate-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#FD1843] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p className="text-xs font-mono text-slate-600">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#FD1843] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
