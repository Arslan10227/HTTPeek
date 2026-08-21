import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser, logAnalyticsEvent } from '../services/firebase';
import { toast } from './useToastStore';
import { BrowserOpenURL, EventsOn } from '../../wailsjs/runtime/runtime';

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const STORAGE_KEY = 'httpeek_auth_profile';

interface AuthState {
  user: AuthUserProfile | null;
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthModalOpen: false,

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  signInGoogle: async () => {
    try {
      set({ isLoading: true });

      // 1. If running directly on the hosted web app (Vercel or Firebase), direct popup works natively
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      if (currentHost.includes('vercel.app') || currentHost.includes('web.app') || currentHost.includes('firebaseapp.com')) {
        const user = await loginWithGoogle();
        const profile: AuthUserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        set({ user: profile, firebaseUser: user, isLoading: false, isAuthModalOpen: false });
        toast.success('Welcome!', `Signed in as ${user.displayName || user.email}`);
        return;
      }

      // 2. In Desktop / Wails environment:
      // Open the browser with the authorized relay URL (Vercel primary)
      const authUrl = 'https://httpeek.vercel.app/auth-callback.html?auto=true';

      try {
        if (typeof BrowserOpenURL === 'function') {
          BrowserOpenURL(authUrl);
        } else if ((window as any).runtime?.BrowserOpenURL) {
          (window as any).runtime.BrowserOpenURL(authUrl);
        } else {
          window.open(authUrl, '_blank');
        }
      } catch (e) {
        window.open(authUrl, '_blank');
      }

      toast.info('Browser Opened', 'Complete Google Sign In in your browser window to log in.');

      // 3. Poll local proxy auth session endpoint (http://127.0.0.1:9099/api/auth/session)
      let pollCount = 0;
      const pollTimer = setInterval(async () => {
        pollCount++;
        if (pollCount > 60 || get().user) {
          clearInterval(pollTimer);
          if (!get().user) set({ isLoading: false });
          return;
        }

        try {
          const res = await fetch('http://127.0.0.1:9099/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            if (data && data.uid) {
              clearInterval(pollTimer);
              const profile: AuthUserProfile = data;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
              set({ user: profile, isLoading: false, isAuthModalOpen: false });
              toast.success('Welcome!', `Signed in as ${profile.displayName || profile.email}`);
              logAnalyticsEvent('login', { method: 'google_browser_sync' });
            }
          }
        } catch (e) {}
      }, 1000);

    } catch (error: any) {
      set({ isLoading: false });
      if (error?.code !== 'auth/popup-closed-by-user') {
        toast.error('Google Sign-In Failed', error?.message || 'Authentication error');
      }
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      localStorage.removeItem(STORAGE_KEY);
      try {
        await logoutUser();
      } catch (e) {}
      set({ user: null, firebaseUser: null, isLoading: false });
      toast.info('Signed Out', 'You have been signed out.');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error('Sign Out Failed', error?.message);
    }
  },

  initAuthListener: () => {
    // 1. Restore cached profile from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const profile = JSON.parse(saved);
        if (profile?.uid) {
          set({ user: profile, isLoading: false });
        }
      }
    } catch (e) {}

    // 2. Listen for postMessage from any popup window
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'HTTPEEK_AUTH_SUCCESS' && event.data?.user) {
        const profile: AuthUserProfile = event.data.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        set({ user: profile, isLoading: false, isAuthModalOpen: false });
        toast.success('Welcome!', `Signed in as ${profile.displayName || profile.email}`);
        logAnalyticsEvent('login', { method: 'google_relay' });
      }
    };
    window.addEventListener('message', handleMessage);

    // 3. BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('httpeek_auth');
      bc.onmessage = (event) => {
        if (event.data?.type === 'HTTPEEK_AUTH_SUCCESS' && event.data?.user) {
          const profile: AuthUserProfile = event.data.user;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
          set({ user: profile, isLoading: false, isAuthModalOpen: false });
          toast.success('Welcome!', `Signed in as ${profile.displayName || profile.email}`);
        }
      };
    } catch (e) {}

    // 4. Wails backend event listener
    try {
      if (typeof EventsOn === 'function') {
        EventsOn('auth:session', (profile: AuthUserProfile) => {
          if (profile && profile.uid) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
            set({ user: profile, isLoading: false, isAuthModalOpen: false });
            toast.success('Welcome!', `Signed in as ${profile.displayName || profile.email}`);
          }
        });
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('message', handleMessage);
      if (bc) bc.close();
    };
  },
}));
