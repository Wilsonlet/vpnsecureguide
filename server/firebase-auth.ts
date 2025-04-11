import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";
import { storage } from "./storage";

// Initialize Firebase Admin SDK for server-side operations
// In a production environment, you would use a service account
// For this demo, we'll use application default credentials
let firebaseAdmin: admin.app.App;

try {
  // Check if Firebase Admin is already initialized
  firebaseAdmin = admin.app();
} catch (error) {
  // Initialize Firebase Admin if not already initialized
  firebaseAdmin = admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
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
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    
    // Find or create user in PostgreSQL
    let user = await storage.getUserByFirebaseId(uid);
    
    if (!user) {
      // Create a new user if not found
      // Generate a display name from email if username not provided
      const username = decodedToken.name || email?.split('@')[0] || `user_${uid.slice(0, 8)}`;
      
      // Create a user with a random password (they'll use Firebase auth)
      const randomPassword = Math.random().toString(36).slice(-12);
      
      user = await storage.createUser({
        username,
        password: randomPassword, // We won't use this for Firebase users
        firebaseId: uid,
        email: email || '',
        subscription: 'free'
      });
    }
    
    // Set user in req object
    req.user = user;
    req.isAuthenticated = () => true;
    
    next();
  } catch (error) {
    // If token verification fails, proceed to the next middleware
    // This allows falling back to session authentication
    console.error("Firebase token verification failed:", error);
    next();
  }
};