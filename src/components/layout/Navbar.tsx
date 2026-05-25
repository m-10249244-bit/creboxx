import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useConfig } from '../ConfigContext';
import { motion } from 'motion/react';
import { formatPrice } from '../../lib/utils';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const { config } = useConfig();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-8 pointer-events-none font-sans">
      <div className="container mx-auto max-w-7xl">
        <div className="bg-white/40 backdrop-blur-xl rounded-[14px] border border-brand-border px-6 py-3 flex items-center justify-between pointer-events-auto shadow-sm">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-4 group">
              {config?.logoUrl ? (
                <img 
                  src={config.logoUrl} 
                  alt={config.appName || 'CRE'} 
                  className="w-10 h-10 object-contain rounded-xl p-1 bg-neutral-900 border border-black/10 transition-transform group-hover:scale-105" 
                />
              ) : (
                <div className="w-10 h-10 bg-black flex items-center justify-center rounded-xl border border-black transition-transform group-hover:scale-105">
                  <span className="text-white font-bold text-xl tracking-tighter">CRE</span>
                </div>
              )}
              {config?.appName && (
                <span className="text-xs font-black uppercase tracking-wider hidden sm:inline-block">
                  {config.appName}
                </span>
              )}
            </Link>
            
            <nav className="hidden md:flex gap-8 font-bold text-[10px] uppercase tracking-[0.2em] opacity-60">
              <Link to="/" className="hover:opacity-100 transition-opacity">Discovery</Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-3 bg-white/40 border border-brand-border rounded-[14px] px-4 py-2 shadow-sm">
                  {config?.currencyIconUrl ? (
                    <img src={config.currencyIconUrl} className="w-4 h-4 object-contain rounded-full" alt="currency" />
                  ) : (
                    <div className="w-4 h-4 bg-[#FFD700] rounded-full border border-brand-border" />
                  )}
                  <span className="font-mono font-bold text-sm tracking-tight">{formatPrice(profile?.balance || 0)}</span>
                  <Link to="/topup" className="bg-black text-white w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold active:scale-90 transition-transform pointer-events-auto">
                    +
                  </Link>
                </div>

                <div className="flex items-center gap-3 pl-4 border-l border-brand-border/10">
                  <Link to="/warehouse" className="flex items-center gap-3 group">
                    <motion.img 
                      src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'} 
                      alt="avatar" 
                      className="w-10 h-10 rounded-[14px] border border-brand-border object-cover select-none"
                      whileHover={{ scale: 1.05 }}
                    />
                    <div className="hidden lg:block text-left select-none">
                      <p className="text-[10px] font-black uppercase tracking-tight leading-none mb-0.5 group-hover:underline">
                        {profile?.displayName || 'Traveler'}
                      </p>
                      <p className="text-[7px] text-zinc-400 font-bold uppercase tracking-wider">
                        View Profile
                      </p>
                    </div>
                  </Link>

                  <div className="hidden lg:block pl-2">
                    <button 
                      onClick={logout} 
                      className="text-[8px] text-zinc-500 hover:text-black font-black uppercase tracking-widest transition-colors"
                    >
                      LOGOUT
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-black text-white px-6 py-2 rounded-[14px] font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-colors pointer-events-auto"
              >
                Connect Account
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
