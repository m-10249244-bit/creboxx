import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../components/auth/AuthContext";
import { formatPrice, RARITY_COLORS, cn } from "../lib/utils";
import {
  Sparkles,
  Trophy,
  Info,
  ChevronRight,
  Zap,
  RefreshCw,
  Warehouse as WarehouseIcon,
  Share2,
} from "lucide-react";
import DrawAnimation from "../components/draw/DrawAnimation";

function TimeRemaining({ endIso }: { endIso: string }) {
  const [rem, setRem] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(endIso).getTime() - Date.now();
      if (diff <= 0) {
        setRem('EXPIRED / 结束');
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRem(`${hrs}h ${mins}m ${secs}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endIso]);

  return <span className="font-mono text-[9px] font-extrabold text-[#FF3B30] text-center">{rem}</span>;
}

export default function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [box, setBox] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [boxPityRules, setBoxPityRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showDrawAnimation, setShowDrawAnimation] = useState(false);
  const [wonPrize, setWonPrize] = useState<any>(null);
  const [wonPrizes, setWonPrizes] = useState<any[]>([]);
  const [drawQty, setDrawQty] = useState<number>(1);
  const [skipAnimation, setSkipAnimation] = useState<boolean>(false);
  const [isAnimationFinished, setIsAnimationFinished] =
    useState<boolean>(false);
  const [userDrawCount, setUserDrawCount] = useState<number>(0);
  const [activeImage, setActiveImage] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      const bSnap = await getDoc(doc(db, "boxes", id));
      if (bSnap.exists()) {
        const bData = { id: bSnap.id, ...bSnap.data() } as any;
        setBox(bData);
        setActiveImage(bData.coverImage || "");
        const pSnap = await getDocs(collection(db, "boxes", id, "prizes"));
        const pData = pSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as any[];
        const nowMs = Date.now();
        const activePresents = pData.filter(
          (p) => !p.timeLimitEnd || new Date(p.timeLimitEnd).getTime() > nowMs
        );
        setPrizes(
          activePresents.sort((a, b) => (b.probability || 0) - (a.probability || 0)),
        );
      } else {
        // Mock data if Firestore is empty for first run
        const fallbackBox = {
          id: "cre-v1",
          title: "CRE Origins: Sky Blue Edition",
          price: 19.9,
          coverImage:
            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60",
          description:
            "The first generation of CRE collectibles. High-end finish with metallic secondary colors.",
          rarityDistribution: {
            Common: "70%",
            Rare: "20%",
            Epic: "9%",
            Secret: "1%",
          },
          detailImages: ["", "", ""],
        };
        setBox(fallbackBox);
        setActiveImage(fallbackBox.coverImage || "");
        setPrizes([
          {
            id: "1",
            name: "Blue Wing",
            rarity: "Common",
            probability: 0.7,
            image:
              "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=1&backgroundColor=b6e3f4",
          },
          {
            id: "2",
            name: "Silver Cloud",
            rarity: "Rare",
            probability: 0.2,
            image:
              "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=2&backgroundColor=d1d4f9",
          },
          {
            id: "3",
            name: "Pink Heart",
            rarity: "Epic",
            probability: 0.09,
            image:
              "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=3&backgroundColor=ffd5dc",
          },
          {
            id: "4",
            name: "Golden Sun",
            rarity: "Secret",
            probability: 0.01,
            image:
              "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=4&backgroundColor=ffdfba",
          },
        ]);
      }
      setLoading(false);
    }
    fetchData();
  }, [id]);

  // Real-time draws count listener for this user & box
  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, "draws"),
      where("userId", "==", user.uid),
      where("boxId", "==", id),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setUserDrawCount(snap.docs.length);
    });
    return () => unsubscribe();
  }, [user, id]);

  // Fetch Pity Rules for this box
  useEffect(() => {
    if (!id) return;
    const fetchPityRules = async () => {
      try {
        const q = query(collection(db, "pityRules"), where("boxId", "==", id));
        const snap = await getDocs(q);
        setBoxPityRules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching pity rules:", err);
      }
    };
    fetchPityRules();
  }, [id]);

  const handleDraw = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    const qty = Math.max(1, Math.floor(drawQty || 1));
    const totalCost = box.price * qty;

    if ((profile?.balance || 0) < totalCost) {
      alert(
        `余额不足，无法购买！您需要 RM ${totalCost.toFixed(2)}，当前余额: RM ${(profile?.balance || 0).toFixed(2)}。`,
      );
      return;
    }

    if (profile?.isBanned || profile?.banned === true || profile?.banned === "true") {
      alert("您的账户已被禁用，无法进行抽取！/ Your account has been banned from draws!");
      return;
    }

    setIsDrawing(true);
    setIsAnimationFinished(skipAnimation);

    // Filter activeCandidates based on advanced controls
    const nowMs = Date.now();
    const activeCandidates = prizes.filter((p) => {
      // Must be enabled
      if (p.enabled === false) return false;
      // Must be in stock
      if (p.stock !== undefined && p.stock <= 0) return false;
      // Admin lock settings (Globally Blocked)
      if (p.isLocked) return false;
      
      // Time Limited ended check
      if (p.timeLimitEnd) {
        try {
          const limitTime = new Date(p.timeLimitEnd).getTime();
          if (nowMs > limitTime) return false;
        } catch (e) {
          console.error(e);
        }
      }

      // User Blacklist check
      const blacklists = Array.isArray(p.blacklistUsers)
        ? p.blacklistUsers
        : (p.blacklistUsers ? p.blacklistUsers.split(',').map((s: any) => s.trim()) : []);
      if (blacklists.includes(user.uid)) return false;

      // User Whitelist check (if whitelist is defined, user MUST be in it)
      const whitelists = Array.isArray(p.whitelistUsers)
        ? p.whitelistUsers
        : (p.whitelistUsers ? p.whitelistUsers.split(',').map((s: any) => s.trim()) : []);
      if (whitelists.length > 0 && !whitelists.includes(user.uid)) return false;

      return true;
    });

    if (activeCandidates.length === 0) {
      alert("该盲盒内的奖品已售罄或暂时不可抽取！ / Items in this box are sold out or locked!");
      setIsDrawing(false);
      return;
    }

    const drawn: any[] = [];
    const riggedPrizesToClear: string[] = [];
    const wonPityRuleIds: string[] = [];

    // Simulate drawings
    for (let i = 0; i < qty; i++) {
      const simulatedCount = userDrawCount + i;
      let pityLimit = box?.pityLimit || 10;
      let selectedPrize = activeCandidates[0];

      // Block A: Check rigged winner target
      const riggedPrize = activeCandidates.find((c) => c.riggedUserUid === user.uid);
      if (riggedPrize) {
        selectedPrize = riggedPrize;
        if (!riggedPrizesToClear.includes(riggedPrize.id)) {
          riggedPrizesToClear.push(riggedPrize.id);
        }
      } else {
        // Block B: Check customizable Pity rules
        let triggeredRule: any = null;
        const previouslyTriggered: string[] = profile?.triggeredPityRules || [];

        for (const rule of boxPityRules) {
          if (rule.onceOnly && previouslyTriggered.includes(rule.id)) {
            continue; // Skip one-time rule if already won
          }

          const prevVal = rule.type === 'spend' ? simulatedCount * box.price : simulatedCount;
          const newVal = rule.type === 'spend' ? (simulatedCount + 1) * box.price : simulatedCount + 1;

          let isPityTriggered = false;
          if (rule.repeatable !== false) {
            isPityTriggered = Math.floor(newVal / rule.threshold) > Math.floor(prevVal / rule.threshold);
          } else {
            isPityTriggered = newVal >= rule.threshold && prevVal < rule.threshold;
          }

          if (isPityTriggered) {
            triggeredRule = rule;
            break;
          }
        }

        if (triggeredRule) {
          let listCandidates = activeCandidates;
          if (triggeredRule.guaranteedPrizes && triggeredRule.guaranteedPrizes.length > 0) {
            listCandidates = activeCandidates.filter((p) =>
              triggeredRule.guaranteedPrizes.includes(p.id)
            );
          }
          if (listCandidates.length === 0) {
            listCandidates = activeCandidates;
          }
          const randomIdx = Math.floor(Math.random() * listCandidates.length);
          selectedPrize = listCandidates[randomIdx];

          if (!wonPityRuleIds.includes(triggeredRule.id)) {
            wonPityRuleIds.push(triggeredRule.id);
          }
        } 
        // Block C: Standard fallback Box Pity
        else {
          let isPityTriggered = false;
          if (box?.pityEnabled) {
            if (box.pityType === "spending") {
              const userSpend = simulatedCount * box.price;
              isPityTriggered = userSpend + box.price >= box.pityLimit;
            } else {
              isPityTriggered = (simulatedCount + 1) % pityLimit === 0;
            }
          }

          if (isPityTriggered) {
            let eligiblePrizes = activeCandidates;
            if (box?.pityPrizes && box.pityPrizes.length > 0) {
              eligiblePrizes = activeCandidates.filter((p) =>
                box.pityPrizes.includes(p.id)
              );
            }
            if (eligiblePrizes.length === 0) {
              eligiblePrizes = activeCandidates.filter((p) =>
                ["Epic", "Secret", "Limited"].includes(p.rarity)
              );
            }
            if (eligiblePrizes.length === 0) {
              eligiblePrizes = activeCandidates;
            }

            const randomIdx = Math.floor(Math.random() * eligiblePrizes.length);
            selectedPrize = eligiblePrizes[randomIdx];
          } 
          // Block D: Standard raw probability draw with hidden true percentage check
          else {
            const totalProb = activeCandidates.reduce((sum, p) => {
              const weight = p.hideProbability && p.hiddenRealProbability !== undefined
                ? p.hiddenRealProbability
                : (p.probability || 0);
              return sum + weight;
            }, 0);

            const random = Math.random() * (totalProb || 1);
            let cumulative = 0;

            for (const p of activeCandidates) {
              const weight = p.hideProbability && p.hiddenRealProbability !== undefined
                ? p.hiddenRealProbability
                : (p.probability || 0);
              cumulative += weight;
              if (random <= cumulative) {
                selectedPrize = p;
                break;
              }
            }
          }
        }
      }

      drawn.push(selectedPrize);
    }

    // Process on Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, {
          balance: increment(-totalCost),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }

      const inventoryRef = collection(db, "inventory");
      const stockLogsRef = collection(db, "stockLogs");
      const drawsRef = collection(db, "draws");

      // Writing sequence or promise all
      await Promise.all(
        drawn.map(async (selectedPrize) => {
          try {
            await addDoc(inventoryRef, {
              userId: user.uid,
              prizeId: selectedPrize.id,
              prizeName: selectedPrize.name,
              boxId: box.id,
              rarity: selectedPrize.rarity,
              image: selectedPrize.image,
              status:
                selectedPrize.shippingRequired !== false
                  ? "in_storage"
                  : "automatically_issued",
              shippingRequired: selectedPrize.shippingRequired !== false,
              displayValue: selectedPrize.displayValue || 0,
              wonAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, "inventory");
          }

          if (selectedPrize.stock !== undefined) {
            try {
              const prizeRef = doc(
                db,
                "boxes",
                box.id,
                "prizes",
                selectedPrize.id,
              );
              await updateDoc(prizeRef, {
                stock: increment(-1),
              });
              await addDoc(stockLogsRef, {
                prizeId: selectedPrize.id,
                prizeName: selectedPrize.name,
                boxId: box.id,
                boxName: box.title || "Platform Box Logo",
                change: -1,
                type: "draw",
                userId: user.uid,
                userDisplayName: profile?.displayName || "Resident",
                timestamp: serverTimestamp(),
              });
            } catch (err) {
              console.error("Stock decrement log error:", err);
            }
          }

          try {
            await addDoc(drawsRef, {
              userId: user.uid,
              userDisplayName: profile?.displayName || "Resident",
              boxId: box.id,
              boxPrice: box.price,
              prizeId: selectedPrize.id,
              prizeName: selectedPrize.name,
              rarity: selectedPrize.rarity,
              timestamp: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, "draws");
          }
        }),
      );

      // Clean rigged flags from prizes
      if (riggedPrizesToClear.length > 0) {
        await Promise.all(
          riggedPrizesToClear.map(async (pId) => {
            try {
              const prizeRef = doc(db, "boxes", box.id, "prizes", pId);
              await updateDoc(prizeRef, {
                riggedUserUid: ""
              });
            } catch (err) {
              console.error("Clean rigged status error:", err);
            }
          })
        );
      }

      // Record newly won pity triggers
      if (wonPityRuleIds.length > 0) {
        try {
          const uRef = doc(db, "users", user.uid);
          const currentTriggers = profile?.triggeredPityRules || [];
          const updatedTriggers = Array.from(new Set([...currentTriggers, ...wonPityRuleIds]));
          await updateDoc(uRef, {
            triggeredPityRules: updatedTriggers
          });
        } catch (err) {
          console.error("Save triggered Pity records error:", err);
        }
      }

      setWonPrizes(drawn);
      setWonPrize(drawn[0]);
      setShowDrawAnimation(true);
    } catch (error) {
      console.error(error);
      alert("Draw failed. Please try again.");
    } finally {
      setIsDrawing(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <RefreshCw size={32} className="text-brand-pink" />
        </motion.div>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Gallery */}
        <div className="space-y-4">
          <motion.div
            layoutId={`box-img-${box.id}`}
            className="aspect-square rounded-[32px] border-4 border-brand-border overflow-hidden bg-white shadow-[8px_8px_0px_0px_#1a1a1a]"
          >
            <img
              src={activeImage || box.coverImage}
              alt={box.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
          <div className="flex gap-4">
            {[0, 1, 2].map((index) => {
              const imgUrl =
                (box.detailImages && box.detailImages[index]) || "";
              return imgUrl ? (
                <button
                  key={index}
                  onClick={() => setActiveImage(imgUrl)}
                  className={cn(
                    "flex-grow aspect-video rounded-2xl overflow-hidden border-2 transition-all hover:scale-[1.03] relative",
                    (activeImage || box.coverImage) === imgUrl
                      ? "border-black shadow-md scale-[1.02]"
                      : "border-brand-border bg-white",
                  )}
                >
                  <img
                    src={imgUrl}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </button>
              ) : (
                <div
                  key={index}
                  className="flex-grow aspect-video bg-white/40 border-2 border-dashed border-brand-border rounded-2xl flex items-center justify-center"
                >
                  <span className="text-[8px] font-black uppercase text-zinc-350 select-none">
                    Slot {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-8 flex flex-col justify-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-brand-accent-pink border border-brand-border rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm">
                Series Two
              </span>
              <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 opacity-60">
                <Trophy size={14} /> Official License
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-serif-italic leading-tight italic">
              {box.title}
            </h1>
            <p className="text-lg text-zinc-500 font-medium leading-relaxed opacity-80">
              {box.description}
            </p>
          </div>

          <div className="bg-white/30 backdrop-blur-2xl border border-white/40 p-8 rounded-[32px] space-y-8 shadow-2xl shadow-blue-200/10">
            <div className="flex items-end justify-between border-b border-black/5 pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-1">
                  Price per draw
                </p>
                <p className="text-4xl font-mono font-bold tracking-tighter">
                  {formatPrice(box.price)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-1">
                  Pool Status
                </p>
                <p className="font-bold flex items-center justify-end gap-2 text-sm italic">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  428 Pieces Left
                </p>
              </div>
            </div>

            {/* Pity guaranteed reminder segment */}
            {box?.pityEnabled && user && (
              <div className="bg-gradient-to-tr from-[#FAFCFF] to-[#F5F9FF] p-5 rounded-2xl border border-brand-border flex items-center justify-between gap-4 shadow-sm animate-fade-in">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-[#2E4057] tracking-wider">
                    <Sparkles
                      size={12}
                      className="text-blue-500 animate-pulse"
                    />
                    GUARANTEED PREMIUM RARE REWARD PROGRESS
                  </div>
                  <p className="text-[10px] text-zinc-500 font-semibold leading-normal">
                    {box.pityType === "spending"
                      ? `Cumulative RM ${box.pityLimit} spending triggers guaranteed drop. Current: RM ${(userDrawCount * box.price).toFixed(2)} / RM ${box.pityLimit}`
                      : `Guaranteed Rare item drops every ${box.pityLimit || 10} draws. Current sequence: ${userDrawCount % (box.pityLimit || 10)} / ${box.pityLimit || 10}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-black text-black bg-white border border-brand-border px-3 py-1.5 rounded-xl shadow-sm">
                    {box.pityType === "spending"
                      ? `${Math.min(100, Math.floor(((userDrawCount * box.price) / box.pityLimit) * 100))}%`
                      : `${userDrawCount % (box.pityLimit || 10)} / ${box.pityLimit || 10}`}
                  </span>
                </div>
              </div>
            )}

            {/* Multi-Draw Quantity Selector & Skip Options */}
            <div className="space-y-4 pt-2 border-t border-black/5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
                  Select Draw Quantity / 抽盒数量
                </label>
                {drawQty > 0 && (
                  <span className="text-xs font-mono font-black text-brand-pink bg-pink-50 border border-pink-100 px-3 py-1 rounded-full">
                    Total: {formatPrice(box.price * drawQty)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setDrawQty(q)}
                    className={cn(
                      "py-2.5 px-3 border-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                      drawQty === q
                        ? "border-black bg-black text-white shadow"
                        : "border-brand-border bg-white text-zinc-700 hover:border-black/30",
                    )}
                  >
                    {q}x
                  </button>
                ))}
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={drawQty || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setDrawQty(
                        isNaN(val) ? 1 : Math.max(1, Math.min(100, val)),
                      );
                    }}
                    placeholder="Custom"
                    className={cn(
                      "w-full py-2.5 px-3 border-2 rounded-xl text-xs font-bold text-center focus:outline-none focus:border-black transition-colors min-w-0 font-mono",
                      ![1, 5, 10].includes(drawQty)
                        ? "border-black bg-white"
                        : "border-brand-border bg-white",
                    )}
                  />
                </div>
              </div>

              {/* Skip Animation Toggle */}
              <div className="flex items-center justify-between bg-white/40 border border-black/5 p-3 rounded-2xl">
                <div className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    id="skipAnimation"
                    checked={skipAnimation}
                    onChange={(e) => setSkipAnimation(e.target.checked)}
                    className="w-4 h-4 text-brand-pink focus:ring-brand-pink border-brand-border rounded cursor-pointer accent-black"
                  />
                  <label
                    htmlFor="skipAnimation"
                    className="text-[11px] font-bold text-zinc-600 cursor-pointer select-none"
                  >
                    Skip Draw Animation / 跳过抽盒动画
                  </label>
                </div>
                <span className="text-[8px] font-black uppercase text-brand-pink bg-pink-50 border border-pink-100/60 px-2 py-0.5 rounded-full tracking-widest leading-none">
                  Fast Mode
                </span>
              </div>
            </div>

            <button
              onClick={handleDraw}
              disabled={isDrawing || !drawQty || drawQty < 1}
              className={cn(
                "w-full h-20 text-xl bg-brand-accent-blue border-[1.5px] border-brand-border rounded-[14px] font-bold flex items-center justify-center gap-4 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] transform hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer",
                (isDrawing || !drawQty || drawQty < 1) &&
                  "opacity-70 pointer-events-none",
              )}
            >
              {isDrawing ? (
                <RefreshCw className="animate-spin" />
              ) : (
                <>
                  <Zap size={24} fill="currentColor" />
                  {`OPEN NOW x${drawQty}`}
                </>
              )}
            </button>
            <div className="flex justify-between items-center px-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">
                Global Shipping ID: #CRE-01
              </p>
              <div className="flex gap-4">
                <button className="text-zinc-400 hover:text-black transition-colors">
                  <Share2 size={16} />
                </button>
                <button className="text-zinc-400 hover:text-black transition-colors">
                  <Info size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Probability List */}
      <section className="space-y-10 pt-10">
        <div className="flex items-center justify-between border-b border-brand-border/10 pb-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.4em] opacity-80 italic">
            Reward Distribution
          </h2>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40">
            Verified On-Chain <Zap size={10} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {prizes.map((prize) => {
            const isTimeLimited = !!prize.timeLimitEnd;
            return (
              <div
                key={prize.id}
                className={cn(
                  "bg-white/40 backdrop-blur-md rounded-[24px] p-6 space-y-4 hover:border-black transition-all shadow-sm relative overflow-hidden",
                  isTimeLimited
                    ? "border-2 border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.85)] bg-gradient-to-b from-rose-50/20 to-white/40"
                    : "border border-white/50"
                )}
              >
                {isTimeLimited && (
                  <div className="absolute top-0 right-0 left-0 bg-[#FF3B30] text-white text-[7px] font-black tracking-widest text-center py-1.5 uppercase flex items-center justify-center gap-1 z-10 animate-pulse">
                    <Zap size={8} /> SPECIAL EVENT / 限时抽出
                  </div>
                )}
                <div className={cn("aspect-square bg-white/60 rounded-xl border border-black/5 flex items-center justify-center p-6 relative", isTimeLimited ? "mt-4" : "")}>
                  <div className="absolute top-2 left-2">
                    <div
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-black/10",
                        (RARITY_COLORS as any)[prize.rarity],
                      )}
                    >
                      {prize.rarity}
                    </div>
                  </div>
                  <img
                    src={prize.image}
                    alt={prize.name}
                    className="w-full h-full object-contain filter drop-shadow-lg"
                  />
                </div>
                <div className="space-y-1 text-center">
                  <h4 className="font-bold text-sm truncate uppercase tracking-tight text-neutral-800">
                    {prize.name}
                  </h4>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] font-mono italic">
                    Chance: {(prize.probability * 100).toFixed(1)}%
                  </p>
                  {isTimeLimited && (
                    <div className="flex flex-col items-center justify-center gap-0.5 mt-2 bg-red-50/80 border border-red-100 rounded-xl py-1.5 px-2">
                      <span className="text-[6px] font-extrabold uppercase text-rose-450 tracking-wider">Remaining Time / 剩余时间:</span>
                      <TimeRemaining endIso={prize.timeLimitEnd} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Draw Animation Overlay */}
      <AnimatePresence>
        {showDrawAnimation && (
          <div className={cn("fixed inset-0 z-[190] flex items-center justify-center p-4 md:p-8 pointer-events-auto transition-all duration-300", skipAnimation ? "bg-black/75 backdrop-blur-md" : "bg-[#FAFCFF]")}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full bg-white border-4 border-brand-border rounded-[40px] flex flex-col items-center justify-center relative overflow-hidden shadow-[20px_20px_0px_0px_#1a1a1a]", skipAnimation ? "max-w-2xl h-auto max-h-[85vh] p-8 md:p-10" : "max-w-5xl h-[80vh]")}
            >
              {/* While drawing is in progress and skip animation is on, show a beautiful loading state */}
              {isDrawing && skipAnimation && (
                <div className="absolute inset-0 z-[115] flex flex-col items-center justify-center bg-[#FAFCFF] p-8 text-center space-y-6">
                  <div className="w-24 h-24 relative flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-dashed border-brand-pink rounded-full animate-spin" />
                    <Sparkles
                      size={36}
                      className="text-yellow-500 animate-pulse"
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase tracking-widest text-neutral-800">
                      Unveiling Box / 正在快速开箱
                    </h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
                      Generating claims and validating tickets on chain...
                    </p>
                  </div>
                </div>
              )}

              {/* Only render animation if not skipped and not yet finished */}
              {!skipAnimation && !isAnimationFinished && (
                <DrawAnimation
                  prizes={prizes}
                  wonPrize={wonPrize}
                  onComplete={() => setIsAnimationFinished(true)}
                />
              )}

              {!isDrawing && !skipAnimation && !isAnimationFinished && (
                <button
                  onClick={() => setIsAnimationFinished(true)}
                  className="absolute top-6 right-6 z-[120] bg-black text-white hover:bg-neutral-800 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 animate-pulse"
                >
                  SKIP / 跳过动画
                </button>
              )}

              {!isDrawing && (skipAnimation || isAnimationFinished) && (
                <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-[#FAFCFF] pointer-events-auto p-4 overflow-y-auto">
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white border-4 border-brand-border p-6 md:p-10 rounded-[32px] shadow-[12px_12px_0px_0px_#1a1a1a] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-y-auto"
                  >
                    <div className="text-center space-y-4 flex-grow overflow-y-auto pr-2 pb-6">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="inline-flex items-center gap-2 bg-brand-pink px-4 py-1.5 rounded-full border-2 border-brand-border font-black text-xs uppercase"
                      >
                        <Sparkles size={14} /> NEW COLLECTIBLE
                        {wonPrizes.length > 1 ? "S" : ""}
                      </motion.div>
                      <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
                        {wonPrizes.length > 1
                          ? `Success! Won ${wonPrizes.length} Items`
                          : "Congratulations!"}
                      </h2>

                      <div
                        className={cn(
                          "grid gap-4 mt-6 py-4",
                          wonPrizes.length === 1
                            ? "grid-cols-1 max-w-[240px] mx-auto"
                            : "grid-cols-2 md:grid-cols-3 max-w-2xl mx-auto",
                        )}
                      >
                        {wonPrizes.map((wp, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-[24px] border border-brand-border p-6 flex flex-col items-center justify-center relative shadow-sm hover:scale-[1.02] transition-all"
                          >
                            <div className="absolute top-3 left-3">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-black/10",
                                  (RARITY_COLORS as any)[wp.rarity],
                                )}
                              >
                                {wp.rarity}
                              </span>
                            </div>
                            <div className="aspect-square w-24 flex items-center justify-center mb-3 mt-4">
                              <img
                                src={wp.image}
                                className="w-full h-full object-contain filter drop-shadow-md"
                                alt=""
                              />
                            </div>
                            <h4 className="text-xs font-black truncate max-w-full uppercase text-center text-zinc-800">
                              {wp.name}
                            </h4>
                            {wp.displayValue !== undefined && (
                              <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full mt-1.5">
                                RM {wp.displayValue}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 justify-center pt-6 border-t border-black/10 shrink-0">
                      <button
                        onClick={() => {
                          setShowDrawAnimation(false);
                          setWonPrize(null);
                          setWonPrizes([]);
                          setIsAnimationFinished(false);
                        }}
                        className="cre-button bg-brand-blue"
                      >
                        AWESOME
                      </button>
                      <Link
                        to="/warehouse"
                        className="cre-button bg-white text-black"
                      >
                        <WarehouseIcon size={18} />
                        VIEW IN WAREHOUSE
                      </Link>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
