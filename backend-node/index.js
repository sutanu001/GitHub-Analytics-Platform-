const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'github_analytics_super_secret_key_123';

// String to Integer Hashing helper for PostgreSQL UID matching
function hashCode(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully via Service Account JSON.');
  } catch (err) {
    console.error('Failed to load Firebase service account JSON:', err.message);
  }
} else {
  try {
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized using default application credentials.');
  } catch (err) {
    console.log('Firebase Admin SDK: No valid credentials found. Using JWT decode fallback mode.');
  }
}

// Express Middleware
app.use(cors());
app.use(express.json());

// Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/github_analytics'
});

let dbAvailable = false;

const DB_JSON_PATH = path.join(__dirname, 'database.json');

function readLocalDatabaseJson() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    return { repos: [], users: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));
  } catch (err) {
    return { repos: [], users: [] };
  }
}

function writeLocalDatabaseJson(data) {
  try {
    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write to database.json:', err.message);
  }
}

function saveToLocalDatabaseJson(analysisResult) {
  const db = readLocalDatabaseJson();
  
  const newRepo = {
    id: db.repos.length + 1,
    owner: analysisResult.repo.owner,
    name: analysisResult.repo.name,
    url: analysisResult.repo.url,
    health_score: analysisResult.repo.health_score,
    stars: analysisResult.repo.stars,
    forks: analysisResult.repo.forks,
    open_issues: analysisResult.repo.open_issues,
    main_language: analysisResult.repo.main_language,
    last_analyzed_at: new Date().toISOString(),
    is_public: analysisResult.repo.is_public,
    commits: analysisResult.commits,
    pullRequests: analysisResult.pull_requests,
    languages: Object.entries(analysisResult.languages).map(([lang, bytes]) => ({ language: lang, bytes })),
    aiSummary: analysisResult.ai_summary
  };
  
  db.repos = db.repos.filter(r => 
    !(r.owner.toLowerCase() === newRepo.owner.toLowerCase() && r.name.toLowerCase() === newRepo.name.toLowerCase())
  );
  
  db.repos.unshift(newRepo);
  writeLocalDatabaseJson(db);
}


// Test DB connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('PostgreSQL Connection Error:', err.message);
    console.log('--- DB FALLBACK ENABLED: Express will serve mock data for preview purposes ---');
    dbAvailable = false;
  } else {
    console.log('PostgreSQL Connected successfully:', res.rows[0].now);
    dbAvailable = true;
  }
});

// Helper: Firebase Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });
  
  try {
    let firebaseUser;
    
    // Check if Firebase Admin is initialized
    if (admin.apps.length > 0) {
      firebaseUser = await admin.auth().verifyIdToken(token);
    } else {
      // Fallback: decode token claims directly for preview validation
      firebaseUser = jwt.decode(token);
      if (!firebaseUser) {
        return res.status(403).json({ error: 'Invalid token structure' });
      }
      // Standard Firebase fields mapped from JWT claims
      firebaseUser.uid = firebaseUser.sub;
      firebaseUser.name = firebaseUser.name || firebaseUser.email.split('@')[0];
      firebaseUser.picture = firebaseUser.picture || 'https://github.com/identicons/dummy.png';
    }
    
    // Sync user details to our PostgreSQL database
    let userId = 1;
    if (dbAvailable) {
      const dbUserHash = hashCode(firebaseUser.uid);
      const dbResult = await pool.query(`
        INSERT INTO users (github_id, username, email, avatar_url, access_token, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (github_id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url,
          access_token = EXCLUDED.access_token,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id;
      `, [
        dbUserHash,
        firebaseUser.name,
        firebaseUser.email || '',
        firebaseUser.picture,
        token
      ]);
      userId = dbResult.rows[0].id;
    }
    
    req.user = {
      id: userId,
      username: firebaseUser.name,
      avatarUrl: firebaseUser.picture,
      email: firebaseUser.email,
      uid: firebaseUser.uid
    };
    
    next();
  } catch (err) {
    console.error('Firebase Auth verification error:', err.message);
    res.status(403).json({ error: 'Invalid or expired authentication token' });
  }
};


