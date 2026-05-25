import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../components/auth/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import {
  Package,
  Truck,
  Boxes,
  RefreshCw,
  Star,
  ArrowRight,
  Wallet,
  History,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Check,
  AlertCircle,
  Camera,
  Trash2,
  X,
  Settings2,
  Shield,
  Calendar,
  Edit,
  Move,
  ZoomIn,
  Eye,
} from "lucide-react";
import { RARITY_COLORS, cn, formatPrice } from "../lib/utils";
import { compressImage, fileToBase64 } from "../lib/imageUtils";
import { format } from "date-fns";
import AddressManager from "../components/profile/AddressManager";
import { useConfig } from "../components/ConfigContext";
import { toast } from "sonner";

export default function Warehouse() {
  const { user, profile, updateProfile } = useAuth();
  const { config } = useConfig();

  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [balanceLogs, setBalanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation layout choices: 'portfolio' (my collection), 'logistics' (my shipping/orders), 'addresses' (settings)
  const [currentSection, setCurrentSection] = useState<
    "portfolio" | "logistics" | "addresses"
  >("portfolio");
  const [filter, setFilter] = useState("all");

  // Billing History Slideout
  const [showBillingHistory, setShowBillingHistory] = useState(false);

  // Avatar Editing States
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [rawAvatarImage, setRawAvatarImage] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HTML5 Image Cropper Coordinates
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Shipping Flow State
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedItemsForShip, setSelectedItemsForShip] = useState<any[]>([]);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [isShipping, setIsShipping] = useState(false);

  const calculatePostage = () => {
    if (!selectedAddress || !config) return 0;
    return selectedAddress.region === "east"
      ? config.shippingFees.east
      : config.shippingFees.west;
  };

  useEffect(() => {
    if (!user) return;

    // Items listener
    const qItems = query(
      collection(db, "inventory"),
      where("userId", "==", user.uid),
    );
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as any,
      );
      setItems(
        data.sort(
          (a, b) =>
            new Date(b.wonAt || 0).getTime() - new Date(a.wonAt || 0).getTime(),
        ),
      );
      setLoading(false);
    });

    // Orders listener
    const qOrders = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as any,
      );
      setOrders(
        data.sort(
          (a, b) =>
            new Date(b.createdAt?.seconds * 1000 || 0).getTime() -
            new Date(a.createdAt?.seconds * 1000 || 0).getTime(),
        ),
      );
    });

    // Balance mutation logs listener
    const qLogs = query(
      collection(db, "balanceLogs"),
      where("userId", "==", user.uid),
    );
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as any,
      );
      setBalanceLogs(
        data.sort(
          (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0),
        ),
      );
    });

    return () => {
      unsubscribeItems();
      unsubscribeOrders();
      unsubscribeLogs();
    };
  }, [user]);

  // Canvas Rerender for Interactive Cropper
  useEffect(() => {
    if (!rawAvatarImage || !canvasRef.current || !showCropModal) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = rawAvatarImage;
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Move to center of canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Draw image centering at calculated offsets
      const imgWidth = img.width;
      const imgHeight = img.height;
      const scaleFactor = Math.min(
        canvas.width / imgWidth,
        canvas.height / imgHeight,
      );
      const w = imgWidth * scaleFactor;
      const h = imgHeight * scaleFactor;

      ctx.drawImage(img, -w / 2 + offset.x, -h / 2 + offset.y, w, h);
      ctx.restore();

      // Draw elegant semi-transparent circular masking overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2.5,
        0,
        Math.PI * 2,
        true,
      );
      ctx.fill();

      // Clean circular crop guide border
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2.5,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    };
  }, [rawAvatarImage, zoom, rotation, offset, showCropModal]);

  // Avatar operations
  const triggerAvatarSelect = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const b64 = await fileToBase64(compressed);
      setRawAvatarImage(b64);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    } catch (err) {
      toast.error("Unable to parse file visual");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const executeAvatarCrop = async () => {
    if (!canvasRef.current || !user) return;
    try {
      // Create offscreen high-res crop canvas
      const cropSize = 250;
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropSize;
      cropCanvas.height = cropSize;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      const mainCanvas = canvasRef.current;
      const radius = mainCanvas.width / 2.5;
      const extX = mainCanvas.width / 2 - radius;
      const extY = mainCanvas.height / 2 - radius;
      const diameter = radius * 2;

      // Copy the circular portion from coordinates to smaller canvas
      cropCtx.drawImage(
        mainCanvas,
        extX,
        extY,
        diameter,
        diameter,
        0,
        0,
        cropSize,
        cropSize,
      );
      const croppedBase64 = cropCanvas.toDataURL("image/webp", 0.85);

      // Save to real database
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { photoURL: croppedBase64 });

      toast.success("Brand profile avatar updated!");
      setShowCropModal(false);
      setRawAvatarImage(null);
    } catch (err) {
      toast.error("DB sync write failed.");
    }
  };

  const deleteCurrentAvatar = async () => {
    if (!user || !confirm("Permanently remove your current profile portrait?"))
      return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
      });
      toast.success("Portrait reset.");
    } catch (error) {
      toast.error("Failed to reset avatar.");
    }
  };

  // Drag interaction inside canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.current.x) / zoom;
    const dy = (e.clientY - dragStart.current.y) / zoom;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Shipping implementation
  const openShippingFlow = (item: any) => {
    setSelectedItemsForShip([item]);
    setShowShippingModal(true);
  };

  const handleConfirmShipping = async () => {
    if (
      !user ||
      selectedItemsForShip.length === 0 ||
      !selectedAddress ||
      !config
    )
      return;

    const postage = calculatePostage();
    if ((profile?.balance || 0) < postage) {
      toast.error("Insufficient balance for postage processing");
      return;
    }

    setIsShipping(true);
    try {
      const orderId = `order-${Date.now()}`;

      // 1. Create order
      await setDoc(doc(db, "orders", orderId), {
        id: orderId,
        userId: user.uid,
        userName: profile?.displayName || "Resident User",
        items: selectedItemsForShip,
        address: selectedAddress,
        postage,
        totalAmount: postage,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Update item status to shipped
      await Promise.all(
        selectedItemsForShip.map((item) =>
          updateDoc(doc(db, "inventory", item.id), {
            status: "shipped",
            orderId: orderId,
          }),
        ),
      );

      // 3. Deduct postage and write audit logs
      if (postage > 0) {
        await updateDoc(doc(db, "users", user.uid), {
          balance: increment(-postage),
        });

        await setDoc(doc(db, "balanceLogs", `postage-${orderId}`), {
          id: `postage-${orderId}`,
          userId: user.uid,
          amount: -postage,
          type: "shipping_fee",
          reason: `Postage fee for order #${orderId.slice(-6)} (${selectedItemsForShip.length} items)`,
          relatedId: orderId,
          timestamp: serverTimestamp(),
        });
      }

      toast.success(
        "Your shipping dispatch request was registered successfully!",
      );
      setShowShippingModal(false);
      setSelectedItemsForShip([]);
      setCheckedItemIds([]);
      setSelectedAddress(null);
    } catch (err) {
      toast.error("Process error.");
    } finally {
      setIsShipping(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  if (loading)
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCw className="animate-spin text-zinc-400" />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* Editorial Luxury Header Banner */}
      <div className="relative w-full rounded-[48px] overflow-hidden border border-black/5 bg-gradient-to-tr from-sky-100/50 via-pink-50/40 to-yellow-50/50 p-12 md:p-16 flex flex-col md:flex-row items-center gap-12 shadow-inner group">
        <div className="absolute inset-0 bg-white/20 backdrop-blur-2xl -z-10" />

        {/* Premium Avatar Layout */}
        <div className="relative hover:scale-[1.03] transition-transform duration-500 shrink-0">
          <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl relative bg-[#FAFBFF] group/avatar">
            <img
              src={
                profile?.photoURL ||
                `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.uid}`
              }
              className="w-full h-full object-cover"
              alt="avatar"
              referrerPolicy="no-referrer"
            />
            <div
              className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
              onClick={triggerAvatarSelect}
            >
              <Camera size={24} className="mb-1" />
              <span className="text-[9px] font-black uppercase tracking-wider">
                REPLACE
              </span>
            </div>
          </div>

          {/* Float control options (mobile direct upload & delete trigger) */}
          <div className="absolute -bottom-2 right-2 flex gap-2">
            <button
              onClick={triggerAvatarSelect}
              className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
              title="Direct upload, supports mobile camera upload"
            >
              <Camera size={14} />
            </button>
            {profile?.photoURL && (
              <button
                onClick={deleteCurrentAvatar}
                className="w-10 h-10 bg-white border border-brand-border text-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-neutral-50 hover:scale-110 transition-transform cursor-pointer"
                title="Delete current avatar selection"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
        </div>

        {/* Meta user Details */}
        <div className="space-y-6 flex-1 text-center md:text-left">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-black text-white px-4 py-1 rounded-full text-[8px] font-black tracking-widest uppercase">
              <Shield size={10} className="text-yellow-400" />
              Resident{" "}
              {profile?.isAdmin ? "• Root Admin" : "• Certified Collector"}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif-italic italic tracking-tight">
              {profile?.displayName || "Resident Collector"}
            </h1>
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-widest">
              Resident ID: {user?.uid?.slice(0, 16).toUpperCase()}
            </p>
          </div>

          {/* Multi Stats Info grid */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 text-[11px] font-bold uppercase text-zinc-400 tracking-wider">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold opacity-50">
                Total inventory draws
              </p>
              <p className="text-black font-semibold text-lg font-mono">
                {items.length} won
              </p>
            </div>
            <div className="w-px h-8 bg-black/10 hidden md:block" />
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold opacity-50">
                Logistics dispatch
              </p>
              <p className="text-black font-semibold text-lg font-mono">
                {orders.length} dispatched
              </p>
            </div>
            <div className="w-px h-8 bg-black/10 hidden md:block" />
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold opacity-50">Account Balance</p>
              <p className="text-zinc-800 font-bold text-lg font-mono">
                {formatPrice(profile?.balance || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Ledger Link on top right */}
        <div className="absolute top-6 right-6 flex gap-3">
          <button
            onClick={() => setShowBillingHistory(true)}
            className="w-12 h-12 bg-white/40 border border-brand-border rounded-2xl flex items-center justify-center hover:bg-white hover:text-black hover:scale-105 transition-all text-zinc-400 shadow-sm"
            title="View billing history ledger"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      {/* Profile Home Navigation Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-black/5 pb-4">
        <div className="flex bg-neutral-100/50 p-1.5 rounded-full border border-black/5">
          {[
            { id: "portfolio", label: "Vault Portfolio", count: items.length },
            {
              id: "logistics",
              label: "My Orders & Logistics",
              count: orders.length,
            },
            { id: "addresses", label: "Address Manager", count: null },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id as any)}
              className={cn(
                "px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                currentSection === section.id
                  ? "bg-black text-white shadow-xl"
                  : "text-zinc-400 hover:text-black",
              )}
            >
              {section.label}{" "}
              {section.count !== null && (
                <span className="opacity-40 font-mono">({section.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Portfolio filter dropdown */}
        {currentSection === "portfolio" && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-4">
            {items.some((i) => i.status === "in_storage") && (
              <div className="flex border border-black/5 p-1 bg-white/40 backdrop-blur rounded-xl shadow-sm gap-1">
                <button
                  onClick={() => {
                    const inStorageIds = items
                      .filter((it) => it.status === "in_storage")
                      .map((it) => it.id);
                    setCheckedItemIds(inStorageIds);
                    toast.success(
                      `Selected all ${inStorageIds.length} items in storage!`,
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-all text-neutral-700"
                >
                  Select All / 全选
                </button>
                <button
                  onClick={() => {
                    setCheckedItemIds([]);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-all text-neutral-400"
                >
                  Clear / 清空
                </button>
              </div>
            )}

            <div className="flex border border-black/5 p-1 bg-white/40 backdrop-blur rounded-xl shadow-sm">
              {["all", "in_storage", "shipped"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                    filter === f
                      ? "bg-black text-white"
                      : "text-zinc-400 hover:text-black",
                  )}
                >
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Content Switching Panels */}
      <AnimatePresence mode="wait">
        {/* CASE 1: Portfolio (Collectibles Grid) */}
        {currentSection === "portfolio" && (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-12"
          >
            {items.length === 0 ? (
              <div className="bg-white/40 p-24 rounded-[40px] border-2 border-brand-border border-dashed flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center">
                  <Package size={32} className="text-zinc-300" />
                </div>
                <h4 className="text-2xl font-serif-italic italic">
                  Empty Brand Vault
                </h4>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Draw some mystery boxes to fill your personal showcase shelf!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {items.some((i) => i.status === "in_storage") && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-100/60 rounded-3xl p-5 flex items-center gap-4 text-xs text-neutral-800 font-medium shadow-sm animate-fade-in">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <span className="text-lg">📦</span>
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold uppercase tracking-tight text-neutral-900 text-[11px]">Merging Shipments Supported / 支持多勾选一并发货</p>
                      <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">勾选您需要发货的奖品右上角，即可通过底部的「合并发货」悬浮条进行多件一并发货！</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/40 backdrop-blur-md border border-brand-border rounded-[32px] overflow-hidden flex flex-col justify-between hover:border-black transition-colors shadow-lg group relative"
                  >
                    <div className="aspect-square p-8 relative">
                      <div className="absolute top-4 left-4 z-10">
                        <span
                          className={cn(
                            "text-[7px] font-black uppercase px-2 py-0.5 rounded-full border border-black/10",
                            RARITY_COLORS[
                              item.rarity as keyof typeof RARITY_COLORS
                            ],
                          )}
                        >
                          {item.rarity}
                        </span>
                      </div>
                      {item.status === "in_storage" && (
                        <div className="absolute top-4 right-4 z-20">
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checkedItemIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCheckedItemIds((prev) => [
                                    ...prev,
                                    item.id,
                                  ]);
                                } else {
                                  setCheckedItemIds((prev) =>
                                    prev.filter((id) => id !== item.id),
                                  );
                                }
                              }}
                              className="w-5 h-5 rounded-md border-2 border-brand-border focus:ring-0 text-black cursor-pointer accent-black bg-white"
                            />
                          </label>
                        </div>
                      )}
                      <div className="w-full h-full bg-white/60 rounded-2xl border border-black/5 flex items-center justify-center p-4">
                        <img
                          src={item.image}
                          className="w-full h-full object-contain filter drop-shadow-lg"
                          alt="item_visual"
                        />
                      </div>
                    </div>

                    <div className="p-6 pt-0 space-y-4">
                      <div className="text-center space-y-0.5">
                        <h5 className="font-bold text-xs uppercase tracking-tight text-neutral-800 line-clamp-1">
                          {item.prizeName}
                        </h5>
                        <p className="text-[8px] text-zinc-400 font-mono font-bold uppercase tracking-wider">
                          Won{" "}
                          {format(
                            new Date(
                              item.wonAt?.toDate
                                ? item.wonAt.toDate()
                                : item.wonAt,
                            ),
                            "MMM dd, HH:mm",
                          )}
                        </p>
                      </div>

                      {item.status === "in_storage" ? (
                        <button
                          onClick={() => openShippingFlow(item)}
                          className="w-full bg-black text-white hover:bg-neutral-800 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                          SHIP PHYSICALLY <ArrowRight size={10} />
                        </button>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 py-2.5 rounded-xl text-center text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          IN LOGISTICS HUB
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}
          </motion.div>
        )}

        {/* CASE 2: Unified Logistics Center ('logistics') */}
        {currentSection === "logistics" && (
          <motion.div
            key="logistics"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8 animate-fade-in"
          >
            {orders.length === 0 ? (
              <div className="bg-white/40 p-20 rounded-[36px] text-center space-y-4">
                <Truck size={36} className="mx-auto text-zinc-300" />
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  No active physical shipments arranged. Ship items from your
                  Vault!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white/50 backdrop-blur border border-brand-border p-8 rounded-[32px] space-y-6 hover:shadow-xl transition-all"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-black/5 pb-4 gap-4">
                      <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                          ORDER TRACKER #{ord.id?.slice(-8).toUpperCase()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar size={12} className="opacity-40" />
                          <span className="text-xs text-zinc-500 font-semibold">
                            {ord.createdAt?.seconds
                              ? format(
                                  new Date(ord.createdAt.seconds * 1000),
                                  "yyyy/MM/dd HH:mm",
                                )
                              : "Just now"}
                          </span>
                        </div>
                      </div>

                      {/* Integrated Tracker Status Indicator */}
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[8px] font-bold uppercase text-zinc-400 mb-0.5">
                            Postage Settled
                          </p>
                          <p className="font-mono text-xs font-bold text-black">
                            {formatPrice(ord.postage || 0)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-full border shadow-sm",
                            ord.status === "pending" &&
                              "bg-amber-50 text-amber-600 border-amber-100",
                            ord.status === "approved" &&
                              "bg-blue-50 text-blue-600 border-blue-105",
                            ord.status === "dispatched" &&
                              "bg-indigo-50 text-indigo-600 border-indigo-105 animate-pulse",
                            ord.status === "delivered" &&
                              "bg-emerald-50 text-emerald-600 border-emerald-100",
                          )}
                        >
                          {ord.status || "Pending Review"}
                        </span>
                      </div>
                    </div>

                    {/* Details of items with tracking */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-2">
                      <div className="space-y-3">
                        <p className="text-[8px] font-bold uppercase text-zinc-400 tracking-wider">
                          Physical Collectible
                        </p>
                        {ord.items?.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 bg-white/70 p-4 rounded-2xl border border-black/5"
                          >
                            <img
                              src={item.image}
                              className="w-10 h-10 object-contain"
                              alt="item"
                            />
                            <div className="min-w-0">
                              <h6 className="font-bold text-xs truncate uppercase">
                                {item.prizeName}
                              </h6>
                              <span
                                className={cn(
                                  "text-[7px] font-black uppercase px-2 py-0.2 rounded-full",
                                  RARITY_COLORS[
                                    item.rarity as keyof typeof RARITY_COLORS
                                  ],
                                )}
                              >
                                {item.rarity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[8px] font-bold uppercase text-zinc-400 tracking-wider">
                          Consignee Coordinates
                        </p>
                        <div className="text-xs space-y-1">
                          <p className="font-bold text-black">
                            {ord.address?.name} ({ord.address?.phone})
                          </p>
                          <p className="text-zinc-500 leading-relaxed font-medium">
                            {ord.address?.street}, {ord.address?.city},{" "}
                            {ord.address?.region === "west"
                              ? "West MY"
                              : "East MY"}
                          </p>
                        </div>
                      </div>

                      {/* Visual Logistics Pipeline block */}
                      <div className="space-y-3">
                        <p className="text-[8px] font-bold uppercase text-zinc-400 tracking-wider">
                          Logistics Pipeline Status
                        </p>
                        <div className="relative pl-6 space-y-4 text-[10px] font-bold uppercase">
                          {/* Vertical Line */}
                          <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-black/5" />

                          <div className="relative">
                            <div
                              className={cn(
                                "absolute -left-5 w-2 h-2 rounded-full",
                                ord.status === "pending"
                                  ? "bg-amber-500 animate-pulse scale-125"
                                  : "bg-zinc-300",
                              )}
                            />
                            <span
                              className={cn(
                                "inline-block",
                                ord.status === "pending"
                                  ? "text-amber-600 font-extrabold"
                                  : "text-zinc-400",
                              )}
                            >
                              1. Dispatch Request Registered
                            </span>
                          </div>
                          <div className="relative">
                            <div
                              className={cn(
                                "absolute -left-5 w-2 h-2 rounded-full",
                                ord.status === "approved"
                                  ? "bg-blue-500 animate-pulse"
                                  : ord.status === "dispatched" ||
                                      ord.status === "delivered"
                                    ? "bg-black"
                                    : "bg-zinc-305",
                              )}
                            />
                            <span
                              className={cn(
                                "inline-block",
                                ord.status === "approved"
                                  ? "text-blue-600 font-extrabold"
                                  : ["dispatched", "delivered"].includes(
                                        ord.status,
                                      )
                                    ? "text-black"
                                    : "text-zinc-400",
                              )}
                            >
                              2. Customs Approved
                            </span>
                          </div>
                          <div className="relative">
                            <div
                              className={cn(
                                "absolute -left-5 w-2 h-2 rounded-full",
                                ord.status === "dispatched"
                                  ? "bg-indigo-500 animate-pulse"
                                  : ord.status === "delivered"
                                    ? "bg-black"
                                    : "bg-zinc-305",
                              )}
                            />
                            <span
                              className={cn(
                                "inline-block",
                                ord.status === "dispatched"
                                  ? "text-indigo-600 font-extrabold"
                                  : ord.status === "delivered"
                                    ? "text-black"
                                    : "text-zinc-400",
                              )}
                            >
                              3. Handed to Courier
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* CASE 3: Address Manager */}
        {currentSection === "addresses" && (
          <motion.div
            key="addresses"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white/40 border border-brand-border p-8 rounded-[32px]"
          >
            <AddressManager />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portrait / Avatar Cropping Modal Builder */}
      <AnimatePresence>
        {showCropModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FAFCFF] p-8 md:p-10 rounded-[40px] w-full max-w-xl shadow-2xl space-y-8 flex flex-col items-center"
            >
              <div className="w-full flex justify-between items-center border-b border-black/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">
                    Interactive Crop Portrait
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">
                    Drag to reposition, use sliders to scaling/orienting
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setRawAvatarImage(null);
                  }}
                  className="p-2 hover:bg-black/5 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Cropping Stage Canvas */}
              <div className="relative aspect-square w-full max-w-[320px] rounded-[32px] overflow-hidden border border-black/10 bg-black cursor-move shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={320}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                  className="w-full h-full block"
                />
              </div>

              {/* Sizing & Rotation Controllers */}
              <div className="w-full space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase text-zinc-400">
                    <span className="flex items-center gap-1">
                      <ZoomIn size={12} /> Portrait Scale
                    </span>
                    <span>{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase text-zinc-400">
                    <span className="flex items-center gap-1">
                      <RefreshCw size={12} /> Rotation Angle
                    </span>
                    <span>{rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    className="w-full h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                </div>
              </div>

              {/* Modifiers action strip */}
              <div className="w-full flex justify-end gap-3 pt-4 border-t border-black/5">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setRawAvatarImage(null);
                  }}
                  className="px-6 py-3 border border-black/10 text-[10px] uppercase font-black tracking-widest rounded-full hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeAvatarCrop}
                  className="cre-button bg-black text-white px-10 h-12 text-[10px]"
                >
                  CROP & BROADCAST
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ledger Slider Panel (Offloaded Payment Ledger) */}
      <AnimatePresence>
        {showBillingHistory && (
          <div className="fixed inset-0 z-[200] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBillingHistory(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="relative w-full max-w-2xl bg-[#FAFCFF] h-full shadow-2xl flex flex-col p-10 z-10"
            >
              <div className="flex justify-between items-center pb-6 border-b border-black/5 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black text-white rounded-[16px] flex items-center justify-center">
                    <History size={20} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold uppercase tracking-tight">
                      Financial Timeline
                    </h4>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                      OFFLOADED BILLING & LEDGER AUDITING
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBillingHistory(false)}
                  className="bg-black/5 p-2 rounded-full hover:bg-black/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                {balanceLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white border border-brand-border/60 p-6 rounded-2xl flex items-center justify-between hover:border-black transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border",
                          [
                            "topup",
                            "registration_reward",
                            "admin_grant",
                          ].includes(log.type)
                            ? "bg-green-50 border-green-100 text-green-500"
                            : "bg-red-50 border-red-100 text-red-500",
                        )}
                      >
                        {[
                          "topup",
                          "registration_reward",
                          "admin_grant",
                        ].includes(log.type) ? (
                          <ArrowUpRight size={16} />
                        ) : (
                          <ArrowDownRight size={16} />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xs uppercase tracking-tight capitalize">
                          {log.type?.replace("_", " ")}
                        </p>
                        <p className="text-[9px] text-zinc-400 font-medium">
                          {log.reason}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-mono font-black",
                          [
                            "topup",
                            "registration_reward",
                            "admin_grant",
                          ].includes(log.type)
                            ? "text-green-600"
                            : "text-black",
                        )}
                      >
                        {[
                          "topup",
                          "registration_reward",
                          "admin_grant",
                        ].includes(log.type)
                          ? "+"
                          : "-"}
                        {formatPrice(Math.abs(log.amount))}
                      </p>
                      <p className="text-[7px] text-zinc-300 font-bold tracking-widest">
                        {log.timestamp?.seconds
                          ? format(
                              new Date(log.timestamp.seconds * 1000),
                              "yyyy/MM/dd HH:mm",
                            )
                          : "Recent"}
                      </p>
                    </div>
                  </div>
                ))}
                {balanceLogs.length === 0 && (
                  <div className="p-16 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    No financial logs recorded on file.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Arrange Shipping Flow Dialog popup */}
      <AnimatePresence>
        {showShippingModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShippingModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-4xl bg-[#F5F9FF] rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto"
            >
              <div className="w-full md:w-80 bg-black p-10 flex flex-col justify-between text-white border-r border-white/5">
                <div className="space-y-8">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                    <Truck
                      size={24}
                      className="text-yellow-400 animate-pulse"
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-serif-italic italic leading-tight">
                      Logistics Dispatch
                    </h3>
                    <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest leading-relaxed">
                      Arranging physical delivery coordinates for won digital
                      collectibles.
                    </p>
                  </div>

                  {selectedItemsForShip.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 space-y-4 max-h-[35vh] overflow-y-auto no-scrollbar">
                      <p className="text-[9px] font-black tracking-widest uppercase opacity-60">
                        Selected Claims ({selectedItemsForShip.length})
                      </p>
                      <div className="space-y-2.5">
                        {selectedItemsForShip.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 bg-white/10 p-2 rounded-xl border border-white/5"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center">
                              <img
                                src={it.image}
                                className="w-full h-full object-contain"
                                alt=""
                              />
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-wider truncate text-zinc-200">
                              {it.prizeName}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[8px] font-bold uppercase opacity-20 italic">
                  Validated CRE Security Service
                </p>
              </div>

              <div className="flex-1 p-10 overflow-y-auto no-scrollbar space-y-8 bg-[#FAFCFF]">
                <AddressManager
                  onSelect={setSelectedAddress}
                  selectedId={selectedAddress?.id}
                />

                {selectedAddress && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-brand-border rounded-[28px] p-6 space-y-4 shadow-xl"
                  >
                    <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 opacity-50">
                      <Wallet size={12} /> Postage Calculation
                    </h4>

                    <div className="space-y-2 text-xs font-semibold">
                      <div className="flex justify-between text-[10px] uppercase opacity-40">
                        <span>Asset Conversion Claims</span>
                        <span>FREE (Covered)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] uppercase opacity-40">
                          Delivery Postage (
                          {selectedAddress.region === "west"
                            ? "West MY"
                            : "East MY"}
                          )
                        </span>
                        <span className="font-mono">
                          {formatPrice(calculatePostage())}
                        </span>
                      </div>
                      <div className="h-px bg-black/5 my-2" />
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase">
                          Grand Settle Postage Amount
                        </span>
                        <span className="text-2xl font-mono font-black text-black">
                          {formatPrice(calculatePostage())}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleConfirmShipping}
                      disabled={isShipping}
                      className="w-full bg-black text-white py-4 rounded-[16px] font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:scale-[1.01] transition-transform flex items-center justify-center gap-3 disabled:opacity-20"
                    >
                      {isShipping
                        ? "ARRANGING..."
                        : "CONFIRM PHYSICALLY DISPATCH"}
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Batch Actions Bar */}
      <AnimatePresence>
        {checkedItemIds.length > 0 && currentSection === "portfolio" && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-8 py-4 rounded-3xl flex items-center gap-6 shadow-2xl border border-white/10 w-[90%] max-w-xl md:w-auto"
          >
            <span className="text-xs font-black uppercase tracking-wider text-yellow-400">
              Selected {checkedItemIds.length} Item
              {checkedItemIds.length > 1 ? "s" : ""} / 已选 {checkedItemIds.length} 个奖品
            </span>
            <div className="w-px h-6 bg-white/20 hidden md:block" />
            <button
              onClick={() => {
                const selectedList = items.filter((it) =>
                  checkedItemIds.includes(it.id),
                );
                setSelectedItemsForShip(selectedList);
                setShowShippingModal(true);
              }}
              className="bg-brand-pink hover:bg-brand-pink/95 text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all scale-95 hover:scale-100 cursor-pointer shrink-0"
            >
              SHIP TOGETHER / 合并一并发货
            </button>
            <button
              onClick={() => setCheckedItemIds([])}
              className="text-[9px] uppercase font-bold opacity-60 hover:opacity-100 tracking-wider shrink-0"
            >
              Clear / 取消
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
