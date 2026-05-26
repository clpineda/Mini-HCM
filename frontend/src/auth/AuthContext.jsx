import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, isFirebaseConfigured } from "../lib/firebase.js";

const AuthContext = createContext(null);

function requireFirebase() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error("Firebase is not configured. Add Firebase values to your .env file.");
  }
}

async function applyAuthPersistence() {
  requireFirebase();
  await setPersistence(auth, browserLocalPersistence);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return undefined;
    }

    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("Unable to set Firebase auth persistence", error);
    });

    return onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setCurrentUser(user);

      if (!user || !db) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        setUserProfile(profileSnapshot.exists() ? profileSnapshot.data() : null);
      } catch (error) {
        console.error("Unable to load user profile", error);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      userProfile,
      isAdmin: userProfile?.role === "admin",
      loading,
      isConfigured: isFirebaseConfigured,
      async register({ name, email, password, role, timezone, scheduleStart, scheduleEnd }) {
        requireFirebase();
        await applyAuthPersistence();

        const credential = await createUserWithEmailAndPassword(auth, email, password);

        await updateProfile(credential.user, {
          displayName: name
        });

        const profile = {
          name,
          email,
          role,
          timezone,
          schedule: {
            start: scheduleStart,
            end: scheduleEnd
          },
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, "users", credential.user.uid), profile);
        setUserProfile(profile);

        return credential.user;
      },
      async login(email, password) {
        requireFirebase();
        await applyAuthPersistence();
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return credential.user;
      },
      async logout() {
        requireFirebase();
        await signOut(auth);
      }
    }),
    [currentUser, userProfile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
