import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser, logAnalyticsEvent } from '../services/firebase';
import { toast } from './useToastStore';

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

      // If we are on the hosted website (https://httpeek.web.app), direct popup is supported
      if (typeof window !== 'undefined' && window.location.hostname.includes('httpeek.web.app')) {
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

      // In Desktop / Wails WebView environment:
      // Open the authorized hosted relay popup at https://httpeek.web.app/auth-callback.html
      const width = 500;
      const height = 620;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        'https://httpeek.web.app/auth-callback.html?auto=true',
        'HTTPeek Google Sign In',
        `width=${width},height=${height},top=${top},left=${left},status=no,menubar=no,toolbar=no`
      );

      // Handle cases where popup might be blocked
      if (!popup) {
        window.open('https://httpeek.web.app/auth-callback.html', '_blank');
      }

      // Timer to reset loading if user closes popup without logging in
      const pollTimer = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(pollTimer);
          if (!get().user) {
            set({ isLoading: false });
          }
        }
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

    // 2. Listen for postMessage from the hosted auth relay popup
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

    return () => {
      window.removeEventListener('message', handleMessage);
      if (bc) bc.close();
    };
  },
}));
