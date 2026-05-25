import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Plus, Edit3, Trash2, Tag, Archive, Sparkles, Image as ImageIcon, Upload, X, Save, Eye, EyeOff, ShieldCheck, AlertCircle, ShoppingBag, Settings, Layers } from 'lucide-react';
import { RARITY_COLORS } from '../../lib/utils';
import { compressImage, fileToBase64 } from '../../lib/imageUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

const STYLE_PRESETS = [
  { name: 'Sky Premium / Neon Blue', class: 'bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold' },
  { name: 'Emerald Sentinel / Green', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-semibold' },
  { name: 'Violet Cosmos / Purple', class: 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold' },
  { name: 'Sweet Rose / Cyber Pink', class: 'bg-pink-50 text-pink-700 border border-pink-200 font-bold' },
  { name: 'Golden Sovereign / Yellow', class: 'bg-yellow-105 text-yellow-850 bg-yellow-50 text-yellow-800 border-2 border-yellow-300 font-bold' },
  { name: 'Amber Core / Flare Orange', class: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold' },
  { name: 'Hyper Crimson / Deep Red', class: 'bg-red-50 text-red-700 border border-red-200 font-bold' },
  { name: 'Brutalist / Onyx Black', class: 'bg-neutral-900 text-neutral-100 border border-neutral-700 font-bold' },
  { name: 'Alloy / Clean Silver', class: 'bg-zinc-100 text-zinc-700 border border-zinc-300 font-semibold' },
];

export default function AdminProducts() {
  const { profile } = useAuth();
  const [boxes, setBoxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBox, setEditingBox] = useState<any | null>(null);
  const [editingBoxPrizes, setEditingBoxPrizes] = useState<any[]>([]);
  const [pityRules, setPityRules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Subtab choice for editor
  const [editorTab, setEditorTab] = useState<'details' | 'prizes' | 'pity'>('details');

  // Custom Rarity Tiers state
  const [customTiers, setCustomTiers] = useState<any[]>([]);
  const [editingTier, setEditingTier] = useState<any | null>(null);
  const [showTiersManager, setShowTiersManager] = useState(false);

  // Modal to add a new prize quickly
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [activePrize, setActivePrize] = useState<any>({
    id: '',
    name: '',
    rarity: 'Common',
    probability: 0.1,
    image: '',
    displayValue: 10,
    shippingRequired: true,
    stock: 999,
    enabled: true,
    // Advanced fields
    isLocked: false,
    whitelistUsers: [],
    blacklistUsers: [],
    riggedUserUid: '',
    hiddenRealProbability: undefined,
    timeLimitEnd: '',
    hideProbability: false
  });
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchBoxes();
    fetchPityRules();
    loadTiers();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to load registered system users:', e);
    }
  };

  const fetchBoxes = async () => {
    const q = query(collection(db, 'boxes'), orderBy('price', 'asc'));
    const snap = await getDocs(q);
    setBoxes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const fetchPityRules = async () => {
    const q = query(collection(db, 'pityRules'));
    const snap = await getDocs(q);
    setPityRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const loadTiers = () => {
    const store = localStorage.getItem('local_col_rarity_tiers');
    if (store) {
      try {
        const tiersObj = JSON.parse(store);
        setCustomTiers(Object.values(tiersObj));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleEdit = async (box: any) => {
    setEditorTab('details');
    if (box) {
      setEditingBox({ ...box });
      // Fetch actual prizes from subcollection
      const pSnap = await getDocs(collection(db, 'boxes', box.id, 'prizes'));
      const arr = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEditingBoxPrizes(arr);
    } else {
      setEditingBox({
        title: '',
        description: '',
        price: 25,
        coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60',
        rarity: 'Common',
        status: 'active',
        tags: ['SERIES 1'],
      });
      setEditingBoxPrizes([]);
    }
  };

  const handleSaveBox = async () => {
    if (!profile?.isAdmin || !editingBox) return;
    setIsSaving(true);
    try {
      const boxId = editingBox.id || `box-${Date.now()}`;
      
      // Save primary box document to boxes collection
      await setDoc(doc(db, 'boxes', boxId), {
        ...editingBox,
        id: boxId,
        updatedAt: serverTimestamp()
      });

      // Clear existing prizes in this subcollection first to avoid orphaned data
      const colRef = collection(db, 'boxes', boxId, 'prizes');
      const snap = await getDocs(colRef);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'boxes', boxId, 'prizes', d.id));
      }

      // Write each prize into Subcollectionboxes/${id}/prizes
      for (const p of editingBoxPrizes) {
        const pId = p.id || `p-${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, 'boxes', boxId, 'prizes', pId), {
          ...p,
          id: pId
        });
      }

      toast.success('Collection and prizes cached & synchronized successfully!');
      setEditingBox(null);
      fetchBoxes();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Could not save details map due to db permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBox = async (id: string) => {
    if (!profile?.isAdmin || !confirm('Are you ABSOLUTELY sure you want to delete this collection and all its sub-assets?')) return;
    try {
      await deleteDoc(doc(db, 'boxes', id));
      // Delete prizes subcollection
      const pSnap = await getDocs(collection(db, 'boxes', id, 'prizes'));
      for (const d of pSnap.docs) {
        await deleteDoc(doc(db, 'boxes', id, 'prizes', d.id));
      }
      toast.success('Collection purged successfully!');
      fetchBoxes();
    } catch (e) {
      toast.error('Deletion rejected.');
    }
  };

  const handleImageUpload = async (file: File) => {
    const compressed = await compressImage(file);
    return await fileToBase64(compressed);
  };

  // Add/refine a prize in localized array
  const pushPrizeToArray = () => {
    if (!activePrize.name.trim()) {
      toast.error('Prize name cannot be empty');
      return;
    }
    const finalImage = activePrize.image || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(activePrize.name)}&backgroundColor=b6e3f4`;
    const readyPrize = {
      ...activePrize,
      id: activePrize.id || `prize-${Date.now()}`,
      image: finalImage,
      whitelistUsers: Array.isArray(activePrize.whitelistUsers) ? activePrize.whitelistUsers : [],
      blacklistUsers: Array.isArray(activePrize.blacklistUsers) ? activePrize.blacklistUsers : [],
      riggedUserUid: activePrize.riggedUserUid || '',
      hiddenRealProbability: activePrize.hiddenRealProbability !== undefined && activePrize.hiddenRealProbability !== null ? Number(activePrize.hiddenRealProbability) : null,
      timeLimitEnd: activePrize.timeLimitEnd || ''
    };

    if (editingBoxPrizes.some(p => p.id === readyPrize.id)) {
      setEditingBoxPrizes(prev => prev.map(p => p.id === readyPrize.id ? readyPrize : p));
    } else {
      setEditingBoxPrizes(prev => [...prev, readyPrize]);
    }
    setShowPrizeModal(false);
    setActivePrize({ 
      id: '', name: '', rarity: 'Common', probability: 0.1, image: '', displayValue: 10, shippingRequired: true, stock: 999, enabled: true, 
      isLocked: false, whitelistUsers: [], blacklistUsers: [], riggedUserUid: '', hiddenRealProbability: undefined, timeLimitEnd: '', hideProbability: false 
    });
  };

  const startEditPrize = (pz: any) => {
    setActivePrize({ 
      id: pz.id || '',
      name: pz.name || '',
      rarity: pz.rarity || 'Common',
      probability: pz.probability !== undefined ? pz.probability : 0.1,
      image: pz.image || '',
      displayValue: pz.displayValue !== undefined ? pz.displayValue : 10,
      shippingRequired: pz.shippingRequired !== false,
      stock: pz.stock !== undefined ? pz.stock : 999,
      enabled: pz.enabled !== false,
      isLocked: pz.isLocked || false,
      whitelistUsers: Array.isArray(pz.whitelistUsers) ? pz.whitelistUsers : (pz.whitelistUsers ? pz.whitelistUsers.split(',').map((s: any) => s.trim()) : []),
      blacklistUsers: Array.isArray(pz.blacklistUsers) ? pz.blacklistUsers : (pz.blacklistUsers ? pz.blacklistUsers.split(',').map((s: any) => s.trim()) : []),
      riggedUserUid: pz.riggedUserUid || '',
      hiddenRealProbability: pz.hiddenRealProbability !== undefined && pz.hiddenRealProbability !== null ? pz.hiddenRealProbability : undefined,
      timeLimitEnd: pz.timeLimitEnd || '',
      hideProbability: pz.hideProbability || false
    });
    setShowPrizeModal(true);
  };

  const removePrizeFromArray = (id: string) => {
    setEditingBoxPrizes(prev => prev.filter(p => p.id !== id));
  };

  // Rarity Tier System Methods
  const handleSaveTier = () => {
    if (!editingTier || !editingTier.name.trim()) return;
    const storeObj = JSON.parse(localStorage.getItem('local_col_rarity_tiers') || '{}');
    
    // Auto-formatting unique ID
    const key = editingTier.name.trim();
    storeObj[key] = {
      id: key,
      name: key,
      style: editingTier.style || 'bg-neutral-100 text-neutral-600',
      sortOrder: editingTier.sortOrder || (Object.keys(storeObj).length + 1)
    };
    localStorage.setItem('local_col_rarity_tiers', JSON.stringify(storeObj));
    toast.success(`Prize Rarity Tier "${key}" synchronized successfully!`);
    setEditingTier(null);
    loadTiers();
  };

  const handleDeleteTier = (tierName: string) => {
    if (['Common', 'Rare', 'Epic', 'Secret'].includes(tierName)) {
      toast.error("Standard default system tiers cannot be deleted.");
      return;
    }
    if (!confirm(`Delete "${tierName}" rarity tier?`)) return;
    const storeObj = JSON.parse(localStorage.getItem('local_col_rarity_tiers') || '{}');
    delete storeObj[tierName];
    localStorage.setItem('local_col_rarity_tiers', JSON.stringify(storeObj));
    toast.success('Rarity Tier purged.');
    loadTiers();
  };

  // Pity Configuration Methods
  const [activePityRule, setActivePityRule] = useState<any>({
    id: '',
    boxId: '',
    name: '',
    type: 'spend', // spend or draws
    threshold: 50,
    resetOnTrigger: true,
    repeatable: true,
    guaranteedPrizes: [] // array of prize IDs or custom descriptions
  });
  const [showPityModal, setShowPityModal] = useState(false);

  const startEditPity = (rule: any) => {
    if (rule) {
      setActivePityRule({ 
        ...rule,
        onceOnly: rule.onceOnly || false
      });
    } else {
      setActivePityRule({
        id: '',
        boxId: editingBox?.id || '',
        name: 'Super Elite Pity',
        type: 'spend',
        threshold: 50,
        resetOnTrigger: true,
        repeatable: true,
        onceOnly: false,
        guaranteedPrizes: []
      });
    }
    setShowPityModal(true);
  };

  const handleSavePity = async () => {
    if (!activePityRule.name.trim()) {
      toast.error('Pity Rule Name is required.');
      return;
    }
    const targetBoxId = activePityRule.boxId || editingBox?.id || 'all';
    const ruleId = activePityRule.id || `pity-${Date.now()}`;
    
    const readyRule = {
      ...activePityRule,
      id: ruleId,
      boxId: targetBoxId,
      onceOnly: activePityRule.onceOnly || false,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'pityRules', ruleId), readyRule);
    toast.success('Pity control rules synchronized in database!');
    setShowPityModal(false);
    fetchPityRules();
  };

  const handleDeletePity = async (rId: string) => {
    if (!confirm('Purge this pity configuration?')) return;
    await deleteDoc(doc(db, 'pityRules', rId));
    toast.success('Pity rule deleted.');
    fetchPityRules();
  };

  return (
    <div className="space-y-12">
      {/* 1. Header Portion with active controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-3xl border border-brand-border p-8 rounded-[32px] shadow-sm">
        <div className="space-y-2">
          <h3 className="text-3xl font-serif-italic italic">Collection CMS & Rules Matrix</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">Customize platform boxes, seed real high-end prizes, manage dynamic rarity tiers, and build pity mechanics.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => setShowTiersManager(true)} className="cre-button bg-white text-black border border-black px-6 h-12 text-xs gap-2">
            ⚙️ MANAGE PRIZE TIERS
          </button>
          <button onClick={() => handleEdit(null)} className="cre-button bg-black text-white px-8 h-12 text-xs gap-3">
            <Plus size={16} /> NEW MYSTERY BOX
          </button>
        </div>
      </div>

      {/* Primary boxes list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {boxes.map((box) => (
          <div key={box.id} className={cn("cre-card bg-white p-8 space-y-6 group relative transition-all border border-transparent hover:border-black/10 hover:shadow-2xl", box.status === 'hidden' && "opacity-60")}>
            <div className="relative aspect-square rounded-[24px] overflow-hidden border border-black/5 bg-[#FAFCFF] shadow-inner">
               <img src={box.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={box.title} />
               <div className="absolute top-4 left-4 z-10 flex gap-2">
                  <span className={cn("text-[8px] font-black uppercase px-3 py-1 rounded-full border shadow-sm", RARITY_COLORS[box.rarity as keyof typeof RARITY_COLORS])}>
                    {box.rarity}
                  </span>
                  {box.status === 'hidden' && (
                    <span className="bg-zinc-800 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <EyeOff size={10} /> HIDDEN
                    </span>
                  )}
               </div>
               <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                  <button onClick={() => handleEdit(box)} className="px-6 py-2.5 bg-white text-black text-[10px] uppercase font-black tracking-widest rounded-full hover:scale-105 transition-transform shadow-xl">MANAGE OR REWRITE</button>
                  <button onClick={() => handleDeleteBox(box.id)} className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"><Trash2 size={16} /></button>
               </div>
            </div>
            
            <div className="space-y-2">
               <div className="flex justify-between items-start">
                  <h4 className="text-xl font-bold tracking-tight">{box.title}</h4>
                  <span className="font-mono font-bold text-lg text-black">{box.price ? `RM${box.price}` : 'Free'}</span>
               </div>
               <p className="text-xs text-zinc-400 font-medium line-clamp-2">{box.description}</p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-black/5">
                <div className="flex gap-1">
                  {box.tags?.map((t: string) => (
                    <span key={t} className="text-[8px] font-bold text-black/40 uppercase tracking-widest">{t}</span>
                  ))}
                </div>
                <span className="text-[8px] font-black uppercase py-1 px-3 bg-neutral-50 rounded-full border border-black/5">{box.status || 'Active'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Box Modifier Modal */}
      <AnimatePresence>
        {editingBox && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingBox(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} className="relative w-full max-w-6xl bg-[#F5F9FF] rounded-[40px] overflow-hidden shadow-2xl flex flex-col h-[90vh]">
               
               {/* Header strip */}
               <div className="p-8 border-b border-black/5 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black text-white rounded-[16px] flex items-center justify-center">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold uppercase tracking-tight">{editingBox.id ? 'Refine Platform Mystery Box' : 'Configure New Platform Asset'}</h3>
                      <p className="text-[9px] opacity-40 font-bold uppercase tracking-widest">REAL-TIME FILE SYSTEM SCHEMA WRITE</p>
                    </div>
                  </div>
                  
                  {/* Nest choosing buttons */}
                  <div className="flex border border-black/5 p-1 bg-neutral-50 rounded-full ml-12">
                    {['details', 'prizes', 'pity'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setEditorTab(tab as any)}
                        className={cn(
                          "px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                          editorTab === tab ? "bg-black text-white" : "text-zinc-400 hover:text-black"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setEditingBox(null)} className="bg-black/5 p-2 rounded-full hover:bg-black/10 transition-all ml-auto"><X size={20} /></button>
               </div>

               {/* Inner dynamic content block based on select */}
               <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                  {editorTab === 'details' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Aspect Cover Display</label>
                        <div className="relative aspect-square rounded-[32px] border-2 border-dashed border-black/10 overflow-hidden bg-white flex flex-col items-center justify-center p-6 bg-radial">
                           {editingBox.coverImage ? (
                             <>
                               <img src={editingBox.coverImage} className="w-full h-full object-contain filter drop-shadow-md" alt="cover_pre" />
                               <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex flex-col items-center justify-center transition-opacity rounded-[32px]">
                                  <label className="cre-button bg-white text-black text-xs cursor-pointer px-6">
                                    <Upload size={14} /> REPLACE DISPLAY
                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const b64 = await handleImageUpload(file);
                                        setEditingBox({ ...editingBox, coverImage: b64 });
                                      }
                                    }} />
                                  </label>
                               </div>
                             </>
                           ) : (
                             <label className="flex flex-col items-center gap-4 cursor-pointer">
                               <Upload size={32} className="opacity-30" />
                               <p className="text-xs uppercase font-bold text-zinc-400">Upload visual render</p>
                               <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                   const b64 = await handleImageUpload(file);
                                   setEditingBox({ ...editingBox, coverImage: b64 });
                                 }
                               }} />
                             </label>
                           )}
                        </div>

                        <div className="space-y-3 pt-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Detail Gallery Images (Bottom 3 Slots)</label>
                           <p className="text-[9px] text-zinc-400 font-bold uppercase leading-tight">Interactive previews shown under the main cover image on the collection details page.</p>
                           <div className="grid grid-cols-3 gap-3">
                             {[0, 1, 2].map((idx) => {
                               const detailImages = editingBox.detailImages || ['', '', ''];
                               const imgUrl = detailImages[idx] || '';
                               return (
                                 <div key={idx} className="relative aspect-video rounded-xl border-2 border-dashed border-black/10 overflow-hidden bg-white flex flex-col items-center justify-center p-1 group">
                                   {imgUrl ? (
                                     <>
                                       <img src={imgUrl} className="w-full h-full object-cover rounded-lg" alt="" />
                                       <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity rounded-xl gap-1">
                                         <label className="cursor-pointer bg-white text-black text-[8px] font-black px-1.5 py-0.5 rounded">
                                           REPLACE
                                           <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                             const file = e.target.files?.[0];
                                             if (file) {
                                               const b64 = await handleImageUpload(file);
                                               const copy = [...detailImages];
                                               copy[idx] = b64;
                                               setEditingBox({ ...editingBox, detailImages: copy });
                                               toast.success(`Gallery Image Slot ${idx + 1} updated!`);
                                             }
                                           }} />
                                         </label>
                                         <button 
                                           onClick={() => {
                                             const copy = [...detailImages];
                                             copy[idx] = '';
                                             setEditingBox({ ...editingBox, detailImages: copy });
                                             toast.success(`Purged Gallery Slot ${idx + 1}`);
                                           }} 
                                           className="text-[8px] text-red-500 hover:text-red-700 font-black uppercase"
                                         >
                                           PURGE
                                         </button>
                                       </div>
                                     </>
                                   ) : (
                                     <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                                       <Upload size={14} className="opacity-30" />
                                       <span className="text-[7px] font-bold text-zinc-400 uppercase">Slot {idx + 1}</span>
                                       <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                         const file = e.target.files?.[0];
                                         if (file) {
                                           const b64 = await handleImageUpload(file);
                                           const copy = [...detailImages];
                                           copy[idx] = b64;
                                           setEditingBox({ ...editingBox, detailImages: copy });
                                           toast.success(`Uploaded Gallery Image for Slot ${idx + 1}!`);
                                         }
                                       }} />
                                     </label>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Collection Identifier</label>
                           <input type="text" value={editingBox.title} onChange={(e) => setEditingBox({...editingBox, title: e.target.value})} className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-bold text-xl focus:border-black outline-none transition-all shadow-sm" required />
                         </div>

                         <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ticket Price (RM)</label>
                              <input type="number" step="0.01" value={editingBox.price} onChange={(e) => setEditingBox({...editingBox, price: parseFloat(e.target.value) || 0})} className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-mono font-bold text-xl focus:border-black outline-none transition-all shadow-sm" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Top Rarity Tier</label>
                              <select value={editingBox.rarity} onChange={(e) => setEditingBox({...editingBox, rarity: e.target.value})} className="w-full h-full bg-white border border-brand-border rounded-xl px-4 font-bold text-sm focus:border-black outline-none transition-all shadow-sm">
                                 {customTiers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                 {customTiers.length === 0 && Object.keys(RARITY_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                           </div>
                         </div>

                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Curation Description</label>
                           <textarea value={editingBox.description} onChange={(e) => setEditingBox({...editingBox, description: e.target.value})} rows={3} className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 text-sm font-medium focus:border-black outline-none transition-all shadow-sm resize-none" />
                          </div>

                          <div className="bg-[#FAFCFF] border border-brand-border p-5 rounded-2xl flex items-center justify-between mt-4">
                            <div>
                              <p className="text-[10px] font-black uppercase text-black">Hide Out-Of-Stock Prizes (缺货自动隐藏)</p>
                              <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">If enabled, out-of-stock prizes are hidden from clients, otherwise they remain visible but can't be drawn.</p>
                            </div>
                            <input type="checkbox" checked={editingBox.hideOutOfStock || false} onChange={(e) => setEditingBox({ ...editingBox, hideOutOfStock: e.target.checked })} className="w-5 h-5 rounded border-zinc-300 text-black focus:ring-black cursor-pointer" />
                         </div>

                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ecosystem Visibility Status</label>
                           <div className="grid grid-cols-3 gap-4">
                              {[
                                { status: 'active', desc: 'Active & Displayed' },
                                { status: 'hidden', desc: 'Disabled/Hidden entirely' },
                                { status: 'sold_out', desc: 'Sold Out' }
                              ].map(colStatus => (
                                <button key={colStatus.status} onClick={() => setEditingBox({...editingBox, status: colStatus.status})} className={cn("px-4 py-3 rounded-xl border font-bold text-[9px] uppercase tracking-widest transition-all text-center flex flex-col justify-center items-center gap-1", editingBox.status === colStatus.status ? "border-black bg-black text-white shadow-md shadow-neutral-300" : "border-brand-border bg-white text-zinc-400 hover:border-black/20")}>
                                  <span>{colStatus.status}</span>
                                  <span className="text-[7px] leading-none opacity-50 lowercase">{colStatus.desc}</span>
                                </button>
                              ))}
                           </div>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* Prizes sub-collection panel */}
                  {editorTab === 'prizes' && (
                    <div className="space-y-8 animate-fade-in">
                       <div className="flex items-center justify-between">
                         <div>
                           <h4 className="text-lg font-bold uppercase tracking-tight">Prize Inventory Map ({editingBoxPrizes.length})</h4>
                           <p className="text-[9px] text-zinc-400 font-bold uppercase">Weighted draw probability system. Sum should reach 1.0 (100%).</p>
                         </div>
                         <button onClick={() => {
                           setActivePrize({ 
                             id: '', name: '', rarity: 'Common', probability: 0.1, image: '', displayValue: 10, shippingRequired: true, stock: 999, enabled: true, 
                             isLocked: false, whitelistUsers: [], blacklistUsers: [], riggedUserUid: '', hiddenRealProbability: undefined, timeLimitEnd: '', hideProbability: false 
                           });
                           setShowPrizeModal(true);
                         }} className="cre-button bg-black text-white px-6 h-10 text-[10px]">
                           + ADD PRIZE TO COLLECTION
                         </button>
                       </div>

                       {/* List existing ones */}
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {editingBoxPrizes.map((p, pIdx) => (
                           <div key={p.id || pIdx} className="bg-white border border-brand-border p-6 rounded-3xl flex items-center gap-4 relative group">
                              <div className="w-16 h-16 bg-neutral-50 rounded-2xl border border-black/5 flex items-center justify-center p-2 shrink-0">
                                <img src={p.image} className="w-full h-full object-contain filter drop-shadow-sm" alt="prize_visual" />
                              </div>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-sm tracking-tight truncate">{p.name}</h5>
                                  {p.isLocked && <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">LOCKED</span>}
                                </div>
                                <div className="flex gap-2 items-center flex-wrap">
                                  <span className={cn("text-[7px] font-black uppercase px-2 py-0.5 rounded-full", RARITY_COLORS[p.rarity as keyof typeof RARITY_COLORS])}>{p.rarity}</span>
                                  <span className="text-[10px] font-mono opacity-40 font-bold">Prob: {(p.probability * 100).toFixed(1)}%</span>
                                  <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">RM {p.displayValue || 0}</span>
                                  <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded", p.shippingRequired !== false ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700")}>
                                    {p.shippingRequired !== false ? "📦 Real Shipping" : "⚡ Auto-Issue"}
                                  </span>
                                  <span className={cn("text-[8px] font-mono font-bold px-1.5 py-0.5 rounded", (p.stock || 0) <= 0 ? "bg-red-50 text-red-600" : "bg-neutral-50 text-neutral-600")}>
                                    Stock: {p.stock !== undefined ? p.stock : "Infinite"}
                                  </span>
                                  {p.enabled === false && <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded">DISABLED</span>}
                                </div>
                                {(p.whitelistUsers || p.blacklistUsers) && (
                                  <p className="text-[7px] text-zinc-400 uppercase font-bold tracking-tight">Has rule filters</p>
                                )}
                              </div>

                              {/* Overlays / quick actions */}
                              <div className="absolute top-3 right-3 flex gap-1 bg-white p-1 rounded-xl shadow-md border border-black/5 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={() => startEditPrize(p)} className="p-1 text-zinc-400 hover:text-black hover:bg-neutral-50 rounded"><Edit3 size={14} /></button>
                                 <button onClick={() => removePrizeFromArray(p.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                              </div>
                           </div>
                         ))}

                         {editingBoxPrizes.length === 0 && (
                           <div className="col-span-full py-16 text-center bg-white border border-brand-border/60 rounded-[32px]">
                              <ShoppingBag size={36} className="mx-auto text-zinc-300 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No prizes configured inside. Users can never draw this box until prizes are seeded!</p>
                           </div>
                         )}
                       </div>
                    </div>
                  )}

                  {/* Guaranteed Pity System configuration */}
                  {editorTab === 'pity' && (
                    <div className="space-y-8">
                       <div className="flex justify-between items-center">
                         <div>
                            <h4 className="text-lg font-bold uppercase tracking-tight">Guaranteed Pity / Pity Mechanics</h4>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase">Trigger high-value dynamic overrides once a specific milestone is met by users of this collection.</p>
                         </div>
                         <button onClick={() => startEditPity(null)} className="cre-button bg-black text-white px-6 h-10 text-[10px]">
                           + NEW CONFLICT RULE
                         </button>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {pityRules.filter(r => r.boxId === editingBox.id || r.boxId === 'all').map(rule => (
                           <div key={rule.id} className="bg-white border border-brand-border p-6 rounded-[28px] space-y-4">
                              <div className="flex items-center justify-between">
                                 <div>
                                   <h5 className="font-bold text-sm uppercase tracking-tight">{rule.name}</h5>
                                   <p className="text-[8px] font-mono text-zinc-400 uppercase font-bold">Ref: {rule.id}</p>
                                 </div>
                                 <div className="flex gap-2">
                                   <button onClick={() => startEditPity(rule)} className="p-1 px-2 border border-black/5 text-[9px] font-bold rounded uppercase hover:bg-neutral-50">Edit</button>
                                   <button onClick={() => handleDeletePity(rule.id)} className="p-1 px-2 border border-red-200 text-red-500 hover:bg-red-50 rounded text-[9px] font-bold uppercase">Delete</button>
                                 </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase text-zinc-500 bg-neutral-50 p-4 rounded-xl border border-black/5">
                                 <div>
                                    <p className="text-[7px] text-zinc-400">Threshold Trigger</p>
                                    <p className="text-black font-semibold text-xs">{rule.type === 'spend' ? `RM ${rule.threshold}` : `${rule.threshold} draws`}</p>
                                 </div>
                                 <div>
                                    <p className="text-[7px] text-zinc-400">Repeatable</p>
                                    <p className="text-black font-semibold text-xs">{rule.repeatable ? 'Yes' : 'One-Time'}</p>
                                 </div>
                                 <div className="col-span-2">
                                    <p className="text-[7px] text-zinc-400">Overriding Prize Candidates</p>
                                    <p className="text-black text-[9px] leading-relaxed mt-1">
                                      {rule.guaranteedPrizes?.length ? rule.guaranteedPrizes.join(', ') : 'Random High Rarity'}
                                    </p>
                                 </div>
                              </div>
                           </div>
                         ))}
                         {pityRules.filter(r => r.boxId === editingBox.id || r.boxId === 'all').length === 0 && (
                           <div className="col-span-full py-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest bg-white border border-brand-border rounded-3xl">
                             No pity limits or guarantees configured. Add one to delight users when they spend RM50 or 30 draws!
                           </div>
                         )}
                       </div>
                    </div>
                  )}
               </div>

               {/* Overwrite save strip */}
               <div className="p-8 border-t border-black/5 bg-white flex justify-end gap-6">
                  <button onClick={() => setEditingBox(null)} className="px-10 py-4 bg-white border border-black/10 rounded-[20px] font-bold text-[10px] uppercase tracking-widest hover:bg-neutral-50 transition-all">CLOSE CMS</button>
                  <button 
                    disabled={isSaving}
                    onClick={handleSaveBox} 
                    className="cre-button bg-black text-white px-12 h-14 text-xs shadow-2xl flex gap-3"
                  >
                    {isSaving ? 'PERSISTING CLOUD STORAGE...' : <><Save size={16} /> SAVE & PURGE STATE CACHE</>}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Prize Control edit popup */}
      <AnimatePresence>
        {showPrizeModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#FAFCFF] p-8 md:p-10 rounded-[36px] w-full max-w-xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
               <div className="flex justify-between items-center pb-4 border-b border-black/5">
                 <h4 className="text-lg font-bold uppercase tracking-tight">{activePrize.id ? 'Refine Prize Parameters' : 'Register New Collectible Prize'}</h4>
                 <button onClick={() => setShowPrizeModal(false)} className="bg-black/5 p-2 rounded-full hover:bg-black/10"><X size={16} /></button>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Prize Label / Name</label>
                    <input type="text" value={activePrize.name} onChange={(e) => setActivePrize({ ...activePrize, name: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 placeholder:opacity-30 outline-none focus:border-black font-semibold" placeholder="e.g., Vanguard Golden Sovereign Core" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Display Value (展示价值 RM)</label>
                      <input type="number" step="0.01" value={activePrize.displayValue !== undefined ? activePrize.displayValue : 10} onChange={(e) => setActivePrize({ ...activePrize, displayValue: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono font-bold text-xs focus:border-black outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Prize Stock (库存数量)</label>
                      <input type="number" value={activePrize.stock !== undefined ? activePrize.stock : 999} onChange={(e) => setActivePrize({ ...activePrize, stock: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono font-bold text-xs focus:border-black outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-black/5">
                     <div className="flex items-center gap-3">
                        <input type="checkbox" id="pz_ship" checked={activePrize.shippingRequired !== false} onChange={(e) => setActivePrize({ ...activePrize, shippingRequired: e.target.checked })} className="w-4 h-4 rounded text-black focus:ring-black border-zinc-200" />
                        <div>
                          <label htmlFor="pz_ship" className="text-[9px] font-black uppercase text-zinc-650 block cursor-pointer">Physical Shipping Needed</label>
                          <span className="text-[7px] text-zinc-400 block mt-0.5">Vouchers/Credit won't need mailing</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <input type="checkbox" id="pz_en" checked={activePrize.enabled !== false} onChange={(e) => setActivePrize({ ...activePrize, enabled: e.target.checked })} className="w-4 h-4 rounded text-black focus:ring-black border-zinc-200" />
                        <div>
                          <label htmlFor="pz_en" className="text-[9px] font-black uppercase text-zinc-650 block cursor-pointer">Enabled / Active prize</label>
                          <span className="text-[7px] text-zinc-400 block mt-0.5">Allow unboxing rolls</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-1">
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Rarity</label>
                      <select value={activePrize.rarity} onChange={(e) => setActivePrize({ ...activePrize, rarity: e.target.value })} className="w-full pr-8 h-[46px] bg-white border border-brand-border rounded-xl px-4 font-bold text-xs focus:border-black outline-none appearance-none">
                         {customTiers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                         {customTiers.length === 0 && Object.keys(RARITY_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Probability Weight (0.00 to 1.00)</label>
                      <input type="number" step="0.001" min="0" max="1" value={activePrize.probability} onChange={(e) => setActivePrize({ ...activePrize, probability: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono font-bold text-xs" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Prize Image Asset</label>
                    <div className="relative h-28 w-full rounded-2xl border-2 border-dashed border-black/10 overflow-hidden bg-white flex flex-col items-center justify-center p-3">
                       {activePrize.image ? (
                         <div className="flex items-center gap-4 w-full h-full justify-between">
                           <img src={activePrize.image} className="h-full w-24 object-contain" alt="" />
                           <div className="flex-1 text-left">
                             <p className="text-[8px] text-zinc-500 font-bold">Base64 Asset Loaded</p>
                             <p className="text-[7px] text-zinc-400 truncate max-w-[150px] font-mono">{activePrize.image.slice(0, 30)}...</p>
                             <label className="text-[8px] font-black uppercase tracking-widest bg-black text-white px-3 py-1.5 rounded-full cursor-pointer hover:bg-neutral-800 transition-colors inline-block mt-2">
                               Change Image
                               <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                   const b64 = await handleImageUpload(file);
                                   setActivePrize({ ...activePrize, image: b64 });
                                 }
                               }} />
                             </label>
                           </div>
                         </div>
                       ) : (
                         <label className="flex flex-col items-center gap-2 cursor-pointer text-center">
                           <Upload size={20} className="opacity-30" />
                           <p className="text-[9px] uppercase font-bold text-zinc-400">Upload visual asset</p>
                           <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                               const b64 = await handleImageUpload(file);
                               setActivePrize({ ...activePrize, image: b64 });
                             }
                           }} />
                         </label>
                       )}
                    </div>
                  </div>

                  {/* Advanced Prize Control Section (Tucked cleanly) */}
                  <div className="border border-brand-border p-4 rounded-2xl bg-neutral-50 space-y-4">
                     <p className="text-[9px] font-black uppercase tracking-widest text-[#2E4057] flex items-center gap-1">
                       <ShieldCheck size={12} /> Advanced System Controls (Hidden from Client)
                     </p>

                     <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                        <div>
                          <p className="text-[9px] font-black uppercase text-black">Globally Blocked (暂时不可抽出所有人)</p>
                          <p className="text-[7px] text-zinc-400 leading-none lowercase">All users are temporarily blocked from drawing this prize</p>
                        </div>
                        <input type="checkbox" checked={activePrize.isLocked || false} onChange={(e) => setActivePrize({ ...activePrize, isLocked: e.target.checked })} className="w-4 h-4 rounded text-black focus:ring-black border-zinc-300" />
                     </div>

                     <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                        <div>
                          <p className="text-[9px] font-black uppercase text-black font-bold text-red-500">Hide True Rate (隐藏真实概率)</p>
                          <p className="text-[7px] text-zinc-400 leading-none lowercase">If enabled, the real unboxing roll uses the field below but displays the standard probability on frontend</p>
                        </div>
                        <input type="checkbox" checked={activePrize.hideProbability || false} onChange={(e) => setActivePrize({ ...activePrize, hideProbability: e.target.checked })} className="w-4 h-4 rounded text-black focus:ring-black border-zinc-300" />
                     </div>

                     {/* Hidden Real Probability Input */}
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-black">Hidden Real Probability / 后台真实掉率</label>
                        <p className="text-[7px] text-zinc-400 leading-tight">留空表示使用前台显示的概率。可设置为 0 以致于所有人/选择的人无法抽中（即使前台仍显示有货且概率正常）</p>
                        <input 
                          type="number" 
                          step="0.001" 
                          min="0" 
                          max="1" 
                          value={activePrize.hiddenRealProbability !== undefined && activePrize.hiddenRealProbability !== null ? activePrize.hiddenRealProbability : ''} 
                          onChange={(e) => setActivePrize({ ...activePrize, hiddenRealProbability: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          className="w-full bg-white border border-brand-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold" 
                          placeholder="e.g. 0.00 to 1.00 (Blank to use Display Probability)"
                        />
                     </div>

                     {/* Whitelist User Checklist */}
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-black">Whitelist Users / 指定用户可抽出（选择，非手写）</label>
                        <p className="text-[7px] text-zinc-400 leading-tight">若选择用户，则仅这部分特定用户可以抽到此奖品，其他人均不可抽出</p>
                        <div className="border border-brand-border rounded-xl bg-white p-2 max-h-32 overflow-y-auto space-y-1">
                          {users.map((u) => {
                            const isChecked = activePrize.whitelistUsers?.includes(u.id) || false;
                            return (
                              <label key={u.id} className="flex items-center gap-2 py-0.5 px-2 hover:bg-neutral-50 rounded cursor-pointer text-[10px] font-semibold text-zinc-600">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const list = activePrize.whitelistUsers || [];
                                    if (e.target.checked) {
                                      setActivePrize({ ...activePrize, whitelistUsers: [...list, u.id] });
                                    } else {
                                      setActivePrize({ ...activePrize, whitelistUsers: list.filter((id: string) => id !== u.id) });
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-black border-zinc-300 rounded focus:ring-black"
                                />
                                <span className="truncate">{u.displayName || u.email || 'Mystery Resident'} <span className="text-[8px] font-mono opacity-50">({u.id.slice(0, 8)})</span></span>
                              </label>
                            );
                          })}
                          {users.length === 0 && <p className="text-[8px] text-zinc-400 text-center py-2">No users registered yet.</p>}
                        </div>
                     </div>

                     {/* Blacklist User Checklist */}
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-black">Blacklist Users / 指定用户不可抽出（选择，非手写）</label>
                        <p className="text-[7px] text-zinc-400 leading-tight">被选择的用户将不能抽到此奖品（即使前台概率跟库存显示正常）</p>
                        <div className="border border-brand-border rounded-xl bg-white p-2 max-h-32 overflow-y-auto space-y-1">
                          {users.map((u) => {
                            const isChecked = activePrize.blacklistUsers?.includes(u.id) || false;
                            return (
                              <label key={u.id} className="flex items-center gap-2 py-0.5 px-2 hover:bg-neutral-50 rounded cursor-pointer text-[10px] font-semibold text-zinc-600">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const list = activePrize.blacklistUsers || [];
                                    if (e.target.checked) {
                                      setActivePrize({ ...activePrize, blacklistUsers: [...list, u.id] });
                                    } else {
                                      setActivePrize({ ...activePrize, blacklistUsers: list.filter((id: string) => id !== u.id) });
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-black border-zinc-300 rounded focus:ring-black"
                                />
                                <span className="truncate">{u.displayName || u.email || 'Mystery Resident'} <span className="text-[8px] font-mono opacity-50">({u.id.slice(0, 8)})</span></span>
                              </label>
                            );
                          })}
                          {users.length === 0 && <p className="text-[8px] text-zinc-400 text-center py-2">No users registered yet.</p>}
                        </div>
                     </div>

                     {/* Rigged Target User dropdown */}
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-black">Rigged Winner Target / 指定必中用户</label>
                        <p className="text-[7px] text-zinc-400 leading-tight">选中本必中用户的下一次开箱必定获得该奖品（中奖后后台会自动清除该配额，绝不露陷）</p>
                        <select 
                          value={activePrize.riggedUserUid || ''}
                          onChange={(e) => setActivePrize({ ...activePrize, riggedUserUid: e.target.value })}
                          className="w-full h-10 bg-white border border-brand-border rounded-xl px-3 font-semibold text-xs text-neutral-800 outline-none focus:border-black appearance-none"
                        >
                          <option value="">-- No Rigging Active / 无指定必中 --</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.displayName || u.email || 'Mystery Resident'} ({u.id.slice(0, 10)}...)</option>
                          ))}
                        </select>
                     </div>

                     {/* Time-Limited open settings */}
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-black">Limited Time Open End / 限时开放截止时间</label>
                        <p className="text-[7px] text-zinc-400 leading-tight">设置截止时间：时间到自动在前端及抽奖中隐藏；在这之前前端会有显眼霓虹氛围灯与剩余时间倒计时呈现！</p>
                        <input 
                          type="datetime-local" 
                          value={activePrize.timeLimitEnd || ''} 
                          onChange={(e) => setActivePrize({ ...activePrize, timeLimitEnd: e.target.value })} 
                          className="w-full bg-white border border-brand-border rounded-xl px-4 py-2.5 font-mono text-xs focus:border-black outline-none font-bold"
                        />
                     </div>
                  </div>
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                 <button onClick={() => setShowPrizeModal(false)} className="px-6 py-3 border border-black/10 text-[9px] font-bold rounded-full uppercase hover:bg-neutral-50">Cancel</button>
                 <button onClick={pushPrizeToArray} className="cre-button bg-black text-white px-8 h-10 text-[10px]">SAVE PRIZE ARTIFACT</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tiers Manager Modal */}
      <AnimatePresence>
        {showTiersManager && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#FAFCFF] p-8 rounded-[36px] w-full max-w-4xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
               <div className="flex justify-between items-center pb-4 border-b border-black/5">
                 <div className="flex items-center gap-2">
                   <Layers size={20} className="text-zinc-600" />
                   <h4 className="text-lg font-bold uppercase tracking-tight">Manage Rarity Tiers</h4>
                 </div>
                 <button onClick={() => setShowTiersManager(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X size={16} /></button>
               </div>

               <div className="flex justify-between items-center">
                 <p className="text-xs text-zinc-500 font-medium font-semibold uppercase tracking-wider text-zinc-400 text-[10px]">Create and manage prize tier styles without writing CSS manually.</p>
                 <button 
                   onClick={() => setEditingTier({ name: '', style: STYLE_PRESETS[0].class, sortOrder: customTiers.length + 1 })} 
                   className="px-5 py-2.5 bg-black text-white text-[10px] font-black uppercase rounded-full tracking-wider hover:bg-neutral-800 transition-all shadow-sm"
                 >
                   + Add Custom Tier
                 </button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {customTiers.map(t => (
                   <div key={t.id} className="bg-white border border-black/5 p-4 rounded-2xl flex flex-col justify-between hover:border-black transition-all">
                     <div className="space-y-2">
                       <div className={cn("px-3 py-1.5 text-[10px] font-black uppercase rounded-full text-center tracking-wider", t.style)}>
                         {t.name}
                       </div>
                       <p className="text-[9px] text-zinc-400 uppercase font-mono tracking-tight text-center">Order priority: {t.sortOrder || 1}</p>
                     </div>
                     <div className="flex gap-2 justify-center mt-3 pt-2 border-t border-black/5">
                       <button onClick={() => setEditingTier(t)} className="p-1 px-3 text-[9px] font-bold text-zinc-500 hover:text-black uppercase hover:underline">Edit</button>
                       <button onClick={() => handleDeleteTier(t.name)} className="p-1 px-3 text-[9px] font-bold text-red-500 hover:text-red-700 uppercase hover:underline">Delete</button>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="flex justify-end pt-4 border-t border-black/5">
                 <button onClick={() => setShowTiersManager(false)} className="cre-button bg-black text-white px-8 h-10 text-[10px]">SAVE & CLOSE</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rarity Tier Add/Edit modal */}
      <AnimatePresence>
        {editingTier && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#FAFCFF] p-8 rounded-[36px] w-full max-w-md shadow-2xl space-y-6">
               <div className="flex justify-between items-center pb-4 border-b border-black/5">
                 <h4 className="text-lg font-bold uppercase tracking-tight">Rarity Tier Editor</h4>
                 <button onClick={() => setEditingTier(null)} className="p-1"><X size={16} /></button>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400">Rarity Tier Name / Key</label>
                    <input type="text" value={editingTier.name} onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-bold" placeholder="e.g. Hidden, Limited, Mythic" disabled={!!editingTier.id} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-zinc-400">Select Style Preset</label>
                      <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase rounded-full tracking-wider", editingTier.style)}>
                        {editingTier.name || 'Preview'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-brand-border rounded-xl bg-white">
                      {STYLE_PRESETS.map((preset) => {
                        const isSelected = editingTier.style === preset.class;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setEditingTier({ ...editingTier, style: preset.class })}
                            className={cn(
                              "p-2 rounded-lg border text-left transition-all flex flex-col gap-1 items-stretch",
                              isSelected ? "border-black bg-black/5" : "border-black/5 hover:border-black/20 bg-white"
                            )}
                          >
                            <span className="text-[8px] font-bold text-zinc-500 leading-none truncate">{preset.name}</span>
                            <span className={cn("px-1.5 py-0.5 text-[8px] font-black uppercase rounded-full text-center tracking-wider max-w-[100px] truncate mx-auto mt-1", preset.class)}>
                              Aa
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400">Sorting Priority (Greater values draw higher in details list)</label>
                    <input type="number" value={editingTier.sortOrder} onChange={(e) => setEditingTier({ ...editingTier, sortOrder: parseInt(e.target.value) || 1 })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono text-xs" />
                  </div>
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                 <button onClick={() => setEditingTier(null)} className="px-6 py-2.5 text-[9px] font-bold uppercase hover:bg-neutral-50 rounded-full">Cancel</button>
                 <button onClick={handleSaveTier} className="cre-button bg-black text-white px-8 h-10 text-[10px]">SAVE PROTOCOL</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pity Rule Modifier Modal */}
      <AnimatePresence>
        {showPityModal && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#FAFCFF] p-8 md:p-10 rounded-[36px] w-full max-w-lg shadow-2xl space-y-6">
               <div className="flex justify-between items-center pb-4 border-b border-black/5">
                 <h4 className="text-lg font-bold uppercase tracking-tight">Setup Guaranteed Pity Rule</h4>
                 <button onClick={() => setShowPityModal(false)} className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full"><X size={14} /></button>
               </div>

               <div className="space-y-4 text-xs font-medium">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400">Pity Rule Name Title</label>
                    <input type="text" value={activePityRule.name} onChange={(e) => setActivePityRule({ ...activePityRule, name: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-bold text-sm" placeholder="e.g. Elite RM50 Guarantee" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400">Trigger Progress Track</label>
                      <select value={activePityRule.type} onChange={(e) => setActivePityRule({ ...activePityRule, type: e.target.value })} className="w-full h-[46px] bg-white border border-brand-border rounded-xl px-4 font-bold">
                         <option value="spend">Cumulative Spend (RM)</option>
                         <option value="draws">Cumulative Draws Count</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400">Trigger Threshold Value</label>
                      <input type="number" min="1" value={activePityRule.threshold} onChange={(e) => setActivePityRule({ ...activePityRule, threshold: parseFloat(e.target.value) || 1 })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono font-bold" />
                    </div>
                  </div>

                   <div className="grid grid-cols-3 gap-2 py-3 border-y border-black/5">
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" id="pt_rpt" checked={activePityRule.repeatable !== false} onChange={(e) => setActivePityRule({ ...activePityRule, repeatable: e.target.checked })} className="w-4 h-4 rounded text-black border-zinc-300 focus:ring-black" />
                        <label htmlFor="pt_rpt" className="text-[8px] font-bold uppercase text-zinc-500 cursor-pointer">Repeat / 可重复</label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" id="pt_rst" checked={activePityRule.resetOnTrigger !== false} onChange={(e) => setActivePityRule({ ...activePityRule, resetOnTrigger: e.target.checked })} className="w-4 h-4 rounded text-black border-zinc-300 focus:ring-black" />
                        <label htmlFor="pt_rst" className="text-[8px] font-bold uppercase text-zinc-500 cursor-pointer">Reset / 重置</label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" id="pt_onc" checked={activePityRule.onceOnly || false} onChange={(e) => setActivePityRule({ ...activePityRule, onceOnly: e.target.checked })} className="w-4 h-4 rounded text-black border-zinc-300 focus:ring-black" />
                        <label htmlFor="pt_onc" className="text-[8px] font-bold uppercase text-zinc-500 cursor-pointer">Once / 仅一次</label>
                      </div>
                   </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-zinc-400 block">Select Overriding Guarantees / 选择多个保底奖品（系统随机抽出一个）</label>
                    <div className="border border-brand-border rounded-2xl bg-white p-3 max-h-48 overflow-y-auto space-y-2">
                      {editingBoxPrizes.map((p) => {
                        const isChecked = activePityRule.guaranteedPrizes?.includes(p.id) || false;
                        return (
                          <label key={p.id} className="flex items-center gap-3 p-1 hover:bg-neutral-50 rounded cursor-pointer text-[11px] font-semibold">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const list = activePityRule.guaranteedPrizes || [];
                                if (e.target.checked) {
                                  setActivePityRule({ ...activePityRule, guaranteedPrizes: [...list, p.id] });
                                } else {
                                  setActivePityRule({ ...activePityRule, guaranteedPrizes: list.filter((id) => id !== p.id) });
                                }
                              }}
                              className="w-4 h-4 text-black border-zinc-300 rounded focus:ring-black"
                            />
                            <div className="flex items-center gap-2">
                              {p.image && <img src={p.image} className="w-5 h-5 object-contain" alt="" />}
                              <span>{p.name} <span className="opacity-50 text-[9px] font-normal">({p.rarity})</span></span>
                            </div>
                          </label>
                        );
                      })}
                      {editingBoxPrizes.length === 0 && (
                        <p className="text-[10px] text-zinc-400 italic text-center py-4">No prizes saved inside this box yet.</p>
                      )}
                    </div>
                  </div>
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                 <button onClick={() => setShowPityModal(false)} className="px-6 py-2 border border-black/10 hover:bg-neutral-50 rounded-full text-[9px] font-bold uppercase">Cancel</button>
                 <button onClick={handleSavePity} className="cre-button bg-black text-white px-8 h-10 text-[10px]">SAVE OVERRIDE RULE</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
