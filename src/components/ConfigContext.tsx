import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './auth/AuthContext';

interface SiteConfig {
  appName: string;
  logoUrl: string;
  maintenanceMode: boolean;
  registrationReward: number;
  registrationRewardLimit: number;
  registrationRewardCount: number;
  faviconUrl: string;
  bannerUrl: string;
  announcement: string;
  themeColor?: string;
  currencyIconUrl?: string;
  currencySymbol?: string;
  allowRegistration: boolean;
  allowDraw: boolean;
  allowTopup: boolean;
  minTopupAmount: number;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  homepageBlocks: any[];
  shippingFees: {
    west: number;
    east: number;
    freeThreshold: number;
  };
  paymentMethods: {
    tng: { qrUrl: string; name: string };
    bank: { details: string; bankName: string };
    duitnow: { qrUrl: string; name: string };
  };
}

interface ConfigContextType {
  config: SiteConfig | null;
  loading: boolean;
  updateConfig: (newConfig: Partial<SiteConfig>) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const DEFAULT_CONFIG: SiteConfig = {
  appName: 'CRE',
  logoUrl: '',
  maintenanceMode: false,
  registrationReward: 10,
  registrationRewardLimit: 100,
  registrationRewardCount: 0,
  faviconUrl: '',
  bannerUrl: '',
  announcement: 'Welcome to the premium mystery box experience!',
  currencySymbol: 'RM',
  currencyIconUrl: '',
  allowRegistration: true,
  allowDraw: true,
  allowTopup: true,
  minTopupAmount: 10,
  soundEnabled: true,
  animationsEnabled: true,
  homepageBlocks: [
    { id: 'hero', type: 'hero', visible: true },
    { id: 'highlights', type: 'highlights', visible: true },
    { id: 'boxes', type: 'boxes', visible: true },
    { id: 'leaderboard', type: 'leaderboard', visible: true },
    { id: 'membership', type: 'membership', visible: true },
  ],
  shippingFees: {
    west: 10,
    east: 15,
    freeThreshold: 200,
  },
  paymentMethods: {
    tng: { qrUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=200', name: 'TNG eWallet' },
    bank: { details: 'CIMB Bank\nAccount: 7062123456\nName: CRE COLLECTIVE', bankName: 'Bank Transfer' },
    duitnow: { qrUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=200', name: 'DuitNow QR' },
  },
};

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    const configRef = doc(db, 'settings', 'config');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SiteConfig;
        setConfig(data);
        
        // Update document title and favicon
        if (data.appName) document.title = data.appName;
        (window as any).currencySymbol = data.currencySymbol || 'RM';
        (window as any).currencyIconUrl = data.currencyIconUrl || '';
        if (data.faviconUrl) {
          const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
          link.type = 'image/x-icon';
          link.rel = 'shortcut icon';
          link.href = data.faviconUrl;
          document.getElementsByTagName('head')[0].appendChild(link);
        }
      } else {
        // Initialize with defaults if not exists
        setDoc(configRef, DEFAULT_CONFIG);
        setConfig(DEFAULT_CONFIG);
        (window as any).currencySymbol = 'RM';
        (window as any).currencyIconUrl = '';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: Partial<SiteConfig>) => {
    if (!profile?.isAdmin) return;
    const configRef = doc(db, 'settings', 'config');
    await setDoc(configRef, { ...config, ...newConfig }, { merge: true });
    
    // Log the change
    const logId = `config-${Date.now()}`;
    await setDoc(doc(db, 'adminLogs', logId), {
      id: logId,
      adminId: profile.uid,
      adminName: profile.displayName,
      action: 'UPDATE_CONFIG',
      details: JSON.stringify(newConfig),
      timestamp: serverTimestamp(),
    });
  };

  return (
    <ConfigContext.Provider value={{ config, loading, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