// ==========================================
// MOCK DATA GENERATOR & HANDLERS
// ==========================================
const mockReposList = [
  {
    id: 1,
    owner: 'facebook',
    name: 'react',
    url: 'https://github.com/facebook/react',
    health_score: 94,
    stars: 224000,
    forks: 46100,
    open_issues: 1250,
    main_language: 'JavaScript',
    last_analyzed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    is_public: true
  },
  {
    id: 2,
    owner: 'tensorflow',
    name: 'tensorflow',
    url: 'https://github.com/tensorflow/tensorflow',
    health_score: 87,
    stars: 182000,
    forks: 89000,
    open_issues: 3400,
    main_language: 'Python',
    last_analyzed_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    is_public: true
  }
];

const generateMockCommits = (owner, repo) => {
  const authors = [
    { name: 'Dan Abramov', avatar: 'https://avatars.githubusercontent.com/u/810438?v=4' },
    { name: 'Sophie Alpert', avatar: '' },
    { name: 'Andrew Clark', avatar: '' },
    { name: 'Sarah Drasner', avatar: 'https://avatars.githubusercontent.com/u/2281088?v=4' }
  ];
  const commits = [];
  const now = Date.now();
  for (let i = 0; i < 25; i++) {
    const author = authors[i % authors.length];
    const additions = Math.floor(Math.random() * 500) + 15;
    const deletions = Math.floor(Math.random() * 400) + 5;
    const date = new Date(now - (i * 3600000 * 16));
    
    commits.push({
      author_name: author.name,
      author_email: `${author.name.toLowerCase().replace(' ', '')}@example.com`,
      author_avatar: author.avatar,
      message: i === 0 ? `Optimize core loop and virtual DOM reconciler for ${repo}` : `Refactor ${repo} directory, fix tests and warnings`,
      additions,
      deletions,
      committed_at: date.toISOString(),
      commit_hash: Math.random().toString(16).substring(2, 14)
    });
  }
  return commits;
};

const generateMockPrs = (owner, repo) => {
  const prs = [];
  const states = ['merged', 'open', 'closed', 'merged'];
  const authors = ['dwight_schru', 'jim_halp', 'pam_bees', 'angela_m'];
  const now = Date.now();
  for (let i = 1; i <= 15; i++) {
    const state = states[i % states.length];
    const created = new Date(now - (i * 3600000 * 48));
    const closed = state !== 'open' ? new Date(created.getTime() + (Math.random() * 3600000 * 72)) : null;
    prs.push({
      number: 1400 + i,
      title: `Merge feature update ${i}: refactor hooks interface in ${repo}`,
      author: authors[i % authors.length],
      state,
      created_at: created.toISOString(),
      closed_at: closed ? closed.toISOString() : null,
      merged_at: state === 'merged' && closed ? closed.toISOString() : null,
      comments_count: Math.floor(Math.random() * 12),
      reviews_count: Math.floor(Math.random() * 4)
    });
  }
  return prs;
};

const generateMockLanguages = (owner, repo) => {
  if (repo.toLowerCase() === 'react') {
    return [
      { language: 'JavaScript', bytes: 1400000 },
      { language: 'HTML', bytes: 150000 },
      { language: 'TypeScript', bytes: 85000 },
      { language: 'CSS', bytes: 45000 }
    ];
  }
  return [
    { language: 'Python', bytes: 2400000 },
    { language: 'C++', bytes: 1200000 },
    { language: 'C', bytes: 450000 },
    { language: 'Go', bytes: 150000 }
  ];
};

const generateMockAiSummary = (owner, repo) => {
  return {
    summary_text: `This is a high-fidelity repository analysis for ${owner}/${repo}. The project serves as an industry-standard framework and tool library widely implemented in production configurations globally. It establishes structured conventions for components, runtime safety, and developer velocity.`,
    architecture_analysis: `Project Folder Map Structure:\n- /src: Contains components, context bindings, and logic hooks.\n- /tests: Features comprehensive unit test definitions.\n- /docs: Houses development logs and setup templates.\n\nTechnological review: Runs modern compilers, build configurations, and bundling workflows. Component trees are decoupled to ensure scale, while context APIs manage data propagation.`,
    recommendations: JSON.stringify([
      "Boost code coverage by integrating automation test cases in Suspense hooks.",
      "Optimize compiler configurations to trim down the production build bundle footprint.",
      "Review dependabot notifications and audit outdated packages in package.json/requirements.txt."
    ])
  };
};

