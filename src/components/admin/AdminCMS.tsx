import React, { useState, useEffect } from 'react';
import { useConfig } from '../ConfigContext';
import { Layout, Image as ImageIcon, Type, Palette, MessageSquare, Bell, CreditCard, Eye, EyeOff, GripVertical, Plus, Truck, Upload, Percent, Trash2, Calendar, Settings, X, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db } from '../../lib/firebase';
import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { compressImage, fileToBase64 } from '../../lib/imageUtils';

export default function AdminCMS() {
  const { config, updateConfig } = useConfig();
  const [banners, setBanners] = useState<any[]>([]);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [showBannerModal, setShowBannerModal] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const snap = await getDocs(collection(db, 'banners'));
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed fetching carousels: ", e);
    }
  };

  const handleSaveBanner = async () => {
    if (!editingBanner || !editingBanner.title?.trim()) {
      toast.error("Banner Title cannot be blank!");
      return;
    }
    const id = editingBanner.id || `banner_${Date.now()}`;
    const payload = { ...editingBanner, id };
    try {
      await setDoc(doc(db, 'banners', id), payload);
      toast.success("Carousel Banner synchronized in database!");
      setEditingBanner(null);
      setShowBannerModal(false);
      fetchBanners();
    } catch (err) {
      toast.error("Synchronization failed.");
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("Are you sure you want to delete this carousel banner?")) return;
    try {
      await deleteDoc(doc(db, 'banners', id));
      toast.success("Carousel Banner purged!");
      fetchBanners();
    } catch (err) {
      toast.error("Purging failed.");
    }
  };

  const handleChange = (key: string, value: any) => {
    updateConfig({ [key]: value });
  };

  const toggleBlock = (id: string) => {
    if (!config?.homepageBlocks) return;
    const blocks = config.homepageBlocks.map(b => 
      b.id === id ? { ...b, visible: !b.visible } : b
    );
    handleChange('homepageBlocks', blocks);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (!config?.homepageBlocks) return;
    const blocks = [...config.homepageBlocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    
    [blocks[index], blocks[targetIndex]] = [blocks[targetIndex], blocks[index]];
    handleChange('homepageBlocks', blocks);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        const b64 = await fileToBase64(compressed);
        if (key === 'tng' || key === 'duitnow') {
          if (!config?.paymentMethods) return;
          const methods = { ...config.paymentMethods };
          methods[key] = { ...methods[key], qrUrl: b64 };
          handleChange('paymentMethods', methods);
          toast.success(`Uploaded payment QR successfully!`);
        } else {
          handleChange(key, b64);
          toast.success(`Logo/Favicon/Banner asset uploaded successfully!`);
        }
      } catch (err) {
        toast.error("File loading failed.");
      }
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingBanner) {
      try {
        const compressed = await compressImage(file);
        const b64 = await fileToBase64(compressed);
        setEditingBanner({ ...editingBanner, imageUrl: b64 });
        toast.success("Image preview loaded!");
      } catch (err) {
        toast.error("Error compressing file.");
      }
    }
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Branding */}
        <div className="lg:col-span-1 bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Palette size={20} className="opacity-40" />
            <h3 className="text-xl font-bold uppercase tracking-tight">Identity & Branding</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Company Name</label>
              <input 
                type="text" 
                value={config?.appName || ''} 
                onChange={(e) => handleChange('appName', e.target.value)}
                className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 font-medium focus:border-black outline-none transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Logo Asset</label>
              <div className="flex items-center gap-4 bg-white/60 border border-brand-border rounded-xl px-4 py-2">
                 {config?.logoUrl && <img src={config.logoUrl} className="w-8 h-8 rounded-lg object-contain bg-neutral-900 p-1" alt="Logo" />}
                 <label className="flex-1 cursor-pointer">
                    <span className="text-[10px] font-bold opacity-30">Tap to upload...</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUrl')} className="hidden" />
                 </label>
                 <Upload size={14} className="opacity-20" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Favicon Asset</label>
              <div className="flex items-center gap-4 bg-white/60 border border-brand-border rounded-xl px-4 py-2">
                 {config?.faviconUrl && <img src={config.faviconUrl} className="w-8 h-8 rounded-lg object-contain p-1 bg-white" alt="Favicon" />}
                 <label className="flex-1 cursor-pointer">
                    <span className="text-[10px] font-bold opacity-30">Tap to upload...</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'faviconUrl')} className="hidden" />
                 </label>
                 <Upload size={14} className="opacity-20" />
              </div>
            </div>

            {/* Currency Customizer */}
            <div className="border-t border-black/5 pt-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Currency Settings (货币与代币)</p>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Currency Symbol</label>
                <input 
                  type="text" 
                  value={config?.currencySymbol || 'RM'} 
                  onChange={(e) => handleChange('currencySymbol', e.target.value)}
                  placeholder="e.g. RM, $, Coins"
                  className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 font-mono font-bold focus:border-black outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Currency Icon File (Image)</label>
                <div className="flex items-center gap-4 bg-white/60 border border-brand-border rounded-xl px-4 py-2">
                   {config?.currencyIconUrl ? (
                     <img src={config.currencyIconUrl} className="w-8 h-8 rounded-full object-contain p-1 border border-black/5 bg-white" alt="Currency Icon" />
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-[#FFD700] border border-brand-border flex items-center justify-center text-[8px] font-bold text-black select-none">COIN</div>
                   )}
                   <label className="flex-1 cursor-pointer">
                      <span className="text-[10px] font-bold opacity-30">Change token file...</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'currencyIconUrl')} className="hidden" />
                   </label>
                   <Upload size={14} className="opacity-20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Homepage Architecture */}
        <div className="lg:col-span-2 bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-8 space-y-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Layout size={20} className="opacity-40" />
              <h3 className="text-xl font-bold uppercase tracking-tight">Platform Architecture</h3>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest bg-black text-white px-3 py-1 rounded-full">Modular Editor</div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Homepage Block Sequence</label>
            <div className="space-y-3">
              {config?.homepageBlocks?.map((block, i) => (
                <div key={block.id} className="flex items-center gap-4 bg-white/60 border border-brand-border p-4 rounded-2xl group hover:border-black transition-all">
                  <div className="flex flex-col gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveBlock(i, 'up')} className="hover:text-blue-500"><GripVertical size={14} /></button>
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-sm tracking-tight uppercase">{block.id}</p>
                    <p className="text-[9px] opacity-40 font-mono italic">Type: {block.type}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleBlock(block.id)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        block.visible ? "bg-black text-white" : "bg-neutral-100 text-neutral-400"
                      )}
                    >
                      {block.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Main Hero Banner</label>
              <div className="flex items-center gap-4 bg-white/60 border border-brand-border rounded-xl px-4 py-2">
                 {config?.bannerUrl && <img src={config.bannerUrl} className="w-12 h-8 rounded-lg object-cover bg-white" alt="Hero" />}
                 <label className="flex-1 cursor-pointer">
                    <span className="text-[10px] font-bold opacity-30">Upload hero visual...</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'bannerUrl')} className="hidden" />
                 </label>
                 <Upload size={14} className="opacity-20" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Global Announcement</label>
              <textarea 
                value={config?.announcement || ''} 
                onChange={(e) => handleChange('announcement', e.target.value)}
                rows={1}
                className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-2 font-medium focus:border-black outline-none transition-colors resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Carousel Banners Manager (Unified Image Files) */}
      <div className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-black/5">
          <div className="flex items-center gap-3">
            <ImageIcon size={20} className="text-zinc-500" />
            <h3 className="text-xl font-bold uppercase tracking-tight">Carousel Banners (Uniform File Uploads)</h3>
          </div>
          <button 
            onClick={() => {
              setEditingBanner({
                title: '',
                subtitle: '',
                imageUrl: '',
                targetUrl: '',
                countdown: ''
              });
              setShowBannerModal(true);
            }} 
            className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-neutral-800 transition-colors"
          >
            + Create Banner
          </button>
        </div>

        <p className="text-xs text-zinc-400 font-medium">Carousel slides shown at the home hero carousel module. Always use base64 file loaders instead of web links.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map(b => (
            <div key={b.id} className="bg-white/70 border border-brand-border rounded-[24px] p-6 flex flex-col justify-between hover:border-black hover:shadow-md transition-all">
               <div className="space-y-3">
                 <div className="aspect-video w-full rounded-xl overflow-hidden bg-neutral-100 border border-black/5 relative">
                   {b.imageUrl ? (
                     <img src={b.imageUrl} className="w-full h-full object-cover" alt="" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-400">NO BANNER IMAGE</div>
                   )}
                 </div>
                 <div>
                   <h4 className="font-bold text-sm tracking-tight truncate">{b.title}</h4>
                   <p className="text-[10px] text-zinc-400 font-medium truncate">{b.subtitle || 'No subtitle content'}</p>
                 </div>
                 {b.countdown && (
                   <span className="inline-block text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full uppercase">
                     ⏰ {b.countdown}
                   </span>
                 )}
               </div>

               <div className="flex gap-2 justify-end mt-4 pt-2 border-t border-black/5">
                 <button 
                   onClick={() => {
                     setEditingBanner(b);
                     setShowBannerModal(true);
                   }} 
                   className="px-3 py-1.5 text-[9px] font-black uppercase text-zinc-650 hover:text-black hover:underline"
                 >
                   Edit
                 </button>
                 <button 
                   onClick={() => handleDeleteBanner(b.id)} 
                   className="px-3 py-1.5 text-[9px] font-black uppercase text-red-500 hover:text-red-700 hover:underline"
                 >
                   Delete
                 </button>
               </div>
            </div>
          ))}
          {banners.length === 0 && (
            <p className="text-[10px] uppercase font-bold text-zinc-400 text-center py-6 col-span-3">No active slide carousels.</p>
          )}
        </div>
      </div>

      {/* Logistics & Shipping Fees */}
      <div className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-8 space-y-8 shadow-sm">
         <div className="flex items-center gap-3">
            <Truck size={20} className="opacity-40" />
            <h3 className="text-xl font-bold uppercase tracking-tight">Logistics & Shipping Fees</h3>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">West Malaysia (RM)</label>
               <input 
                 type="number" 
                 value={config?.shippingFees?.west || 0}
                 onChange={(e) => {
                    const fees = { ...config?.shippingFees };
                    fees.west = parseFloat(e.target.value);
                    handleChange('shippingFees', fees);
                 }}
                 className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-mono font-bold text-lg"
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">East Malaysia (RM)</label>
               <input 
                 type="number" 
                 value={config?.shippingFees?.east || 0}
                 onChange={(e) => {
                    const fees = { ...config?.shippingFees };
                    fees.east = parseFloat(e.target.value);
                    handleChange('shippingFees', fees);
                 }}
                 className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-mono font-bold text-lg"
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">Free Threshold (RM)</label>
               <input 
                 type="number" 
                 value={config?.shippingFees?.freeThreshold || 0}
                 onChange={(e) => {
                    const fees = { ...config?.shippingFees };
                    fees.freeThreshold = parseFloat(e.target.value);
                    handleChange('shippingFees', fees);
                 }}
                 className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-mono font-bold text-lg"
               />
            </div>
         </div>
      </div>
      
      {/* Payment Information Management */}
      <div className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-8 space-y-8 shadow-sm font-sans">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard size={20} className="opacity-40" />
          <h3 className="text-xl font-bold uppercase tracking-tight">Payment Method Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* TNG */}
           <div className="space-y-4 p-6 bg-blue-50/50 rounded-[24px] border border-blue-100 flex flex-col justify-between">
              <div>
                 <p className="font-bold text-xs uppercase tracking-widest text-blue-700">TNG eWallet</p>
                 <p className="text-[10px] text-zinc-400 mt-1 font-semibold leading-tight">Upload Touch 'n Go QR code asset to receive payments.</p>
              </div>
              <div className="space-y-2 mt-4">
                 <div className="relative aspect-square w-full max-w-[150px] mx-auto rounded-2xl border-2 border-dashed border-blue-200 overflow-hidden bg-white flex flex-col items-center justify-center p-2">
                    {config?.paymentMethods?.tng?.qrUrl ? (
                      <>
                        <img src={config.paymentMethods.tng.qrUrl} className="w-full h-full object-contain" alt="TNG QR" />
                        <label className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer">
                          <span className="text-[9px] text-white font-black uppercase tracking-wider">Replace QR</span>
                          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'tng')} className="hidden" />
                        </label>
                      </>
                    ) : (
                      <label className="flex flex-col items-center gap-1.5 cursor-pointer text-center font-semibold">
                        <Upload size={18} className="text-blue-400" />
                        <span className="text-[8px] font-black text-blue-500 uppercase leading-none">Upload TNG QR</span>
                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'tng')} className="hidden" />
                      </label>
                    )}
                 </div>
              </div>
           </div>

           {/* DuitNow */}
           <div className="space-y-4 p-6 bg-pink-50/50 rounded-[24px] border border-pink-100 flex flex-col justify-between">
              <div>
                 <p className="font-bold text-xs uppercase tracking-widest text-pink-700">DuitNow QR</p>
                 <p className="text-[10px] text-zinc-400 mt-1 font-semibold leading-tight">Upload DuitNow QR code asset to receive payments.</p>
              </div>
              <div className="space-y-2 mt-4">
                 <div className="relative aspect-square w-full max-w-[150px] mx-auto rounded-2xl border-2 border-dashed border-pink-200 overflow-hidden bg-white flex flex-col items-center justify-center p-2">
                    {config?.paymentMethods?.duitnow?.qrUrl ? (
                      <>
                        <img src={config.paymentMethods.duitnow.qrUrl} className="w-full h-full object-contain" alt="DuitNow QR" />
                        <label className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer">
                          <span className="text-[9px] text-white font-black uppercase tracking-wider">Replace QR</span>
                          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'duitnow')} className="hidden" />
                        </label>
                      </>
                    ) : (
                      <label className="flex flex-col items-center gap-1.5 cursor-pointer text-center font-semibold">
                        <Upload size={18} className="text-pink-400" />
                        <span className="text-[8px] font-black text-pink-500 uppercase leading-none">Upload QR</span>
                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'duitnow')} className="hidden" />
                      </label>
                    )}
                 </div>
              </div>
           </div>

           {/* Bank */}
           <div className="space-y-4 p-6 bg-neutral-100/50 rounded-[24px] border border-neutral-200 flex flex-col justify-between">
              <div>
                 <p className="font-bold text-xs uppercase tracking-widest text-neutral-700">Bank Transfer</p>
                 <p className="text-[10px] text-zinc-400 mt-1">Provide clear banking details for direct bank transfers.</p>
              </div>
              <div className="space-y-2 mt-4 flex-1 flex flex-col">
                <textarea 
                  value={config?.paymentMethods?.bank?.details || ''}
                  onChange={(e) => {
                    if (!config?.paymentMethods) return;
                    const methods = { ...config.paymentMethods };
                    methods.bank = { ...methods.bank, details: e.target.value };
                    handleChange('paymentMethods', methods);
                  }}
                  rows={4}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-xs font-mono resize-none flex-1 focus:border-black outline-none transition-colors"
                  placeholder="e.g. Bank name, Account Name, Account Numbers"
                />
              </div>
           </div>
        </div>
      </div>

      {/* Slide / Banner Edit modal */}
      {showBannerModal && editingBanner && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md font-sans">
          <div className="bg-[#FAFCFF] p-8 rounded-[36px] w-full max-w-lg shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center pb-4 border-b border-black/5">
               <h4 className="text-lg font-bold uppercase tracking-tight">Slide Banner Editor</h4>
               <button onClick={() => { setShowBannerModal(false); setEditingBanner(null); }} className="p-1"><X size={18} /></button>
             </div>

             <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Slide Image Upload (Strictly File)</label>
                  <div className="relative aspect-video w-full rounded-2xl border-2 border-dashed border-black/10 overflow-hidden bg-white flex flex-col items-center justify-center p-4">
                     {editingBanner.imageUrl ? (
                       <>
                         <img src={editingBanner.imageUrl} className="w-full h-full object-cover" alt="Slide" />
                         <label className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer">
                           <span className="text-[10px] text-white font-black uppercase tracking-wider">Replace Asset</span>
                           <input type="file" accept="image/*" onChange={handleBannerImageUpload} className="hidden" />
                         </label>
                       </>
                     ) : (
                       <label className="flex flex-col items-center gap-2 cursor-pointer text-center">
                         <Upload size={22} className="opacity-30" />
                         <span className="text-[9px] font-black text-black uppercase">Upload slide graphics file</span>
                         <input type="file" accept="image/*" onChange={handleBannerImageUpload} className="hidden" />
                       </label>
                     )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Main Banner Title</label>
                    <input type="text" value={editingBanner.title || ''} onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-2 text-xs font-bold" placeholder="e.g. CRE Origins: Edition" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Banner Subtitle</label>
                    <input type="text" value={editingBanner.subtitle || ''} onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-2 text-xs font-medium" placeholder="e.g. Pure Platinum Spec Series" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Target Link / Path</label>
                    <input type="text" value={editingBanner.targetUrl || ''} onChange={(e) => setEditingBanner({ ...editingBanner, targetUrl: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-2 text-xs font-mono" placeholder="e.g. /boxes/bronze-standard" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Countdown Banner Text (Optional)</label>
                    <input type="text" value={editingBanner.countdown || ''} onChange={(e) => setEditingBanner({ ...editingBanner, countdown: e.target.value })} className="w-full bg-white border border-brand-border rounded-xl px-4 py-2 text-xs font-medium" placeholder="e.g. Ends in 24h!" />
                  </div>
                </div>
             </div>

             <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
               <button onClick={() => { setShowBannerModal(false); setEditingBanner(null); }} className="px-6 py-2.5 text-[9px] font-bold uppercase hover:bg-neutral-50 rounded-full">Cancel</button>
               <button onClick={handleSaveBanner} className="cre-button bg-black text-white px-8 h-10 text-[10px]">SAVE SLIDE CAROUSEL</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
