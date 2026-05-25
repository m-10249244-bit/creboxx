import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  AlertCircle, 
  TrendingUp, 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Play, 
  Pause, 
  RotateCcw, 
  QrCode, 
  CreditCard, 
  Users, 
  ChevronRight, 
  Download, 
  Database 
} from 'lucide-react';
import { formatPrice, cn } from '../../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../auth/AuthContext';

export default function AdminTopups() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);

  // Sub tab config: 'requests' | 'qrPool'
  const [subTab, setSubTab] = useState<'requests' | 'qrPool'>('requests');

  // QR Code Pool states
  const [qrList, setQrList] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQr, setEditingQr] = useState<any | null>(null);
  const [viewHistoryQr, setViewHistoryQr] = useState<any | null>(null);

  // QR creation inputs
  const [qrName, setQrName] = useState('');
  const [qrType, setQrType] = useState<'tng' | 'duitnow' | 'bank'>('tng');
  const [qrImage, setQrImage] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [maxLimit, setMaxLimit] = useState('500');

  // QR editing inputs
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('500');
  const [editAmount, setEditAmount] = useState('0');
  const [editBankDetails, setEditBankDetails] = useState('');

  // Load pending topup requests
  useEffect(() => {
    const q = query(collection(db, 'topupRequests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load QR pool
  useEffect(() => {
    const q = query(collection(db, 'qrPool'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQrList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (isEditMode) {
          setEditingQr((prev: any) => ({ ...prev, qrUrl: reader.result as string }));
        } else {
          setQrImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrName || !maxLimit) return;
    try {
      const id = `qr-${Date.now()}`;
      await setDoc(doc(db, 'qrPool', id), {
        id,
        name: qrName,
        type: qrType,
        qrUrl: qrImage,
        bankDetailsText: bankDetails,
        maxLimit: parseFloat(maxLimit),
        currentAmount: 0,
        usageCount: 0,
        status: 'active',
        recentUsers: [],
        createdAt: new Date().toISOString()
      });

      // Reset form fields
      setQrName('');
      setQrType('tng');
      setQrImage('');
      setBankDetails('');
      setMaxLimit('500');
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save payment QR to collection. Check logs.');
    }
  };

  const handleSaveEditQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQr) return;
    try {
      const qrRef = doc(db, 'qrPool', editingQr.id);
      const isFull = parseFloat(editAmount) >= parseFloat(editLimit);
      await updateDoc(qrRef, {
        name: editName,
        maxLimit: parseFloat(editLimit),
        currentAmount: parseFloat(editAmount),
        bankDetailsText: editBankDetails,
        qrUrl: editingQr.qrUrl || '',
        status: isFull ? 'full' : editingQr.status === 'full' ? 'active' : editingQr.status
      });
      setEditingQr(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save QR configuration changes.');
    }
  };

  const toggleQrStatus = async (qr: any) => {
    try {
      const newStatus = qr.status === 'paused' ? 'active' : 'paused';
      const qrRef = doc(db, 'qrPool', qr.id);
      await updateDoc(qrRef, { status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetCollect = async (qrId: string) => {
    if (!window.confirm('Reset this QR collection collected volume back to RM 0.00?')) return;
    try {
      const qrRef = doc(db, 'qrPool', qrId);
      await updateDoc(qrRef, {
        currentAmount: 0,
        status: 'active'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQr = async (qrId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this payment method from the selection pool?')) return;
    try {
      await deleteDoc(doc(db, 'qrPool', qrId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (req: any) => {
    if (!profile?.isAdmin) return;
    
    try {
      // 1. Update request status
      const reqRef = doc(db, 'topupRequests', req.id);
      await updateDoc(reqRef, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: profile.uid
      });

      // 2. Update user balance
      const userRef = doc(db, 'users', req.userId);
      await updateDoc(userRef, {
        balance: increment(req.amount)
      });

      // 3. Write balance log
      const logId = `log-${Date.now()}`;
      await setDoc(doc(db, 'balanceLogs', logId), {
        id: logId,
        userId: req.userId,
        amount: req.amount,
        type: 'topup',
        reason: `Manual top-up approved via channel [${req.qrName || 'Manual'}]`,
        timestamp: serverTimestamp(),
        relatedId: req.id
      });

      // 4. Admin audit log
      const adminLogId = `admin-log-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', adminLogId), {
        id: adminLogId,
        adminId: profile.uid,
        adminName: profile.displayName,
        action: 'APPROVE_TOPUP',
        targetId: req.id,
        details: `Approved RM${req.amount} for ${req.userName}`,
        timestamp: serverTimestamp()
      });

      setSelectedRequest(null);
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve top-up. Please check console.');
    }
  };

  const handleReject = async (req: any) => {
    if (!profile?.isAdmin || !rejectReason) return;

    try {
      const reqRef = doc(db, 'topupRequests', req.id);
      await updateDoc(reqRef, {
        status: 'rejected',
        rejectReason,
        reviewedAt: serverTimestamp(),
        reviewedBy: profile.uid
      });

      // Admin audit log
      const adminLogId = `admin-log-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', adminLogId), {
        id: adminLogId,
        adminId: profile.uid,
        adminName: profile.displayName,
        action: 'REJECT_TOPUP',
        targetId: req.id,
        details: `Rejected top-up for ${req.userName}. Reason: ${rejectReason}`,
        timestamp: serverTimestamp()
      });

      setSelectedRequest(null);
      setRejectReason('');
    } catch (error) {
      console.error('Rejection error:', error);
    }
  };

  // QR Stats Summary
  const activeCount = qrList.filter(q => q.status === 'active').length;
  const fullCount = qrList.filter(q => q.status === 'full').length;
  const pausedCount = qrList.filter(q => q.status === 'paused').length;
  const totalCollectedPool = qrList.reduce((acc, q) => acc + (q.currentAmount || 0), 0);

  return (
    <div className="space-y-8 font-sans">
      
      {/* Tab Navigation header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 border border-brand-border p-4 rounded-3xl">
        <div className="flex items-center gap-2 bg-black/5 p-1 rounded-2xl w-fit">
          <button 
            type="button"
            onClick={() => setSubTab('requests')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              subTab === 'requests' 
                ? "bg-black text-white shadow-xl" 
                : "text-zinc-500 hover:text-black hover:bg-white/40"
            )}
          >
            Review Requests ({requests.length})
          </button>
          <button 
            type="button"
            onClick={() => setSubTab('qrPool')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              subTab === 'qrPool' 
                ? "bg-black text-white shadow-xl" 
                : "text-zinc-500 hover:text-black hover:bg-white/40"
            )}
          >
            <QrCode size={12} />
            Receiver QR Pool
          </button>
        </div>

        {subTab === 'qrPool' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-black text-white hover:bg-zinc-800 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors self-start sm:self-auto shadow-md active:scale-95"
          >
            <Plus size={14} /> add payment QR receiver
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {subTab === 'requests' ? (
          <motion.div 
            key="requestsView"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Pending Requests', value: requests.length, color: 'text-yellow-500', icon: Clock },
                { label: 'Subscribed Channels', value: qrList.length, color: 'text-blue-500', icon: QrCode },
                { label: 'Ecosystem Limit Collected', value: formatPrice(totalCollectedPool), color: 'text-green-500', icon: TrendingUp },
              ].map((stat, i) => (
                <div key={i} className="bg-white/40 border border-brand-border p-8 rounded-[24px] space-y-2 shadow-sm">
                  <div className="flex items-center justify-between opacity-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
                    <stat.icon size={16} />
                  </div>
                  <p className={cn("text-4xl font-mono font-bold tracking-tighter", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/40 border border-brand-border rounded-[32px] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/60 border-b border-brand-border">
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest opacity-40">User</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest opacity-40">Amount</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest opacity-40">Allocated QR</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest opacity-40">Method</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest opacity-40">Date</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest opacity-40 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-brand-border/10 hover:bg-white/60 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {req.userName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm tracking-tight">{req.userName}</p>
                            <p className="text-[10px] opacity-40 font-bold">{req.userId.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 font-mono font-bold text-green-600">{formatPrice(req.amount)}</td>
                      <td className="p-6 font-bold text-xs text-blue-600 font-mono">
                        {req.qrName || <span className="text-zinc-400">DEFAULT</span>}
                      </td>
                      <td className="p-6 font-bold text-xs opacity-65 uppercase">{req.method}</td>
                      <td className="p-6 text-xs font-bold opacity-40">{format(req.createdAt?.toDate ? req.createdAt.toDate() : (req.createdAt ? new Date(req.createdAt) : new Date()), 'MMM dd, HH:mm')}</td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => {
                            setSelectedRequest(req);
                            setRejectReason('');
                          }}
                          className="cre-button px-6 py-2 text-[10px] bg-black text-white hover:bg-neutral-800 font-black tracking-widest"
                        >
                          REVIEW PROOF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loading && (
                    <tr><td colSpan={6} className="p-20 text-center text-xs font-bold opacity-20 uppercase tracking-widest">Loading Requests...</td></tr>
                  )}
                  {!loading && requests.length === 0 && (
                    <tr><td colSpan={6} className="p-20 text-center text-xs font-bold opacity-20 uppercase tracking-widest">No pending review tasks</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="qrPoolView"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Stat Counters for Pools */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Channels', value: qrList.length, color: 'text-black' },
                { label: 'Selected Active (正常)', value: activeCount, color: 'text-green-500' },
                { label: 'Saturated Max (满额)', value: fullCount, color: 'text-red-500' },
                { label: 'Paused Channels (暂停)', value: pausedCount, color: 'text-amber-500' }
              ].map((st, idx) => (
                <div key={idx} className="bg-white/40 border border-brand-border p-6 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">{st.label}</p>
                  <p className={cn("text-3xl font-mono font-bold", st.color)}>{st.value}</p>
                </div>
              ))}
            </div>

            {/* List and Grid display of the Multi-QR pool */}
            {qrList.length === 0 ? (
              <div className="bg-white/30 backdrop-blur-md rounded-3xl border border-brand-border py-24 text-center">
                <QrCode size={48} className="mx-auto text-zinc-300 mb-4 animate-bounce" />
                <h3 className="font-bold uppercase tracking-tight text-lg mb-1">Payment Receiver QR Pool is Empty</h3>
                <p className="text-zinc-500 text-xs max-w-sm mx-auto mb-6">No custom payment channels are mounted. Users will pay using default values configured in Global Setting.</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-black text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105"
                >
                  Create First QR Code
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {qrList.map((qr) => {
                  const percent = Math.min(((qr.currentAmount || 0) / (qr.maxLimit || 500)) * 100, 100);
                  const isSaturated = qr.currentAmount >= qr.maxLimit;
                  
                  return (
                    <div 
                      key={qr.id} 
                      className={cn(
                        "bg-white/40 border-2 rounded-[28px] p-6 space-y-4 shadow-md flex flex-col justify-between relative overflow-hidden transition-all",
                        qr.status === 'full' || isSaturated ? "border-red-500/20 bg-red-50/10" : 
                        qr.status === 'paused' ? "border-amber-500/20 bg-amber-50/10" : "border-brand-border"
                      )}
                    >
                      {/* Top bar indicators */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider",
                          qr.type === 'tng' ? "bg-blue-150 text-blue-700 font-mono" :
                          qr.type === 'duitnow' ? "bg-pink-100 text-pink-700 font-mono" :
                          "bg-zinc-100 text-zinc-700 font-mono"
                        )}>
                          {qr.type === 'tng' ? 'TNG eWallet' : qr.type === 'duitnow' ? 'DuitNow QR' : 'Bank Transfer'}
                        </span>

                        <span className={cn(
                          "px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                          qr.status === 'active' ? "bg-green-100 text-green-700" :
                          qr.status === 'full' || isSaturated ? "bg-red-100 text-red-700 animate-pulse" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {qr.status === 'active' ? '● 正常' : qr.status === 'full' ? '● 满额' : '● 暂停'}
                        </span>
                      </div>

                      {/* Info & Content Body */}
                      <div className="flex gap-4 items-start pt-2">
                        {qr.qrUrl ? (
                          <div className="w-16 h-16 rounded-xl bg-white p-1 border border-black/5 flex items-center justify-center shrink-0">
                            <img src={qr.qrUrl} alt="QR" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                            <CreditCard size={20} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate uppercase tracking-tight">{qr.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase pt-0.5">Used: {qr.usageCount || 0} times</p>
                          {qr.bankDetailsText && (
                            <p className="text-[9px] text-zinc-400 font-serif-italic italic line-clamp-2 mt-1 whitespace-pre-wrap">
                              {qr.bankDetailsText}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Limit Progress Calculation (RM/Limit) */}
                      <div className="space-y-1 bg-white/50 p-3 rounded-xl border border-black/5">
                        <div className="flex justify-between items-baseline text-[10px]">
                          <span className="font-bold opacity-40 uppercase">Ecosystem Load</span>
                          <span className="font-semibold font-mono text-zinc-800">
                            {formatPrice(qr.currentAmount || 0)} / <span className="text-zinc-400">{formatPrice(qr.maxLimit || 500)}</span>
                          </span>
                        </div>
                        
                        <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isSaturated || qr.status === 'full' ? "bg-red-500" : "bg-black"
                            )} 
                            style={{ width: `${percent}%` }} 
                          />
                        </div>

                        <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase pt-1">
                          <span>Ratio: {percent.toFixed(0)}%</span>
                          <span>Left: {formatPrice(Math.max((qr.maxLimit || 500) - (qr.currentAmount || 0), 0))}</span>
                        </div>
                      </div>

                      {/* Call-to-actions overlay */}
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[9px] font-black uppercase tracking-wider">
                        <button
                          onClick={() => toggleQrStatus(qr)}
                          className={cn(
                            "py-2 px-2.5 rounded-lg border-2 flex items-center justify-center gap-1.5 active:scale-95 transition-all bg-white",
                            qr.status === 'paused' ? "text-green-600 border-green-500/20" : "text-amber-600 border-amber-500/20"
                          )}
                        >
                          {qr.status === 'paused' ? (
                            <>
                              <Play size={10} /> RESUME
                            </>
                          ) : (
                            <>
                              <Pause size={10} /> PAUSE
                            </>
                          )}
                        </button>

                        <button
                          disabled={!qr.recentUsers || qr.recentUsers.length === 0}
                          onClick={() => setViewHistoryQr(qr)}
                          className="py-2 px-2.5 rounded-lg border-2 border-black/10 bg-white hover:border-black text-black flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
                        >
                          <Users size={10} /> PAYERS ({qr.recentUsers?.length || 0})
                        </button>

                        <button
                          onClick={() => {
                            setEditingQr(qr);
                            setEditName(qr.name || '');
                            setEditLimit((qr.maxLimit || 500).toString());
                            setEditAmount((qr.currentAmount || 0).toString());
                            setEditBankDetails(qr.bankDetailsText || '');
                          }}
                          className="py-2 px-2.5 rounded-lg bg-black text-white hover:bg-neutral-800 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                        >
                          <Edit2 size={10} /> REWRITE
                        </button>

                        <button
                          onClick={() => handleResetCollect(qr.id)}
                          className="py-2 px-2.5 rounded-lg border-2 border-dashed border-zinc-250 text-zinc-500 hover:text-black hover:border-black flex items-center justify-center gap-1.5 active:scale-95 transition-all bg-white"
                        >
                          <RotateCcw size={10} /> RESET ALL
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteQr(qr.id)}
                        className="absolute top-4 right-4 text-zinc-350 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Purge Receiver"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Request Drawer/Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRequest(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[#F5F9FF] rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              <div className="flex-1 bg-black flex items-center justify-center p-8">
                <img src={selectedRequest.proofUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
              </div>
              
              <div className="w-full md:w-96 p-10 space-y-10 bg-white/40 backdrop-blur-xl flex flex-col justify-center">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
                      <Eye size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold uppercase tracking-tight">Review Proof</h3>
                      <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Audit manual payment</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 border border-brand-border p-6 rounded-[24px] space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase opacity-40">Amount</span>
                      <span className="font-mono font-bold text-xl text-green-600">{formatPrice(selectedRequest.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase opacity-40">User</span>
                      <span className="font-bold text-sm">{selectedRequest.userName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase opacity-40">QR Channel USED</span>
                      <span className="font-bold text-xs font-mono text-blue-600 uppercase">{selectedRequest.qrName || 'Manual Default'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase opacity-40">Method</span>
                      <span className="font-bold text-[10px] uppercase">{selectedRequest.method}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Rejection Remark (Internal)</label>
                  <textarea 
                    placeholder="Why are you rejecting this?"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full bg-white border border-brand-border rounded-xl p-4 text-sm focus:border-red-500 outline-none transition-colors h-24 resize-none"
                  />
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      disabled={!rejectReason}
                      onClick={() => handleReject(selectedRequest)}
                      className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <XCircle size={14} /> REJECT
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleApprove(selectedRequest)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 transition-all py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      <CheckCircle2 size={14} /> APPROVE
                    </button>
                  </div>
                </div>

                <button onClick={() => setSelectedRequest(null)} className="text-center w-full text-[10px] font-bold uppercase tracking-widest opacity-20 hover:opacity-100 transition-all">
                  DISMISS REVIEW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Creation Modal for QR Codes */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-[#F5F9FF] rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-black/5 bg-white/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase tracking-tight">Add Receiver QR</h3>
                    <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Ecosystem Channel router</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 px-2 hover:bg-black/5 rounded">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateQr} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Channel Name (描述备注)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TNG eWallet #1"
                    value={qrName}
                    onChange={(e) => setQrName(e.target.value)}
                    className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 text-sm focus:border-black outline-none transition-colors font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Channel Type</label>
                    <select
                      value={qrType}
                      onChange={(e) => setQrType(e.target.value as any)}
                      className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 text-sm focus:border-black outline-none transition-colors font-bold"
                    >
                      <option value="tng">TNG eWallet</option>
                      <option value="duitnow">DuitNow QR</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Limit Cap (额度限制 - RM)</label>
                    <input
                      type="number"
                      required
                      placeholder="500"
                      value={maxLimit}
                      onChange={(e) => setMaxLimit(e.target.value)}
                      className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 text-sm focus:border-black outline-none transition-colors font-mono font-bold"
                    />
                  </div>
                </div>

                {qrType !== 'bank' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 font-bold">Upload QR image (二维码图片)</label>
                    <div className="border-2 border-dashed border-black/10 rounded-2xl p-6 bg-white/60 flex flex-col items-center justify-center text-center gap-2">
                      {qrImage ? (
                        <>
                          <img src={qrImage} className="w-32 h-32 object-contain rounded-lg border shadow-sm" alt="unloaded" />
                          <button 
                            type="button"
                            onClick={() => setQrImage('')} 
                            className="text-[9px] text-red-500 hover:text-red-700 font-bold uppercase"
                          >
                            purge image
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer space-y-2 flex flex-col items-center">
                          <Download size={24} className="opacity-30" />
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Choose file / Drag here</span>
                          <input type="file" accept="image/*" onChange={(e) => handleImageFileChange(e, false)} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 font-bold">Bank Details description</label>
                    <textarea
                      placeholder="e.g. Maybank 1144-8844-3322 (Mohd Ali)"
                      value={bankDetails}
                      onChange={(e) => setBankDetails(e.target.value)}
                      className="w-full bg-white/60 border border-brand-border rounded-xl p-4 text-sm focus:border-black outline-none transition-colors h-24 resize-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="cre-button bg-black text-white w-full py-4 text-xs font-black tracking-widest"
                >
                  SAVE CHANNEL RECEIVER
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editing Modal for QR Receiver */}
      <AnimatePresence>
        {editingQr && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingQr(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-[#F5F9FF] rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-black/5 bg-white/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold">
                    <Edit2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase tracking-tight">Rewrite Channel Receiver</h3>
                    <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Adjust limit allocations</p>
                  </div>
                </div>
                <button onClick={() => setEditingQr(null)} className="p-1 px-2 hover:bg-black/5 rounded">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveEditQr} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Rename Channel Display Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 text-sm focus:border-black outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Cumulative Collected (RM)</label>
                    <input
                      type="number"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 text-sm focus:border-black outline-none font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Threshold Max Limit (RM)</label>
                    <input
                      type="number"
                      required
                      value={editLimit}
                      onChange={(e) => setEditLimit(e.target.value)}
                      className="w-full bg-white/60 border border-brand-border rounded-xl px-4 py-3 text-sm focus:border-black outline-none font-mono font-bold"
                    />
                  </div>
                </div>

                {editingQr.type !== 'bank' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 font-bold">Update QR Code Image file</label>
                    <div className="border-2 border-dashed border-black/10 rounded-2xl p-6 bg-white/60 flex flex-col items-center justify-center text-center gap-2">
                      {editingQr.qrUrl ? (
                        <>
                          <img src={editingQr.qrUrl} className="w-32 h-32 object-contain rounded-lg border shadow-sm" alt="Editing QR" />
                          <button 
                            type="button"
                            onClick={() => setEditingQr((prev: any) => ({ ...prev, qrUrl: '' }))} 
                            className="text-[9px] text-red-500 hover:text-red-700 font-bold uppercase animate-pulse"
                          >
                            purge Image file
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer space-y-2 flex flex-col items-center">
                          <Download size={24} className="opacity-30" />
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Change image file</span>
                          <input type="file" accept="image/*" onChange={(e) => handleImageFileChange(e, true)} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 font-bold">Modify Bank Details metadata</label>
                    <textarea
                      value={editBankDetails}
                      onChange={(e) => setEditBankDetails(e.target.value)}
                      className="w-full bg-white border border-brand-border rounded-xl p-4 text-sm focus:border-black outline-none h-24 resize-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="cre-button bg-black text-white w-full py-4 text-xs font-black tracking-widest shadow-xl"
                >
                  SAVE CHANNEL REWRITE
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Recent Payers / History Modal */}
      <AnimatePresence>
        {viewHistoryQr && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewHistoryQr(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#F5F9FF] rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-black/5 bg-white/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase tracking-tight">Recent Payment Payer Logs</h3>
                    <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Channel: {viewHistoryQr.name}</p>
                  </div>
                </div>
                <button onClick={() => setViewHistoryQr(null)} className="p-1 px-2 hover:bg-black/5 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-4 overflow-y-auto max-h-[60vh]">
                {!viewHistoryQr.recentUsers || viewHistoryQr.recentUsers.length === 0 ? (
                  <p className="text-center py-10 opacity-40 font-bold uppercase text-[10px] tracking-widest">No payer history logs recorded</p>
                ) : (
                  viewHistoryQr.recentUsers.map((item: any, idx: number) => (
                    <div key={idx} className="bg-white/60 rounded-2xl border border-black/5 p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-zinc-800">{item.userName || 'Anonymous Payer'}</p>
                        <p className="text-[9px] text-zinc-400 font-mono font-medium">
                          {item.timestamp ? format(new Date(item.timestamp), 'MMM dd, HH:mm') : 'N/A'} • UID: {item.userId?.slice(0, 8)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-green-600">
                        +{formatPrice(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
