import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { MapPin, Plus, Trash2, Home, Building2, Phone, User, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface Address {
  id: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  postcode: string;
  state: string;
  region: 'west' | 'east';
  isDefault: boolean;
}

const MALAYSIA_STATES = {
  west: ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya'],
  east: ['Sabah', 'Sarawak', 'Labuan']
};

export default function AddressManager({ onSelect, selectedId }: { onSelect?: (addr: Address) => void, selectedId?: string }) {
  const { profile } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'users', profile.uid, 'addresses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAddresses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Address)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  const handleAdd = async () => {
    if (!profile?.uid || !name || !phone || !street || !city || !state) return;
    
    const region = MALAYSIA_STATES.east.includes(state) ? 'east' : 'west';
    
    try {
      await addDoc(collection(db, 'users', profile.uid, 'addresses'), {
        recipientName: name,
        phone,
        street,
        city,
        postcode,
        state,
        region,
        isDefault: addresses.length === 0,
        createdAt: serverTimestamp()
      });
      setShowAdd(false);
      resetForm();
    } catch (err) {
      console.error('Error adding address:', err);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setStreet('');
    setCity('');
    setPostcode('');
    setState('');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.uid) return;
    await deleteDoc(doc(db, 'users', profile.uid, 'addresses', id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
            <MapPin size={20} className="opacity-40" />
            <h3 className="text-sm font-black uppercase tracking-widest">Saved Destinations</h3>
         </div>
         <button 
           onClick={() => setShowAdd(true)}
           className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-black text-white px-4 py-2 rounded-full hover:scale-105 transition-all"
         >
           <Plus size={14} />
           New Address
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div 
            key={addr.id}
            onClick={() => onSelect?.(addr)}
            className={cn(
              "relative bg-white/60 border-2 rounded-[24px] p-6 cursor-pointer transition-all hover:shadow-xl",
              selectedId === addr.id ? "border-black scale-[1.02] bg-white shadow-xl" : "border-brand-border/20 hover:border-black/10"
            )}
          >
             {selectedId === addr.id && (
               <div className="absolute -top-2 -right-2 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center border-4 border-[#F5F9FF] shadow-lg">
                  <Check size={16} />
               </div>
             )}
             
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                      {addr.isDefault ? <Home size={14} /> : <Building2 size={14} />}
                   </div>
                   <span className="font-bold text-sm tracking-tight">{addr.recipientName}</span>
                </div>
                <button 
                   onClick={(e) => handleDelete(addr.id, e)}
                   className="p-2 opacity-20 hover:opacity-100 hover:text-red-500 transition-all"
                >
                   <Trash2 size={14} />
                </button>
             </div>

             <div className="space-y-1">
                <p className="text-[11px] font-medium opacity-60 leading-relaxed">
                   {addr.phone}<br />
                   {addr.street}, {addr.city},<br />
                   {addr.postcode}, {addr.state}
                </p>
                <div className="pt-2">
                   <span className={cn(
                     "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                     addr.region === 'west' ? "bg-blue-50 text-blue-500 border-blue-100" : "bg-purple-50 text-purple-500 border-purple-100"
                   )}>
                      {addr.region === 'west' ? 'West Malaysia' : 'East Malaysia'}
                   </span>
                </div>
             </div>
          </div>
        ))}

        {addresses.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-brand-border/20 rounded-[32px]">
             <AlertCircle size={32} className="mx-auto opacity-10 mb-4" />
             <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">No delivery destinations found</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 30 }} 
               className="relative w-full max-w-lg bg-[#F5F9FF] rounded-[40px] p-8 space-y-6 shadow-2xl"
            >
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
                     <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Add New Destination</h3>
                    <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Physical delivery point setup</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 flex flex-col">
                     <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Recipient Name</label>
                     <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                     <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Phone Number</label>
                     <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+60..." className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all" />
                  </div>
                  <div className="col-span-2 space-y-1.5 flex flex-col">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Street Address</label>
                    <textarea value={street} onChange={(e) => setStreet(e.target.value)} placeholder="House No, Street, Building..." className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all resize-none h-20" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                     <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">City</label>
                     <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                     <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Postcode</label>
                     <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all" />
                  </div>
                  <div className="col-span-2 space-y-1.5 flex flex-col">
                     <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">State / Region</label>
                     <select value={state} onChange={(e) => setState(e.target.value)} className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-black outline-none transition-all">
                        <option value="">Select State...</option>
                        {MALAYSIA_STATES.west.map(s => <option key={s} value={s}>{s} (West)</option>)}
                        {MALAYSIA_STATES.east.map(s => <option key={s} value={s}>{s} (East)</option>)}
                     </select>
                  </div>
               </div>

               <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-4 bg-white border border-black/10 rounded-2xl font-bold text-[10px] uppercase tracking-widest">Cancel</button>
                  <button 
                     onClick={handleAdd}
                     className="flex-1 py-4 bg-black text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                     Save Destination
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
