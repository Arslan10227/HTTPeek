import { create } from 'zustand';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser, logAnalyticsEvent } from '../services/firebase';
import { toast } from './useToastStore';

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

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
      const user = await loginWithGoogle();
      const profile: AuthUserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      set({ user: profile, firebaseUser: user, isLoading: false, isAuthModalOpen: false });
      toast.success('Welcome!', `Signed in as ${user.displayName || user.email}`);
    } catch (error: any) {
      set({ isLoading: false });
      if (error?.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname || 'wails.localhost';
        toast.error(
          'Unauthorized Domain',
          `Add "${currentDomain}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`
        );
      } else if (error?.code !== 'auth/popup-closed-by-user') {
        toast.error('Google Sign-In Failed', error?.message || 'Authentication error');
      }
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await logoutUser();
      set({ user: null, firebaseUser: null, isLoading: false });
      toast.info('Signed Out', 'You have been signed out.');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error('Sign Out Failed', error?.message);
    }
  },

  initAuthListener: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        set({
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
          firebaseUser: user,
          isLoading: false,
        });
        logAnalyticsEvent('user_session_restored', { uid: user.uid });
      } else {
        set({ user: null, firebaseUser: null, isLoading: false });
      }
    });
    return unsubscribe;
  },
}));
