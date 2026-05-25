import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { useAuth } from './auth/AuthContext';
import { formatPrice } from '../lib/utils';

export default function NotificationManager() {
  const { profile } = useAuth();
  const [activeNotification, setActiveNotification] = useState<any>(null);
  const [hasShown, setHasShown] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.uid) return;

    // Listen for recently approved topups
    const q = query(
      collection(db, 'topupRequests'),
      where('userId', '==', profile.uid),
      where('status', '==', 'approved'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const topup = snapshot.docs[0].data();
        
        let updatedAtMillis = 0;
        const val = topup.updatedAt;
        if (val) {
          if (typeof val.toMillis === 'function') {
            updatedAtMillis = val.toMillis();
          } else if (typeof val.toDate === 'function') {
            updatedAtMillis = val.toDate().getTime();
          } else if (val instanceof Date) {
            updatedAtMillis = val.getTime();
          } else if (typeof val === 'number') {
            updatedAtMillis = val;
          } else if (typeof val === 'string') {
            updatedAtMillis = Date.parse(val) || 0;
          } else if (typeof val.seconds === 'number') {
            updatedAtMillis = val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
          }
        }
        
        // Only show if updated in the last 10 seconds and not already shown
        const isRecent = updatedAtMillis && (Date.now() - updatedAtMillis < 10000);
        
        if (isRecent && !hasShown.has(snapshot.docs[0].id)) {
          setActiveNotification(topup);
          setHasShown(prev => new Set(prev).add(snapshot.docs[0].id));
          
          // Auto close after 6 seconds
          setTimeout(() => setActiveNotification(null), 6000);
        }
      }
    });

    return () => unsubscribe();
  }, [profile?.uid, hasShown]);

  return (
    <AnimatePresence>
      {activeNotification && (
        <div className="fixed top-24 right-8 z-[200] max-w-sm w-full pointer-events-none">
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="pointer-events-auto bg-black text-white rounded-[32px] p-6 shadow-2xl relative overflow-hidden"
          >
             {/* Background glow */}
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-accent-blue/40 blur-3xl" />
             
             <div className="flex gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                   <Sparkles className="text-brand-accent-blue" size={24} />
                </div>
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <span className="text-xl font-bold font-serif-italic italic">Topup Success</span>
                   </div>
                   <p className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                      {formatPrice(activeNotification.amount)} has been added to your CRE credit.
                   </p>
                </div>
                <button 
                  onClick={() => setActiveNotification(null)}
                  className="absolute top-0 right-0 p-2 opacity-40 hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
             </div>

             <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: "100%" }}
                   animate={{ width: "0%" }}
                   transition={{ duration: 6, ease: "linear" }}
                   className="h-full bg-brand-accent-blue"
                />
             </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
