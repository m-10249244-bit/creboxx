// Local Storage-backed Firebase Simulator
// Fulfills the Chinese request: "-把数据库存进local浏览器的里面" (Put the database into the local browser)
// and fixes permission/operation and auth issues transparently!

// -------------------------------------------------------------
// Helper to deep merge objects
// -------------------------------------------------------------
function mergeDeep(target: any, source: any): any {
  const isObject = (item: any) => (item && typeof item === 'object' && !Array.isArray(item));
  if (!isObject(target) || !isObject(source)) {
    return source;
  }
  const output = { ...target };
  Object.keys(source).forEach(key => {
    if (isObject(source[key])) {
      if (!(key in target)) {
        Object.assign(output, { [key]: source[key] });
      } else {
        output[key] = mergeDeep(target[key], source[key]);
      }
    } else {
      Object.assign(output, { [key]: source[key] });
    }
  });
  return output;
}

// -------------------------------------------------------------
// Resolve Firestore special field values (increment, serverTimestamp)
// -------------------------------------------------------------
function resolveValue(val: any, existingVal: any) {
  if (val && typeof val === 'object') {
    if (val.__type === 'increment') {
      const base = typeof existingVal === 'number' ? existingVal : 0;
      return base + val.amount;
    }
    if (val.__type === 'serverTimestamp') {
      return new Date().toISOString();
    }
  }
  return val;
}

function resolveSpecialValues(data: any, existing: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item, i) => resolveSpecialValues(item, existing ? existing[i] : undefined));
  }
  if (typeof data === 'object') {
    if (data.__type === 'increment') {
      const base = typeof existing === 'number' ? existing : 0;
      return base + data.amount;
    }
    if (data.__type === 'serverTimestamp') {
      return new Date().toISOString();
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = resolveSpecialValues(value, existing ? existing[key] : undefined);
    }
    return result;
  }
  return data;
}

// -------------------------------------------------------------
// Real-time listener registry
// -------------------------------------------------------------
interface FirebaseListener {
  id: string;
  ref: any;
  callback: (snap: any) => void;
}
const listeners = new Set<FirebaseListener>();

function notifyListenersForPath(colPath: string, docId?: string) {
  for (const listener of listeners) {
    const lRef = listener.ref;
    if (lRef.type === 'doc') {
      if (lRef.col === colPath && (!docId || lRef.id === docId)) {
        getDoc(lRef).then(listener.callback).catch(err => console.error(err));
      }
    } else {
      const lColPath = lRef.type === 'collection' ? lRef.path : lRef.ref.path;
      if (lColPath === colPath) {
        getDocs(lRef).then(listener.callback).catch(err => console.error(err));
      }
    }
  }
}

