# 📊 GitHub Analytics Platform: High-Fidelity Git Insights

[![React](https://img.shields.counts.cx/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![Node.js](https://img.shields.counts.cx/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](#)
[![Python](https://img.shields.counts.cx/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)
[![PostgreSQL](https://img.shields.counts.cx/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](#)
[![Firebase](https://img.shields.counts.cx/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](#)
[![Google Gemini](https://img.shields.counts.cx/badge/Gemini%20AI-8E75C2?style=for-the-badge&logo=google&logoColor=white)](#)

A modern, high-fidelity developer dashboard that analyzes GitHub repository health, commit frequencies, code churn, and team collaboration. Featuring a premium **Peach-Coral Pastel** user interface, responsive handcrafted SVG data visualizations, Firebase Auth integrations, and automated Google Gemini AI repository audits.

https://github.com/user-attachments/assets/4803dc5e-62f8-4528-9160-3f023b883fad

---

## 🏗️ System Architecture

The platform is designed with a decoupled multi-tier architecture to ensure clear separation of concerns, easy scalability, and absolute fault tolerance.

graph TD
    subgraph Client [React SPA Client (Vite)]
        UI[Peach-Coral Dashboard]
        SVGC[Custom SVG Visualizations]
        FBA[Firebase Auth Client]
    end

    subgraph Backend [Node.js Express Server]
        API[Express Router]
        JWT[JWT Verification Middleware]
        SP[Subprocess Spawn Handler]
        DBR[Database Router Layer]
    end

    subgraph Analytics [Python Analytics Engine]
        PA[Git Analyzer Script]
        GPY[GitPython & API Parser]
    end

    subgraph Data [Storage & Services]
        PG[(PostgreSQL Database)]
        JDB[(Local JSON Database)]
        GEM[Google Gemini 1.5 Flash API]
        FCS[Firebase Auth Cloud]
    end

    UI -->|API Requests| API
    FBA -->|Verify Tokens| JWT
    JWT -->|Authenticate| FCS
    FBA -.->|Simulate Auth| JWT
    API -->|Spawn Subprocess| PA
    PA -->|API Queries| GPY
    GPY -->|Code Analysis| GEM
    PA -->|Format Output| DBR
    DBR -->|Primary Connection| PG
    DBR -.->|Offline Fallback| JDB
```

---

## ⚡ Core Engineering Highlights (Hiring Standouts)

This project was built to demonstrate advanced software engineering patterns, focusing on resilience, performance, and real-world developer tools.

### 1. Zero-Install Database Fallback (Resilient File-Store Route)
*   **The Challenge**: A standard Postgres database setup can block immediate review if Docker or PostgreSQL is offline.
*   **The Solution**: I implemented a database router layer. If connection to the Postgres database fails, the Express backend automatically flags the offline state and switches queries to a local, structured **`database.json`** file.
*   **Stream Pipeline Interceptor**: When PostgreSQL is offline, the spawned Python Git analyzer captures all collected metrics, wraps them inside custom stdout boundary delimiters (`--- JSON_RESULT_START ---`), and prints the payload. Express intercepts this stream, writes the data to the local file-store, and serves it transparently.

### 2. Built-in Local Developer Auth Emulator
*   **The Challenge**: Social login APIs (Google/GitHub) require active domain redirects, making rapid developer onboarding and offline testing difficult.
*   **The Solution**: I designed a **Developer Auth Emulator** modal. If Firebase config variables are unconfigured, the client presents a customizable identity form. 
*   **JWT Token Simulation**: The backend signs mock Firebase-compliant JSON Web Tokens containing custom user parameters. This replicates real Firebase user flows, letting reviewers log in with different accounts, create unique DB cache records, and verify layouts instantly in a zero-config sandbox.

### 3. Handcrafted Zero-Dependency SVG Data Visualizations
*   **The Challenge**: Charting libraries (ChartJS, Recharts) bloat production bundle footprints and slow down viewport loading.
*   **The Solution**: I designed and rendered the entire reporting suite using responsive SVG drawings directly in React. Commit chronologies, language distribution strips, code churn charts, and circular quality gauges are hand-coded SVGs, ensuring instant load times and pixel-perfect responsiveness.

### 4. Hybrid LLM Analyzer & Metric-Driven Verdict Fallback
*   **The Challenge**: The absence of a Gemini API key can leave the AI Overview and recommendations empty.
*   **The Solution**: Built a hybrid analysis module. If the Gemini key is present, it uses `gemini-1.5-flash` to execute full audits. If the key is absent, a custom rules-based analyzer evaluates the parsed Git statistics (commits, language ratios, health index, README presence) to generate a tailored multi-paragraph report and actionable developer suggestions.

---

## 🌟 Visual Theme & UI Inspirations
The user interface is modeled after premium, modern mobile product dashboards:
*   **Theme**: Warm Peach-Coral Pastel.
*   **Background Canvas**: Soft peach-cream (`#FDF1EE`) with dual gradient-blobs.
*   **Component Cards**: Crisp solid white panels (`#FFFFFF`) with large rounded corners (`border-radius: 20px`) and terracotta drop shadows.
*   **Pill Category Navigation**: Category filters and active tabs render as elegant pill shapes. Active selections stand out in solid terracotta (`#E37364`) with white typography.

---

## 🛠️ Features Overview

*   **Commit Analytics**: Detailed chronology graphs charting commit volumes over time.
*   **Contribution Heatmap**: Interactive GitHub-style activity grid measuring contribution frequency.
*   **Code Churn**: Visual balance chart plotting lines added vs. lines deleted.
*   **Team Insights**: Clean leaderboard ranking contribution percentages, impact metrics, and velocity per developer.
*   **Language Trends**: Byte-ratio breakdowns of repository tech stacks.
*   **PR Statistics**: Aggregated lists tracking review speed, comment totals, and open/closed ratios.
*   **AI Code Verdicts**: Architectural summaries, file layout diagnostics, and step-by-step developer guidelines.
*   **Repository Health Score**: Aggregated rating metric scoring documentation availability, active code cadence, and repo safety.

---

## 🚀 Quick Setup (Get Running in 3 Minutes)

The platform is optimized for zero-config testing. If you don't have PostgreSQL or Firebase setup, the system will **automatically fall back to the Local JSON Database & Developer Auth Emulator**, letting you run full Git analyzes out of the box.

### 1. Clone & Set Environment variables
Create a `.env` file in the root directory:
```env
# Server Configurations
PORT=5000
JWT_SECRET=developer_secret_key_for_jwt_signing

# (Optional) PostgreSQL - App falls back to database.json if offline
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/github_analytics

# (Optional) Google Gemini API - App falls back to local metric engine if empty
GEMINI_API_KEY=

# (Optional) Firebase Credentials - App falls back to Auth Emulator if empty
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

### 2. Launch the Backend Server
1. Install backend packages:
   ```bash
   cd backend-node
   npm install
   ```
2. Setup Python requirements (ensure you have Python 3.9+ installed):
   ```bash
   pip install -r ../backend-python/requirements.txt
   ```
3. Start the Node.js API:
   ```bash
   npm run dev
   ```
The backend server runs on **`http://localhost:5000`**.

### 3. Launch the Frontend Application
1. Open a new terminal session, navigate to the frontend folder, and install modules:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
The React SPA client runs on **`http://localhost:5173`**.

---

## 🔬 How the Analysis Engine Works
1. **Trigger**: The client posts a repository link or user profile URL to the backend.
2. **Analysis Spawn**: The Node backend validates the payload and spawns a Python process:
   ```bash
   python backend-python/analyzer.py --owner <owner> --repo <repo>
   ```
3. **Cloning & Parsing**: Python clones the latest commit history chunks, aggregates line insertions, calculates PR stats, and queries directory languages.
4. **AI review**: Python sends repository structure details to Gemini or computes the local fallback.
5. **Persistence**: Express catches the parsed payload, routes it to the database driver, and immediately returns the unified repository analytics schema to the client!
