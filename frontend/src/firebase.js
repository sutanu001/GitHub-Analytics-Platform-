import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Check if credentials have been populated with actual values
export const isFirebaseConfigured = !!(apiKey && 
  apiKey !== 'your_firebase_api_key_here' && 
  apiKey.trim() !== '');

let authInstance = null;
let googleProviderInstance = null;
let githubProviderInstance = null;

if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    };
    
    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    
    googleProviderInstance = new GoogleAuthProvider();
    githubProviderInstance = new GithubAuthProvider();
    githubProviderInstance.addScope('repo');
    githubProviderInstance.addScope('read:user');
    
    console.log('Firebase SDK initialized successfully.');
  } catch (err) {
    console.error('Firebase initialization failed:', err);
  }
} else {
  console.log('Firebase is not configured. Running in local repository analysis (Guest) mode.');
}

export const triggerMockLogin = async (providerName, name, email, avatar) => {
  try {
    const response = await fetch('/api/auth/mock-firebase-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        provider: providerName,
        name: name,
        email: email,
        avatar: avatar
      })
    });
    if (response.ok) {
      const data = await response.json();
      return data.token;
    }
  } catch (err) {
    console.error("Local Auth Emulator Token Generation Error:", err);
  }
  return null;
};

export { authInstance as auth, googleProviderInstance as googleProvider, githubProviderInstance as githubProvider };

