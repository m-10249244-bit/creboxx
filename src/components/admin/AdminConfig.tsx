import React from 'react';
import { useConfig } from '../ConfigContext';
import { Settings, ShieldAlert, UserPlus, Zap, Wallet, Gift, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AdminConfig() {
  const { config, updateConfig } = useConfig();

  const toggle = (key: string) => {
    updateConfig({ [key]: !(config as any)[key] });
  };

  const handleChange = (key: string, value: number) => {
    updateConfig({ [key]: value });
  };

  const switches = [
    { key: 'maintenanceMode', label: 'Maintenance Mode', description: 'Take the site offline for updates', icon: ShieldAlert, color: 'text-red-500' },
    { key: 'allowRegistration', label: 'Allow New Registrations', description: 'Disable to stop new users from joining', icon: UserPlus, color: 'text-blue-500' },
    { key: 'allowDraw', label: 'Allow Drawings', description: 'Disable mystery box unboxing', icon: Zap, color: 'text-yellow-500' },
    { key: 'allowTopup', label: 'Allow Top-ups', description: 'Enable or disable the manual top-up system', icon: Wallet, color: 'text-green-500' }
  ];

  return (
    <div className="space-y-12">
      {/* System Switches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {switches.map((s) => (
          <div key={s.key} className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[24px] p-8 flex items-center justify-between shadow-sm group">
            <div className="flex items-center gap-6">
              <div className={cn("w-14 h-14 rounded-2xl bg-white border border-brand-border flex items-center justify-center shadow-sm transition-transform group-hover:scale-110", s.color)}>
                <s.icon size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold uppercase tracking-tight">{s.label}</h4>
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{s.description}</p>
              </div>
            </div>
            
            <button 
              onClick={() => toggle(s.key)}
              className={cn(
                "w-16 h-8 rounded-full border border-black relative transition-all duration-300",
                (config as any)[s.key] ? "bg-black" : "bg-white"
              )}
            >
              <div className={cn(
                "absolute top-1 w-6 h-6 rounded-full border border-black transition-all duration-300",
                (config as any)[s.key] ? "left-9 bg-white" : "left-1 bg-black/5"
              )} />
            </button>
          </div>
        ))}
      </div>

      {/* Rewards System Configuration */}
      <div className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-10 space-y-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Gift size={24} className="opacity-40" />
          <h3 className="text-xl font-bold uppercase tracking-tight">Rewards & Thresholds</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Registration Reward (RM)</label>
            <input 
              type="number"
              value={config?.registrationReward}
              onChange={(e) => handleChange('registrationReward', parseFloat(e.target.value))}
              className="w-full bg-white/60 border border-brand-border rounded-xl px-6 py-4 text-3xl font-mono font-bold focus:border-black outline-none transition-colors"
            />
            <p className="text-[10px] italic opacity-40">Instant balance awarded to new users upon profile creation.</p>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Reward Member Limit</label>
            <input 
              type="number"
              value={config?.registrationRewardLimit}
              onChange={(e) => handleChange('registrationRewardLimit', parseInt(e.target.value))}
              className="w-full bg-white/60 border border-brand-border rounded-xl px-6 py-4 text-3xl font-mono font-bold focus:border-black outline-none transition-colors"
            />
            <p className="text-[10px] italic opacity-40">Stop rewards after this many users have claimed it.</p>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Min. Top-up Amount</label>
            <input 
              type="number"
              value={config?.minTopupAmount}
              onChange={(e) => handleChange('minTopupAmount', parseFloat(e.target.value))}
              className="w-full bg-white/60 border border-brand-border rounded-xl px-6 py-4 text-3xl font-mono font-bold focus:border-black outline-none transition-colors"
            />
            <p className="text-[10px] italic opacity-40">Lowest allowed amount for manual top-up requests.</p>
          </div>
        </div>
      </div>

      <div className="bg-black text-white rounded-[32px] p-10 flex items-center justify-between overflow-hidden relative group">
         <div className="space-y-2 relative z-10">
            <h3 className="text-2xl font-serif-italic italic">System Optimization</h3>
            <p className="text-sm opacity-60">All settings are applied instantly across the entire collective.</p>
         </div>
         <div className="flex gap-4 relative z-10">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><Volume2 size={20} /></div>
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><Sparkles size={20} /></div>
         </div>
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform" />
      </div>
    </div>
  );
}
