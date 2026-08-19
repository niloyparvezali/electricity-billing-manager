import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (next) {
      await setDoc(doc(db, "users", next.uid), {
        uid: next.uid,
        email: next.email || "",
        displayName: next.displayName || "",
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    setInitializing(false);
  }), []);

  async function register(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email || "",
      displayName: name.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  return (
    <AuthContext.Provider value={{
      user,
      initializing,
      login: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
      register,
      logout: () => signOut(auth)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