// ==========================================
// AUTHENTICATION & OAUTH ROUTES
// ==========================================

// 1. Firebase Authentication endpoints (popups negotiated client-side)
// Session verified in Express middleware


// 3. Get Authenticated User Info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    avatarUrl: req.user.avatarUrl
  });
});

// 4. Developer Auth Emulator Token Generator
app.post('/api/auth/mock-firebase-token', (req, res) => {
  const { provider, name, email, avatar } = req.body;
  const mockUid = `mock-uid-${provider || 'developer'}-${Math.floor(Math.random() * 100000)}`;
  
  const mockUserPayload = {
    sub: mockUid,
    name: name || 'Demo Developer',
    email: email || 'developer@example.com',
    picture: avatar || 'https://avatars.githubusercontent.com/u/583231?v=4',
    iss: 'https://securetoken.google.com/github-analytics-platform',
    aud: 'github-analytics-platform',
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24
  };
  
  const token = jwt.sign(mockUserPayload, JWT_SECRET);
  res.json({ token });
});


// ==========================================
// REPOSITORY METRICS & ANALYTICS API
// ==========================================

// 1. Get List of Analyzed Repositories
app.get('/api/repos', async (req, res) => {
  const useMockData = process.env.MOCK_DATA === 'true';
  if (!dbAvailable) {
    if (useMockData) {
      return res.json(mockReposList);
    } else {
      // JSON File Fallback
      const db = readLocalDatabaseJson();
      return res.json(db.repos.map(r => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        url: r.url,
        health_score: r.health_score,
        stars: r.stars,
        forks: r.forks,
        main_language: r.main_language,
        last_analyzed_at: r.last_analyzed_at
      })));
    }
  }
  
  try {
    const result = await pool.query(`
      SELECT id, owner, name, url, health_score, stars, forks, open_issues, main_language, last_analyzed_at
      FROM analyzed_repositories
      ORDER BY last_analyzed_at DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    if (useMockData) {
      console.log('Query failed, falling back to mock database list.');
      return res.json(mockReposList);
    }
    console.error('Database connection error in /api/repos:', error.message);
    res.status(500).json({ error: 'Database query failed. Ensure PostgreSQL is configured and running.' });
  }
});

// 2. Get Full Details of a Specific Repository
app.get('/api/repos/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;
  const useMockData = process.env.MOCK_DATA === 'true';
  
  if (!dbAvailable) {
    if (useMockData) {
      const meta = mockReposList.find(r => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase()) || {
        owner,
        name: repo,
        url: `https://github.com/${owner}/${repo}`,
        health_score: 82,
        stars: 5400,
        forks: 1200,
        open_issues: 98,
        main_language: 'TypeScript',
        last_analyzed_at: new Date().toISOString(),
        is_public: true
      };
      return res.json({
        meta,
        commits: generateMockCommits(owner, repo),
        pullRequests: generateMockPrs(owner, repo),
        languages: generateMockLanguages(owner, repo),
        aiSummary: generateMockAiSummary(owner, repo)
      });
    } else {
      // JSON File Fallback
      const db = readLocalDatabaseJson();
      const found = db.repos.find(r => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase());
      if (found) {
        return res.json({
          meta: {
            id: found.id,
            owner: found.owner,
            name: found.name,
            url: found.url,
            health_score: found.health_score,
            stars: found.stars,
            forks: found.forks,
            open_issues: found.open_issues,
            main_language: found.main_language,
            last_analyzed_at: found.last_analyzed_at,
            is_public: found.is_public
          },
          commits: found.commits,
          pullRequests: found.pullRequests,
          languages: found.languages,
          aiSummary: found.aiSummary
        });
      }
      return res.status(404).json({ error: 'Repository analysis not found. Please click Analyze first.' });
    }
  }
  
  try {
    const repoResult = await pool.query(
      `SELECT * FROM analyzed_repositories WHERE owner = $1 AND name = $2`,
      [owner, repo]
    );
    
    if (repoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Repository analysis not found in database. Please perform an analysis first.' });
    }
    
    const repoData = repoResult.rows[0];
    const repoId = repoData.id;
    
    const commitsResult = await pool.query(
      `SELECT author_name, author_email, author_avatar, message, additions, deletions, committed_at, commit_hash 
       FROM commit_analytics 
       WHERE repo_id = $1 
       ORDER BY committed_at DESC`,
      [repoId]
    );
    
    const prsResult = await pool.query(
      `SELECT number, title, author, state, created_at, closed_at, merged_at, comments_count, reviews_count 
       FROM pull_requests 
       WHERE repo_id = $1 
       ORDER BY created_at DESC`,
      [repoId]
    );
    
    const languagesResult = await pool.query(
      `SELECT language, bytes FROM repository_languages WHERE repo_id = $1 ORDER BY bytes DESC`,
      [repoId]
    );
    
    const summaryResult = await pool.query(
      `SELECT summary_text, architecture_analysis, recommendations FROM ai_summaries WHERE repo_id = $1`,
      [repoId]
    );
    
    res.json({
      meta: repoData,
      commits: commitsResult.rows,
      pullRequests: prsResult.rows,
      languages: languagesResult.rows,
      aiSummary: summaryResult.rows[0] || null
    });
    
  } catch (error) {
    if (useMockData) {
      console.error('Error fetching repo details, falling back to mocks:', error.message);
      return res.json({
        meta: { owner, name: repo, url: `https://github.com/${owner}/${repo}`, health_score: 80, stars: 1500, forks: 250, open_issues: 12, main_language: 'JavaScript', last_analyzed_at: new Date().toISOString() },
        commits: generateMockCommits(owner, repo),
        pullRequests: generateMockPrs(owner, repo),
        languages: generateMockLanguages(owner, repo),
        aiSummary: generateMockAiSummary(owner, repo)
      });
    }
    console.error('Database error in /api/repos/:owner/:repo:', error.message);
    res.status(500).json({ error: `Database query failed: ${error.message}` });
  }
});


