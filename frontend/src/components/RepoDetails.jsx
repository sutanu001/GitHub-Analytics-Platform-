import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, ArrowRight, Star, GitBranch, AlertCircle, Calendar, RefreshCw, 
  GitPullRequest, Code, BarChart2, Users, Brain, Activity, Plus, Minus
} from 'lucide-react';

export default function RepoDetails({ owner, repo, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDetails = async () => {
    try {
      const response = await fetch(`/api/repos/${owner}/${repo}`);
      if (response.ok) {
        const json = await response.json();
        setData(json);
      } else {
        const errJson = await response.json();
        setError(errJson.error || 'Failed to fetch repository details');
      }
    } catch (err) {
      setError('Failed to reach Node.js API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [owner, repo]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/repos/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ owner, repo })
      });
      if (response.ok) {
        await fetchDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Compiling Git metrics and AI reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-content fade-in">
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-red)', marginBottom: '1rem' }} />
          <h2>Error Loading Repository Details</h2>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={onBack} className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { meta, commits, pullRequests, languages, aiSummary } = data;

  // Calculate high level summaries
  const totalCommits = commits.length;
  const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);
  const totalChurn = totalAdditions + totalDeletions;
  
  // Contributor stats
  const contributorMap = {};
  commits.forEach(c => {
    const key = c.author_name;
    if (!contributorMap[key]) {
      contributorMap[key] = {
        name: c.author_name,
        email: c.author_email,
        avatar: c.author_avatar,
        count: 0,
        additions: 0,
        deletions: 0
      };
    }
    contributorMap[key].count += 1;
    contributorMap[key].additions += c.additions;
    contributorMap[key].deletions += c.deletions;
  });
  
  const contributors = Object.values(contributorMap).sort((a, b) => b.count - a.count);

  // PR analytics
  const prsCount = pullRequests.length;
  const mergedPrs = pullRequests.filter(pr => pr.state === 'merged');
  const openPrs = pullRequests.filter(pr => pr.state === 'open');
  const closedPrs = pullRequests.filter(pr => pr.state === 'closed');
  
  // Calculate average cycle time for merged PRs
  let avgMergeTimeHours = 0;
  if (mergedPrs.length > 0) {
    const totalHours = mergedPrs.reduce((sum, pr) => {
      const created = new Date(pr.created_at);
      const merged = new Date(pr.merged_at);
      return sum + (merged - created) / (1000 * 60 * 60);
    }, 0);
    avgMergeTimeHours = Math.round(totalHours / mergedPrs.length);
  }

  // Parse Recommendations array
  let recommendations = [];
  try {
    recommendations = aiSummary && aiSummary.recommendations ? JSON.parse(aiSummary.recommendations) : [];
  } catch (err) {
    recommendations = [];
  }

  // Define standard colors for top languages
  const getLanguageColor = (lang) => {
    const colors = {
      javascript: '#f1e05a',
      typescript: '#3178c6',
      python: '#3572a5',
      html: '#e34c26',
      css: '#563d7c',
      go: '#00add8',
      rust: '#dea584',
      java: '#b07219',
      cpp: '#f34b7d',
      ruby: '#701516',
      php: '#4f5d95'
    };
    return colors[lang.toLowerCase()] || '#8b5cf6';
  };

  // 1. RENDER OVERVIEW TAB
  const renderOverviewTab = () => {
    // Health score color
    let healthColor = 'var(--color-green)';
    if (meta.health_score < 50) healthColor = 'var(--color-red)';
    else if (meta.health_score < 80) healthColor = 'var(--color-orange)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="fade-in">
        {/* Top Cards: Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1.5rem' }} className="grid-cols-2">
          {/* Health Score Overview */}
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div className="health-score-container" style={{ width: '130px', height: '130px' }}>
              <svg width="120" height="120" className="health-svg">
                <circle cx="60" cy="60" r="48" className="health-bg" style={{ strokeWidth: 12 }} />
                <circle 
                  cx="60" 
                  cy="60" 
                  r="48" 
                  className={`health-bar`}
                  style={{
                    strokeWidth: 12,
                    stroke: healthColor,
                    strokeDasharray: 2 * Math.PI * 48,
                    strokeDashoffset: (2 * Math.PI * 48) - (meta.health_score / 100) * (2 * Math.PI * 48),
                    filter: `drop-shadow(0 0 8px ${healthColor})`
                  }}
                />
              </svg>
              <div className="health-score-value" style={{ fontSize: '2.2rem' }}>
                <span>{meta.health_score}</span>
                <span className="health-score-label">Health Score</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <h3 style={{ fontSize: '1.3rem' }}>Code Quality Review</h3>
              <p style={{ fontSize: '0.9rem' }}>
                {meta.health_score >= 80 ? 'Excellent standards. Strong commit cadence, robust metadata, and low PR turnaround delay.' :
                 meta.health_score >= 50 ? 'Good standing. Average issue responsiveness. Adding tests, README structure, or licenses could boost your score.' :
                 'Critical attention needed. Inactive timeline, high open issues ratio, or minimal repository documentation.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Contributors</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-cyan)' }}>{contributors.length}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>developers</span>
            </div>
            <p style={{ fontSize: '0.85rem' }}>Commit history is parsed across the latest active logs.</p>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Churn Stats</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{totalChurn.toLocaleString()}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>lines changed</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              <span className="churn-add" style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}><Plus size={12}/> {totalAdditions.toLocaleString()}</span>
              <span className="churn-del" style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}><Minus size={12}/> {totalDeletions.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Lower row: AI Summary block & Language Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }} className="grid-cols-2">
          {/* AI Code Summary preview */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={20} style={{ color: 'var(--color-primary)' }} /> AI Repository Summary
            </h3>
            {aiSummary ? (
              <>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 7, WebkitBoxOrient: 'vertical' }}>
                  {aiSummary.summary_text}
                </p>
                <button 
                  onClick={() => setActiveTab('ai_summary')} 
                  className="btn btn-secondary" 
                  style={{ alignSelf: 'flex-start', marginTop: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Read Architecture & AI Reviews <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <p>No AI analysis text found. Try refreshing analysis.</p>
            )}
          </div>

          {/* Language distribution card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Code size={20} style={{ color: 'var(--color-cyan)' }} /> Language Trends
            </h3>
            
            {languages.length > 0 ? (
              <>
                {/* Horizontal segmented progress bar */}
                <div className="lang-distribution-bar">
                  {languages.map((l, idx) => {
                    const totalBytes = languages.reduce((sum, item) => sum + parseInt(item.bytes), 0);
                    const percentage = (parseInt(l.bytes) / totalBytes) * 100;
                    return (
                      <div 
                        key={l.language} 
                        className="lang-bar-segment"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: getLanguageColor(l.language)
                        }}
                        title={`${l.language}: ${percentage.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>

                {/* Detail list grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, maxHeight: '200px' }}>
                  {languages.map(l => {
                    const totalBytes = languages.reduce((sum, item) => sum + parseInt(item.bytes), 0);
                    const percentage = (parseInt(l.bytes) / totalBytes) * 100;
                    return (
                      <div key={l.language} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: getLanguageColor(l.language) }}></span>
                          <span style={{ fontWeight: 600 }}>{l.language}</span>
                        </div>
                        <span style={{ color: 'var(--text-secondary)' }}>{percentage.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No language details detected.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 2. RENDER COMMITS TIMELINE & CUSTOM HEATMAP
  const renderCommitsTab = () => {
    // Let's draw a beautiful SVG Line Chart of commit sizes (total additions/deletions) over the recent history.
    // We reverse commits to show chronological order left-to-right.
    const chronologicalCommits = [...commits].reverse().slice(-15);
    
    // Draw SVG Line Chart
    const svgWidth = 700;
    const svgHeight = 200;
    const padding = { top: 15, right: 30, bottom: 25, left: 50 };
    
    // Find Max commit churn size
    const maxChurn = Math.max(...chronologicalCommits.map(c => c.additions + c.deletions), 10);
    
    const getX = (index) => {
      const step = (svgWidth - padding.left - padding.right) / (chronologicalCommits.length - 1 || 1);
      return padding.left + index * step;
    };
    
    const getY = (value) => {
      const chartHeight = svgHeight - padding.top - padding.bottom;
      return svgHeight - padding.bottom - (value / maxChurn) * chartHeight;
    };

    // Contribution Heatmap: Build mock/actual data matrix (7 rows x 52 cols)
    // Map commits into day/week slots of the past 12 months
    const now = new Date();
    const dates = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dates.push({
        dateStr: d.toISOString().split('T')[0],
        dayOfWeek: d.getDay(), // 0 for Sunday
        commitsCount: 0
      });
    }

    // Populate actual counts from DB commits
    commits.forEach(c => {
      const commitDateStr = new Date(c.committed_at).toISOString().split('T')[0];
      const match = dates.find(d => d.dateStr === commitDateStr);
      if (match) {
        match.commitsCount += 1;
      }
    });

    // Group dates by week
    const weeks = [];
    let currentWeek = [];
    dates.forEach(d => {
      currentWeek.push(d);
      if (d.dayOfWeek === 6 || dates.indexOf(d) === dates.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="fade-in">
        {/* Heatmap Section */}
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Calendar size={18} style={{ color: 'var(--color-primary)' }} /> Contribution Calendar Heatmap
          </h3>
          <div className="heatmap-scroll-container">
            <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
              {/* Row-by-Row rendering (Sunday=0, Monday=1, ..., Saturday=6) */}
              {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
                <React.Fragment key={dayIndex}>
                  {weeks.map((week, weekIndex) => {
                    const dayData = week.find(d => d.dayOfWeek === dayIndex);
                    if (!dayData) return <div key={weekIndex} className="heatmap-cell" style={{ visibility: 'hidden' }} />;
                    
                    const count = dayData.commitsCount;
                    let intensity = "0";
                    if (count > 0 && count <= 2) intensity = "1";
                    else if (count > 2 && count <= 4) intensity = "2";
                    else if (count > 4 && count <= 8) intensity = "3";
                    else if (count > 8) intensity = "4";

                    return (
                      <div 
                        key={weekIndex} 
                        className="heatmap-cell" 
                        data-count={intensity}
                        title={`${count} commits on ${new Date(dayData.dateStr).toLocaleDateString()}`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="heatmap-legend">
            <span>Less</span>
            <div className="heatmap-legend-box" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }} />
            <div className="heatmap-legend-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.25)' }} />
            <div className="heatmap-legend-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.45)' }} />
            <div className="heatmap-legend-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.65)' }} />
            <div className="heatmap-legend-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.9)', boxShadow: '0 0 4px var(--color-primary)' }} />
            <span>More</span>
          </div>
        </div>

        {/* Commit timeline Line Chart & Commit Feed */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }} className="grid-cols-2">
          {/* Commit Volume Line Chart */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Activity size={18} style={{ color: 'var(--color-cyan)' }} /> Commit Size Trend
            </h3>
            {chronologicalCommits.length > 1 ? (
              <div style={{ width: '100%', overflowX: 'auto', flex: 1, display: 'flex', alignItems: 'center' }}>
                <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = getY(maxChurn * ratio);
                    return (
                      <g key={i}>
                        <line 
                          x1={padding.left} 
                          y1={y} 
                          x2={svgWidth - padding.right} 
                          y2={y} 
                          stroke="rgba(255,255,255,0.05)" 
                          strokeWidth="1"
                        />
                        <text 
                          x={padding.left - 10} 
                          y={y + 4} 
                          fill="var(--text-muted)" 
                          fontSize="10" 
                          textAnchor="end"
                          fontFamily="var(--font-mono)"
                        >
                          {Math.round(maxChurn * ratio)}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Timeline Points & Lines */}
                  {/* Area path */}
                  <path 
                    d={`
                      M ${getX(0)} ${getY(0)}
                      ${chronologicalCommits.map((c, idx) => `L ${getX(idx)} ${getY(c.additions + c.deletions)}`).join(' ')}
                      L ${getX(chronologicalCommits.length - 1)} ${getY(0)}
                      Z
                    `}
                    fill="url(#violet-gradient)"
                    opacity="0.15"
                  />
                  
                  {/* Stroke path */}
                  <path 
                    d={chronologicalCommits.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(c.additions + c.deletions)}`).join(' ')}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 0 4px var(--color-primary))' }}
                  />

                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="violet-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Circle Dots for each Commit */}
                  {chronologicalCommits.map((c, idx) => (
                    <circle 
                      key={idx}
                      cx={getX(idx)}
                      cy={getY(c.additions + c.deletions)}
                      r="4"
                      fill="var(--color-cyan)"
                      stroke="var(--bg-main)"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{`${c.author_name}: ${c.message.substring(0, 30)}... (+${c.additions} -${c.deletions})`}</title>
                    </circle>
                  ))}
                  
                  {/* X Axis Labels */}
                  {chronologicalCommits.filter((_, idx) => idx % 3 === 0).map((c, idx) => {
                    const actualIdx = commits.indexOf(c);
                    return (
                      <text 
                        key={idx}
                        x={getX(commits.slice(-15).indexOf(c))} 
                        y={svgHeight - 5} 
                        fill="var(--text-muted)" 
                        fontSize="10" 
                        textAnchor="middle"
                        fontFamily="var(--font-sans)"
                      >
                        {new Date(c.committed_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      </text>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <p style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>Not enough commit data to trace trend.</p>
            )}
          </div>

          {/* Commit Feed */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              Recent Commits
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: '250px' }}>
              {commits.slice(0, 10).map((c, i) => (
                <div key={i} className="commit-item" style={{ padding: '0.6rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                    {c.author_avatar ? (
                      <img src={c.author_avatar} alt={c.author_name} className="commit-author-img" style={{ width: '28px', height: '28px' }} />
                    ) : (
                      <div className="commit-author-img" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                        {c.author_name.charAt(0)}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p className="commit-msg" style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '220px' }}>
                        {c.message}
                      </p>
                      <p className="commit-meta" style={{ fontSize: '0.75rem' }}>
                        {c.author_name} • {new Date(c.committed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="churn-indicator" style={{ fontSize: '0.75rem' }}>
                    <span className="churn-add">+{c.additions}</span>
                    <span className="churn-del">-{c.deletions}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. RENDER CODE CHURN TAB
  const renderChurnTab = () => {
    // Code churn: additions vs deletions. We draw a beautiful bar graph where additions are vertical bars upward,
    // and deletions are vertical bars downward (represented positive/negative)
    const recentCommits = commits.slice(0, 20).reverse();
    
    const svgWidth = 720;
    const svgHeight = 260;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartHeight = svgHeight - padding.top - padding.bottom;
    
    // Find max value to scale chart
    const maxVal = Math.max(...recentCommits.map(c => Math.max(c.additions, c.deletions)), 100);
    
    const getX = (idx) => {
      const step = (svgWidth - padding.left - padding.right) / (recentCommits.length || 1);
      return padding.left + idx * step;
    };
    
    const getBarWidth = () => {
      return Math.max(2, ((svgWidth - padding.left - padding.right) / recentCommits.length) * 0.6);
    };

    return (
      <div className="glass-card fade-in">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <BarChart2 size={18} style={{ color: 'var(--color-secondary)' }} /> Code Churn Analysis (Last 20 Commits)
        </h3>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Code churn measures developer editing patterns. Green bars represent added lines of code, and red bars show deleted lines per commit, indicating refactoring volume vs feature growth.
        </p>

        {recentCommits.length > 0 ? (
          <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
            <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
              {/* Y Axis Grid Lines */}
              {[1, 0.5, 0, -0.5, -1].map((ratio, i) => {
                const y = padding.top + chartHeight/2 - (ratio * chartHeight/2);
                const displayVal = Math.round(maxVal * ratio);
                return (
                  <g key={i}>
                    <line 
                      x1={padding.left} 
                      y1={y} 
                      x2={svgWidth - padding.right} 
                      y2={y} 
                      stroke={ratio === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"} 
                      strokeWidth={ratio === 0 ? 1.5 : 1}
                    />
                    <text 
                      x={padding.left - 10} 
                      y={y + 4} 
                      fill="var(--text-muted)" 
                      fontSize="9" 
                      textAnchor="end"
                      fontFamily="var(--font-mono)"
                    >
                      {displayVal > 0 ? `+${displayVal}` : displayVal}
                    </text>
                  </g>
                );
              })}

              {/* Draw bars */}
              {recentCommits.map((c, idx) => {
                const x = getX(idx) + ((getX(1) - getX(0)) - getBarWidth())/2;
                const midY = padding.top + chartHeight/2;
                
                // Additions Bar (upward)
                const addHeight = (c.additions / maxVal) * (chartHeight / 2);
                const addY = midY - addHeight;
                
                // Deletions Bar (downward)
                const delHeight = (c.deletions / maxVal) * (chartHeight / 2);
                
                return (
                  <g key={idx}>
                    {/* Additions */}
                    <rect 
                      x={x} 
                      y={addY} 
                      width={getBarWidth()} 
                      height={addHeight} 
                      fill="var(--color-green)"
                      opacity="0.8"
                      rx="2"
                    >
                      <title>{`Commit: ${c.message.substring(0,30)}...\nAdditions: +${c.additions}`}</title>
                    </rect>
                    {/* Deletions */}
                    <rect 
                      x={x} 
                      y={midY} 
                      width={getBarWidth()} 
                      height={delHeight} 
                      fill="var(--color-red)"
                      opacity="0.8"
                      rx="2"
                    >
                      <title>{`Commit: ${c.message.substring(0,30)}...\nDeletions: -${c.deletions}`}</title>
                    </rect>
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {recentCommits.filter((_, idx) => idx % 4 === 0).map((c, idx) => {
                return (
                  <text 
                    key={idx}
                    x={getX(recentCommits.indexOf(c)) + (getX(1) - getX(0))/2} 
                    y={svgHeight - 5} 
                    fill="var(--text-muted)" 
                    fontSize="9" 
                    textAnchor="middle"
                  >
                    {c.commit_hash.substring(0,6)}
                  </text>
                );
              })}
            </svg>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Not enough commit data to analyze churn.</p>
        )}
      </div>
    );
  };

  // 4. RENDER TEAM INSIGHTS TAB
  const renderTeamTab = () => {
    return (
      <div className="glass-card fade-in">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Users size={18} style={{ color: 'var(--color-cyan)' }} /> Contributor Analytics
        </h3>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Review contributions, impact, and activity distribution across team members based on their commits and lines of code changed.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Developer</th>
                <th style={{ padding: '0.75rem 1rem' }}>Commits</th>
                <th style={{ padding: '0.75rem 1rem' }}>Impact (Churn)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Additions</th>
                <th style={{ padding: '0.75rem 1rem' }}>Deletions</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contribution Ratio</th>
              </tr>
            </thead>
            <tbody>
              {contributors.map((c, i) => {
                const totalDevCommits = commits.length;
                const ratio = ((c.count / totalDevCommits) * 100).toFixed(1);
                
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }} className="hover-row">
                    <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                          {c.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p style={{ fontWeight: 600 }}>{c.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</p>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{c.count}</td>
                    <td style={{ padding: '1rem' }}>{(c.additions + c.deletions).toLocaleString()}</td>
                    <td style={{ padding: '1rem', color: 'var(--color-green)' }}>+{c.additions.toLocaleString()}</td>
                    <td style={{ padding: '1rem', color: 'var(--color-red)' }}>-{c.deletions.toLocaleString()}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', width: '80px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${ratio}%`, background: 'var(--color-cyan)', borderRadius: '3px' }}></div>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{ratio}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <style>{`
          .hover-row:hover {
            background: rgba(255,255,255,0.02);
          }
        `}</style>
      </div>
    );
  };

  // 5. RENDER PR STATISTICS TAB
  const renderPrsTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="fade-in">
        {/* Upper stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }} className="grid-cols-2">
          <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total PRs</span>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--color-primary)', marginTop: '0.25rem' }}>{prsCount}</h2>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Merged PRs</span>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--color-green)', marginTop: '0.25rem' }}>{mergedPrs.length}</h2>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Open PRs</span>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--color-cyan)', marginTop: '0.25rem' }}>{openPrs.length}</h2>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Merge Duration (Avg)</span>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--color-orange)', marginTop: '0.25rem' }}>
              {avgMergeTimeHours > 0 ? `${avgMergeTimeHours}h` : 'N/A'}
            </h2>
          </div>
        </div>

        {/* PR List Table */}
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <GitPullRequest size={18} style={{ color: 'var(--color-primary)' }} /> Pull Request Catalog
          </h3>
          {pullRequests.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>PR Info</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Author</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Created At</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Merged At</th>
                  </tr>
                </thead>
                <tbody>
                  {pullRequests.map((pr, i) => {
                    let badgeColor = "rgba(16, 185, 129, 0.15)";
                    let badgeText = "Merged";
                    let textColor = "var(--color-green)";
                    
                    if (pr.state === 'open') {
                      badgeColor = "rgba(6, 182, 212, 0.15)";
                      badgeText = "Open";
                      textColor = "var(--color-cyan)";
                    } else if (pr.state === 'closed') {
                      badgeColor = "rgba(239, 68, 68, 0.15)";
                      badgeText = "Closed";
                      textColor = "var(--color-red)";
                    }

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }} className="hover-row">
                        <td style={{ padding: '0.9rem 1rem', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginRight: '0.5rem' }}>#{pr.number}</span>
                          <span style={{ fontWeight: 600 }} title={pr.title}>{pr.title}</span>
                        </td>
                        <td style={{ padding: '0.9rem 1rem' }}>{pr.author}</td>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <span style={{ background: badgeColor, color: textColor, fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            {badgeText}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>
                          {new Date(pr.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)' }}>
                          {pr.merged_at ? new Date(pr.merged_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>No Pull Request metrics compiled for this repository.</p>
          )}
        </div>
      </div>
    );
  };

  // 6. RENDER AI DETAILED SUMMARY TAB
  const renderAiSummaryTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="fade-in">
        {aiSummary ? (
          <>
            {/* Summary Text Panel */}
            <div className="glass-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Brain size={18} style={{ color: 'var(--color-primary)' }} /> Repository Overview & Purpose
              </h3>
              <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-primary)' }}>
                {aiSummary.summary_text}
              </p>
            </div>

            {/* Architecture Analysis Terminal */}
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot dot-red"></div>
                <div className="terminal-dot dot-yellow"></div>
                <div className="terminal-dot dot-green"></div>
                <span style={{ marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>gemini-1.5-flash: architecture_analyzer.py</span>
              </div>
              <div className="terminal-line">
                <span className="terminal-prompt">$</span> <span>cat ./architecture_review.log</span>
              </div>
              <div className="terminal-content" style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '0.95rem' }}>
                {aiSummary.architecture_analysis}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="glass-card" style={{ borderLeft: '4px solid var(--color-cyan)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Brain size={18} style={{ color: 'var(--color-cyan)' }} /> Developer Recommendations
              </h3>
              {recommendations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {recommendations.map((rec, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-cyan)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '2px' }}>{rec}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No recommendations generated.</p>
              )}
            </div>
          </>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 0' }}>
            <Brain size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p>No AI analysis file exists for this repository. Try running analysis again.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="main-content fade-in">
      {/* Detail Page Header */}
      <div className="repo-detail-header">
        <div className="repo-title-wrapper">
          <button onClick={onBack} className="back-button">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '2rem' }}>{meta.name}</h1>
              <span className="repo-badge" style={{ verticalAlign: 'middle' }}>
                {meta.is_public ? 'public' : 'private'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Analyzed {new Date(meta.last_analyzed_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Buttons / Actions */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="repo-stats" style={{ borderTop: 'none', paddingTop: 0, margin: 0, fontSize: '0.95rem', gap: '1.25rem' }}>
            <div className="repo-stat-item">
              <Star size={16} />
              <span style={{ fontWeight: 600 }}>{meta.stars.toLocaleString()}</span>
            </div>
            <div className="repo-stat-item">
              <GitBranch size={16} />
              <span style={{ fontWeight: 600 }}>{meta.forks.toLocaleString()}</span>
            </div>
          </div>
          <button 
            onClick={handleRefresh} 
            className="btn btn-secondary"
            disabled={refreshing}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spinner' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Updating...' : 'Re-Analyze'}
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <Brain size={16} /> Overview
        </button>
        <button className={`tab-btn ${activeTab === 'commits' ? 'active' : ''}`} onClick={() => setActiveTab('commits')}>
          <Calendar size={16} /> Commits & Heatmap
        </button>
        <button className={`tab-btn ${activeTab === 'churn' ? 'active' : ''}`} onClick={() => setActiveTab('churn')}>
          <BarChart2 size={16} /> Code Churn
        </button>
        <button className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
          <Users size={16} /> Team Insights
        </button>
        <button className={`tab-btn ${activeTab === 'prs' ? 'active' : ''}`} onClick={() => setActiveTab('prs')}>
          <GitPullRequest size={16} /> PR Statistics
        </button>
        <button className={`tab-btn ${activeTab === 'ai_summary' ? 'active' : ''}`} onClick={() => setActiveTab('ai_summary')}>
          <Brain size={16} /> AI Summary
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'commits' && renderCommitsTab()}
      {activeTab === 'churn' && renderChurnTab()}
      {activeTab === 'team' && renderTeamTab()}
      {activeTab === 'prs' && renderPrsTab()}
      {activeTab === 'ai_summary' && renderAiSummaryTab()}
    </div>
  );
}
