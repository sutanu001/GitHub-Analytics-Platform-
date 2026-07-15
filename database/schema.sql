-- PostgreSQL Database Schema for GitHub Analytics Platform

-- Enable UUID extension if needed (not strictly required here, but good practice)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (GitHub OAuth authenticated users)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id INTEGER UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    avatar_url VARCHAR(500),
    access_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Analyzed Repositories Table (Metadata about repos that have been analyzed)
CREATE TABLE IF NOT EXISTS analyzed_repositories (
    id SERIAL PRIMARY KEY,
    owner VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    health_score INTEGER DEFAULT 0,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,
    main_language VARCHAR(50),
    last_analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT TRUE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_owner_name UNIQUE (owner, name)
);

-- 3. Commit Analytics Table (Tracks commits, contributors, additions/deletions)
CREATE TABLE IF NOT EXISTS commit_analytics (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES analyzed_repositories(id) ON DELETE CASCADE,
    commit_hash VARCHAR(100) NOT NULL,
    author_name VARCHAR(100),
    author_email VARCHAR(255),
    author_avatar VARCHAR(500),
    message TEXT,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    committed_at TIMESTAMP NOT NULL,
    CONSTRAINT unique_repo_commit UNIQUE (repo_id, commit_hash)
);

-- 4. Pull Requests Table (Tracks PR statistics and velocity)
CREATE TABLE IF NOT EXISTS pull_requests (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES analyzed_repositories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT,
    author VARCHAR(100),
    state VARCHAR(20) NOT NULL, -- 'open', 'closed', 'merged'
    created_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    merged_at TIMESTAMP,
    comments_count INTEGER DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    CONSTRAINT unique_repo_pr UNIQUE (repo_id, number)
);

-- 5. Repository Languages Table (Language distribution)
CREATE TABLE IF NOT EXISTS repository_languages (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES analyzed_repositories(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    bytes BIGINT NOT NULL,
    CONSTRAINT unique_repo_lang UNIQUE (repo_id, language)
);

-- 6. AI Summaries Table (Gemini-generated repository summaries)
CREATE TABLE IF NOT EXISTS ai_summaries (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES analyzed_repositories(id) ON DELETE CASCADE UNIQUE,
    summary_text TEXT NOT NULL,
    architecture_analysis TEXT,
    recommendations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commits_repo ON commit_analytics(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_date ON commit_analytics(committed_at);
CREATE INDEX IF NOT EXISTS idx_prs_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_languages_repo ON repository_languages(repo_id);
