// Firebase Authentication helper for the admin login flow.
// Loaded from Google's hosted Firebase SDK (CDN) so it can be added
// without rebuilding the Vite bundle in js/app.js.
import { initializeApp, getApps, getApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Same public config already used by js/app.js — not a secret, safe to duplicate here.
const firebaseConfig = {
  projectId: "xtra-tv-pro",
  appId: "1:109355602004:web:fbff658a5274944e39ddc1",
  apiKey: "AIzaSyDePG1pFMPzrgCah5qA4nbrTFFen1mtdxs",
  authDomain: "xtra-tv-pro.firebaseapp.com",
  storageBucket: "xtra-tv-pro.firebasestorage.app",
  messagingSenderId: "109355602004",
  measurementId: "G-35PFTVPP77",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Signs in an admin with email/password. Throws on failure (wrong
// credentials, user not found, etc.) — caller should catch and show
// a friendly error message.
export async function adminLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function adminLogout() {
  return signOut(auth);
}

// Subscribes to admin auth state changes (fires immediately with the
// current user, then again on sign-in/sign-out). Returns an unsubscribe fn.
export function watchAdminAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// Returns the current admin's Firebase ID token (auto-refreshed by the SDK
// if needed), or null if nobody is signed in. Used by js/firestore-rest.js
// to attach `Authorization: Bearer <token>` to Firestore REST calls.
export async function getAdminIdToken() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// Returns { uid, email } for the currently signed-in admin, or null.
// Used to look up / bootstrap that admin's row in the "admin_roles"
// collection (see js/analytics-web.js).
export async function getCurrentAdminUser() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return { uid: user.uid, email: user.email };
}

// Creates a brand-new admin account (email/password) WITHOUT signing the
// current admin out. Firebase's client SDK normally signs in as whichever
// user was just created, so this spins up a short-lived secondary Firebase
// App instance (isolated auth state) to do the sign-up, then tears it down.
// Returns the new user's { uid, email }.
export async function createAdminUser(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const result = { uid: cred.user.uid, email: cred.user.email };
    await signOut(secondaryAuth);
    return result;
  } finally {
    await deleteApp(secondaryApp);
  }
}
