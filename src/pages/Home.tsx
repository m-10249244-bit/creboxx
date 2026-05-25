import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Sparkles, TrendingUp, History, Zap, Package, Layers, Gift } from 'lucide-react';
import BoxCard from '../components/home/BoxCard';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useConfig } from '../components/ConfigContext';
import { cn } from '../lib/utils';

const BannerCountdown = ({ endTime }: { endTime: string }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!endTime) return;
    const target = new Date(endTime).getTime();
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft('FINISHED');
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return (
    <span className="inline-flex items-center gap-1 bg-yellow-405 text-black bg-yellow-400 font-mono font-black text-[9px] px-2.5 py-1 rounded-full border border-black uppercase tracking-wider animate-pulse">
      ⏳ {timeLeft} LIMIT
    </span>
  );
};

export default function Home() {
  const { config } = useConfig();
  const [recentDraws, setRecentDraws] = useState<any[]>([]);
  const [boxes, setBoxes] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [activeBanner, setActiveBanner] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch banners
    getDocs(collection(db, 'banners')).then((snap) => {
      const bannerList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBanners(bannerList.length > 0 ? bannerList : [
        {
          id: 'b1',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
          title: 'CRE Origins: Sky Blue Edition',
          subtitle: 'Limited series. Premium handcrafted resin design with matte finish.',
          targetUrl: '/box/cre-v1',
          countdown: '2026-12-31T23:59:59'
        },
        {
          id: 'b2',
          imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80',
          title: 'Nebula Overdrive Spec',
          subtitle: 'Step into the cosmos. Elite draw with ultra-rare pity drops.',
          targetUrl: '/box/cre-v2',
          countdown: '2026-10-15T18:00:00'
        },
        {
          id: 'b3',
          imageUrl: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1200&auto=format&fit=crop&q=80',
          title: 'Alpha Protocol Horizon',
          subtitle: 'Aesthetic luxury meets future cybernetic toys.',
          targetUrl: '/box/cre-v3',
          countdown: ''
        }
      ]);
    });

    // Boxes listener
    const qBoxes = query(collection(db, 'boxes'), orderBy('price', 'asc'));
    getDocs(qBoxes).then((snap) => {
      const allBoxes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Only show active boxes or default seeded boxes that don't have a status, or are marked 'active'
      setBoxes(allBoxes.filter(box => box.status === 'active' || box.status === undefined));
      setLoading(false);
    });

    // Recent draws listener
    const qDraws = query(collection(db, 'draws'), orderBy('timestamp', 'desc'), limit(5));
    const unsubscribeDraws = onSnapshot(qDraws, (snapshot) => {
      setRecentDraws(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeDraws();
  }, []);

  // Auto banner rotation (慢、高级、有停顿感 - 6 seconds)
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBanner(prev => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Swipe handlers for mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || banners.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      // Swipe Left -> Next
      setActiveBanner(prev => (prev + 1) % banners.length);
    } else if (diff < -50) {
      // Swipe Right -> Prev
      setActiveBanner(prev => (prev - 1 + banners.length) % banners.length);
    }
    setTouchStartX(null);
  };

  const renderBlock = (block: any) => {
    if (!block.visible) return null;

    switch (block.type) {
      case 'hero':
        if (banners.length === 0) return null;
        const curBanner = banners[activeBanner] || banners[0];
        return (
          <section key={block.id} className="relative select-none w-full col-span-12">
            <div 
               onTouchStart={handleTouchStart}
               onTouchEnd={handleTouchEnd}
               className="relative overflow-hidden w-full h-[520px] rounded-[48px] border-4 border-brand-border bg-black shadow-[20px_20px_0px_0px_#1a1a1a] flex items-center justify-between"
            >
               {/* Animated Background Slide/Fade */}
               <AnimatePresence mode="wait">
                 <motion.div
                    key={activeBanner}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} 
                    className="absolute inset-0 w-full h-full cursor-pointer"
                 >
                    {curBanner.targetUrl ? (
                      <Link to={curBanner.targetUrl} className="block w-full h-full">
                        <img src={curBanner.imageUrl} className="w-full h-full object-cover select-none pointer-events-none" alt="" />
                      </Link>
                    ) : (
                      <img src={curBanner.imageUrl} className="w-full h-full object-cover select-none pointer-events-none" alt="" />
                    )}
                 </motion.div>
               </AnimatePresence>

               {/* Left/Right Navigation Arrows */}
               {banners.length > 1 && (
                 <>
                   <button 
                     onClick={(e) => { e.stopPropagation(); setActiveBanner(prev => (prev - 1 + banners.length) % banners.length); }}
                     className="absolute left-6 z-30 w-10 h-10 rounded-full bg-white/30 hover:bg-white/95 border border-white/40 text-white hover:text-black hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-300 pointer-events-auto"
                   >
                     <span className="text-sm font-bold">←</span>
                   </button>
                   <button 
                     onClick={(e) => { e.stopPropagation(); setActiveBanner(prev => (prev + 1) % banners.length); }}
                     className="absolute right-6 z-30 w-10 h-10 rounded-full bg-white/30 hover:bg-white/95 border border-white/40 text-white hover:text-black hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-300 pointer-events-auto"
                   >
                     <span className="text-sm font-bold">→</span>
                   </button>
                 </>
               )}

               {/* Carousel dot indicators */}
               {banners.length > 1 && (
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
                   {banners.map((_, i) => (
                     <button
                        key={i}
                        onClick={() => setActiveBanner(i)}
                        className={cn(
                          "h-2 rounded-full transition-all duration-500",
                          activeBanner === i ? "w-8 bg-white shadow-sm shadow-white" : "w-2 bg-white/40 hover:bg-white/60"
                        )}
                     />
                   ))}
                 </div>
               )}
            </div>
          </section>
        );

      case 'highlights':
        return (
          <section key={block.id} className="grid grid-cols-1 md:grid-cols-3 gap-8">
             {[
               { label: 'Asset Security', desc: 'Blockchain verified ownership', icon: Package },
               { label: 'Instant Liquidity', desc: 'Trade items for credits instantly', icon: Layers },
               { label: 'Priority Access', desc: 'Member exclusive drops', icon: Gift }
             ].map((feature, i) => (
               <div key={i} className="bg-white/40 border border-brand-border p-8 rounded-[32px] space-y-4 hover:border-black transition-all group">
                  <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                     <feature.icon size={20} />
                  </div>
                  <div className="space-y-1">
                     <h3 className="font-bold uppercase tracking-tight">{feature.label}</h3>
                     <p className="text-xs text-zinc-400 font-medium">{feature.desc}</p>
                  </div>
               </div>
             ))}
          </section>
        );

      case 'boxes':
        return (
          <section key={block.id} className="space-y-12">
            <div className="flex items-end justify-between border-b border-brand-border pb-8">
              <div className="space-y-2">
                 <h2 className="text-4xl font-serif-italic italic">Active Collections</h2>
                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Choose your path to rarity</p>
              </div>
              <Link to="/warehouse" className="text-[10px] font-bold opacity-40 underline underline-offset-8 hover:opacity-100 transition-opacity uppercase tracking-widest">Your Inventory</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
               {boxes.map(box => <BoxCard key={box.id} box={box} />)}
               {loading && [1,2,3].map(i => <div key={i} className="h-[400px] bg-white/20 animate-pulse rounded-[40px]" />)}
            </div>
          </section>
        );

      case 'leaderboard':
        return (
          <footer key={block.id} className="h-16 bg-white border border-brand-border rounded-[20px] flex items-center px-8 shadow-sm">
            <div className="flex items-center gap-3 mr-8">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Live Feed</span>
            </div>
            
            <div className="flex-1 overflow-hidden h-full flex items-center">
              <AnimatePresence mode="wait">
                {recentDraws.length > 0 ? (
                  <motion.div 
                    key={recentDraws[0].id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex gap-4 items-center text-[10px] font-bold uppercase tracking-wider"
                  >
                     <span className="opacity-40">{recentDraws[0].userDisplayName?.split(' ')[0]}***</span>
                     <span className="opacity-20">obtained</span>
                     <span className="bg-black text-white px-3 py-1 rounded-full text-[8px]">{recentDraws[0].prizeName}</span>
                     <span className="opacity-20 italic">at {new Date(recentDraws[0].timestamp?.seconds * 1000).toLocaleTimeString()}</span>
                  </motion.div>
                ) : (
                  <span className="text-[9px] font-bold uppercase opacity-20 italic tracking-widest">Monitoring global unboxing activity...</span>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-6 border-l border-brand-border/10 pl-8 ml-8">
               <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-zinc-300" />
                  <span className="text-[10px] font-bold opacity-40">ONLINE: 1,429</span>
               </div>
            </div>
          </footer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-24">
      {config?.homepageBlocks?.map(block => renderBlock(block))}
    </div>
  );
}
