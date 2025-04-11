import { Request, Response, NextFunction } from "express";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { storage } from "./storage";

// Initialize Firebase Admin SDK for server-side operations
// In a production environment, you would use a service account
// For this demo, we'll use application default credentials
let firebaseAdmin: App;

try {
  // Initialize Firebase Admin
  firebaseAdmin = initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
} catch (error: any) {
  // If the app is already initialized, we'll get an error
  if (error.code === 'app/duplicate-app') {
    console.log('Firebase Admin already initialized');
  } else {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

// Middleware to verify Firebase ID tokens
export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If no token, proceed to the next middleware (will be handled by passport)
    return next();
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Verify the ID token using the Auth instance
    const auth = getAuth(firebaseAdmin);
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    
    // Find or create user in PostgreSQL
    let user = await storage.getUserByFirebaseId(uid);
    
    if (!user) {
      // Create a new user if not found
      // Generate a display name from email if username not provided
      const displayName = decodedToken.name || decodedToken.display_name;
      const username = displayName || email?.split('@')[0] || `user_${uid.slice(0, 8)}`;
      
      // Create a user with a random password (they'll use Firebase auth)
      const randomPassword = Math.random().toString(36).slice(-12);
      
      // Create a user record with Firebase ID 
      user = await storage.createUser({
        username,
        password: randomPassword, // We won't use this for Firebase users
        firebaseId: uid,
        email: email || ''
      });
      
      // Subscription is set by default in storage.createUser implementation
    }
    
    // Set user in req object
    req.user = user;
    // Type assertion to handle the authentication check
    (req as any).isAuthenticated = () => true;
    
    next();
  } catch (error) {
    // If token verification fails, proceed to the next middleware
    // This allows falling back to session authentication
    console.error("Firebase token verification failed:", error);
    next();
  }
};