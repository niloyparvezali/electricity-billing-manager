import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (next) {
      const profile = doc(db, "users", next.uid);
      const snap = await getDoc(profile);
      if (!snap.exists()) await setDoc(profile, { uid: next.uid, email: next.email || "", displayName: next.displayName || "", createdAt: serverTimestamp() }, { merge:true });
    }
    setInitializing(false);
  }), []);
  const value = useMemo(() => ({
    user, initializing,
    login: (email,password) => signInWithEmailAndPassword(auth, email.trim(), password),
    async register(name,email,password) {
      const c = await createUserWithEmailAndPassword(auth,email.trim(),password);
      if (name.trim()) await updateProfile(c.user,{displayName:name.trim()});
      await setDoc(doc(db,"users",c.user.uid),{uid:c.user.uid,email:c.user.email||"",displayName:name.trim(),createdAt:serverTimestamp()},{merge:true});
      return c;
    },
    logout: () => signOut(auth)
  }), [user,initializing]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){ const c=useContext(AuthContext); if(!c) throw new Error("useAuth must be used inside AuthProvider"); return c; }
