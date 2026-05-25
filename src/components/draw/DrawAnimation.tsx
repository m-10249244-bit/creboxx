import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { cn, RARITY_COLORS } from '../../lib/utils';

interface DrawAnimationProps {
  prizes: any[];
  wonPrize: any;
  onComplete: () => void;
}

export default function DrawAnimation({ prizes, wonPrize, onComplete }: DrawAnimationProps) {
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<any[]>([]);
  
  // Create a long list for the scrolling effect
  useEffect(() => {
    if (!prizes.length || !wonPrize) return;

    const totalItems = 80;
    const newList = [];
    for (let i = 0; i < totalItems; i++) {
        // Place the winning prize at a specific position (e.g., 70)
        if (i === 70) {
            newList.push(wonPrize);
        } else {
            newList.push(prizes[Math.floor(Math.random() * prizes.length)]);
        }
    }
    setItems(newList);

    // Initial sequence
    const runAnimation = async () => {
        // Prepare: Center the 70th item
        const itemWidth = 200; // Expected item width
        const gap = 16;
        const offset = (itemWidth + gap) * 70 - (containerRef.current?.offsetWidth || 0) / 2 + itemWidth/2;

        await controls.start({
            x: -offset,
            transition: { 
                duration: 5, 
                ease: [0.12, 0, 0.39, 0], // Fast start, very slow finish
            }
        });
        
        onComplete();
    };

    runAnimation();
  }, [prizes, wonPrize, controls]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center space-y-12 overflow-hidden bg-brand-cream/50 relative">
      {/* Indicator */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+40px)] z-20 pointer-events-none">
        <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-1 h-32 bg-brand-border rounded-full shadow-[0_0_20px_rgba(26,26,26,0.3)] relative"
        >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-border rotate-45" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-border rotate-45" />
        </motion.div>
      </div>

      <div className="w-full relative px-4" ref={containerRef}>
        <motion.div 
          animate={controls}
          className="flex gap-4 items-center"
        >
          {items.map((item, idx) => (
            <div 
              key={idx} 
              className={cn(
                "flex-shrink-0 w-[200px] aspect-[4/5] cre-card bg-white p-6 flex flex-col items-center justify-center gap-4 transition-all",
                idx === 70 ? "border-brand-pink border-4 scale-105 shadow-[0_0_40px_rgba(252,228,236,1)]" : "opacity-40 grayscale"
              )}
            >
              <div className="w-24 h-24 bg-neutral-50 rounded-xl flex items-center justify-center p-2 mb-2">
                <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
              </div>
              <div className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-black/5", (RARITY_COLORS as any)[item.rarity])}>
                {item.rarity}
              </div>
              <h4 className="font-bold text-center text-sm truncate w-full">{item.name}</h4>
              {idx === 70 && (
                <div className="absolute -top-3 -right-3 bg-brand-pink w-8 h-8 rounded-full border-2 border-brand-border flex items-center justify-center animate-bounce">
                    <Sparkles size={16} />
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Ambience */}
      <div className="absolute inset-0 pointer-events-none h-full w-full">
         <div className="absolute top-0 bottom-0 left-0 w-64 bg-gradient-to-r from-brand-cream to-transparent z-10" />
         <div className="absolute top-0 bottom-0 right-0 w-64 bg-gradient-to-l from-brand-cream to-transparent z-10" />
      </div>

      <div className="text-center space-y-4">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-border/40">Opening your destiny...</p>
        <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map(i => (
                <motion.div 
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-brand-pink"
                />
            ))}
        </div>
      </div>
    </div>
  );
}
