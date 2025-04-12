import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged,
  connectAuthEmulator
} from "firebase/auth";

// Lazy initialization for better performance
let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;
let googleProvider: GoogleAuthProvider;

// Lazy initialization function
const initializeFirebase = () => {
  if (app) return { app, auth, googleProvider };

  // Firebase configuration using environment variables
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: "", // Not required but added for completeness
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  // Initialize Firebase
  console.log('Initializing Firebase services...');
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  
  // Use emulator in development
  if (import.meta.env.DEV) {
    // Uncomment to use Firebase emulator if needed
    // connectAuthEmulator(auth, 'http://localhost:9099');
  }

  return { app, auth, googleProvider };
};

// Firebase authentication functions
export const signInWithGoogle = async () => {
  try {
    const { auth, googleProvider } = initializeFirebase();
    
    // Use redirect instead of popup to avoid popup blockers and configuration issues
    await signInWithRedirect(auth, googleProvider);
    
    // Note: This function will redirect away, so the code below won't execute
    // immediately. It will run after the user is redirected back.
    return null;
  } catch (error: any) {
    console.error("Error signing in with Google: ", error);
    throw error;
  }
};

// Handle redirect result when user returns from Google auth page
export const getGoogleRedirectResult = async () => {
  try {
    const { auth } = initializeFirebase();
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error: any) {
    console.error("Error getting redirect result: ", error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, password: string) => {
  try {
    const { auth } = initializeFirebase();
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error("Error registering with email: ", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const { auth } = initializeFirebase();
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error("Error logging in with email: ", error);
    throw error;
  }
};

export const logoutFirebase = async () => {
  try {
    const { auth } = initializeFirebase();
    await signOut(auth);
  } catch (error: any) {
    console.error("Error signing out: ", error);
    throw error;
  }
};

export const getCurrentUser = (): Promise<FirebaseUser | null> => {
  return new Promise((resolve) => {
    const { auth } = initializeFirebase();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Initialize Firebase only when these exports are used
export const getFirebaseAuth = () => initializeFirebase().auth;
export const getFirebaseApp = () => initializeFirebase().app;