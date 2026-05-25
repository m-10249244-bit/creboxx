import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Wallet, CreditCard, QrCode, Upload, CheckCircle2, History, Info, ChevronRight, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../components/auth/AuthContext';
import { useConfig } from '../components/ConfigContext';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
import { compressImage, fileToBase64 } from '../lib/imageUtils';
import { formatPrice, cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Topup() {
  const { user, profile } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [qrPool, setQrPool] = useState<any[]>([]);
  const [assignedQr, setAssignedQr] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'topupRequests'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchQrs = async () => {
      try {
        const snap = await getDocs(collection(db, 'qrPool'));
        setQrPool(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching QR Pool:', err);
      }
    };
    fetchQrs();
  }, [step]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      setProof(compressed);
      const output = await fileToBase64(compressed);
      setProofPreview(output);
    } catch (err) {
      console.error('File process error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!user || !amount || !method || !proof) return;
    setIsUploading(true);
    
    try {
      // Image already compressed during selection for responsiveness
      const base64 = await fileToBase64(proof);
      
      const requestId = `topup-${Date.now()}`;
      await setDoc(doc(db, 'topupRequests', requestId), {
        id: requestId,
        userId: user.uid,
        userName: profile?.displayName || 'User',
        amount: parseFloat(amount),
        method,
        proofUrl: base64,
        status: 'pending',
        qrId: assignedQr?.id || 'default',
        qrName: assignedQr?.name || 'Default Channel',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update QR Code Limit Allocation and Usage Counter
      if (assignedQr) {
        const qrRef = doc(db, 'qrPool', assignedQr.id);
        const nextCollect = (assignedQr.currentAmount || 0) + parseFloat(amount);
        const limitAmt = assignedQr.maxLimit || 500;
        const reachedLimit = nextCollect >= limitAmt;

        const recordEntry = {
          userId: user.uid,
          userName: profile?.displayName || 'User',
          amount: parseFloat(amount),
          timestamp: new Date().toISOString()
        };

        const existingHist = assignedQr.recentUsers || [];
        const finalHist = [recordEntry, ...existingHist].slice(0, 10);

        const nextStatus = assignedQr.status === 'paused'
          ? 'paused'
          : (reachedLimit ? 'full' : 'active');

        await setDoc(qrRef, {
          currentAmount: nextCollect,
          usageCount: (assignedQr.usageCount || 0) + 1,
          status: nextStatus,
          recentUsers: finalHist
        }, { merge: true });
      }
      
      setStep(4); // Success step
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit topup request. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!config?.allowTopup) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-serif-italic italic mb-4">Top-ups Disabled</h1>
        <p className="text-zinc-500">The top-up system is currently undergoing maintenance.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-black transition-colors">
          <ArrowLeft size={20} />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
        <button 
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 bg-white/40 border border-brand-border px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm"
        >
          <History size={14} />
          History
        </button>
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif-italic italic">Top-up Wallet</h1>
        <p className="text-zinc-500 font-medium opacity-60">Add credits to your account via manual payment.</p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            step >= s ? "bg-black" : "bg-black/5"
          )} />
        ))}
      </div>

      <div className="bg-white/30 backdrop-blur-2xl border border-white/40 rounded-[32px] p-8 md:p-12 shadow-2xl shadow-blue-200/10 min-h-[400px] flex flex-col">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col justify-center"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Enter Amount (RM)</label>
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-blue bg-blue-50/60 border border-blue-100 px-3 py-1 rounded-full animate-pulse">
                    最高单次充值限额: RM 500.00
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-mono font-bold opacity-20">RM</span>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    max="500"
                    className="w-full bg-white/40 border border-black/10 rounded-[24px] py-8 px-20 text-5xl font-mono font-bold focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[10, 50, 100, 200, 500].map(val => (
                    <button 
                      key={val}
                      onClick={() => setAmount(val.toString())}
                      className="bg-white/60 border border-black/5 hover:border-black px-6 py-2 rounded-full text-xs font-bold transition-all"
                    >
                      RM{val}
                    </button>
                  ))}
                </div>

                {/* QR Pool Limit Checks */}
                {parseFloat(amount) > 0 && (() => {
                  const amtVal = parseFloat(amount);
                  if (amtVal > 500) {
                    return (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
                        <AlertCircle size={18} className="shrink-0 text-red-500" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">无法充值 (Unable to Top Up)</p>
                          <p className="text-[11px] opacity-90 font-semibold">
                            超出最高单次充值限额。最高单次充值金额为: RM 500.00
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const activeQrs = qrPool.filter(q => q.status === 'active');
                  if (activeQrs.length === 0) {
                    return (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
                        <AlertCircle size={18} className="shrink-0 text-red-500" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">无法充值 (No Available Channel)</p>
                          <p className="text-[11px] opacity-90 font-semibold w-full">
                            由于收款额度已满，当前系统无可用收款二维码，无法充值。直接显示最高充值 500.00
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const hasMatching = qrPool.some(q => 
                    q.status === 'active' && 
                    ((q.maxLimit || 500) - (q.currentAmount || 0)) >= amtVal
                  );

                  if (!hasMatching) {
                    const maxPossible = Math.max(...activeQrs.map(q => Math.max((q.maxLimit || 500) - (q.currentAmount || 0), 0)));
                    return (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
                        <AlertCircle size={18} className="shrink-0 text-red-500" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">无法充值 (Limit Exceeded)</p>
                          <p className="text-[11px] opacity-90 font-semibold">
                            由于收款上限并无对应的二维码，无法充值。当前系统最高单次可用充值额度为: RM {maxPossible.toFixed(2)}。最高单次限制: RM 500.00
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <button 
                disabled={
                  !amount || 
                  parseFloat(amount) < (config?.minTopupAmount || 1) || 
                  parseFloat(amount) > 500 || 
                  !qrPool.some(q => q.status === 'active' && ((q.maxLimit || 500) - (q.currentAmount || 0)) >= parseFloat(amount))
                }
                onClick={() => setStep(2)}
                className="cre-button w-full h-16 text-lg bg-black text-white hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none"
              >
                PROCEED TO METHOD
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col justify-center"
            >
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Choose Payment Method</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'tng', name: 'TNG eWallet', icon: QrCode, color: 'bg-blue-50' },
                    { id: 'duitnow', name: 'DuitNow QR', icon: QrCode, color: 'bg-pink-50' },
                    { id: 'bank', name: 'Bank Transfer', icon: CreditCard, color: 'bg-neutral-50' }
                  ].map(m => {
                    const amtVal = parseFloat(amount) || 0;
                    const hasMethodQr = qrPool.some(q => 
                      q.type === m.id && 
                      q.status === 'active' && 
                      ((q.maxLimit || 500) - (q.currentAmount || 0)) >= amtVal
                    );

                    return (
                      <button
                        key={m.id}
                        disabled={!hasMethodQr}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          "p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-4 group relative",
                          method === m.id ? "border-black bg-white shadow-xl" : "border-white/40 bg-white/20 hover:bg-white/40 shadow-sm",
                          !hasMethodQr && "opacity-45 cursor-not-allowed bg-zinc-100"
                        )}
                      >
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", m.color)}>
                          <m.icon size={24} className="text-black/60" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">{m.name}</span>
                        {!hasMethodQr && (
                          <span className="absolute top-2 right-2 bg-red-500 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
                            Full / 额满
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {method && (() => {
                  const amtVal = parseFloat(amount) || 0;
                  const hasMethodQr = qrPool.some(q => 
                    q.type === method && 
                    q.status === 'active' && 
                    ((q.maxLimit || 500) - (q.currentAmount || 0)) >= amtVal
                  );
                  if (!hasMethodQr) {
                    return (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-left text-xs font-semibold">
                        ❌ 该收款通道收款上限已达标，并无对应的可用二维码，无法充值。直接显示最高充值 500.00
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(1)}
                  className="bg-white/40 border border-black/10 px-8 py-4 rounded-[14px] font-bold text-xs"
                >
                  BACK
                </button>
                <button 
                  disabled={
                    !method || 
                    !qrPool.some(q => 
                      q.type === method && 
                      q.status === 'active' && 
                      ((q.maxLimit || 500) - (q.currentAmount || 0)) >= (parseFloat(amount) || 0)
                    )
                  }
                  onClick={() => {
                    if (!method) return;
                    const amtVal = parseFloat(amount) || 0;
                    // Find active QR codes of this payment type that aren't saturated and have capacity
                    const activeQrs = qrPool.filter(q => 
                      q.type === method && 
                      q.status === 'active' && 
                      ((q.maxLimit || 500) - (q.currentAmount || 0)) >= amtVal
                    );
                    if (activeQrs.length > 0) {
                      // Random distribution among available QR targets
                      const selected = activeQrs[Math.floor(Math.random() * activeQrs.length)];
                      setAssignedQr(selected);
                    } else {
                      setAssignedQr(null); // Fallback
                    }
                    setStep(3);
                  }}
                  className="cre-button bg-black text-white flex-1 h-16 text-lg hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none"
                >
                  NEXT
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold uppercase tracking-tight">Payment Details</h3>
                    <p className="text-sm text-zinc-500">Please send precisely <span className="font-bold text-black">RM{amount}</span> to the account below.</p>
                  </div>

                  <div className="bg-black text-white p-6 rounded-[24px] shadow-2xl">
                    {assignedQr ? (
                      <div className="space-y-4 text-center">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/10 px-3 py-1 rounded-full text-brand-blue border border-white/5">
                          🔗 CHANNEL: {assignedQr.name}
                        </span>
                        
                        {assignedQr.qrUrl ? (
                          <div className="bg-white p-4 rounded-xl inline-block mt-2">
                            <img 
                              src={assignedQr.qrUrl} 
                              alt={`${assignedQr.name} QR`} 
                              className="w-48 h-48 object-contain rounded-lg mx-auto"
                            />
                          </div>
                        ) : null}

                        {assignedQr.bankDetailsText ? (
                          <pre className="font-mono text-sm text-zinc-300 text-left bg-white/5 p-4 rounded-xl whitespace-pre-wrap">{assignedQr.bankDetailsText}</pre>
                        ) : null}

                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                          Random Channel Assigned • Safe Payment
                        </p>
                      </div>
                    ) : (
                      method === 'bank' ? (
                        <pre className="font-mono text-sm whitespace-pre-wrap">{config?.paymentMethods?.bank?.details}</pre>
                      ) : (
                        <div className="space-y-4 text-center">
                          <div className="bg-white p-4 rounded-xl inline-block">
                             <img 
                              src={method === 'tng' ? config?.paymentMethods?.tng?.qrUrl : config?.paymentMethods?.duitnow?.qrUrl} 
                              alt="QR Code" 
                              className="w-48 h-48 object-cover rounded-lg"
                             />
                          </div>
                          <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                            Scan to pay • {method === 'tng' ? 'TNG eWallet' : 'DuitNow'}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Upload Proof of Payment</label>
                  <label 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={cn(
                      "relative block w-full aspect-square md:aspect-[4/5] rounded-[24px] border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                      proofPreview ? "border-black" : "border-black/5 hover:border-black/20 hover:bg-white/40"
                    )}
                  >
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    {proofPreview ? (
                      <div className="w-full h-full relative">
                        <img src={proofPreview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-white text-xs font-bold uppercase tracking-widest">Change Image</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                        <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center">
                          <Upload size={24} className="opacity-40" />
                        </div>
                        <p className="text-xs text-zinc-500 font-medium">Click or drag receipt photo here</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setStep(2)}
                  className="bg-white/40 border border-black/10 px-8 py-4 rounded-[14px] font-bold text-xs"
                >
                  BACK
                </button>
                <button 
                  disabled={!proof || isUploading}
                  onClick={handleSubmit}
                  className="cre-button bg-black text-white flex-1 h-16 text-lg hover:bg-neutral-800"
                >
                  {isUploading ? 'SUBMITTING...' : 'SUBMIT FOR REVIEW'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10"
            >
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center relative">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <CheckCircle2 size={48} className="text-green-500" />
                </motion.div>
                <div className="absolute inset-0 bg-green-500/20 blur-2xl animate-pulse rounded-full" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-4xl font-serif-italic italic">Submission Received</h2>
                <p className="text-zinc-500 max-w-sm mx-auto">Your top-up request is now pending review. It usually takes 5-30 minutes during business hours.</p>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setShowHistory(true)}
                  className="px-8 py-4 bg-white/60 border border-black/10 rounded-[14px] font-bold text-xs"
                >
                  VIEW STATUS
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="cre-button bg-black text-white px-10 py-4 text-xs"
                >
                  BACK TO HOME
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-[#F5F9FF] rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-black/5 flex items-center justify-between bg-white/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase tracking-tight">Top-up History</h3>
                    <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Pending & Completed</p>
                  </div>
                </div>
                <button onClick={() => setShowHistory(false)} className="bg-black/5 p-2 rounded-full hover:bg-black/10 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <History size={48} className="mx-auto mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">No history yet</p>
                  </div>
                ) : (
                  history.map((req) => (
                    <div key={req.id} className="bg-white/60 border border-white rounded-[24px] p-6 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-black/5 flex items-center justify-center overflow-hidden">
                          <img src={req.proofUrl} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xl font-mono font-bold">{formatPrice(req.amount)}</p>
                          <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">
                            {format(req.createdAt?.toDate ? req.createdAt.toDate() : (req.createdAt ? new Date(req.createdAt) : new Date()), 'MMM dd, HH:mm')} • {req.method.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-[0.2em]",
                        req.status === 'pending' ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                        req.status === 'approved' ? "bg-green-50 border-green-200 text-green-700" :
                        "bg-red-50 border-red-200 text-red-700"
                      )}>
                        {req.status}
                      </div>
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
