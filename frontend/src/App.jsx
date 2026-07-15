import React, { useState, useEffect } from 'react';
import { Activity, LayoutDashboard, Database } from 'lucide-react';
import { auth, googleProvider, githubProvider, isFirebaseConfigured, triggerMockLogin } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import Dashboard from './components/Dashboard';
import RepoDetails from './components/RepoDetails';

const Github = ({ size = 18, ...props }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Local Developer Auth Emulator Modal States
  const [showDevAuthModal, setShowDevAuthModal] = useState(false);
  const [devAuthProvider, setDevAuthProvider] = useState('google');
  const [devAuthName, setDevAuthName] = useState('Demo Developer');
  const [devAuthEmail, setDevAuthEmail] = useState('developer@example.com');
  const [devAuthAvatar, setDevAuthAvatar] = useState('');

  // Monitor Firebase Authentication state changes
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setUser({
            username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            avatarUrl: firebaseUser.photoURL || 'https://github.com/identicons/dummy.png',
            email: firebaseUser.email,
            idToken: idToken
          });
          localStorage.setItem('token', idToken);
        } catch (err) {
          console.error("Failed to retrieve ID Token:", err);
          setUser(null);
        }
      } else {
        setUser(null);
        localStorage.removeItem('token');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignInGoogle = async () => {
    if (!isFirebaseConfigured) {
      setDevAuthProvider('google');
      setDevAuthName('Demo Google Dev');
      setDevAuthEmail('google-dev@example.com');
      setDevAuthAvatar('https://lh3.googleusercontent.com/a/default-user=s96-c');
      setShowDevAuthModal(true);
      return;
    }
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google Sign-In Error:", err.message);
      setAuthLoading(false);
    }
  };

  const handleSignInGithub = async () => {
    if (!isFirebaseConfigured) {
      setDevAuthProvider('github');
      setDevAuthName('Demo GitHub Dev');
      setDevAuthEmail('github-dev@example.com');
      setDevAuthAvatar('https://avatars.githubusercontent.com/u/583231?v=4');
      setShowDevAuthModal(true);
      return;
    }
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, githubProvider);
    } catch (err) {
      console.error("GitHub Sign-In Error:", err.message);
      setAuthLoading(false);
    }
  };

  const handleDevAuthSubmit = async () => {
    setShowDevAuthModal(false);
    setAuthLoading(true);
    try {
      const avatarUrl = devAuthAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(devAuthName)}`;
      const token = await triggerMockLogin(devAuthProvider, devAuthName, devAuthEmail, avatarUrl);
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          username: payload.name,
          avatarUrl: payload.picture,
          email: payload.email,
          idToken: token
        });
        localStorage.setItem('token', token);
      }
    } catch (err) {
      console.error("Local Auth Emulator Login Error:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActivePage('dashboard');
      setSelectedRepo(null);
    } catch (err) {
      console.error("Sign-Out Error:", err.message);
    }
  };

  const handleSelectRepo = (owner, name) => {
    setSelectedRepo({ owner, name });
    setActivePage('repo-details');
  };

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="navbar">
        <div className="brand" onClick={() => { setActivePage('dashboard'); setSelectedRepo(null); }} style={{ cursor: 'pointer' }}>
          <Activity size={24} />
          <span>GitHub Analytics Platform</span>
        </div>

        <div className="nav-links">
          <button 
            className="btn btn-secondary" 
            style={{ 
              padding: '0.5rem 1rem', 
              fontSize: '0.85rem', 
              borderColor: activePage === 'dashboard' ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
              background: activePage === 'dashboard' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.03)'
            }}
            onClick={() => { setActivePage('dashboard'); setSelectedRepo(null); }}
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
          
          {authLoading ? (
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderLeftColor: 'var(--color-cyan)', animation: 'spin 1s linear infinite' }}></div>
          ) : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="user-profile-badge">
                <img src={user.avatarUrl} alt={user.username} className="user-avatar" />
                <span className="user-name">{user.username}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSignInGoogle} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Login with Google
              </button>
              <button onClick={handleSignInGithub} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <Github size={14} /> Login with GitHub
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Pages */}
      <main style={{ flex: 1 }}>
        {activePage === 'dashboard' ? (
          <Dashboard 
            user={user} 
            onSelectRepo={handleSelectRepo} 
            onLogout={handleLogout} 
            onSignInGoogle={handleSignInGoogle}
            onSignInGithub={handleSignInGithub}
            analyzing={analyzing}
            setAnalyzing={setAnalyzing}
            statusMessage={statusMessage}
            setStatusMessage={setStatusMessage}
          />
        ) : (
          selectedRepo && (
            <RepoDetails 
              owner={selectedRepo.owner} 
              repo={selectedRepo.name} 
              onBack={() => { setActivePage('dashboard'); setSelectedRepo(null); }} 
            />
          )
        )}
      </main>

      {/* Modern Footer */}
      <footer style={{ 
        padding: '2.5rem 2rem', 
        textAlign: 'center', 
        fontSize: '0.85rem', 
        color: 'var(--text-secondary)', 
        borderTop: '1px solid rgba(227, 115, 100, 0.08)', 
        background: 'rgba(253, 241, 238, 0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
          <Database size={14} />
          <span>Powered by React • Node.js • Python • Firebase • PostgreSQL</span>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          GitHub Analytics Platform &copy; 2026. Made with Firebase Auth popups & Google Gemini AI integration.
        </div>
      </footer>

      {/* Global Processing Loader */}
      {analyzing && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <h2 style={{ fontSize: '1.6rem', color: '#fff', background: 'linear-gradient(135deg, var(--color-cyan) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Analyzing Repository
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}>
            {statusMessage}
          </p>
          <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', height: '100%', width: '40%', background: 'linear-gradient(90deg, var(--color-cyan), var(--color-primary))', borderRadius: '2px', animation: 'loading-bar-sweep 1.5s infinite ease-in-out' }}></div>
          </div>
          <style>{`
            @keyframes loading-bar-sweep {
              0% { left: -40%; }
              100% { left: 100%; }
            }
          `}</style>
        </div>
      )}

      {/* Local Developer Auth Emulator Modal */}
      {showDevAuthModal && (
        <div className="loading-overlay" style={{ background: 'rgba(253, 241, 238, 0.92)', zIndex: 1050 }}>
          <div className="glass-card" style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--color-primary)', boxShadow: '0 15px 40px rgba(227, 115, 100, 0.18)' }}>
            <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(227, 115, 100, 0.1)', paddingBottom: '0.5rem', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Developer Auth Emulator
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Firebase keys are unconfigured. Use this popup to define your mock profile details locally.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Display Name</label>
              <input 
                type="text" 
                value={devAuthName} 
                onChange={(e) => setDevAuthName(e.target.value)} 
                className="form-input" 
                placeholder="e.g. John Doe"
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Email Address</label>
              <input 
                type="email" 
                value={devAuthEmail} 
                onChange={(e) => setDevAuthEmail(e.target.value)} 
                className="form-input" 
                placeholder="e.g. john@example.com"
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Avatar URL (Optional)</label>
              <input 
                type="text" 
                value={devAuthAvatar} 
                onChange={(e) => setDevAuthAvatar(e.target.value)} 
                className="form-input" 
                placeholder="Leave blank for generic seed avatar"
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleDevAuthSubmit} 
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Sign In
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowDevAuthModal(false)} 
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
