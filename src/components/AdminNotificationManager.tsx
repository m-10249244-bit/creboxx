import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './auth/AuthContext';
import { useConfig } from './ConfigContext';
import { toast } from 'sonner';

export default function AdminNotificationManager() {
  const { profile } = useAuth();
  const { config } = useConfig();
  const lastTopupId = useRef<string | null>(null);
  const lastOrderId = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!profile?.isAdmin) return;

    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    const playNotification = () => {
      if (config?.soundEnabled && audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio play failed', e));
      }
    };

    // Listen for new pending topups
    const qTopups = query(
      collection(db, 'topupRequests'), 
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubTopups = onSnapshot(qTopups, (snap) => {
      if (snap.empty) return;
      const doc = snap.docs[0];
      if (lastTopupId.current && lastTopupId.current !== doc.id) {
        toast.success(`New Top-up Request: RM ${doc.data().amount}`, {
          description: `From user: ${doc.data().userName}`,
          action: {
            label: 'View',
            onClick: () => window.location.hash = '#topups'
          }
        });
        playNotification();
      }
      lastTopupId.current = doc.id;
    });

    // Listen for new pending orders
    const qOrders = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      if (snap.empty) return;
      const doc = snap.docs[0];
      if (lastOrderId.current && lastOrderId.current !== doc.id) {
        toast.info(`New Shipping Order`, {
          description: `User ${doc.data().userName} just arranged shipping`,
          action: {
            label: 'Process',
            onClick: () => window.location.hash = '#orders'
          }
        });
        playNotification();
      }
      lastOrderId.current = doc.id;
    });

    return () => {
      unsubTopups();
      unsubOrders();
    };
  }, [profile?.isAdmin, config?.soundEnabled]);

  return null;
}