// -------------------------------------------------------------
// Seed Data Initialization
// -------------------------------------------------------------
function initializeDataSeed() {
  // 1. Settings / configuration
  if (!localStorage.getItem('local_col_settings')) {
    const defaultConfig = {
      config: {
        appName: 'CRE Collectors',
        logoUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&auto=format&fit=crop&q=80',
        maintenanceMode: false,
        registrationReward: 15,
        registrationRewardLimit: 1000,
        registrationRewardCount: 5,
        faviconUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=32&auto=format&fit=crop&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
        announcement: '🔥 Welcome to CRE: Premium Collector\'s Portal. Verify warehouse arrivals live.',
        allowRegistration: true,
        allowDraw: true,
        allowTopup: true,
        minTopupAmount: 10,
        soundEnabled: true,
        animationsEnabled: true,
        homepageBlocks: [
          { id: 'hero', type: 'hero', visible: true },
          { id: 'highlights', type: 'highlights', visible: true },
          { id: 'boxes', type: 'boxes', visible: true },
          { id: 'leaderboard', type: 'leaderboard', visible: true },
          { id: 'membership', type: 'membership', visible: true },
        ],
        shippingFees: {
          west: 10,
          east: 15,
          freeThreshold: 150,
        },
        paymentMethods: {
          tng: { qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TNG-CRE-PAYMENT', name: 'TNG eWallet' },
          bank: { details: 'Maybank Malaysia\nAccount: 154039405912\nName: CRE SPACE PTE LTD', bankName: 'Standard Bank Transfer' },
          duitnow: { qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DUITNOW-CRE-PAYMENT', name: 'DuitNow QR QR' },
        }
      }
    };
    localStorage.setItem('local_col_settings', JSON.stringify(defaultConfig));
  }

  // 1.1 Banners/Carousel Collection Seed
  if (!localStorage.getItem('local_col_banners')) {
    const initialBanners = {
      'b1': {
        id: 'b1',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
        title: 'CRE Origins: Sky Blue Edition',
        subtitle: 'Limited series. Premium handcrafted resin design with matte finish.',
        targetUrl: '/box/cre-v1',
        countdown: '2026-12-31T23:59:59'
      },
      'b2': {
        id: 'b2',
        imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80',
        title: 'Nebula Overdrive Spec',
        subtitle: 'Step into the cosmos. Elite draw with ultra-rare pity drops.',
        targetUrl: '/box/cre-v2',
        countdown: '2026-10-15T18:00:00'
      },
      'b3': {
        id: 'b3',
        imageUrl: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1200&auto=format&fit=crop&q=80',
        title: 'Alpha Protocol Horizon',
        subtitle: 'Aesthetic luxury meets future cybernetic toys.',
        targetUrl: '/box/cre-v3',
        countdown: ''
      }
    };
    localStorage.setItem('local_col_banners', JSON.stringify(initialBanners));
  }

  // 2. Boxes / products seed
  if (!localStorage.getItem('local_col_boxes')) {
    const defaultBoxes = {
      'cre-v1': {
        id: 'cre-v1',
        title: 'CRE Origins: Sky Blue Edition',
        price: 19.9,
        coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60',
        description: 'The first generation of CRE premium collectibles. Featuring pure finishes with retro metallic secondary hues.',
        rarity: 'Common',
        status: 'active',
        tags: ['ORIGINS', 'SERIES 1'],
        rarityDistribution: { Common: '70%', Rare: '20%', Epic: '9%', Secret: '1%' }
      },
      'cre-v2': {
        id: 'cre-v2',
        title: 'Nebula Cosmic Eclipse',
        price: 49.0,
        coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
        description: 'Dive into interstellar relics. High-contrast holographic overlays and deep matte violet casing.',
        rarity: 'Epic',
        status: 'active',
        tags: ['COSMIC', 'HOLO'],
        rarityDistribution: { Common: '65%', Rare: '23%', Epic: '11%', Secret: '1%' }
      },
      'cre-v3': {
        id: 'cre-v3',
        title: 'Vanguard Golden Sovereign',
        price: 129.0,
        coverImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=60',
        description: 'Highly restricted, serialized royalty drops. Premium gold plating details, only for top-tier collectors.',
        rarity: 'Secret',
        status: 'active',
        tags: ['ROYALTY', 'GOLD'],
        rarityDistribution: { Common: '50%', Rare: '35%', Epic: '13%', Secret: '2%' }
      }
    };
    localStorage.setItem('local_col_boxes', JSON.stringify(defaultBoxes));

    // Seed prizes for each box
    const prizesV1 = {
      'p1': { id: 'p1', name: 'Original Sky bot', rarity: 'Common', probability: 0.70, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=1&backgroundColor=b6e3f4' },
      'p2': { id: 'p2', name: 'Silver Cloud Core', rarity: 'Rare', probability: 0.20, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=2&backgroundColor=d1d4f9' },
      'p3': { id: 'p3', name: 'Neon Heart Unit', rarity: 'Epic', probability: 0.09, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=3&backgroundColor=ffd5dc' },
      'p4': { id: 'p4', name: 'Chronos Sun Spec', rarity: 'Secret', probability: 0.01, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=4&backgroundColor=ffdfba' },
    };
    localStorage.setItem('local_col_boxes/cre-v1/prizes', JSON.stringify(prizesV1));

    const prizesV2 = {
      'p2-1': { id: 'p2-1', name: 'Cosmic Visor Bot', rarity: 'Common', probability: 0.65, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=21&backgroundColor=f1f5f9' },
      'p2-2': { id: 'p2-2', name: 'Aetheric Plasma Blade', rarity: 'Rare', probability: 0.23, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=22&backgroundColor=e0f2fe' },
      'p2-3': { id: 'p2-3', name: 'Quantum Core Cell', rarity: 'Epic', probability: 0.11, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=23&backgroundColor=fae8ff' },
      'p2-4': { id: 'p2-4', name: 'Void Eye Singularity', rarity: 'Secret', probability: 0.01, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=24&backgroundColor=fef08a' },
    };
    localStorage.setItem('local_col_boxes/cre-v2/prizes', JSON.stringify(prizesV2));

    const prizesV3 = {
      'p3-1': { id: 'p3-1', name: 'Golden Sovereign Seal', rarity: 'Common', probability: 0.50, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=31&backgroundColor=fef3c7' },
      'p3-2': { id: 'p3-2', name: 'Royal Jewel Chalice', rarity: 'Rare', probability: 0.35, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=32&backgroundColor=fee2e2' },
      'p3-3': { id: 'p3-3', name: 'Cybernetic Crown Relic', rarity: 'Epic', probability: 0.13, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=33&backgroundColor=ecfdf5' },
      'p3-4': { id: 'p3-4', name: 'Imperator Throne Spec', rarity: 'Secret', probability: 0.02, image: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=34&backgroundColor=fffbeb' },
    };
    localStorage.setItem('local_col_boxes/cre-v3/prizes', JSON.stringify(prizesV3));
  }

  // 3. User Credentials & Profiles Seed (Admin is "admin", pwd is "admin", or '1' and '1')
  const adminUser = {
    uid: 'admin_sys_uid_10249244',
    email: 'm-10249244@moe-dl.edu.my',
    displayName: 'CRE System Admin',
    emailVerified: true,
    photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin'
  };

  const creds = JSON.parse(localStorage.getItem('local_auth_credentials') || '{}');
  creds['m-10249244@moe-dl.edu.my'] = creds['m-10249244@moe-dl.edu.my'] || {
    password: 'admin',
    user: adminUser
  };
  creds['admin@cre.local'] = creds['admin@cre.local'] || {
    password: 'admin',
    user: adminUser
  };
  creds['1@cre.local'] = {
    password: '1',
    user: { ...adminUser, email: '1@cre.local', displayName: '1' }
  };
  localStorage.setItem('local_auth_credentials', JSON.stringify(creds));

  // Username mapping
  const usernames = JSON.parse(localStorage.getItem('local_col_usernames') || '{}');
  usernames['admin'] = {
    uid: 'admin_sys_uid_10249244',
    username: 'admin',
    lowercaseUsername: 'admin'
  };
  usernames['1'] = {
    uid: 'admin_sys_uid_10249244',
    username: '1',
    lowercaseUsername: '1'
  };
  localStorage.setItem('local_col_usernames', JSON.stringify(usernames));

  // Admin's Firestore User profile
  const users = JSON.parse(localStorage.getItem('local_col_users') || '{}');
  users['admin_sys_uid_10249244'] = {
    uid: 'admin_sys_uid_10249244',
    displayName: 'CRE System Admin',
    email: 'm-10249244@moe-dl.edu.my',
    photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin',
    balance: 999999,
    points: 10000,
    isAdmin: true,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem('local_col_users', JSON.stringify(users));

  // 4. Seed Prize/Rarity Tiers
  if (!localStorage.getItem('local_col_rarity_tiers')) {
    const initialTiers = {
      'Common': { id: 'Common', name: 'Common', style: 'bg-neutral-100 text-neutral-600', sortOrder: 1 },
      'Rare': { id: 'Rare', name: 'Rare', style: 'bg-blue-100 text-blue-600', sortOrder: 2 },
      'Epic': { id: 'Epic', name: 'Epic', style: 'bg-pink-100 text-pink-600', sortOrder: 3 },
      'Secret': { id: 'Secret', name: 'Secret', style: 'bg-yellow-100 text-yellow-600 font-bold glow-soft', sortOrder: 4 },
      'Hidden': { id: 'Hidden', name: 'Hidden', style: 'bg-purple-100 text-purple-600 font-bold', sortOrder: 5 },
      'Limited': { id: 'Limited', name: 'Limited', style: 'bg-emerald-100 text-emerald-600 font-bold', sortOrder: 6 }
    };
    localStorage.setItem('local_col_rarity_tiers', JSON.stringify(initialTiers));
  }
}

// Ensure seed data starts
initializeDataSeed();

// -------------------------------------------------------------
// APP (firebase/app)
// -------------------------------------------------------------
export function initializeApp(config: any) {
  return { name: '[LocalStorage-Fallback-Default]', config };
}

// -------------------------------------------------------------
// AUTH (firebase/auth)
// -------------------------------------------------------------
class MockAuth {
  _listeners = new Set<Function>();

  get currentUser() {
    const userStr = localStorage.getItem('local_auth_current_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  _notify() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Auth listener notify error:', e);
      }
    }
  }
}

export const authInstance = new MockAuth();

export function getAuth() {
  return authInstance;
}

export function onAuthStateChanged(auth: MockAuth, callback: (user: any) => void) {
  const handler = () => {
    callback(auth.currentUser);
  };
  auth._listeners.add(handler);
  handler(); // initial fire

  return () => {
    auth._listeners.delete(handler);
  };
}

export async function signOut(auth: MockAuth) {
  localStorage.removeItem('local_auth_current_user');
  auth._notify();
}

export async function createUserWithEmailAndPassword(auth: MockAuth, email: string, password: string) {
  const username = email.split('@')[0];
  const uid = 'u_' + Math.random().toString(36).substr(2, 9);
  
  const creds = JSON.parse(localStorage.getItem('local_auth_credentials') || '{}');
  if (creds[email.toLowerCase()]) {
    throw new Error('auth/email-already-in-use');
  }

  const newUser = {
    uid,
    email,
    displayName: username,
    emailVerified: true,
    photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
  };

  creds[email.toLowerCase()] = {
    password,
    user: newUser
  };
  localStorage.setItem('local_auth_credentials', JSON.stringify(creds));

  // Log in
  localStorage.setItem('local_auth_current_user', JSON.stringify(newUser));
  auth._notify();

  return { user: newUser };
}

export async function signInWithEmailAndPassword(auth: MockAuth, email: string, password: string) {
  const creds = JSON.parse(localStorage.getItem('local_auth_credentials') || '{}');
  const record = creds[email.toLowerCase()];

  if (!record || record.password !== password) {
    throw new Error('auth/wrong-password');
  }

  const loggedUser = record.user;
  localStorage.setItem('local_auth_current_user', JSON.stringify(loggedUser));
  auth._notify();

  return { user: loggedUser };
}

// -------------------------------------------------------------
// FIRESTORE (firebase/firestore)
// -------------------------------------------------------------
export const dbInstance = { name: 'local_firestore_db' };

export function getFirestore() {
  return dbInstance;
}

export function doc(db: any, ...args: any[]) {
  let pathParts: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      pathParts.push(...arg.split('/').filter(Boolean));
    } else if (arg && typeof arg === 'object' && arg.type === 'collection') {
      pathParts.push(...arg.path.split('/').filter(Boolean));
    }
  }
  
  const id = pathParts.pop() || '';
  const colPath = pathParts.join('/');
  
  return {
    type: 'doc',
    col: colPath,
    id: id,
    path: colPath ? `${colPath}/${id}` : id
  };
}

export function collection(db: any, ...args: any[]) {
  let pathParts: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      pathParts.push(...arg.split('/').filter(Boolean));
    } else if (arg && typeof arg === 'object' && arg.type === 'doc') {
      pathParts.push(...arg.path.split('/').filter(Boolean));
    }
  }
  
  const colPath = pathParts.join('/');
  return {
    type: 'collection',
    path: colPath
  };
}

export async function getDoc(docRef: any) {
  const colPath = docRef.col;
  const docId = docRef.id;
  
  const dataStore = JSON.parse(localStorage.getItem(`local_col_${colPath}`) || '{}');
  const docData = dataStore[docId];
  
  return {
    id: docId,
    ref: docRef,
    exists: () => docData !== undefined && docData !== null,
    data: () => docData ? JSON.parse(JSON.stringify(docData)) : undefined
  };
}

interface QueryConstraint {
  type: string;
  field?: string;
  operator?: string;
  value?: any;
  direction?: string;
  n?: number;
}

export function query(collectionRef: any, ...constraints: QueryConstraint[]) {
  return {
    type: 'query',
    ref: collectionRef,
    constraints: constraints.filter(Boolean)
  };
}

export function where(field: string, operator: string, value: any): QueryConstraint {
  return { type: 'where', field, operator, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number): QueryConstraint {
  return { type: 'limit', n };
}

export async function getDocs(queryRef: any) {
  const colPath = queryRef.type === 'collection' ? queryRef.path : queryRef.ref.path;
  
  const dataStore = JSON.parse(localStorage.getItem(`local_col_${colPath}`) || '{}');
  let docs = Object.keys(dataStore).map(id => ({
    id,
    data: () => JSON.parse(JSON.stringify(dataStore[id]))
  }));
  
  // If query ref, filter & sort
  if (queryRef.type === 'query') {
    const constraints = queryRef.constraints || [];
    for (const c of constraints) {
      if (c.type === 'where') {
        const { field, operator, value } = c;
        docs = docs.filter(docVal => {
          const dData = docVal.data();
          const fValue = dData[field as string];
          
          if (operator === '==') {
            return fValue === value;
          } else if (operator === '!=') {
            return fValue !== value;
          } else if (operator === '>=') {
            return fValue >= value;
          } else if (operator === '<=') {
            return fValue <= value;
          } else if (operator === '>') {
            return fValue > value;
          } else if (operator === '<') {
            return fValue < value;
          } else if (operator === 'in') {
            return Array.isArray(value) && value.includes(fValue);
          } else if (operator === 'array-contains') {
            return Array.isArray(fValue) && fValue.includes(value);
          }
          return true;
        });
      } else if (c.type === 'orderBy') {
        const { field, direction } = c;
        docs.sort((a, b) => {
          const valA = a.data()[field as string];
          const valB = b.data()[field as string];
          if (valA === undefined) return 1;
          if (valB === undefined) return -1;
          
          if (direction === 'desc') {
            return valA > valB ? -1 : valA < valB ? 1 : 0;
          } else {
            return valA < valB ? -1 : valA > valB ? 1 : 0;
          }
        });
      }
    }
    
    // Limit application
    for (const c of constraints) {
      if (c.type === 'limit') {
        docs = docs.slice(0, c.n);
      }
    }
  }
  
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (doc: any) => void) => docs.forEach(cb)
  };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const colPath = docRef.col;
  const docId = docRef.id;
  
  const dataStore = JSON.parse(localStorage.getItem(`local_col_${colPath}`) || '{}');
  const existingDoc = dataStore[docId] || {};
  
  let mergedData = { ...data };
  if (options?.merge) {
    mergedData = mergeDeep(existingDoc, data);
  }
  
  // Resolve increment & timestamps
  mergedData = resolveSpecialValues(mergedData, existingDoc);
  
  dataStore[docId] = mergedData;
  localStorage.setItem(`local_col_${colPath}`, JSON.stringify(dataStore));
  
  notifyListenersForPath(colPath, docId);
}

export async function updateDoc(docRef: any, data: any) {
  const colPath = docRef.col;
  const docId = docRef.id;
  
  const dataStore = JSON.parse(localStorage.getItem(`local_col_${colPath}`) || '{}');
  const existingDoc = dataStore[docId];
  if (!existingDoc) {
    throw new Error(`Document not found: ${colPath}/${docId}`);
  }
  
  let updatedDoc = { ...existingDoc };
  for (const [key, val] of Object.entries(data)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = updatedDoc;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      current[lastKey] = resolveValue(val, current[lastKey]);
    } else {
      updatedDoc[key] = resolveValue(val, updatedDoc[key]);
    }
  }
  
  dataStore[docId] = updatedDoc;
  localStorage.setItem(`local_col_${colPath}`, JSON.stringify(dataStore));
  
  notifyListenersForPath(colPath, docId);
}

export async function addDoc(collectionRef: any, data: any) {
  const colPath = collectionRef.path;
  const docId = 'doc_' + Math.random().toString(36).substr(2, 12);
  
  const dataStore = JSON.parse(localStorage.getItem(`local_col_${colPath}`) || '{}');
  const resolvedData = resolveSpecialValues({ id: docId, ...data }, {});
  
  dataStore[docId] = resolvedData;
  localStorage.setItem(`local_col_${colPath}`, JSON.stringify(dataStore));
  
  notifyListenersForPath(colPath, docId);
  
  return {
    id: docId,
    path: `${colPath}/${docId}`
  };
}

export async function deleteDoc(docRef: any) {
  const colPath = docRef.col;
  const docId = docRef.id;
  
  const dataStore = JSON.parse(localStorage.getItem(`local_col_${colPath}`) || '{}');
  if (dataStore[docId]) {
    delete dataStore[docId];
    localStorage.setItem(`local_col_${colPath}`, JSON.stringify(dataStore));
    
    notifyListenersForPath(colPath, docId);
  }
}

export function onSnapshot(ref: any, callback: (snap: any) => void, onError?: any) {
  const listenerDescriptor: FirebaseListener = {
    id: Math.random().toString(36).substr(2, 9),
    ref,
    callback
  };
  listeners.add(listenerDescriptor);
  
  const trigger = async () => {
    try {
      if (ref.type === 'doc') {
        const snap = await getDoc(ref);
        callback(snap);
      } else {
        const snap = await getDocs(ref);
        callback(snap);
      }
    } catch (e) {
      if (onError) onError(e);
      else console.error('Snapshot trigger error:', e);
    }
  };
  
  trigger();
  
  return () => {
    listeners.delete(listenerDescriptor);
  };
}

export function serverTimestamp() {
  return { __type: 'serverTimestamp' };
}

export function increment(amount: number) {
  return { __type: 'increment', amount };
}

export async function runTransaction(db: any, callback: (transaction: any) => Promise<any>) {
  const transaction = {
    get: async (docRef: any) => {
      return await getDoc(docRef);
    },
    set: async (docRef: any, data: any, options?: any) => {
      return await setDoc(docRef, data, options);
    },
    update: async (docRef: any, data: any) => {
      return await updateDoc(docRef, data);
    },
    delete: async (docRef: any) => {
      return await deleteDoc(docRef);
    }
  };
  return await callback(transaction);
}

// Ensure basic Timestamp support
export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
}
