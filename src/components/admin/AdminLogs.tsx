import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { ShieldCheck, ShieldAlert, Cpu, Activity, User, Ticket, Sparkles, TrendingUp } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';

export default function AdminLogs() {
  const [logTab, setLogTab] = useState<'audit' | 'draws'>('audit');
  const [logs, setLogs] = useState<any[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (logTab === 'audit') {
      const q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      const q = query(collection(db, 'draws'), orderBy('timestamp', 'desc'), limit(80));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setDraws(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [logTab]);

  const getLogIcon = (action: string) => {
    if (action.includes('REJECT')) return <ShieldAlert className="text-red-500" />;
    if (action.includes('APPROVE')) return <ShieldCheck className="text-green-500" />;
    if (action.includes('CONFIG') || action.includes('UPDATE')) return <Cpu className="text-blue-500" />;
    return <Activity className="text-neutral-400" />;
  };

  return (
    <div className="space-y-8">
      {/* Visual Header */}
      <div className="bg-black text-white p-10 rounded-[32px] flex items-center justify-between overflow-hidden relative group shadow-2xl">
        <div className="space-y-2 relative z-10">
          <h2 className="text-4xl font-serif-italic italic">Ecosystem Audit Hub</h2>
          <p className="text-sm opacity-60">Complete tracking & operational transparency for admin actions and drawings.</p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/10 to-transparent flex items-center justify-center">
            <Ticket size={120} className="opacity-10 scale-150 rotate-12" />
        </div>
      </div>

      {/* Log Section Switches */}
      <div className="flex border-b border-brand-border gap-4 pb-2">
         <button
            onClick={() => setLogTab('audit')}
            className={cn(
              "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
              logTab === 'audit' ? "bg-black text-white" : "text-zinc-400 hover:text-black hover:bg-neutral-100"
            )}
         >
            Admin Action Audit / 操作审计日志
         </button>
         <button
            onClick={() => setLogTab('draws')}
            className={cn(
              "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
              logTab === 'draws' ? "bg-black text-white" : "text-zinc-400 hover:text-black hover:bg-neutral-100"
            )}
         >
            Overall Drawings Log / 所有抽奖记录 ({draws.length})
         </button>
      </div>

      {/* Audit Logs Content */}
      <div className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] overflow-hidden shadow-sm">
        {logTab === 'audit' ? (
          <>
            <div className="p-8 border-b border-brand-border flex items-center gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-black/5"><Activity size={20} /></div>
               <div>
                  <h3 className="font-bold uppercase tracking-tight">Admin Activity Log</h3>
                  <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Last 50 recorded administrative transitions</p>
               </div>
            </div>

            <div className="divide-y divide-black/5">
              {logs.map((log) => (
                <div key={log.id} className="p-8 hover:bg-white/60 transition-colors flex items-center gap-8 group">
                   <div className="w-12 h-12 rounded-2xl bg-white border border-brand-border flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                      {getLogIcon(log.action)}
                   </div>
                   
                   <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                         <span className="font-bold text-sm tracking-tight">{log.action ? log.action.replace(/_/g, ' ') : 'ACTION'}</span>
                         <span className="w-1 h-1 rounded-full bg-black/10 hidden sm:inline" />
                         <span className="text-[10px] font-bold text-zinc-500">{log.details}</span>
                      </div>
                      <div className="flex items-center gap-4 opacity-40 text-[9px] font-bold uppercase tracking-wider">
                         <div className="flex items-center gap-2">
                            <User size={10} />
                            <span>{log.adminName || 'System'}</span>
                         </div>
                         <span>
                            {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'MM-dd HH:mm:ss') : (log.timestamp ? format(new Date(log.timestamp), 'MM-dd HH:mm:ss') : 'Just now')}
                         </span>
                      </div>
                   </div>
                   
                   <div className="hidden md:block shrink-0">
                      <div className="bg-white/60 border border-brand-border px-4 py-2 rounded-xl">
                         <code className="text-[9px] font-mono opacity-40 uppercase tracking-tighter">ID: {log.targetId?.slice(0, 12)}...</code>
                      </div>
                   </div>
                </div>
              ))}
              {loading && (
                <div className="p-20 text-center text-xs font-bold opacity-20 uppercase tracking-widest">Ingesting audit log streams...</div>
              )}
              {!loading && logs.length === 0 && (
                <div className="p-20 text-center text-xs font-bold opacity-20 uppercase tracking-widest">No audit logs recorded</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="p-8 border-b border-brand-border flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-black/5"><Sparkles size={20} className="text-yellow-500" /></div>
                  <div>
                     <h3 className="font-bold uppercase tracking-tight">System-Wide Drawings Journal</h3>
                     <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Global drawers unboxing database streams / 实时开箱数据流</p>
                  </div>
               </div>
               <div className="text-[10px] font-mono font-black uppercase text-rose-500 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full">
                  Real-time Active
               </div>
            </div>

            <div className="p-0 overflow-x-auto no-scrollbar">
               <table className="w-full text-left text-xs font-semibold border-collapse">
                  <thead>
                     <tr className="bg-neutral-50/50 border-b border-brand-border text-[9px] font-black uppercase tracking-wider text-neutral-500">
                        <th className="p-6">Catalog / Box</th>
                        <th className="p-6">Resident Username</th>
                        <th className="p-6">Loot Drop / Prize</th>
                        <th className="p-6">Rarity</th>
                        <th className="p-6 col-span-1">Cost</th>
                        <th className="p-6 text-right">Timestamp</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                     {draws.map((dr) => (
                       <tr key={dr.id} className="hover:bg-white/60 transition-colors">
                          <td className="p-6 font-black uppercase tracking-tight text-neutral-900">{dr.boxName || 'Mystery Box'}</td>
                          <td className="p-6 font-bold text-blue-600 flex items-center gap-1.5 leading-none">
                             <User size={12} className="opacity-40" />
                             {dr.username || 'System resident'}
                          </td>
                          <td className="p-6 text-zinc-800 font-bold">{dr.prizeName}</td>
                          <td className="p-6">
                             <span className={cn(
                               "text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full block text-center max-w-[80px]",
                               dr.rarity === 'Legendary' ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-neutral-50 text-neutral-500 border border-neutral-100"
                             )}>
                               {dr.rarity || 'Common'}
                             </span>
                          </td>
                          <td className="p-6 font-mono font-black text-rose-500">{dr.pricePaid !== undefined ? `RM ${dr.pricePaid}` : '-'}</td>
                          <td className="p-6 text-right opacity-40 font-mono text-[10px]">
                             {dr.timestamp?.toDate ? format(dr.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : (dr.timestamp ? format(new Date(dr.timestamp), 'yyyy-MM-dd HH:mm:ss') : 'Recently')}
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
               {loading && (
                 <div className="p-20 text-center text-xs font-bold opacity-20 uppercase tracking-widest">Hydrating global unbox journal...</div>
               )}
               {!loading && draws.length === 0 && (
                 <div className="p-20 text-center text-xs font-bold opacity-20 uppercase tracking-widest">No unboxing history draws found</div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