// Helper: Parse GitHub URL or Shorthand
function parseGitHubUrl(urlOrShorthand) {
  if (!urlOrShorthand) return null;
  const cleanUrl = urlOrShorthand.trim().replace(/\/$/, ""); // strip trailing slash
  
  // 1. Check for standard HTTP/HTTPS URLs
  const httpMatch = cleanUrl.match(/github\.com\/([^\/]+)(?:\/([^\/]+))?/);
  if (httpMatch) {
    const part1 = httpMatch[1];
    const part2 = httpMatch[2];
    
    // Ignore common system routes
    const systemRoutes = ['settings', 'notifications', 'explore', 'trending', 'pulls', 'issues', 'marketplace'];
    if (systemRoutes.includes(part1.toLowerCase())) return null;

    if (part2) {
      return {
        type: 'repo',
        owner: part1,
        repo: part2.replace(/\.git$/, "").split('/')[0]
      };
    } else {
      return {
        type: 'profile',
        username: part1
      };
    }
  }
  
  // 2. Check for SSH URLs
  const sshMatch = cleanUrl.match(/github\.com[:\/]([^\/]+)\/([^\/]+)/);
  if (sshMatch) {
    return {
      type: 'repo',
      owner: sshMatch[1],
      repo: sshMatch[2].replace(/\.git$/, "").split('/')[0]
    };
  }
  
  // 3. Check for owner/repo shorthand (contains exactly one slash)
  const shorthandMatch = cleanUrl.match(/^([^\/]+)\/([^\/]+)$/);
  if (shorthandMatch && !cleanUrl.includes(':') && !cleanUrl.startsWith('http')) {
    return {
      type: 'repo',
      owner: shorthandMatch[1],
      repo: shorthandMatch[2].replace(/\.git$/, "")
    };
  }
  
  // 4. Check for single username shorthand (no slashes, no colons, not starting with http)
  const usernameMatch = cleanUrl.match(/^([a-zA-Z0-9\-]+)$/);
  if (usernameMatch && !cleanUrl.startsWith('http')) {
    return {
      type: 'profile',
      username: cleanUrl
    };
  }
  
  return null;
}

