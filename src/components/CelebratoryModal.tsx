import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Sparkles, X } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { formatPrice } from '../lib/utils';
import Confetti from 'react-confetti';

export default function CelebratoryModal() {
  const { showRewardModal, setShowRewardModal, rewardAmount } = useAuth();

  if (!showRewardModal) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Background Confetti/Particles can be added here if a library is present, 
          but for now let's use a nice animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowRewardModal(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 40 }}
        className="relative w-full max-w-lg bg-[#F5F9FF] rounded-[48px] p-12 text-center overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-pink-400 to-yellow-400" />
        
        <div className="relative space-y-8">
          <div className="w-32 h-32 bg-black text-white rounded-[40px] flex items-center justify-center mx-auto shadow-2xl relative group">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
            >
              <Gift size={56} />
            </motion.div>
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-[#F5F9FF] shadow-lg">
              <Sparkles size={20} className="text-black" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-serif-italic italic leading-tight">A Special Welcome</h2>
            <p className="text-zinc-500 font-medium uppercase tracking-[0.2em] text-[10px]">CRE Exclusive Membership Bonus</p>
          </div>

          <div className="bg-white/60 p-10 rounded-[40px] border border-white shadow-inner relative overflow-hidden">
            <div className="relative z-10 space-y-1">
              <p className="text-xs font-bold opacity-30 uppercase tracking-widest">Bonus Balance Credited</p>
              <p className="text-6xl font-mono font-bold tracking-tighter text-black">
                {formatPrice(rewardAmount)}
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-pink-50/50" />
          </div>

          <p className="text-sm text-zinc-400 font-medium px-4">
            Congratulations! Your bonus has been added to your CRE wallet. Explore our premium collections today.
          </p>

          <button 
            onClick={() => setShowRewardModal(false)}
            className="cre-button w-full h-16 bg-black text-white text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
          >
            START EXPLORING
          </button>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-100/50 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2" />
      </motion.div>
    </div>
  );
}
