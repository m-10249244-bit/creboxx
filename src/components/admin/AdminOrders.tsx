import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Package, Truck, CheckCircle, XCircle, Clock, MapPin, Search, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { formatPrice, cn } from '../../lib/utils';
import { useAuth } from '../auth/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminOrders() {
  const { profile: adminProfile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingNote, setShippingNote] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!adminProfile?.isAdmin) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updateData: any = { 
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'shipped') {
        updateData.courierName = courierName;
        updateData.trackingNumber = trackingNumber;
        updateData.shippingNote = shippingNote;
      }

      await updateDoc(orderRef, updateData);

      // Audit Log
      const logId = `admin-log-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: 'UPDATE_ORDER_STATUS',
        targetId: orderId,
        details: `Updated order ${orderId} status to ${newStatus}`,
        timestamp: serverTimestamp()
      });

      setSelectedOrder(null);
      resetShippingForm();
    } catch (error) {
      console.error('Update order error:', error);
    }
  };

  const resetShippingForm = () => {
    setCourierName('');
    setTrackingNumber('');
    setShippingNote('');
  };

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(search.toLowerCase()) || 
    o.userName?.toLowerCase().includes(search.toLowerCase()) ||
    o.trackingNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="space-y-8">
      {/* Search & Stats */}
      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
         <div className="relative w-full lg:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by ID, Customer or Tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/40 border border-brand-border rounded-[20px] pl-12 pr-6 py-4 text-sm focus:border-black outline-none transition-all"
            />
         </div>
         
         <div className="flex gap-4 overflow-x-auto no-scrollbar w-full lg:w-auto">
            {Object.entries(stats).map(([key, val]) => (
              <div key={key} className="bg-white/40 border border-brand-border px-6 py-3 rounded-2xl flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] font-bold uppercase opacity-30 tracking-widest">{key}</span>
                <span className="text-xl font-mono font-bold">{val}</span>
              </div>
            ))}
         </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order.id} className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-6 lg:p-8 flex flex-col lg:flex-row gap-8 shadow-sm hover:border-black transition-all">
             {/* Left: Basic Info */}
             <div className="lg:w-48 space-y-4">
                <div className="space-y-1">
                   <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Order ID</p>
                   <p className="font-mono font-black text-sm truncate">{order.id}</p>
                </div>
                <div className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm",
                  order.status === 'pending' ? "bg-yellow-400 text-black" :
                  order.status === 'processing' ? "bg-blue-400 text-white" :
                  order.status === 'shipped' ? "bg-purple-400 text-white" :
                  "bg-green-500 text-white"
                )}>
                  {order.status === 'pending' && <Clock size={12} />}
                  {order.status === 'shipped' && <Truck size={12} />}
                  {order.status === 'completed' && <CheckCircle size={12} />}
                  {order.status}
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-bold uppercase opacity-40">Submitted</p>
                   <p className="text-[11px] font-medium">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'Just now'}</p>
                </div>
             </div>

             {/* Middle: Items & Address */}
             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 py-6 lg:py-0 border-y lg:border-y-0 lg:border-x border-brand-border/10 lg:px-8">
                <div className="space-y-4">
                   <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Shipment Content</p>
                   <div className="flex -space-x-4">
                      {order.items?.map((item: any, i: number) => (
                        <div key={i} className="w-12 h-12 bg-white rounded-xl border border-brand-border overflow-hidden shadow-md group relative">
                           <img src={item.image} className="w-full h-full object-cover" />
                        </div>
                      ))}
                   </div>
                   <p className="text-[10px] font-bold uppercase">{order.items?.length} Premium Collectibles</p>
                </div>

                <div className="space-y-3">
                   <div className="flex items-start gap-2">
                      <MapPin size={16} className="opacity-40 mt-1" />
                      <div>
                         <p className="font-bold text-sm">{order.address?.recipientName}</p>
                         <p className="text-[11px] opacity-60 leading-relaxed max-w-xs">
                            {order.address?.phone}<br />
                            {order.address?.street}, {order.address?.city}, {order.address?.postcode}, {order.address?.state}
                         </p>
                      </div>
                   </div>
                </div>
             </div>

             {/* Right: Actions */}
             <div className="lg:w-64 space-y-4 flex flex-col justify-center">
                {order.status === 'pending' && (
                  <button 
                    onClick={() => handleUpdateStatus(order.id, 'processing')}
                    className="w-full py-4 bg-black text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    Start Processing
                  </button>
                )}

                {order.status === 'processing' && (
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    Set Tracking Info
                  </button>
                )}

                {order.status === 'shipped' && (
                  <div className="bg-white/60 p-4 rounded-2xl border border-brand-border space-y-2">
                     <p className="text-[9px] font-bold uppercase opacity-40">Tracking Details</p>
                     <p className="text-xs font-bold text-blue-500 flex items-center gap-2">
                       {order.courierName}: {order.trackingNumber}
                       <ExternalLink size={12} />
                     </p>
                     <button 
                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                        className="w-full py-2 bg-green-500 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest"
                     >
                        Mark Completed
                     </button>
                  </div>
                )}
             </div>
          </div>
        ))}
      </div>

      {/* Shipping Info Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedOrder(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 30 }} 
               className="relative w-full max-w-lg bg-[#F5F9FF] rounded-[40px] p-10 space-y-8 shadow-2xl"
            >
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-black text-white rounded-[20px] flex items-center justify-center shadow-xl">
                   <Truck size={28} />
                 </div>
                 <div>
                   <h3 className="text-2xl font-bold uppercase tracking-tight">Shipment Logistics</h3>
                   <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Recording courier data for Order #{selectedOrder.id.slice(-6)}</p>
                 </div>
               </div>

               <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 ml-1">Courier Name</label>
                     <select 
                       value={courierName}
                       onChange={(e) => setCourierName(e.target.value)}
                       className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-bold text-sm focus:border-black outline-none transition-all shadow-sm"
                     >
                       <option value="">Select Courier...</option>
                       <option value="J&T Express">J&T Express</option>
                       <option value="PosLaju">PosLaju</option>
                       <option value="NinjaVan">NinjaVan</option>
                       <option value="DHL eCommerce">DHL eCommerce</option>
                       <option value="Pigeon">Pigeon</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 ml-1">Tracking Number</label>
                     <input 
                       type="text" 
                       placeholder="Enter Airway Bill Number..."
                       value={trackingNumber}
                       onChange={(e) => setTrackingNumber(e.target.value)}
                       className="w-full bg-white border border-brand-border rounded-xl px-6 py-5 font-mono font-bold text-lg focus:border-black outline-none transition-all shadow-sm" 
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 ml-1">Shipping Note (Optional)</label>
                     <textarea 
                        placeholder="Additional details for the customer..."
                        value={shippingNote}
                        onChange={(e) => setShippingNote(e.target.value)}
                        className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 text-sm font-medium focus:border-black outline-none transition-all shadow-sm resize-none h-24"
                     />
                  </div>
               </div>

               <div className="flex gap-4">
                  <button onClick={() => setSelectedOrder(null)} className="flex-1 py-4 bg-white border border-black/10 rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'shipped')}
                    disabled={!courierName || !trackingNumber}
                    className="flex-1 py-4 bg-black text-white border border-black rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20"
                  >
                    DISPATCH PACKAGE
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
