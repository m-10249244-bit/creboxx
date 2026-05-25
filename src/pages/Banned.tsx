import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, LogOut, MessageCircle } from 'lucide-react';
import { useAuth } from '../components/auth/AuthContext';

export default function BannedPage() {
  const { logout, profile } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F9FF] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-white/40 backdrop-blur-3xl border border-red-500/20 rounded-[40px] p-12 text-center space-y-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
        
        <div className="inline-flex items-center justify-center w-24 h-24 bg-red-500 text-white rounded-[32px] shadow-2xl shadow-red-500/20 mb-4 animate-bounce">
          <ShieldAlert size={48} />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-serif-italic italic tracking-tight text-red-600">Access Revoked</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">System Protocol Deviation Detected</p>
        </div>

        <div className="bg-red-50 border border-red-100 p-8 rounded-[24px] space-y-4">
          <p className="text-sm font-medium text-red-800 leading-relaxed italic">
            "Your profile ID <span className="font-mono font-bold">{profile?.uid.slice(-8)}</span> has been restricted due to violations of our ecosystem guidelines. All collection draws and warehouse logistics are suspended."
          </p>
          {profile?.banReason && (
             <div className="pt-4 border-t border-red-200">
                <p className="text-[10px] font-bold uppercase opacity-40 mb-1">Official Reason</p>
                <p className="text-sm font-bold">{profile.banReason}</p>
             </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            onClick={() => window.open('mailto:support@cre.com')}
            className="flex-1 py-5 bg-white border border-brand-border rounded-2xl flex items-center justify-center gap-3 font-bold text-[10px] uppercase tracking-widest hover:bg-neutral-50 transition-all shadow-sm"
          >
            <MessageCircle size={18} />
            Appeal Suspension
          </button>
          <button 
            onClick={logout}
            className="flex-1 py-5 bg-black text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl"
          >
            <LogOut size={18} />
            Exit Portal
          </button>
        </div>

        <p className="text-[10px] font-bold uppercase opacity-30 tracking-widest pt-8">
          The CRE Ecosystem maintains a high-integrity environment for all collectors.
        </p>
      </motion.div>
    </div>
  );
}
