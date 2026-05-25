import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, Lock, Sparkles } from 'lucide-react';
import { formatPrice } from '../../lib/utils';

export default function BoxCard({ box }: { box: any, key?: any }) {
  return (
    <Link to={`/box/${box.id}`} className="group block">
      <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-[24px] p-4 flex flex-col justify-between group-hover:border-black transition-all cursor-pointer h-full shadow-lg hover:shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <span className="bg-brand-accent-pink text-[9px] font-bold px-3 py-1 border border-black rounded-full uppercase tracking-widest text-brand-border">
            {box.status === 'active' ? 'New Drop' : box.status.replace('_', ' ')}
          </span>
          <span className="opacity-40 text-[10px] font-bold">#{box.id.split('-').pop()}</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 relative group-hover:scale-105 transition-transform">
           <div className="absolute inset-0 bg-brand-accent-blue/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="w-48 h-60 bg-white/60 border border-black rounded-[24px] shadow-[4px_4px_0px_rgba(0,0,0,0.05)] relative overflow-hidden flex items-center justify-center">
             <img 
               src={box.coverImage} 
               alt={box.title}
               className="w-full h-full object-cover"
             />
           </div>
        </div>

        <div className="text-center mt-6 space-y-1">
          <p className="text-sm font-black uppercase tracking-tight">{box.title}</p>
          <p className="text-[10px] opacity-40 font-bold uppercase tracking-[0.2em]">{formatPrice(box.price)}</p>
        </div>
      </div>
    </Link>
  );
}