// 3. Trigger Repository Analysis
app.post('/api/repos/analyze', async (req, res) => {
  const { owner, repo, link } = req.body;
  const useMockData = process.env.MOCK_DATA === 'true';
  
  let repoOwner = owner;
  let repoName = repo;
  
  // Get token/session headers for authentication
  let userToken = null;
  let userId = null;
  
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userToken = decoded.githubToken;
        userId = decoded.id;
      } catch (err) {}
    }
  }
  
  if (link) {
    const parsed = parseGitHubUrl(link);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid GitHub URL format. Please paste a standard GitHub link, a profile link, or use the "owner/repo" shorthand.' });
    }
    
    if (parsed.type === 'profile') {
      // Fetch repositories list for this profile
      try {
        const token = userToken || process.env.GITHUB_TOKEN;
        const headers = { 
          'User-Agent': 'github-analytics-platform',
          'Accept': 'application/vnd.github.v3+json'
        };
        if (token) {
          headers['Authorization'] = `token ${token}`;
        }
        
        console.log(`Fetching repositories list for user: ${parsed.username}`);
        const githubUrl = `https://api.github.com/users/${parsed.username}/repos?per_page=60&sort=updated`;
        const response = await axios.get(githubUrl, { headers });
        
        return res.json({
          status: 'profile_repos',
          username: parsed.username,
          repos: response.data.map(r => ({
            name: r.name,
            owner: r.owner.login,
            description: r.description,
            stars: r.stargazers_count,
            forks: r.forks_count,
            language: r.language,
            url: r.html_url
          }))
        });
      } catch (err) {
        console.error('Failed to fetch user repositories:', err.message);
        const statusCode = err.response ? err.response.status : 500;
        
        // Dynamic Fallback: If rate limited (403/429) or server is down/offline, serve preview repositories
        if (statusCode === 403 || statusCode === 429 || statusCode === 500) {
          console.log(`[Rate Limit / Offline Fallback] Serving preview repository list for developer: "${parsed.username}"`);
          return res.json({
            status: 'profile_repos',
            username: parsed.username,
            repos: [
              {
                name: 'react-portfolio-dashboard',
                owner: parsed.username,
                description: 'A modern, responsive developer portfolio with custom peach-coral themes and SVG indicators.',
                stars: 34,
                forks: 7,
                language: 'JavaScript',
                url: `https://github.com/${parsed.username}/react-portfolio-dashboard`
              },
              {
                name: 'node-express-boiler',
                owner: parsed.username,
                description: 'A lightweight Node.js Express backend framework featuring secure JWT token controls.',
                stars: 19,
                forks: 4,
                language: 'JavaScript',
                url: `https://github.com/${parsed.username}/node-express-boiler`
              },
              {
                name: 'python-data-analyzer',
                owner: parsed.username,
                description: 'Statistical engine parsing structural code patterns and running local heuristics review reports.',
                stars: 28,
                forks: 6,
                language: 'Python',
                url: `https://github.com/${parsed.username}/python-data-analyzer`
              },
              {
                name: 'dockerized-postgres-db',
                owner: parsed.username,
                description: 'Zero-dependency template schema mapping relational SQL files via custom Docker images.',
                stars: 12,
                forks: 2,
                language: 'HTML',
                url: `https://github.com/${parsed.username}/dockerized-postgres-db`
              }
            ]
          });
        }
        
        const message = statusCode === 404 
          ? `GitHub profile "${parsed.username}" not found. Check the spelling.` 
          : `Failed to fetch repositories for "${parsed.username}" (Rate limit exceeded or GitHub server down)`;
        return res.status(statusCode === 404 ? 404 : 500).json({ error: message });
      }
    } else {
      repoOwner = parsed.owner;
      repoName = parsed.repo;
    }
  }
  
  if (!repoOwner || !repoName) {
    return res.status(400).json({ error: 'Repository owner and name are required' });
  }


  // If DB is offline
  if (!dbAvailable) {
    if (useMockData) {
      console.log(`[MOCK MODE] Analyzing ${repoOwner}/${repoName} in background...`);
      setTimeout(() => {
        const exists = mockReposList.find(r => r.owner.toLowerCase() === repoOwner.toLowerCase() && r.name.toLowerCase() === repoName.toLowerCase());
        if (!exists) {
          mockReposList.unshift({
            id: mockReposList.length + 1,
            owner: repoOwner,
            name: repoName,
            url: `https://github.com/${repoOwner}/${repoName}`,
            health_score: Math.floor(Math.random() * 30) + 70, // 70-100
            stars: Math.floor(Math.random() * 50000) + 100,
            forks: Math.floor(Math.random() * 15000) + 20,
            open_issues: Math.floor(Math.random() * 800),
            main_language: 'TypeScript',
            last_analyzed_at: new Date().toISOString(),
            is_public: true
          });
        }
      }, 2000);
      
      return setTimeout(() => {
        res.json({
          status: 'success',
          message: 'Repository mock-analyzed successfully',
          repo: { owner: repoOwner, name: repoName }
        });
      }, 2500);
    } else {
      // REAL analysis with Local JSON database fallback!
      console.log(`[JSON FALLBACK MODE] Triggering real Python analyzer for ${repoOwner}/${repoName}...`);
      const pythonScript = path.join(__dirname, '..', 'backend-python', 'analyzer.py');
      let command = `python "${pythonScript}" --owner "${repoOwner}" --repo "${repoName}"`;
      if (userToken) command += ` --token "${userToken}"`;
      if (userId) command += ` --user-id ${userId}`;
      
      console.log(`Executing analyzer: ${command}`);
      
      return exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Analyzer Error: ${error.message}`);
          return res.status(500).json({ 
            error: 'Analysis failed. Make sure the repository exists and is accessible.',
            details: stderr || error.message
          });
        }
        
        const startMarker = '--- JSON_RESULT_START ---';
        const endMarker = '--- JSON_RESULT_END ---';
        
        if (stdout.includes(startMarker) && stdout.includes(endMarker)) {
          const jsonString = stdout.substring(
            stdout.indexOf(startMarker) + startMarker.length,
            stdout.indexOf(endMarker)
          ).trim();
          
          try {
            const parsedData = JSON.parse(jsonString);
            saveToLocalDatabaseJson(parsedData);
            
            return res.json({
              status: 'success',
              message: 'Repository analyzed successfully (saved locally)',
              repo: parsedData.repo
            });
          } catch (err) {
            console.error('Failed to parse Python analyzer output:', err.message);
            return res.status(500).json({ error: 'Analysis succeeded but output parsing failed' });
          }
        } else {
          console.error('Python analyzer finished but did not return JSON data. Output:', stdout);
          return res.status(500).json({ error: 'Analysis failed. Verify your database connection or try again.' });
        }
      });
    }
  }

  
  const pythonScript = path.join(__dirname, '..', 'backend-python', 'analyzer.py');
  let command = `python "${pythonScript}" --owner "${repoOwner}" --repo "${repoName}"`;
  if (userToken) command += ` --token "${userToken}"`;
  if (userId) command += ` --user-id ${userId}`;
  
  console.log(`Executing analyzer: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Analyzer Error: ${error.message}`);
      return res.status(500).json({ 
        error: 'Analysis failed. Make sure the repository exists and is accessible.',
        details: stderr || error.message
      });
    }
    
    pool.query(
      `SELECT * FROM analyzed_repositories WHERE owner = $1 AND name = $2`,
      [repoOwner, repoName],
      (err, result) => {
        if (err || result.rows.length === 0) {
          return res.status(500).json({ error: 'Analysis finished but database query failed.' });
        }
        res.json({
          status: 'success',
          message: 'Repository analyzed successfully',
          repo: result.rows[0]
        });
      }
    );
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Node.js Express Server running on http://localhost:${PORT}`);
});
