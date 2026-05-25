import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/auth/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User, Lock, ArrowRight, Sparkles, ShieldCheck, Mail, KeyRound } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const { loginNative, registerNative } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const resetToken = searchParams.get('resetToken');
  const resetUsername = searchParams.get('username');

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(
    resetToken && resetUsername ? 'reset' : 'login'
  );
  const [username, setUsername] = useState(resetUsername || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (!resetUsername) throw new Error('Invalid query params');

        // Update changeable login password target
        const usernameRef = doc(db, 'usernames', resetUsername.toLowerCase());
        await updateDoc(usernameRef, {
          authPassword: password
        });

        setSuccessMsg('Password Reset Successful! Logging in...');
        
        // Log user in automatically!
        setTimeout(async () => {
          try {
            await loginNative(resetUsername, password);
            navigate('/');
          } catch (loginErr: any) {
            setError('Login failed: ' + loginErr.message);
            setLoading(false);
          }
        }, 1500);
        return;
      }

      if (mode === 'login') {
        await loginNative(username, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await registerNative(username, password, email);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/40 backdrop-blur-3xl border border-brand-border rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        {/* Apple-style background glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-accent-blue/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-accent-pink/20 blur-[100px] pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-black text-white rounded-[20px] mb-4 shadow-xl">
              {mode === 'reset' ? <KeyRound size={32} /> : <Sparkles size={32} />}
            </div>
            <h1 className="text-3xl font-serif-italic italic tracking-tight">
              {mode === 'login' ? 'Welcome Back' : mode === 'reset' ? 'Reset Password' : 'Create Account'}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
              {mode === 'login' 
                ? 'Access your private collection' 
                : mode === 'reset' 
                ? `Create a brand new credential for ${resetUsername}` 
                : 'Join the CRE collective ecosystem'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity" size={18} />
                <input 
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/60 border border-brand-border rounded-2xl pl-16 pr-6 py-5 font-medium focus:border-black outline-none transition-all disabled:opacity-50"
                  required
                  disabled={mode === 'reset'}
                />
              </div>

              {mode === 'register' && (
                <div className="relative group">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity" size={18} />
                  <input 
                    type="email"
                    placeholder="Recovery Email (Optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/60 border border-brand-border rounded-2xl pl-16 pr-6 py-5 font-medium focus:border-black outline-none transition-all"
                  />
                </div>
              )}

              <div className="relative group">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity" size={18} />
                <input 
                  type="password"
                  placeholder={mode === 'reset' ? "New Password" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/60 border border-brand-border rounded-2xl pl-16 pr-6 py-5 font-medium focus:border-black outline-none transition-all"
                  required
                />
              </div>

              {(mode === 'register' || mode === 'reset') && (
                <div className="relative group">
                  <ShieldCheck className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity" size={18} />
                  <input 
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/60 border border-brand-border rounded-2xl pl-16 pr-6 py-5 font-medium focus:border-black outline-none transition-all"
                    required
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-550 text-[10px] font-bold uppercase tracking-wider text-center bg-red-50 py-2.5 rounded-xl border border-red-200/50">{error}</p>
            )}

            {successMsg && (
              <p className="text-green-600 text-[10px] font-bold uppercase tracking-wider text-center bg-green-50 py-2.5 rounded-xl border border-green-200/50">{successMsg}</p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-5 rounded-2xl font-bold text-sm tracking-widest uppercase hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (mode === 'reset' ? 'Resetting Password...' : 'Authenticating...') : (
                <>
                  {mode === 'login' ? 'Unlock Access' : mode === 'reset' ? 'Save New Password' : 'Create Portfolio'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {mode !== 'reset' && (
            <div className="text-center pt-4">
              <button 
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity underline underline-offset-8"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : "Already a member? Sign in"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
