import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getAnalytics, logEvent as firebaseLogEvent, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';

// HTTPeek Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAS0nIrvVrH_NvAsxSVVu4VIT3AEOj5U2A",
  authDomain: "httpeek.firebaseapp.com",
  projectId: "httpeek",
  storageBucket: "httpeek.firebasestorage.app",
  messagingSenderId: "197087786767",
  appId: "1:197087786767:web:48c123e5966268b494307a",
  measurementId: "G-VSQ7RTKQFS"
};

// Initialize Firebase App instance
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firebase Analytics safely (checks browser support)
let analyticsInstance: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      try {
        analyticsInstance = getAnalytics(app);
      } catch (e) {
        console.warn('[Firebase Analytics] Init skipped:', e);
      }
    }
  });
}

/**
 * Log an analytics event to Firebase Analytics
 */
export const logAnalyticsEvent = (eventName: string, params?: Record<string, any>) => {
  if (analyticsInstance) {
    try {
      firebaseLogEvent(analyticsInstance, eventName, params);
    } catch (e) {
      console.warn('[Firebase Analytics] Event failed:', e);
    }
  }
};

/**
 * Sign in with Google Popup
 */
export const loginWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider);
  logAnalyticsEvent('login', { method: 'google' });
  return result.user;
};

/**
 * Sign out current user
 */
export const logoutUser = async (): Promise<void> => {
  await firebaseSignOut(auth);
  logAnalyticsEvent('logout');
};
