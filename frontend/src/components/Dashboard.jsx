import React, { useState, useEffect } from 'react';
import { Search, GitBranch, Star, AlertCircle, Plus, LogOut, ArrowRight, Activity } from 'lucide-react';

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

export default function Dashboard({ user, onSelectRepo, onLogout, onSignInGoogle, onSignInGithub, analyzing, setAnalyzing, statusMessage, setStatusMessage }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newRepoLink, setNewRepoLink] = useState('');
  const [analysisError, setAnalysisError] = useState(null);
  
  // Profile Search States
  const [profileRepos, setProfileRepos] = useState([]);
  const [profileUsername, setProfileUsername] = useState('');

  // Fetch analyzed repositories
  const fetchRepos = async () => {
    try {
      const response = await fetch('/api/repos');
      if (response.ok) {
        const data = await response.json();
        setRepos(data);
      }
    } catch (err) {
      console.error("Failed to fetch repositories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!newRepoLink.trim()) return;

    setAnalyzing(true);
    setAnalysisError(null);
    setStatusMessage('Contacting GitHub API...');

    // Rotate status messages to keep user engaged during 5-15s analysis
    const statusInterval = setInterval(() => {
      const messages = [
        'Fetching repository details...',
        'Parsing commit history...',
        'Calculating code churn trends...',
        'Reviewing Pull Request statistics...',
        'Consulting Google Gemini for AI Code Review...',
        'Generating architecture summaries...',
        'Computing Repository Health Score...',
        'Saving metrics to PostgreSQL database...'
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setStatusMessage(randomMsg);
    }, 2000);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/repos/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ link: newRepoLink })
      });

      const result = await response.json();
      clearInterval(statusInterval);

      if (response.ok) {
        setNewRepoLink('');
        if (result.status === 'profile_repos') {
          setAnalyzing(false);
          setProfileRepos(result.repos);
          setProfileUsername(result.username);
        } else {
          setProfileRepos([]);
          setProfileUsername('');
          // Refresh list
          await fetchRepos();
          // Automatically open the analyzed repo
          if (result.repo) {
            onSelectRepo(result.repo.owner, result.repo.name);
          }
        }
      } else {
        setAnalyzing(false);
        setAnalysisError(result.error || 'Failed to analyze repository. Check that it exists and is public.');
      }
    } catch (err) {
      clearInterval(statusInterval);
      setAnalyzing(false);
      setAnalysisError('Network error. Is the server running?');
    }
  };

  const handleSelectProfileRepo = async (repoName) => {
    setAnalyzing(true);
    setAnalysisError(null);
    setStatusMessage(`Triggering real-time Git analysis for ${repoName}...`);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/repos/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ owner: profileUsername, repo: repoName })
      });

      const result = await response.json();
      if (response.ok) {
        setProfileUsername('');
        setProfileRepos([]);
        await fetchRepos();
        if (result.repo) {
          onSelectRepo(result.repo.owner, result.repo.name);
        }
      } else {
        setAnalysisError(result.error || 'Failed to analyze repository.');
      }
    } catch (err) {
      setAnalysisError('Network error. Is the server running?');
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.owner.toLowerCase().includes(search.toLowerCase()) ||
    (repo.main_language && repo.main_language.toLowerCase().includes(search.toLowerCase()))
  );

  // Helper to render health gauge circle
  const renderHealthGauge = (score) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    let colorClass = "health-high";
    if (score < 50) colorClass = "health-low";
    else if (score < 80) colorClass = "health-medium";

    return (
      <div className="health-score-container">
        <svg width="100" height="100" className="health-svg">
          <circle cx="50" cy="50" r={radius} className="health-bg" />
          <circle 
            cx="50" 
            cy="50" 
            r={radius} 
            className={`health-bar ${colorClass}`}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="health-score-value">
          <span>{score}</span>
          <span className="health-score-label">Health</span>
        </div>
      </div>
    );
  };

  return (
    <div className="main-content fade-in">
      {/* Upper Panel: Connect GitHub Account & Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', marginBottom: '3rem', alignItems: 'stretch' }} className="grid-cols-2">
        {/* User Card / Login Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src={user.avatarUrl} alt={user.username} style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--color-cyan)', boxShadow: 'var(--glow-cyan)' }} />
                <div>
                  <h2 style={{ fontSize: '1.4rem' }}>Welcome, {user.username}!</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-green)' }}>GitHub Connected</p>
                </div>
              </div>
              <p style={{ fontSize: '0.95rem' }}>You can now analyze private repositories and enjoy higher rate limits directly linked to your GitHub account.</p>
              <button onClick={onLogout} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
                <LogOut size={16} /> Disconnect Account
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Connect Developer Account
              </h2>
              <p style={{ fontSize: '0.95rem' }}>
                Authenticate to analyze private repositories, save project metrics, and access developer insights.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={onSignInGoogle} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  Login with Google
                </button>
                <button onClick={onSignInGithub} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Github size={16} /> Login with GitHub
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Analyze Form */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: 'var(--color-cyan)' }} /> Analyze Repository or Profile
          </h2>
          <p style={{ fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            Paste a repository link (e.g. <code>facebook/react</code>) or paste any GitHub profile URL (e.g. <code>https://github.com/AdityaJ7</code>) to load its public repositories.
          </p>
          <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Paste repo link, profile link, or user name..." 
                value={newRepoLink} 
                onChange={(e) => setNewRepoLink(e.target.value)}
                className="form-input"
                style={{ paddingRight: '3rem' }}
                disabled={analyzing}
              />
              <button 
                type="submit" 
                className="btn btn-cyan" 
                style={{ position: 'absolute', right: '4px', top: '4px', bottom: '4px', padding: '0.5rem 1rem', borderRadius: '8px' }}
                disabled={analyzing}
              >
                <Plus size={16} />
              </button>
            </div>
            {analysisError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-red)', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertCircle size={16} />
                <span>{analysisError}</span>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Lower Panel: Repositories List */}
      <div>
        {profileUsername ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Public Repositories for @{profileUsername}</h2>
                <p style={{ fontSize: '0.95rem' }}>Select a repository to start deep analysis</p>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setProfileUsername(''); setProfileRepos([]); }}
              >
                Back to Catalog
              </button>
            </div>
            
            {profileRepos.length === 0 ? (
              <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No public repositories found for this GitHub account.</p>
              </div>
            ) : (
              <div className="dashboard-grid">
                {profileRepos.map((repo, idx) => (
                  <div 
                    key={idx} 
                    className="glass-card repo-card" 
                    onClick={() => handleSelectProfileRepo(repo.name)}
                    style={{ cursor: 'pointer', height: '200px' }}
                  >
                    <div className="repo-card-header" style={{ marginBottom: 0, width: '100%' }}>
                      <div style={{ width: '100%' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '260px' }} title={repo.name}>
                          {repo.name}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.75rem' }}>
                          {repo.description || 'No description provided.'}
                        </p>
                        {repo.language && (
                          <span className="repo-badge">{repo.language}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="repo-stats">
                      <div className="repo-stat-item">
                        <Star size={14} style={{ fill: 'rgba(255,255,255,0.1)' }} />
                        <span>{repo.stars.toLocaleString()}</span>
                      </div>
                      <div className="repo-stat-item">
                        <GitBranch size={14} />
                        <span>{repo.forks.toLocaleString()}</span>
                      </div>
                      <div className="repo-stat-item" style={{ marginLeft: 'auto', color: 'var(--color-cyan)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Analyze</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Analyzed Repositories</h2>
                <p style={{ fontSize: '0.95rem' }}>Select a repository to view deep metrics and AI analysis</p>
              </div>
              <div style={{ marginLeft: 'auto', position: 'relative', width: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search repositories..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading repositories...</p>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Search size={48} style={{ strokeWidth: 1, marginBottom: '1rem', color: 'var(--text-muted)' }} />
                <h3>No Repositories Found</h3>
                <p style={{ marginTop: '0.25rem', fontSize: '0.95rem' }}>
                  {search ? "Try adjusting your search terms" : "Paste a GitHub URL or username above to analyze your first repository!"}
                </p>
              </div>
            ) : (
              <div className="dashboard-grid">
                {filteredRepos.map((repo) => (
                  <div 
                    key={repo.id} 
                    className="glass-card repo-card" 
                    onClick={() => onSelectRepo(repo.owner, repo.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="repo-card-header">
                      <div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px' }}>
                          {repo.name}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          by {repo.owner}
                        </p>
                        {repo.main_language && (
                          <span className="repo-badge">{repo.main_language}</span>
                        )}
                      </div>
                      {renderHealthGauge(repo.health_score)}
                    </div>

                    <div className="repo-stats">
                      <div className="repo-stat-item">
                        <Star size={14} style={{ fill: 'rgba(255,255,255,0.1)' }} />
                        <span>{repo.stars.toLocaleString()}</span>
                      </div>
                      <div className="repo-stat-item">
                        <GitBranch size={14} />
                        <span>{repo.forks.toLocaleString()}</span>
                      </div>
                      <div className="repo-stat-item" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Analyzed {new Date(repo.last_analyzed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
