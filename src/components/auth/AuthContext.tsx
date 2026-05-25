import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, runTransaction, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  loginNative: (username: string, password: string) => Promise<void>;
  registerNative: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  showRewardModal: boolean;
  setShowRewardModal: (show: boolean) => void;
  rewardAmount: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const profileRef = doc(db, 'users', user.uid);
        try {
          const pSnap = await getDoc(profileRef);
          
          const isAdminUser = 
            user.email === 'm-10249244@moe-dl.edu.my' || 
            user.email === 'admin@cre.local' || 
            user.email === '1@cre.local' || 
            user.uid === 'admin_sys_uid_10249244' ||
            user.displayName === '1' ||
            user.displayName === 'admin';

          if (pSnap.exists()) {
            const currentProfile = pSnap.data();
            if (isAdminUser && !currentProfile?.isAdmin) {
              await updateDoc(profileRef, { isAdmin: true });
            }
          } else {
            // New user - fetch config for reward
            const configSnap = await getDoc(doc(db, 'settings', 'config'));
            const config = configSnap.data();
            const reward = config?.registrationReward || 0;
            
            const newProfile = {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              balance: reward,
              points: 0,
              isAdmin: isAdminUser,
              createdAt: serverTimestamp(),
              rewardClaimed: reward > 0
            };
            
            await setDoc(profileRef, newProfile);
            
            if (reward > 0) {
              const logId = `reward-${Date.now()}`;
              await setDoc(doc(db, 'balanceLogs', logId), {
                id: logId,
                userId: user.uid,
                amount: reward,
                type: 'registration_reward',
                reason: 'First registration bonus',
                timestamp: serverTimestamp()
              });
              
              setRewardAmount(reward);
              setShowRewardModal(true);
            }
            
            setProfile({ ...newProfile, createdAt: new Date() } as any);
          }

          onSnapshot(profileRef, (doc) => {
            setProfile(doc.data());
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, profileRef.path);
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, profileRef.path);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginNative = async (username: string, password: string) => {
    // Check if translation password mapping exists for database-driven override
    const usernameRef = doc(db, 'usernames', username.toLowerCase());
    const userSnap = await getDoc(usernameRef);
    if (userSnap.exists()) {
      const credentials = userSnap.data();
      const currentPassword = credentials.authPassword || credentials.firebaseAuthPassword || password;
      if (currentPassword === password) {
        // Log in using root firebase password mapping
        const rootPassword = credentials.firebaseAuthPassword || password;
        const email = username.includes('@') ? username : `${username.toLowerCase()}@cre.local`;
        try {
          await signInWithEmailAndPassword(auth, email, rootPassword);
        } catch (authErr: any) {
          // If the auth record does not exist yet (i.e. was pre-created in database by Admin), register it on-the-fly!
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, email, rootPassword);
          } else {
            throw authErr;
          }
        }
        return;
      } else {
        throw new Error('auth/wrong-password');
      }
    }
    // Fallback if no username mapping exists
    const email = username.includes('@') ? username : `${username.toLowerCase()}@cre.local`;
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerNative = async (username: string, password: string, emailStr?: string) => {
    const internalEmail = `${username.toLowerCase()}@cre.local`;
    const finalEmail = emailStr || internalEmail;
    
    // Check if username exists
    const usernameRef = doc(db, 'usernames', username.toLowerCase());
    const userSnap = await getDoc(usernameRef);
    if (userSnap.exists()) {
      throw new Error('Username already taken');
    }

    const { user: newUser } = await createUserWithEmailAndPassword(auth, finalEmail, password);
    
    // Create mapping in transaction with authentication password tracking
    try {
      await runTransaction(db, async (transaction) => {
        transaction.set(usernameRef, {
          uid: newUser.uid,
          username: username,
          lowercaseUsername: username.toLowerCase(),
          authPassword: password, // Changeable password field
          firebaseAuthPassword: password // Constant root login password
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, usernameRef.path);
    }

    // Profile creation is handled by the useEffect above
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      loginNative, 
      registerNative, 
      logout, 
      showRewardModal, 
      setShowRewardModal, 
      rewardAmount 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
