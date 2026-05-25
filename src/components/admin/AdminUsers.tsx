import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  query, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc, 
  deleteDoc,
  where, 
  getDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  User as UserIcon, 
  Wallet, 
  History, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Ban, 
  UserPlus, 
  Eye, 
  Package, 
  Truck, 
  Trash2, 
  ShieldAlert, 
  Edit2, 
  Copy, 
  Check, 
  Lock, 
  MapPin, 
  Clipboard,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { formatPrice, cn } from '../../lib/utils';
import { useAuth } from '../auth/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminUsers() {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // States for Adjusting Balance
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // States for Adding a New User/Admin
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [isCreatedAsAdmin, setIsCreatedAsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [userNote, setUserNote] = useState('');

  // States for User Details Modal
  const [showDetails, setShowDetails] = useState<any | null>(null);
  const [userItems, setUserItems] = useState<any[]>([]);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [userDraws, setUserDraws] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'inventory' | 'logistics' | 'addresses' | 'draws'>('profile');

  // Biography Editing States (inside details)
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Logistics Editing Panels (inside details logistics tab)
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [orderStatus, setOrderStatus] = useState('pending');
  const [orderCourier, setOrderCourier] = useState('');
  const [orderTracking, setOrderTracking] = useState('');
  const [orderNote, setOrderNote] = useState('');

  // Real-time listener for user accounts
  useEffect(() => {
    const q = query(collection(db, 'users'), limit(120));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Set initial bio editing variables when selected user changes
  useEffect(() => {
    if (showDetails) {
      setEditDisplayName(showDetails.displayName || '');
      setEditUsername(showDetails.username || showDetails.displayName || '');
      setEditPhotoURL(showDetails.photoURL || '');
      setEditPassword('');
      setIsEditingBio(false);
      setEditingOrder(null);
    }
  }, [showDetails]);

  // Balance Adjust with quick helper shortcuts
  const handleAdjustBalance = async (userObj: any, customAmount?: number, customReason?: string) => {
    if (!adminProfile?.isAdmin || !userObj) return;

    const amount = customAmount !== undefined ? customAmount : parseFloat(adjustAmount);
    const reason = customReason !== undefined ? customReason : adjustReason;

    if (isNaN(amount) || !reason) {
      alert("Please enter a valid amount and reason / 请输入正确的数额及备注");
      return;
    }

    try {
      const userRef = doc(db, 'users', userObj.uid);
      await updateDoc(userRef, {
        balance: increment(amount)
      });

      // Log balance log
      const logId = `balance-adj-${Date.now()}`;
      await setDoc(doc(db, 'balanceLogs', logId), {
        id: logId,
        userId: userObj.uid,
        amount: amount,
        type: amount > 0 ? 'admin_grant' : 'admin_deduction',
        reason: reason,
        timestamp: serverTimestamp(),
        adminId: adminProfile.uid
      });

      // Admin audit log
      const adminLogId = `admin-log-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', adminLogId), {
        id: adminLogId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: 'ADJUST_BALANCE',
        targetId: userObj.uid,
        details: `Adjusted balance for ${userObj.displayName} by RM ${amount}. Reason: ${reason}`,
        timestamp: serverTimestamp()
      });

      // Sync active state in detail modal
      if (showDetails && showDetails.uid === userObj.uid) {
        setShowDetails((prev: any) => ({ ...prev, balance: (prev.balance || 0) + amount }));
      }

      setSelectedUserForBalance(null);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  // Toggle Banned Flag
  const handleBanUser = async (userId: string, currentBannedState: boolean) => {
    if (!adminProfile?.isAdmin) return;
    const nextBanned = !currentBannedState;
    if (!confirm(`Are you sure you want to ${nextBanned ? 'BAN' : 'UNBAN'} this user? / 确认${nextBanned ? '封禁' : '解封'}该用户？`)) return;

    try {
      await updateDoc(doc(db, 'users', userId), { isBanned: nextBanned });
      
      // Update local state if currently selected
      if (showDetails && showDetails.uid === userId) {
        setShowDetails((prev: any) => ({ ...prev, isBanned: nextBanned }));
      }

      const logId = `admin-ban-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: nextBanned ? 'BAN_USER' : 'UNBAN_USER',
        targetId: userId,
        details: `${nextBanned ? 'Banned' : 'Unbanned'} user ${userId}`,
        timestamp: serverTimestamp()
      });
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Delete User completely (注销用户)
  const handleDeleteUser = async (userObj: any) => {
    if (!adminProfile?.isAdmin || !userObj) return;
    if (!confirm(`💣 WARNING: Are you sure you want to DELETE user "${userObj.displayName}" completely? This is IRREVERSIBLE and deletes credentials & profile documents! / 确认彻底注销并删除该用户？此操作不可逆！`)) return;

    try {
      // 1. Delete mapping record in usernames
      const usernameLower = (userObj.username || userObj.displayName || '').toLowerCase();
      if (usernameLower) {
        await deleteDoc(doc(db, 'usernames', usernameLower));
      }

      // 2. Delete user profile
      await deleteDoc(doc(db, 'users', userObj.uid));

      // 3. Log action
      const logId = `admin-del-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: 'DELETE_USER',
        targetId: userObj.uid,
        details: `Deleted and deregistered user ${userObj.displayName} (UID: ${userObj.uid})`,
        timestamp: serverTimestamp()
      });

      setShowDetails(null);
      alert("User deregistered successfully / 用户已成功注销");
    } catch (error: any) {
      alert("Deregister failed: " + error.message);
    }
  };

  // Create User or Admin safely (Using Translation Layer - No signout occurs!)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile?.isAdmin || !newUsername || !newPassword) return;

    try {
      const usernameLower = newUsername.trim().toLowerCase();
      
      // Check username exists
      const usernameRef = doc(db, 'usernames', usernameLower);
      const userSnap = await getDoc(usernameRef);
      if (userSnap.exists()) {
        throw new Error('Username already taken / 该用户名已被占用');
      }

      const newUid = `user_sys_${Date.now()}`;
      
      // Write translation credentials securely
      await setDoc(usernameRef, {
        uid: newUid,
        username: newUsername,
        lowercaseUsername: usernameLower,
        authPassword: newPassword, // changeable custom password
        firebaseAuthPassword: newPassword // static fallback on-the-fly provisioning password
      });

      const parsedBalance = parseFloat(initialBalance) || 0;
      const userDocRef = doc(db, 'users', newUid);
      await setDoc(userDocRef, {
        uid: newUid,
        displayName: newUsername,
        username: newUsername,
        balance: parsedBalance,
        isAdmin: isCreatedAsAdmin,
        isMember: isMember,
        isBanned: false,
        note: userNote,
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80', // Default gorgeous avatar!
        createdAt: serverTimestamp()
      });

      if (parsedBalance > 0) {
        const logId = `admin-init-${Date.now()}`;
        await setDoc(doc(db, 'balanceLogs', logId), {
          id: logId,
          userId: newUid,
          amount: parsedBalance,
          type: 'admin_grant',
          reason: 'Initial account balance',
          timestamp: serverTimestamp()
        });
      }

      // Admin audit log
      const adminLogId = `admin-log-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', adminLogId), {
        id: adminLogId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: isCreatedAsAdmin ? 'CREATE_ADMIN' : 'CREATE_USER',
        targetId: newUid,
        details: `Created account ${newUsername} (Admin: ${isCreatedAsAdmin ? 'True' : 'False'}) with balance RM ${parsedBalance}`,
        timestamp: serverTimestamp()
      });

      setShowAddUser(false);
      setNewUsername('');
      setNewPassword('');
      setInitialBalance('0');
      setUserNote('');
      setIsCreatedAsAdmin(false);
      setIsMember(false);
      alert(`Account "${newUsername}" created successfully! / 账号创建成功！`);
    } catch (error: any) {
      alert("Creation failed / 创建失败: " + error.message);
    }
  };

  // Save Biography and Username Changes (with usernames moving!)
  const handleSaveBio = async () => {
    if (!showDetails || !adminProfile?.isAdmin) return;
    
    try {
      const oldUsername = (showDetails.username || showDetails.displayName || '').trim();
      const nextUsername = editUsername.trim();
      
      if (!nextUsername) {
        alert("Username cannot be empty / 用户名不能为空");
        return;
      }

      const uid = showDetails.uid;
      const userRef = doc(db, 'users', uid);

      // If username has changed, handle translation document migration!
      if (oldUsername.toLowerCase() !== nextUsername.toLowerCase()) {
        const nextUsernameLower = nextUsername.toLowerCase();
        const nextUsernameRef = doc(db, 'usernames', nextUsernameLower);
        
        // Check if new name is already taken
        const checkSnap = await getDoc(nextUsernameRef);
        if (checkSnap.exists()) {
          alert("New username is already taken by another profile! / 新用户名已被占用！");
          return;
        }

        // Fetch old credential document parameters to preserve password mapping
        const oldUsernameLower = oldUsername.toLowerCase();
        const oldUsernameRef = doc(db, 'usernames', oldUsernameLower);
        const oldSnap = await getDoc(oldUsernameRef);
        
        let savedAuthPass = editPassword || '123456';
        let savedFirebasePass = '123456';

        if (oldSnap.exists()) {
          const oldData = oldSnap.data();
          savedAuthPass = editPassword || oldData.authPassword || '123456';
          savedFirebasePass = oldData.firebaseAuthPassword || oldData.authPassword || '123456';
        }

        // Write new username mapping
        await setDoc(nextUsernameRef, {
          uid: uid,
          username: nextUsername,
          lowercaseUsername: nextUsernameLower,
          authPassword: savedAuthPass,
          firebaseAuthPassword: savedFirebasePass
        });

        // Delete old username mapping
        await deleteDoc(oldUsernameRef);
      } else {
        // If username didn't change but passive password change is requested
        if (editPassword) {
          const usernameLower = oldUsername.toLowerCase();
          const usernameRef = doc(db, 'usernames', usernameLower);
          await updateDoc(usernameRef, {
            authPassword: editPassword
          });
        }
      }

      // Update actual user document profile params
      const updatePayload: any = {
        displayName: nextUsername,
        username: nextUsername,
        photoURL: editPhotoURL
      };
      
      await updateDoc(userRef, updatePayload);

      // Audit profile change
      const logId = `admin-bio-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: 'UPDATE_USER_PROFILE',
        targetId: uid,
        details: `Updated bio properties for ${nextUsername}`,
        timestamp: serverTimestamp()
      });

      // Update current rendering focus modal state
      setShowDetails((prev: any) => ({
        ...prev,
        displayName: nextUsername,
        username: nextUsername,
        photoURL: editPhotoURL
      }));

      setIsEditingBio(false);
      setEditPassword('');
      alert("Credentials & Bio saved! / 账号资料已成功保存！");
    } catch (err: any) {
      alert("Save failed: " + err.message);
    }
  };

  // Fetch full user sub-resource collections (inventory, orders, addresses, draws)
  const fetchUserDetails = async (userObj: any) => {
    setShowDetails(userObj);
    setActiveSubTab('profile');
    
    // Inventory
    const qItems = query(collection(db, 'inventory'), where('userId', '==', userObj.uid));
    onSnapshot(qItems, (snap) => {
      setUserItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Orders
    const qOrders = query(collection(db, 'orders'), where('userId', '==', userObj.uid));
    onSnapshot(qOrders, (snap) => {
      setUserOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Addresses subcollection
    const qAddr = query(collection(db, 'users', userObj.uid, 'addresses'));
    onSnapshot(qAddr, (snap) => {
      setUserAddresses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Draws history
    const qDraws = query(collection(db, 'draws'), where('userId', '==', userObj.uid));
    onSnapshot(qDraws, (snap) => {
      const drawnLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client side by chronological order
      drawnLogs.sort((a: any, b: any) => {
        const tA = a.timestamp?.seconds || 0;
        const tB = b.timestamp?.seconds || 0;
        return tB - tA;
      });
      setUserDraws(drawnLogs);
    });
  };

  // Delete Individual Won Prize directly from user's inventory (删除奖品)
  const handleDeletePrize = async (itemId: string, itemName: string) => {
    if (!adminProfile?.isAdmin) return;
    if (!confirm(`Are you sure you want to REMOVE "${itemName}" from this user's inventory? / 确认从该用户的仓库中扣除删除此奖品？`)) return;

    try {
      await deleteDoc(doc(db, 'inventory', itemId));
      
      // Audit deletion
      const logId = `admin-discard-prize-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: 'DELETE_INVENTORY_ITEM',
        targetId: itemId,
        details: `Deleted ${itemName} from user inventory`,
        timestamp: serverTimestamp()
      });
      alert('Item deleted! / 奖品已扣除删除');
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  // Modify Logistics details (更改物流) for any user order
  const handleModifyLogistics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !adminProfile?.isAdmin) return;

    try {
      const orderRef = doc(db, 'orders', editingOrder.id);
      const updateData: any = {
        status: orderStatus,
        courierName: orderCourier,
        trackingNumber: orderTracking,
        shippingNote: orderNote,
        updatedAt: serverTimestamp()
      };

      await updateDoc(orderRef, updateData);

      // Audit logistics modification
      const logId = `admin-logistics-${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        adminId: adminProfile.uid,
        adminName: adminProfile.displayName,
        action: 'UPDATE_LOGISTICS',
        targetId: editingOrder.id,
        details: `Updated logistics details for order #${editingOrder.id.slice(-6)} to ${orderStatus}`,
        timestamp: serverTimestamp()
      });

      setEditingOrder(null);
      alert("Logistics status updated! / 物流状态修改成功！");
    } catch (err: any) {
      alert("Logistics update failed: " + err.message);
    }
  };

  // Clipboard copy helper for Reset links
  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(identifier);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(search.toLowerCase()) || 
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.uid?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Search and Action Header */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
         <div className="relative w-full md:w-96 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Search user, admin, UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/40 border border-brand-border rounded-[20px] pl-12 pr-6 py-4 text-sm focus:border-black outline-none transition-all"
            />
         </div>
         
         <div className="flex flex-wrap items-center gap-4 w-full md:w-auto md:justify-end">
            <button
               onClick={() => setShowAddUser(true)}
               className="bg-black text-white hover:bg-zinc-800 text-[10px] font-black uppercase tracking-widest px-6 py-4 rounded-[20px] inline-flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
               <UserPlus size={14} /> Add User/Admin / 添增用户或管理员
            </button>
            <div className="text-[10px] font-bold uppercase opacity-30 tracking-widest bg-white border border-brand-border px-6 py-4 rounded-[20px]">
               {users.length} Active Profiles
            </div>
         </div>
      </div>

      {/* Grid of Users Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredUsers.map((user) => (
          <div key={user.uid} className="bg-white/40 backdrop-blur-xl border border-brand-border rounded-[32px] p-8 space-y-6 shadow-sm group hover:border-black transition-all relative overflow-hidden">
             {/* Admin Badging glow */}
             {user.isAdmin && (
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[30px] rounded-full pointer-events-none" />
             )}
             
             <div className="flex items-center justify-between">
                <div 
                  onClick={() => fetchUserDetails(user)}
                  className="flex items-center gap-4 cursor-pointer hover:opacity-85"
                >
                   <div className="w-14 h-14 bg-black text-white rounded-[24px] overflow-hidden flex items-center justify-center font-bold text-xl shadow-xl shrink-0 border border-black/10">
                      {user.photoURL ? (
                        <img src={user.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        user.displayName?.charAt(0).toUpperCase()
                      )}
                   </div>
                   <div className="truncate max-w-[150px]">
                      <h4 className="font-black text-lg tracking-tight truncate flex items-center gap-1.5 text-zinc-900">
                        {user.displayName}
                      </h4>
                      <p className="text-[9px] font-black uppercase opacity-40">Joined {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'Virtual onboard'}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   {user.isAdmin && <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Admin</span>}
                   {user.isBanned && <span className="bg-red-50 text-red-500 border border-red-100 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Banned</span>}
                </div>
             </div>

             <div className="bg-white/60 rounded-[24px] p-6 flex items-center justify-between border border-black/5">
                <div>
                   <p className="text-[9px] font-black uppercase opacity-40 tracking-widest">Available Balance</p>
                   <p className="text-2xl font-mono font-bold tracking-tighter text-zinc-900">{formatPrice(user.balance || 0)}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setSelectedUserForBalance(user)}
                     className="w-10 h-10 bg-white border border-brand-border rounded-xl flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                     title="Credit Adjustment"
                   >
                     <Wallet size={16} />
                   </button>
                   <button 
                     onClick={() => fetchUserDetails(user)}
                     className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
                     title="Manage Profile"
                   >
                     <ChevronRight size={18} />
                   </button>
                </div>
             </div>

             <div className="flex items-center gap-2 opacity-30 text-[9px] font-bold uppercase">
                <UserIcon size={11} />
                <span className="font-mono truncate">UID: {user.uid}</span>
             </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="p-20 text-center text-xs font-bold uppercase tracking-widest opacity-20">Refreshing profile directories...</div>
      )}

      {/* Manual balance adjustments */}
      <AnimatePresence>
        {selectedUserForBalance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUserForBalance(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 30 }} 
               className="relative w-full max-w-lg bg-[#FAFCFF] rounded-[40px] p-10 space-y-8 shadow-2xl border-2 border-brand-border"
            >
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-black text-white rounded-[20px] flex items-center justify-center shadow-xl">
                   <Wallet size={28} />
                 </div>
                 <div>
                   <h3 className="text-2xl font-black uppercase tracking-tight">Modify Credit / 余额加减</h3>
                   <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Adjusting wallet balance for {selectedUserForBalance.displayName}</p>
                 </div>
               </div>

               <div className="space-y-6">
                  {/* Quick Shortcut Buttons */}
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-wider opacity-40 ml-1">Quick Actions / 快速调整</label>
                     <div className="grid grid-cols-4 gap-2">
                        {['+10', '+50', '+100', '+500', '-10', '-50', '-100', '-500'].map((amt) => (
                           <button
                              key={amt}
                              onClick={() => {
                                handleAdjustBalance(selectedUserForBalance, parseFloat(amt), `Admin Quick Adj ${amt}`);
                              }}
                              className={cn(
                                "py-2.5 rounded-xl font-mono text-xs font-bold uppercase border-2 text-center transition-all hover:scale-105 active:scale-95 cursor-pointer",
                                amt.startsWith('+') 
                                  ? "bg-green-50/50 border-green-200 text-green-700 hover:bg-green-100" 
                                  : "bg-red-50/50 border-red-200 text-red-700 hover:bg-red-100"
                              )}
                           >
                              {amt}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-wider opacity-40 ml-1">Custom Adjustment Amount / 手动数值 (RM)</label>
                     <div className="relative">
                        <input 
                          type="number" 
                          placeholder="e.g. 100 or -50"
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 font-mono font-bold text-2xl focus:border-black outline-none transition-all shadow-sm" 
                        />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-wider opacity-40 ml-1">Reason Description / 备注描述</label>
                     <textarea 
                        placeholder="Manual payment matching, customer compensation, activity reward, etc."
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        className="w-full bg-white border border-brand-border rounded-xl px-6 py-4 text-sm font-medium focus:border-black outline-none transition-all shadow-sm resize-none h-20"
                     />
                  </div>
               </div>

               <div className="flex gap-4">
                  <button onClick={() => setSelectedUserForBalance(null)} className="flex-1 py-4 bg-white border border-black/10 rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</button>
                  <button 
                    onClick={() => handleAdjustBalance(selectedUserForBalance)}
                    disabled={!adjustAmount || !adjustReason}
                    className="flex-1 py-4 bg-black text-white border border-black rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20"
                  >
                    EXCHANGE VALUE / 确认币值调整
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual user onboarding */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddUser(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 30 }} 
               className="relative w-full max-w-lg bg-[#FAFCFF] rounded-[40px] p-10 space-y-8 shadow-2xl border-2 border-brand-border"
            >
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-black text-white rounded-[20px] flex items-center justify-center shadow-xl">
                   <UserPlus size={28} />
                 </div>
                 <div>
                   <h3 className="text-2xl font-black uppercase tracking-tight">Onboard User or Admin</h3>
                   <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Manual ecosystem member initializer / 创建新用户或管理员</p>
                 </div>
               </div>

               <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 ml-1">Username / 用户名</label>
                        <input type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-sm focus:border-black outline-none transition-all" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 ml-1">Password / 登录密码</label>
                        <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-sm focus:border-black outline-none transition-all" />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase opacity-40 ml-1">Initial Balance / 初始余额 (RM)</label>
                     <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono font-bold text-lg focus:border-black outline-none transition-all" />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase opacity-40 ml-1">Internal Note / 内部档案标注</label>
                     <textarea value={userNote} onChange={e => setUserNote(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all resize-none h-20" placeholder="e.g. VIP VIP client, event winner..." />
                  </div>

                  {/* Checkbox to define Administrator level! */}
                  <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-brand-border">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={isCreatedAsAdmin} 
                           onChange={(e) => setIsCreatedAsAdmin(e.target.checked)}
                           className="w-4 h-4 rounded text-black focus:ring-black border-brand-border" 
                        />
                        <div className="text-left">
                           <span className="text-[10px] font-black uppercase block">Is Admin</span>
                           <span className="text-[8px] opacity-40 block">Enable administrator panel</span>
                        </div>
                     </label>

                     <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={isMember} 
                           onChange={(e) => setIsMember(e.target.checked)}
                           className="w-4 h-4 rounded text-black focus:ring-black border-brand-border" 
                        />
                        <div className="text-left">
                           <span className="text-[10px] font-black uppercase block">Is Member</span>
                           <span className="text-[8px] opacity-40 block">Ecosystem VIP status flag</span>
                        </div>
                     </label>
                  </div>

                  <div className="flex gap-4">
                     <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-4 bg-white border border-black/10 rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</button>
                     <button type="submit" className="flex-1 py-4 bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Initialize Profile / 确认创建账户</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Master details modal with tab pages */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDetails(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 30 }} 
               className="relative w-full max-w-5xl bg-[#FAFCFF] rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh]"
            >
               {/* Left sidebar info column */}
               <div className="w-full md:w-80 bg-black p-8 flex flex-col justify-between text-white border-r border-white/5 shrink-0 overflow-y-auto no-scrollbar">
                   <div className="space-y-6">
                      <div className="w-24 h-24 bg-white/10 rounded-[32px] overflow-hidden mx-auto md:mx-0 flex items-center justify-center text-3xl font-bold border border-white/10 shadow-inner relative group">
                         {showDetails.photoURL ? (
                           <img src={showDetails.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                         ) : (
                           showDetails.displayName?.charAt(0).toUpperCase()
                         )}
                      </div>
                      <div className="space-y-1 text-center md:text-left">
                         <h3 className="text-3xl font-serif-italic italic leading-tight">{showDetails.displayName}</h3>
                         <p className="text-[9px] opacity-40 font-bold uppercase tracking-wider font-mono">UID: {showDetails.uid}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                         <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center md:text-left">
                            <p className="text-[8px] font-black uppercase opacity-30 text-white">Credit / 余额</p>
                            <p className="text-base font-mono font-bold tracking-tight text-yellow-400">{formatPrice(showDetails.balance || 0)}</p>
                         </div>
                         <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center md:text-left">
                            <p className="text-[8px] font-black uppercase opacity-30 text-white">Security</p>
                            <span className={cn("text-[10px] font-black uppercase block mt-0.5", showDetails.isBanned ? "text-red-500 animate-pulse" : "text-green-500")}>
                               {showDetails.isBanned ? 'Banned' : 'Active'}
                            </span>
                         </div>
                      </div>

                      {showDetails.note && (
                        <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 text-left">
                           <p className="text-[8px] font-black uppercase text-blue-400 mb-1">Remarks</p>
                           <p className="text-[10px] italic opacity-60 leading-relaxed font-serif-italic">{showDetails.note}</p>
                        </div>
                      )}
                   </div>

                   {/* Vertical Tab Navigation for details */}
                   <div className="space-y-1.5 pt-6">
                      {[
                        { id: 'profile', label: 'Auth Profile & Bio / 账号管理', icon: UserIcon },
                        { id: 'inventory', label: `Inventory Assets / 奖品仓库 (${userItems.length})`, icon: Package },
                        { id: 'logistics', label: `Logistics Orders / 物流订单 (${userOrders.length})`, icon: Truck },
                        { id: 'addresses', label: `Registered Addresses / 地址薄 (${userAddresses.length})`, icon: MapPin },
                        { id: 'draws', label: `Chronological Draws / 抽奖记录 (${userDraws.length})`, icon: History }
                      ].map((subTab) => (
                        <button
                           key={subTab.id}
                           onClick={() => {
                             setActiveSubTab(subTab.id as any);
                             setEditingOrder(null);
                           }}
                           className={cn(
                             "w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-3 transition-colors",
                             activeSubTab === subTab.id 
                               ? "bg-white text-black text-bold font-black" 
                               : "text-zinc-500 hover:bg-white/5 hover:text-white"
                           )}
                        >
                           <subTab.icon size={13} />
                           {subTab.label}
                        </button>
                      ))}
                   </div>

                   <div className="space-y-3 pt-6 shrink-0">
                      <button onClick={() => setShowDetails(null)} className="w-full py-3 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors cursor-pointer">Close Profile / 关闭详情</button>
                   </div>
               </div>

               {/* Right workspace panel */}
               <div className="flex-1 p-8 md:p-10 overflow-y-auto no-scrollbar space-y-8 bg-white">
                  
                  {/* WORKSPACE TAB 1: Profile & Password Recovery */}
                  {activeSubTab === 'profile' && (
                     <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-black/5 pb-4">
                           <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Auth Profile Credentials / 账号资料与安全</h4>
                           <button 
                             onClick={() => setIsEditingBio(!isEditingBio)}
                             className="text-[10px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer"
                           >
                             <Edit2 size={12} /> {isEditingBio ? 'Exit Edit Mode / 取消' : 'Edit Credentials / 直接更改'}
                           </button>
                        </div>

                        {/* Bio editing form */}
                        {isEditingBio ? (
                          <div className="bg-neutral-50/50 rounded-3xl p-6 border border-brand-border space-y-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase opacity-40 ml-1">Editable display name / 更改姓名</label>
                                <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-sm focus:border-black outline-none transition-all" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase opacity-40 ml-1">Editable Username / 更改用户名 (This handles translation relocation)</label>
                                <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-sm focus:border-black outline-none transition-all" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase opacity-40 ml-1">Avatar Photo URL / 头像图片链接</label>
                                <input type="text" value={editPhotoURL} onChange={e => setEditPhotoURL(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono text-xs focus:border-black outline-none transition-all" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase opacity-40 ml-1">Set Password Directly / 更改用户登录密码（不填不修改）</label>
                                <div className="relative">
                                   <input 
                                     type="text" 
                                     placeholder="Set new credentials password " 
                                     value={editPassword} 
                                     onChange={e => setEditPassword(e.target.value)} 
                                     className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 pr-12 font-mono text-sm focus:border-black outline-none transition-all" 
                                   />
                                   <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30" />
                                </div>
                             </div>

                             <div className="pt-2">
                                <button
                                  onClick={handleSaveBio}
                                  className="px-6 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                >
                                   Save Credentials / 保存更改
                                </button>
                             </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="bg-neutral-50/50 rounded-2xl p-6 border border-brand-border space-y-4">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Static Parameters / 资料细节</h5>
                                <div className="space-y-3">
                                   <div>
                                      <p className="text-[8px] font-black uppercase opacity-40">DisplayName / 真实姓名</p>
                                      <p className="font-semibold text-sm text-zinc-900">{showDetails.displayName}</p>
                                   </div>
                                   <div>
                                      <p className="text-[8px] font-black uppercase opacity-40">Username / 用户标识</p>
                                      <p className="font-semibold text-sm text-zinc-900">{showDetails.username || showDetails.displayName}</p>
                                   </div>
                                   <div>
                                      <p className="text-[8px] font-black uppercase opacity-40">Registered Email / 注册邮箱</p>
                                      <p className="font-mono text-xs text-zinc-605">{showDetails.email || 'Virtual native database account'}</p>
                                   </div>
                                </div>
                             </div>

                             <div className="bg-neutral-50/50 rounded-2xl p-6 border border-brand-border space-y-4 flex flex-col justify-between">
                                <div>
                                   <h5 className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Security Actions / 找回密码链接</h5>
                                   <p className="text-[9px] opacity-40 leading-relaxed uppercase font-bold mt-1.5">
                                      Copy recovery link. Send this link directly to the resident to reset password.
                                      / 复制用户找回密码重置链接，发送该专属链接给忘记密码的用户，用户可进入直接重置密码！
                                   </p>
                                </div>

                                <div className="space-y-2">
                                   {/* COPY FORWARD LINK FOR RESET PASSWORD */}
                                   <button
                                      onClick={() => {
                                        const rLink = `${window.location.origin}/login?resetToken=${showDetails.uid}&username=${encodeURIComponent(showDetails.username || showDetails.displayName)}`;
                                        copyToClipboard(rLink, 'recovery');
                                      }}
                                      className="w-full py-3 bg-white border border-brand-border rounded-xl text-[9px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 hover:bg-neutral-50 hover:border-black transition-all cursor-pointer"
                                   >
                                      {copiedIndex === 'recovery' ? <Check size={12} className="text-green-500" /> : <Clipboard size={12} />}
                                      {copiedIndex === 'recovery' ? 'Link Copied / 已复制' : 'Copy Password Changer Link / 复制密码找回链接'}
                                   </button>
                                </div>
                             </div>
                          </div>
                        )}

                        {/* Banish & Destroy panel */}
                        <div className="bg-red-50/30 rounded-[32px] p-6 border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
                           <div className="space-y-1 text-center md:text-left">
                              <h5 className="font-semibold text-sm text-red-900 flex items-center justify-center md:justify-start gap-2">
                                 <ShieldAlert size={16} /> Extreme Control Center / 风险管理控制
                              </h5>
                              <p className="text-[9px] text-red-700/60 font-medium uppercase leading-relaxed max-w-lg mt-1">
                                 Ban suspended accounts indefinitely or permanently purge credentials and logs data.
                                 / 可以对账户执行封禁(ban)限制或注销删除。注销将删除此用户包括其关联的所有账号数据库映射！
                              </p>
                           </div>

                           <div className="flex gap-3 w-full md:w-auto">
                              <button
                                 onClick={() => handleBanUser(showDetails.uid, showDetails.isBanned || false)}
                                 className={cn(
                                   "flex-1 md:flex-none px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 cursor-pointer transition-all",
                                   showDetails.isBanned 
                                     ? "bg-green-600 text-white hover:bg-green-700"
                                     : "bg-amber-600 text-white hover:bg-amber-700"
                                 )}
                              >
                                 <Ban size={12} />
                                 {showDetails.isBanned ? 'Unban / 解封' : 'Ban / 封禁账号'}
                              </button>

                              <button
                                 onClick={() => handleDeleteUser(showDetails)}
                                 className="flex-1 md:flex-none px-5 py-3 bg-red-650 text-white hover:bg-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 cursor-pointer transition-all"
                              >
                                 <Trash2 size={12} /> Deregister / 彻底注销用户
                              </button>
                           </div>
                        </div>
                     </div>
                  )}

                  {/* WORKSPACE TAB 2: Users Won Prizes / Inventory Delete */}
                  {activeSubTab === 'inventory' && (
                     <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-black/5 pb-4">
                           <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Inventory Collectibles & Drops / 仓库中持有的奖品列表</h4>
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">
                             Total Held: {userItems.length} Items
                           </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                           {userItems.map((item) => (
                             <div key={item.id} className="bg-white rounded-3xl p-5 border border-brand-border flex flex-col items-center justify-between gap-3 relative hover:shadow-md transition-shadow">
                                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                                   <img src={item.image} className="w-full h-full object-contain filter drop-shadow-md" alt="" />
                                </div>
                                <div className="text-center w-full space-y-1">
                                   <p className="text-[10px] font-black uppercase tracking-tight truncate block text-zinc-900">{item.prizeName}</p>
                                   <p className="text-[7.5px] text-zinc-400 font-bold uppercase block">Rarity: {item.rarity || 'Common'}</p>
                                </div>

                                <div className="w-full flex items-center justify-between pt-2 border-t border-black/5">
                                   <span className={cn(
                                     "text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full block",
                                     item.status === 'in_storage' ? "bg-blue-50 text-blue-505 border border-blue-100" : "bg-green-50 text-green-505 border border-green-100"
                                   )}>
                                      {item.status === 'in_storage' ? 'In Storage / 仓储中' : 'Shipped / 已发货'}
                                   </span>
                                   
                                   {/* DELETE WON PRIZE ACTION BUTTON */}
                                   <button
                                     onClick={() => handleDeletePrize(item.id, item.prizeName)}
                                     className="w-7 h-7 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                                     title="Delete Asset / 扣除删除奖品"
                                   >
                                      <Trash2 size={13} />
                                   </button>
                                </div>
                             </div>
                           ))}
                           {userItems.length === 0 && (
                             <div className="col-span-full py-16 text-center text-xs font-bold uppercase opacity-35 tracking-widest">No inventory assets held in warehouse / 用户的仓库里目前空空如也</div>
                           )}
                        </div>
                     </div>
                  )}

                  {/* WORKSPACE TAB 3: Shipping Orders & Logistics Modifiers */}
                  {activeSubTab === 'logistics' && (
                     <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-black/5 pb-4">
                           <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Logistics Shipping Tickets / 发货申请和物流进度</h4>
                           <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase">
                             {userOrders.length} Logistics Records
                           </span>
                        </div>

                        {/* Editing interactive screen inside tab workspace */}
                        {editingOrder ? (
                          <form onSubmit={handleModifyLogistics} className="bg-neutral-50 rounded-3xl p-6 border-2 border-brand-border space-y-6">
                             <div className="flex items-center justify-between border-b border-black/5 pb-3">
                                <div>
                                   <p className="text-[9px] font-black uppercase opacity-40">Currently Configuring</p>
                                   <h5 className="font-black text-sm uppercase">Modify Logistics for Order #{editingOrder.id.slice(-6)}</h5>
                                </div>
                                <button type="button" onClick={() => setEditingOrder(null)} className="text-[10px] font-bold uppercase text-zinc-400 hover:text-black">Cancel</button>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                   <label className="text-[10px] font-black opacity-50 block">Logistics Status / 快递状态</label>
                                   <select 
                                     value={orderStatus} 
                                     onChange={(e) => setOrderStatus(e.target.value)} 
                                     className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-xs focus:border-black outline-none"
                                   >
                                      <option value="pending">Pending Review / 待处理</option>
                                      <option value="processing">Processing & Pack / 正在配货</option>
                                      <option value="shipped">Shipped & Transit / 已发货</option>
                                      <option value="completed">Completed & Arrived / 已签收完成</option>
                                   </select>
                                </div>

                                <div className="space-y-1.5">
                                   <label className="text-[10px] font-black opacity-50 block">Courier Name / 快递公司</label>
                                   <input type="text" placeholder="e.g. DHL, FedEx, PosLaju..." value={orderCourier} onChange={e => setOrderCourier(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-xs focus:border-black outline-none" />
                                </div>

                                <div className="space-y-1.5">
                                   <label className="text-[10px] font-black opacity-50 block">Tracking Code / 快递面单号</label>
                                   <input type="text" placeholder="Tracking Number..." value={orderTracking} onChange={e => setOrderTracking(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-mono text-xs focus:border-black outline-none" />
                                </div>

                                <div className="space-y-1.5">
                                   <label className="text-[10px] font-black opacity-50 block">Admin Logistics Comment / 发货内部备注</label>
                                   <input type="text" placeholder="Shipping notes, packing staff, etc..." value={orderNote} onChange={e => setOrderNote(e.target.value)} className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 font-semibold text-xs focus:border-black outline-none" />
                                </div>
                             </div>

                             <div className="pt-2">
                                <button type="submit" className="w-full py-3.5 bg-black text-white hover:bg-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer">
                                   Save Logistics Update / 确认修改快递信息
                                </button>
                             </div>
                          </form>
                        ) : (
                          <div className="space-y-4">
                             {userOrders.map((order) => (
                               <div key={order.id} className="bg-neutral-50/50 hover:bg-neutral-50 border border-brand-border p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors">
                                  <div className="space-y-3 flex-1">
                                     <div className="flex items-center gap-3 flex-wrap">
                                        <span className="font-mono font-black text-xs text-zinc-900 block">#{order.id.slice(-8).toUpperCase()}</span>
                                        <span className={cn(
                                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full block border",
                                          order.status === 'pending' ? "bg-yellow-50 text-amber-600 border-amber-200" :
                                          order.status === 'processing' ? "bg-blue-50 text-blue-600 border-blue-200" :
                                          order.status === 'shipped' ? "bg-purple-50 text-purple-600 border-purple-200" :
                                          "bg-green-50 text-green-600 border-green-200"
                                        )}>
                                           {order.status}
                                        </span>
                                        <span className="text-[9px] font-bold text-zinc-400 block">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'recently'}</span>
                                     </div>

                                     {/* Shipping address recap */}
                                     {order.address && (
                                       <div className="text-[10px] opacity-60 leading-relaxed font-sans text-neutral-600">
                                          <p className="font-bold flex items-center gap-1.5"><MapPin size={11} /> {order.address.recipientName} ({order.address.phone})</p>
                                          <p className="pl-4">{order.address.street}, {order.address.city}, {order.address.postcode}, {order.address.state}</p>
                                       </div>
                                     )}

                                     <div className="flex -space-x-2 pt-1 overflow-x-auto no-scrollbar">
                                        {order.items?.map((it: any, i: number) => (
                                          <div key={i} className="w-8 h-8 rounded-lg overflow-hidden border border-brand-border bg-white p-0.5 shrink-0 shadow-md scroll-smooth" title={it.prizeName}>
                                             <img src={it.image} className="w-full h-full object-contain" />
                                          </div>
                                        ))}
                                     </div>
                                  </div>

                                  <div className="text-right space-y-2 shrink-0 w-full md:w-auto">
                                     {order.trackingNumber && (
                                       <p className="text-[10px] font-mono font-bold text-blue-600 uppercase">
                                          {order.courierName}: {order.trackingNumber}
                                       </p>
                                     )}
                                     
                                     {/* EDIT LOGISTICS ACTION BUTTON */}
                                     <button
                                       onClick={() => {
                                         setEditingOrder(order);
                                         setOrderStatus(order.status || 'pending');
                                         setOrderCourier(order.courierName || '');
                                         setOrderTracking(order.trackingNumber || '');
                                         setOrderNote(order.shippingNote || '');
                                       }}
                                       className="w-full md:w-auto py-2 px-4 bg-white border border-brand-border text-zinc-950 font-black text-[9px] uppercase tracking-widest rounded-lg hover:border-black transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                     >
                                        <Edit2 size={11} /> Modify Logistics / 更改物流
                                     </button>
                                  </div>
                               </div>
                             ))}
                             {userOrders.length === 0 && (
                               <div className="py-16 text-center text-xs font-bold uppercase opacity-35 tracking-widest">No shipping logistics requests / 暂无任何发货订单</div>
                             )}
                          </div>
                        )}
                     </div>
                  )}

                  {/* WORKSPACE TAB 4: Saved Shipping Addresses */}
                  {activeSubTab === 'addresses' && (
                     <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-black/5 pb-4">
                           <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Registered Mailing Addresses / 保存的收货地址薄</h4>
                           <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">
                             {userAddresses.length} Addresses / 个保存地址
                           </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {userAddresses.map((addr) => (
                             <div key={addr.id} className="bg-neutral-50/50 p-6 rounded-2xl border border-brand-border relative space-y-3">
                                {addr.isDefault && (
                                  <span className="absolute top-4 right-4 bg-green-50 text-green-600 border border-green-200.50 px-2 py-0.5 text-[8px] font-bold uppercase rounded-full">
                                    Default / 默认
                                  </span>
                                )}
                                <div className="space-y-1">
                                   <p className="font-bold text-sm flex items-center gap-1.5"><MapPin size={13} /> {addr.recipientName}</p>
                                   <p className="text-xs text-zinc-400 font-mono font-medium">{addr.phone}</p>
                                </div>
                                <div className="text-[11px] text-zinc-600 font-medium leading-relaxed pl-5 border-l-2 border-brand-border">
                                   {addr.street},<br />
                                   {addr.city}, {addr.postcode},<br />
                                   {addr.state}
                                </div>
                             </div>
                           ))}
                           {userAddresses.length === 0 && (
                             <div className="col-span-full py-16 text-center text-xs font-bold uppercase opacity-35 tracking-widest">No address logs registered by user / 用户尚未添加任何收货地址</div>
                           )}
                        </div>
                     </div>
                  )}

                  {/* WORKSPACE TAB 5: Drawings History Table */}
                  {activeSubTab === 'draws' && (
                     <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-black/5 pb-4">
                           <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Chronological Draws History / 抽奖中盒流水记录</h4>
                           <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-full uppercase">
                             Total Draws / 累计抽盒: {userDraws.length} Times
                           </span>
                        </div>

                        <div className="bg-white rounded-2xl border border-brand-border overflow-hidden shadow-inner">
                           <div className="max-h-[50vh] overflow-y-auto no-scrollbar">
                              <table className="w-full text-left text-xs font-medium border-collapse">
                                 <thead>
                                    <tr className="bg-neutral-50 border-b border-brand-border text-[9px] font-black uppercase tracking-wider text-neutral-500">
                                       <th className="p-4">Box Catalog / 盲盒类</th>
                                       <th className="p-4">Won Item & Drop / 抽得物品</th>
                                       <th className="p-4">Rarity / 稀有度</th>
                                       <th className="p-4">Spent (RM) / 花费</th>
                                       <th className="p-4 text-right">Timestamp / 时间</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-black/5">
                                    {userDraws.map((dt) => (
                                      <tr key={dt.id} className="hover:bg-neutral-50/50 transition-colors">
                                         <td className="p-4 font-black">{dt.boxName || 'Mystery Box'}</td>
                                         <td className="p-4 font-semibold text-zinc-800">{dt.prizeName}</td>
                                         <td className="p-4">
                                            <span className="text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                                               {dt.rarity || 'Common'}
                                            </span>
                                         </td>
                                         <td className="p-4 font-mono font-bold text-neutral-600">{dt.pricePaid !== undefined ? `RM ${dt.pricePaid}` : '-'}</td>
                                         <td className="p-4 text-right opacity-45 text-[10px] font-mono leading-none">
                                            {dt.timestamp?.toDate ? dt.timestamp.toDate().toLocaleString() : (dt.timestamp ? new Date(dt.timestamp).toLocaleString() : 'recently')}
                                         </td>
                                      </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                           {userDraws.length === 0 && (
                             <div className="py-16 text-center text-xs font-bold uppercase opacity-35 tracking-widest border-t border-brand-border">No unboxing history logs / 该用户没有产生任何开箱记录</div>
                           )}
                        </div>
                     </div>
                  )}

               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
