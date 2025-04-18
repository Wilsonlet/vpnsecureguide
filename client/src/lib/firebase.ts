import { initializeApp, getApp, FirebaseApp } from "firebase/app";
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

// Safely initialize Firebase only once
let app: FirebaseApp | undefined;
let auth: ReturnType<typeof getAuth>;
let googleProvider: GoogleAuthProvider;

// Get the proper authentication domain based on environment
const getAuthDomain = () => {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_FIREBASE_PROJECT_ID
      ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`
      : 'localhost';
  }

  // Get the current hostname
  const currentHostname = window.location.hostname;
  
  // Check for different environments
  if (currentHostname.includes('.replit.dev') || 
      currentHostname.includes('.replit.app') ||
      currentHostname.endsWith('.repl.co')) {
    // In Replit environments, use the current URL as the auth domain
    return currentHostname;
  } else if (currentHostname === 'localhost' || currentHostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    // For localhost or IP addresses in development
    return 'localhost';
  }
  
  // For custom domains or any other case, use the current hostname
  // This allows it to work with any domain where the app is deployed
  return currentHostname;
};

// Firebase configuration using environment variables
const getFirebaseConfig = () => {
  const authDomain = getAuthDomain();
  
  // Check for missing required Firebase config
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  
  // Provide helpful error messages if configuration is missing
  if (!apiKey) {
    console.error('Missing required Firebase config: VITE_FIREBASE_API_KEY');
  }
  
  if (!projectId) {
    console.error('Missing required Firebase config: VITE_FIREBASE_PROJECT_ID');
  }
  
  if (!appId) {
    console.error('Missing required Firebase config: VITE_FIREBASE_APP_ID');
  }
  
  // Continue with available config
  return {
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: projectId ? `${projectId}.appspot.com` : undefined,
    messagingSenderId: "000000000000", // Placeholder, required by Firebase
    appId: appId,
  };
};

/**
 * Initialize Firebase safely with error handling to prevent duplicate initialization
 */
const initializeFirebase = () => {
  if (!app) {
    try {
      // Initialize Firebase only once
      console.log('Initializing Firebase services...');
      const firebaseConfig = getFirebaseConfig();
      console.log('Using auth domain:', firebaseConfig.authDomain);
      
      try {
        app = getApp();
        console.log('Retrieved existing Firebase app');
      } catch (getAppError) {
        // App doesn't exist yet, initialize it
        app = initializeApp(firebaseConfig);
        console.log('Firebase app initialized successfully');
      }
      
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      
      // Add scopes if needed
      googleProvider.addScope('profile');
      googleProvider.addScope('email');
      
      // Use emulator in development if needed
      if (import.meta.env.DEV) {
        // connectAuthEmulator(auth, 'http://localhost:9099');
      }
    } catch (error: any) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
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
    
    // Handle specific Firebase auth configuration error
    if (error.code === 'auth/configuration-not-found') {
      console.warn('Firebase authentication configuration not found. This error occurs when:');
      console.warn('1. Your application domain is not added to the authorized domains list in Firebase console');
      console.warn('2. Your Firebase project is not correctly configured for the chosen authentication method');
      console.warn('Please update your Firebase project configuration in the Firebase console.');
      
      // We still throw because this is a blocking error that should be addressed
      error.message = 'Firebase authentication is not properly configured. Please contact support.';
    }
    
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
    
    // Handle specific Firebase auth configuration error
    if (error.code === 'auth/configuration-not-found') {
      console.warn('Firebase authentication configuration not found. This usually means your Firebase project needs additional configuration.');
      console.warn('Please ensure your Replit dev URL is added to the Firebase authorized domains list in the Firebase console.');
      
      // Return null instead of throwing to prevent app crash
      return null;
    }
    
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