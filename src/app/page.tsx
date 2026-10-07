'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Briefcase, 
  Zap, 
  ChevronRight, 
  Terminal, 
  Activity, 
  Compass, 
  FileText,
  Building2,
  Users,
  Calendar,
  Layers,
  Database,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  X,
  Loader2,
  ArrowRight,
  Bell,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { useDashboardStore } from '@/lib/store/dashboard-store';

interface AIAnalyzeResumeResult {
  score: number;
  verdict: string;
  positives: string[];
  gaps: string[];
}

interface AIFindEligibleResult {
  eligible: { name: string; minCgpa: number; package: number }[];
}

interface AICompareResult {
  verdict: string;
  recommendation: string;
}

interface AIGenerateQuestionsResult {
  questions: { question: string; topic: string; difficulty: string }[];
}

interface AIBuildRoadmapResult {
  phases: { week: string; topic: string }[];
}

interface AIImproveAtsResult {
  gaps: string[];
  recommendations: string[];
}

interface SearchResults {
  companies: { id: string; name: string; industry: string | null }[];
  jobs: { id: string; title: string; packageLpa: number; company?: { name: string } }[];
  students: { id: string; name: string; email: string; branch: string; cgpa: number }[];
  questions: { id: string; question: string; topic: string; difficulty: string; company?: { name: string } }[];
  resumes: { id: string; filename: string; version: number; skills: string[] }[];
}

export default function Home() {
  const {
    student,
    companies,
    applications,
    selectedCompanyA,
    selectedCompanyB,
    commandPaletteOpen,
    readinessScore,
    missingSkills,
    setCommandPaletteOpen,
    updateProfile,
    submitApplication,
    setBattleCompanies,
    advanceApplicationStatus,
  } = useDashboardStore();

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'recruiter' | 'tpo' | 'admin'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Active Menu Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Custom interactive states
  const [newSkill, setNewSkill] = useState('');
  const [battleA, setBattleA] = useState(selectedCompanyA);
  const [battleB, setBattleB] = useState(selectedCompanyB);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  // AI Copilot Actions Output
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<unknown>(null);

  // Global search API fetcher
  useEffect(() => {
    if (!paletteQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/company/search?q=${encodeURIComponent(paletteQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [paletteQuery]);

  // Keyboard shortcut listener for Command Palette (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Reset tab when role changes
  useEffect(() => {
    setActiveTab('dashboard');
    setAiAction(null);
    setAiOutput(null);
  }, [selectedRole]);

  // Simulated Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    setTimeout(() => {
      if (selectedRole === 'admin' && !otp) {
        setLoginError('2FA OTP code is required for Administrator access.');
        setIsLoggingIn(false);
        return;
      }
      setIsLoggingIn(false);
      setIsLoggedIn(true);
    }, 800);
  };

  // Structured AI Tasks Executor
  const runAiTask = async (task: string) => {
    setAiAction(task);
    setAiLoading(true);
    setAiOutput(null);

    // Simulate async network request to BullMQ/FastAPI background job
    setTimeout(() => {
      setAiLoading(false);
      if (task === 'analyze-resume') {
        setAiOutput({
          score: 89,
          verdict: 'Excellent suitability for target SDE openings.',
          positives: ['Strong overlap on React, TypeScript, and SQL queries.', 'Standard formatting matches ATS parsers.'],
          gaps: ['Missing Cloud Infrastructure (AWS/GCP) metrics.', 'No CI/CD pipelines specified.'],
        });
      } else if (task === 'find-eligible') {
        const eligible = companies.filter(c => student.cgpa >= c.minCgpa);
        setAiOutput({
          eligible: eligible.map(c => ({ name: c.name, minCgpa: c.minCgpa, package: c.packageLpa })),
        });
      } else if (task === 'compare') {
        setAiOutput({
          verdict: 'Google offers a higher salary package but maintains a stricter CGPA threshold. Amazon is highly aligned with your Java background.',
          recommendation: 'Target Amazon SDE Intern opening first, and raise CGPA to 9.20+ to qualify for Google.',
        });
      } else if (task === 'generate-questions') {
        setAiOutput({
          questions: [
            { question: 'Given a binary tree, print its boundary nodes in anti-clockwise order.', topic: 'Binary Trees', difficulty: 'Hard' },
            { question: 'How do you design a rate limiter middleware for a multi-tenant SaaS application?', topic: 'System Design', difficulty: 'Medium' },
            { question: 'Explain dirty reads, non-repeatable reads, and phantom reads in PostgreSQL transaction isolation.', topic: 'DBMS', difficulty: 'Medium' }
          ]
        });
      } else if (task === 'build-roadmap') {
        setAiOutput({
          phases: [
            { week: 'Week 1-2', topic: 'Advanced System Design (Load balancers, caching, database sharding)' },
            { week: 'Week 3-4', topic: 'Docker & Kubernetes orchestration (Containers deployment, services)' },
            { week: 'Week 5-6', topic: 'FastAPI and Python microservices endpoints connection' }
          ]
        });
      } else if (task === 'improve-ats') {
        setAiOutput({
          gaps: missingSkills,
          recommendations: [
            'Add a Docker containerization section in your main portfolio project.',
            'Include basic System Design keywords (horizontal scaling, consistent hashing) in your resume text.'
          ]
        });
      }
    }, 1000);
  };

  // Quick command executor for keyboard palette
  const executePaletteCommand = (action: () => void) => {
    action();
    setPaletteQuery('');
    setCommandPaletteOpen(false);
  };

  // Shared variables
  const activeApplications = applications.filter((a) => a.status !== 'REJECTED');

  // --- RENDERING 1: ENTERPRISE LOGIN GATEWAY ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-[#6366F1] flex items-center justify-center text-white font-bold">P</div>
            <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">PlacementOS</span>
          </div>
          <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
            University Placement Management Platform
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Sign in to access your dashboard
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-sm border border-[#E2E8F0] rounded-xl sm:px-10">
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2.5">
                  Choose Portal Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'student', name: 'Student' },
                    { id: 'recruiter', name: 'Recruiter' },
                    { id: 'tpo', name: 'TPO Officer' },
                    { id: 'admin', name: 'Admin' }
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role.id as 'student' | 'recruiter' | 'tpo' | 'admin');
                        setLoginError('');
                      }}
                      className={`py-2 px-3 border text-xs font-semibold rounded-lg transition-all ${
                        selectedRole === role.id 
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder={
                    selectedRole === 'student' ? 'sbbhat_b22@it.vjti.ac.in' :
                    selectedRole === 'recruiter' ? 'talent@google.com' :
                    selectedRole === 'tpo' ? 'tpo@vjti.ac.in' : 'root@placementos.local'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {selectedRole === 'admin' && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    2FA REQUIRED
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="block w-full px-3 py-2 border border-amber-300 bg-white rounded-lg text-sm text-slate-900 text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}

              {loginError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {loginError}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                >
                  {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
                </button>
              </div>
            </form>

            {selectedRole !== 'admin' && (
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-slate-500 uppercase tracking-wider font-semibold">or</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLoggedIn(true)}
                    className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLoggedIn(true)}
                    className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-slate-900" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" fill="currentColor"/>
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING 2: UNIFIED DASHBOARD B2B LAYOUT ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">
      {/* 1. TOP NAVBAR */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsLoggedIn(false)}>
            <div className="h-7 w-7 rounded bg-[#6366F1] flex items-center justify-center text-white font-bold text-sm">P</div>
            <span className="font-bold tracking-tight text-slate-900 text-lg">PlacementOS</span>
          </div>

          <div className="relative hidden md:block max-w-xs w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              onClick={() => setCommandPaletteOpen(true)}
              placeholder="Search or actions (Ctrl+K)"
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-slate-100/70 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">

          {/* Notifications */}
          <button className="text-slate-400 hover:text-slate-600 relative p-1.5 rounded-full hover:bg-slate-50 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#EF4444]"></span>
          </button>

          {/* User profile widget */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
              {selectedRole === 'student' ? 'SB' : selectedRole === 'recruiter' ? 'RE' : selectedRole === 'tpo' ? 'TP' : 'AD'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-slate-800">
                {selectedRole === 'student' ? student.name : selectedRole === 'recruiter' ? 'Google Recruiter' : selectedRole === 'tpo' ? 'TPO Officer' : 'System Root'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">{selectedRole}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsLoggedIn(false)}
            className="text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 bg-white rounded-lg px-3 py-2 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 2. LEFT SIDEBAR */}
        <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between hidden md:flex">
          <div className="p-4 space-y-6">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2.5">Workspace Navigation</p>
              <nav className="space-y-1">
                {/* Dynamic Menu entries based on active role */}
                {selectedRole === 'student' && (
                  <>
                    {[
                      { id: 'dashboard', label: 'Dashboard', icon: Layers },
                      { id: 'resume', label: 'Resume & Identity', icon: FileText },
                      { id: 'radar', label: 'Opportunity Radar', icon: Compass },
                      { id: 'copilot', label: 'AI Copilot', icon: Zap }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          activeTab === item.id 
                            ? 'bg-indigo-50 text-indigo-600' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                        {item.label}
                      </button>
                    ))}
                  </>
                )}

                {selectedRole === 'recruiter' && (
                  <>
                    {[
                      { id: 'dashboard', label: 'Hiring Overview', icon: Layers },
                      { id: 'candidates', label: 'Candidates List', icon: Users },
                      { id: 'jobs', label: 'Jobs Campaigns', icon: Briefcase },
                      { id: 'calendar', label: 'Interviews Calendar', icon: Calendar }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          activeTab === item.id 
                            ? 'bg-indigo-50 text-indigo-600' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                        {item.label}
                      </button>
                    ))}
                  </>
                )}

                {selectedRole === 'tpo' && (
                  <>
                    {[
                      { id: 'dashboard', label: 'TPO Overview', icon: Layers },
                      { id: 'drives', label: 'Calendar Drives', icon: Calendar },
                      { id: 'analytics', label: 'Branch Placements', icon: Activity },
                      { id: 'alerts', label: 'Drive Alerts', icon: AlertTriangle }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          activeTab === item.id 
                            ? 'bg-indigo-50 text-indigo-600' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                        {item.label}
                      </button>
                    ))}
                  </>
                )}

                {selectedRole === 'admin' && (
                  <>
                    {[
                      { id: 'dashboard', label: 'Admin Metrics', icon: Layers },
                      { id: 'users', label: 'Users Registry', icon: Users },
                      { id: 'audit', label: 'Security Audit Logs', icon: Database },
                      { id: 'health', label: 'System Diagnostics', icon: ShieldCheck }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          activeTab === item.id 
                            ? 'bg-indigo-50 text-indigo-600' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                        {item.label}
                      </button>
                    ))}
                  </>
                )}
              </nav>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold justify-center">
              <Terminal className="h-3.5 w-3.5 text-slate-400" />
              PRESS CTRL+K FOR CMD
            </div>
            <div className="text-xs text-slate-400 text-center font-mono">v1.2.0-Production</div>
          </div>
        </aside>

        {/* 3. MAIN DASHBOARD CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          
          {/* ========================================== */}
          {/* STUDENT DASHBOARD VIEWS                    */}
          {/* ========================================== */}
          {selectedRole === 'student' && (
            <div className="space-y-6">
              
              {/* TAB A: STUDENT HERO DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* HERO BANNER SECTION */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Good Evening, {student.name} 👋</h1>
                        <p className="text-sm text-slate-500 font-mono">Roll: {student.studentId} | Department of {student.branch}</p>
                        <div className="flex items-center gap-2 mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 max-w-sm">
                          <span className="text-xs font-bold text-[#F59E0B] bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">NEXT EVENT</span>
                          <span className="text-sm text-slate-700 font-semibold font-sans">Amazon OA — Tomorrow, 9:00 AM</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 divide-x divide-slate-100">
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Placement Readiness</p>
                          <div className="flex items-center gap-2.5 mt-1.5">
                            <div className="text-3xl font-extrabold text-slate-800">{readinessScore}%</div>
                            <div className="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-[#6366F1] h-full" style={{ width: `${readinessScore}%` }}></div>
                            </div>
                          </div>
                        </div>

                        <div className="pl-6 text-left">
                          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recommended Cracks</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {['Google', 'Atlassian', 'Morgan Stanley', 'JPMC'].map(comp => (
                              <span key={comp} className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg">{comp}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DOUBLE COLUMN PANELS */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT 2 COLUMNS: APPLICATIONS AND PROFILE CONTROLLER */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Active Applications list */}
                      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-indigo-500" /> Active Placement Applications
                          </h2>
                          <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">TRACKING {activeApplications.length} PROCESSES</span>
                        </div>

                        <div className="space-y-4">
                          {activeApplications.map((app) => (
                            <div key={app.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h3 className="font-bold text-slate-900 text-base">{app.companyName}</h3>
                                  <p className="text-sm text-slate-500 font-medium">{app.title} — <span className="text-emerald-600 font-bold font-mono">{app.packageLpa} LPA</span></p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs uppercase font-semibold font-mono px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
                                    Stage: {app.status}
                                  </span>
                                  {app.status !== 'SELECTED' && (
                                    <button
                                      onClick={() => advanceApplicationStatus(app.id)}
                                      className="text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      Advance <ChevronRight className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100/50">
                                <span className="text-xs text-slate-500 font-sans italic truncate max-w-sm">
                                  &ldquo;{app.timeline[app.timeline.length - 1]?.note || 'Processing application...'}&rdquo;
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-semibold" suppressHydrationWarning>
                                  {app.timeline[app.timeline.length - 1]?.timestamp 
                                    ? new Date(app.timeline[app.timeline.length - 1].timestamp).toLocaleDateString() 
                                    : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Simulator sliders */}
                      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-3">
                          <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
                            <Sliders className="h-5 w-5 text-indigo-500" /> Digital Twin Profile Simulator
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">Simulate changes to profile credentials and analyze placement readiness variations</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-600">Simulated CGPA</span>
                              <span className="font-bold text-indigo-600 font-mono">{student.cgpa} / 10.00</span>
                            </div>
                            <input
                              type="range"
                              min="6.5"
                              max="9.8"
                              step="0.05"
                              value={student.cgpa}
                              onChange={(e) => updateProfile({ cgpa: parseFloat(e.target.value) })}
                              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-600">Simulated Coding Score</span>
                              <span className="font-bold text-indigo-600 font-mono">{student.codingScore} Index</span>
                            </div>
                            <input
                              type="range"
                              min="200"
                              max="950"
                              step="10"
                              value={student.codingScore}
                              onChange={(e) => updateProfile({ codingScore: parseInt(e.target.value, 10) })}
                              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Simulated Skills Inventory</label>
                          <div className="flex flex-wrap gap-1.5">
                            {student.skills.map((skill) => (
                              <span key={skill} className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg">
                                {skill}
                                <button 
                                  onClick={() => updateProfile({ skills: student.skills.filter(s => s !== skill) })}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <div className="flex items-center">
                              <input
                                type="text"
                                placeholder="Add skill..."
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newSkill.trim()) {
                                    updateProfile({ skills: [...student.skills, newSkill.trim()] });
                                    setNewSkill('');
                                  }
                                }}
                                className="border border-slate-200 text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: CALENDAR EVENTS AND REPLAY ACTIVITY MAP */}
                    <div className="space-y-6">
                      {/* Upcoming calendar openings */}
                      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-2">
                          <h3 className="font-semibold text-sm text-slate-800">Drive Timeline Calendar</h3>
                        </div>
                        <div className="space-y-3">
                          {[
                            { date: 'June 10', title: 'Amazon Online Test', desc: 'SDE Intern campaign' },
                            { date: 'June 15', title: 'Google Pre-Placement Talk', desc: 'FTE hiring drive' },
                            { date: 'June 18', title: 'Atlassian CodeSprint OA', desc: 'Direct matching candidates' }
                          ].map((ev) => (
                            <div key={ev.title} className="flex gap-3">
                              <div className="text-center font-mono py-1 px-2.5 bg-slate-50 border border-slate-100 rounded-lg flex-shrink-0 self-start">
                                <p className="text-[9px] font-bold text-indigo-600 uppercase">{ev.date.split(' ')[0]}</p>
                                <p className="text-xs font-bold text-slate-800">{ev.date.split(' ')[1]}</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-900">{ev.title}</p>
                                <p className="text-[10px] text-slate-500">{ev.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent simulation activities */}
                      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-2">
                          <h3 className="font-semibold text-sm text-slate-800">Recent Sandbox Activities</h3>
                        </div>
                        <div className="space-y-2.5">
                          {[
                            { time: '2 hours ago', action: 'Resume active version activated', desc: 'v5 layout updated' },
                            { time: '1 day ago', action: 'Applied to Google FTE', desc: 'Cutoff requirement check passed' },
                            { time: '3 days ago', action: 'Advanced Morgan Stanley stage', desc: 'Offered congratulations extended' }
                          ].map((act, i) => (
                            <div key={i} className="text-xs border-l-2 border-slate-100 pl-3 py-0.5">
                              <p className="text-[10px] font-mono text-slate-400">{act.time}</p>
                              <p className="font-semibold text-slate-800 mt-0.5">{act.action}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{act.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB B: RESUME MANAGEMENT & HISTORY */}
              {activeTab === 'resume' && (
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h2 className="font-semibold text-sm text-slate-800">Resume Vault & Placement Identity</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Manage versioned resumes with magic header validation checks and script scanners</p>
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      Upload New Version
                    </button>
                  </div>

                  {/* Active Resume Display */}
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-9 w-9 text-indigo-500" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">sanket_bhat_v5_vjti.pdf</h3>
                        <p className="text-xs text-slate-500">MIME: <span className="font-mono">application/pdf</span> | Size: 1.4 MB | Uploaded: June 5, 2026</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg">ACTIVE REVISION</span>
                  </div>

                  {/* Replay matrix activity map mock */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Placement Activity contributions Replay</h3>
                    <div className="border border-slate-200/60 rounded-xl p-4 bg-white flex flex-col gap-2 items-center justify-center">
                      <div className="grid grid-cols-52 gap-[3px] w-full max-w-lg">
                        {Array.from({ length: 364 }).map((_, idx) => {
                          const intensity = idx % 11 === 0 ? 'bg-[#3b82f6]' : idx % 19 === 0 ? 'bg-[#10b981]' : 'bg-[#e2e8f0]';
                          return <div key={idx} className={`h-2 w-2 rounded-[1px] ${intensity}`} />;
                        })}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-1">
                        <div className="flex items-center gap-1"><div className="h-2 w-2 bg-[#e2e8f0] rounded-[1px]" /> Low Activity</div>
                        <div className="flex items-center gap-1"><div className="h-2 w-2 bg-[#3b82f6] rounded-[1px]" /> Applications</div>
                        <div className="flex items-center gap-1"><div className="h-2 w-2 bg-[#10b981] rounded-[1px]" /> Selections</div>
                      </div>
                    </div>
                  </div>

                  {/* History revisions list */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resume Revision History</h3>
                    <div className="border border-slate-200/60 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">Version</th>
                            <th className="px-4 py-2.5">Filename</th>
                            <th className="px-4 py-2.5">Uploaded</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { v: 'v5', name: 'sanket_bhat_v5_vjti.pdf', date: '6/5/2026', status: 'Active' },
                            { v: 'v4', name: 'sanket_bhat_v4_test.pdf', date: '6/2/2026', status: 'Archived' },
                            { v: 'v3', name: 'sanket_bhat_v3_draft.pdf', date: '5/20/2026', status: 'Archived' }
                          ].map((row) => (
                            <tr key={row.v} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-semibold text-slate-800">{row.v}</td>
                              <td className="px-4 py-3 font-mono text-slate-700">{row.name}</td>
                              <td className="px-4 py-3 text-slate-500">{row.date}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.status === 'Active' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB C: OPPORTUNITY RADAR */}
              {activeTab === 'radar' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Recommended Openings */}
                  <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <Compass className="h-4.5 w-4.5 text-indigo-500" /> Opportunity Radar Matcher
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">Auto-matches real corporate drive openings based on your simulated CGPA and skills criteria</p>
                    </div>

                    <div className="space-y-4">
                      {companies.map((job) => {
                        const isEligible = student.cgpa >= job.minCgpa;
                        const matchType = isEligible ? 'HIGH MATCH' : 'INELIGIBLE';
                        const alreadyApplied = applications.some((app) => app.jobId === job.id);

                        return (
                          <div key={job.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-bold text-slate-900 text-sm">{job.name}</h3>
                                <p className="text-xs text-slate-500">{job.industry} — <span className="text-[#6366F1] font-semibold font-mono">{job.packageLpa} LPA</span></p>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                isEligible 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                  : 'bg-red-50 border-red-200 text-red-700'
                              }`}>
                                {matchType}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1 mb-3">
                              {job.requiredSkills.map(skill => (
                                <span key={skill} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{skill}</span>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                              <span className="text-[10px] text-slate-400">Min CGPA Required: <span className="font-mono font-bold text-slate-600">{job.minCgpa}</span></span>
                              {alreadyApplied ? (
                                <span className="text-[10px] font-semibold text-slate-400">Application Submitted</span>
                              ) : (
                                <button
                                  onClick={() => submitApplication(job.id)}
                                  disabled={!isEligible}
                                  className={`text-xs font-semibold px-3 py-1 rounded ${
                                    isEligible 
                                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors' 
                                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  Apply Now
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Company Battle V2 */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <Building2 className="h-4.5 w-4.5 text-indigo-500" /> Recruiter Battle Comparator
                      </h2>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compare Recruiter A</label>
                        <select 
                          value={battleA} 
                          onChange={(e) => {
                            setBattleA(e.target.value);
                            setBattleCompanies(e.target.value, battleB);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compare Recruiter B</label>
                        <select 
                          value={battleB} 
                          onChange={(e) => {
                            setBattleB(e.target.value);
                            setBattleCompanies(battleA, e.target.value);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="pt-2">
                        <button 
                          onClick={() => runAiTask('compare')}
                          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-2 px-3 border border-slate-200 rounded-lg transition-all text-xs"
                        >
                          Synthesize Comparative Analysis
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB D: STRUCTURED AI COPILOT */}
              {activeTab === 'copilot' && (
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                      <Zap className="h-4.5 w-4.5 text-indigo-500 animate-pulse" /> Structured AI Placement Copilot
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Select a structured workflow to run background analysis using FastAPI and ChromaDB</p>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: 'analyze-resume', label: 'Analyze Resume', desc: 'Verify ATS score & keywords' },
                      { id: 'find-eligible', label: 'Find Eligible Companies', desc: 'Extract listings matching CGPA' },
                      { id: 'compare', label: 'Compare Google vs Amazon', desc: 'Side-by-side selection statistics' },
                      { id: 'generate-questions', label: 'Generate Interview Questions', desc: 'Topics from past experience vault' },
                      { id: 'build-roadmap', label: 'Build 30-Day Roadmap', desc: 'Simulate weekly learning tasks' },
                      { id: 'improve-ats', label: 'Improve ATS Score', desc: 'Identify skill differences gaps' }
                    ].map((act) => (
                      <button
                        key={act.id}
                        onClick={() => runAiTask(act.id)}
                        className={`text-left p-3.5 border rounded-xl transition-all ${
                          aiAction === act.id 
                            ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900">{act.label}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{act.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Results Panel */}
                  <div className="border border-slate-200/60 rounded-2xl bg-slate-50/50 p-5 min-h-[160px] flex flex-col justify-center">
                    {aiLoading ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        <p className="text-xs text-slate-500 font-mono">Enqueuing BullMQ job &rarr; FastAPI &rarr; ChromaDB...</p>
                      </div>
                    ) : aiOutput ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                          <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                          <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">Analysis Result</h4>
                        </div>
                        
                        {/* ATS Score output */}
                        {aiAction === 'analyze-resume' && (
                          (() => {
                            const res = aiOutput as AIAnalyzeResumeResult;
                            return (
                              <div className="space-y-3 text-xs">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl font-black text-indigo-600 font-mono">{res.score}%</span>
                                  <span className="font-semibold text-slate-800">{res.verdict}</span>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-700">Matching Keywords:</p>
                                  {res.positives.map((pos: string) => <p key={pos} className="text-slate-500 pl-3 border-l-2 border-emerald-500">{pos}</p>)}
                                </div>
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-700">Missing Gaps:</p>
                                  {res.gaps.map((gap: string) => <p key={gap} className="text-slate-500 pl-3 border-l-2 border-red-500">{gap}</p>)}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* Eligible companies output */}
                        {aiAction === 'find-eligible' && (
                          (() => {
                            const res = aiOutput as AIFindEligibleResult;
                            return (
                              <div className="space-y-2 text-xs">
                                <p className="font-semibold text-slate-700">Matching opening directories ({res.eligible.length} found):</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {res.eligible.map((el) => (
                                    <div key={el.name} className="bg-white border border-slate-100 p-2.5 rounded-lg flex justify-between">
                                      <span className="font-bold text-slate-800">{el.name}</span>
                                      <span className="text-slate-500 font-mono">Min CGPA: {el.minCgpa} | {el.package} LPA</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* Battle synthesis output */}
                        {aiAction === 'compare' && (
                          (() => {
                            const res = aiOutput as AICompareResult;
                            return (
                              <div className="text-xs space-y-2">
                                <p className="text-slate-700 leading-relaxed"><strong className="text-slate-900">Battle Verdict:</strong> {res.verdict}</p>
                                <p className="text-indigo-600 font-semibold">Recommended path: {res.recommendation}</p>
                              </div>
                            );
                          })()
                        )}

                        {/* Interview questions output */}
                        {aiAction === 'generate-questions' && (
                          (() => {
                            const res = aiOutput as AIGenerateQuestionsResult;
                            return (
                              <div className="space-y-3 text-xs">
                                {res.questions.map((q, i: number) => (
                                  <div key={i} className="bg-white border border-slate-100 p-3 rounded-lg flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-slate-900">{q.question}</p>
                                      <p className="text-[10px] text-slate-400">Category: {q.topic}</p>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      q.difficulty === 'Hard' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                    }`}>
                                      {q.difficulty}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        )}

                        {/* Weekly roadmap output */}
                        {aiAction === 'build-roadmap' && (
                          (() => {
                            const res = aiOutput as AIBuildRoadmapResult;
                            return (
                              <div className="space-y-3 text-xs">
                                {res.phases.map((ph) => (
                                  <div key={ph.week} className="bg-white border border-slate-100 p-3 rounded-lg flex gap-3 items-center">
                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px]">{ph.week}</span>
                                    <span className="text-slate-700">{ph.topic}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        )}

                        {/* Skill gaps score output */}
                        {aiAction === 'improve-ats' && (
                          (() => {
                            const res = aiOutput as AIImproveAtsResult;
                            return (
                              <div className="space-y-3 text-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-700">Missing Core Skills:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {res.gaps.map((sk: string) => <span key={sk} className="bg-red-50 border border-red-100 text-red-700 font-semibold text-[10px] px-2 py-0.5 rounded-lg">{sk}</span>)}
                                  </div>
                                </div>
                                <div className="space-y-1 pt-1">
                                  <p className="font-semibold text-slate-700">Action Recommendations:</p>
                                  {res.recommendations.map((rec: string, i: number) => <p key={i} className="text-slate-500 pl-3 border-l-2 border-indigo-500">{rec}</p>)}
                                </div>
                              </div>
                            );
                          })()
                        )}

                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 py-6 gap-1">
                        <HelpCircle className="h-6 w-6 opacity-60" />
                        <p className="text-xs">No analysis running. Trigger a task above to generate output.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================== */}
          {/* RECRUITER PORTAL VIEWS                     */}
          {/* ========================================== */}
          {selectedRole === 'recruiter' && (
            <div className="space-y-6">
              
              {/* TAB A: RECRUITER OVERVIEW */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* KPI metrics cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                      { label: 'Active Job Openings', val: '8', desc: 'Campaign campaigns running' },
                      { label: 'Total Applicants', val: '321', desc: 'Applied across IT & CS' },
                      { label: 'Interviews Scheduled', val: '42', desc: 'Next 7 days schedule' }
                    ].map((kpi) => (
                      <div key={kpi.label} className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                        <p className="text-3xl font-black text-slate-900 mt-2">{kpi.val}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{kpi.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Candidate applications listing */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                      <h3 className="font-semibold text-sm text-slate-800">Pending Campaign Candidates</h3>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Showing latest applications</span>
                    </div>

                    <div className="space-y-3">
                      {[
                        { student: 'Sanket Bhat', branch: 'IT', cgpa: '9.12', job: 'SDE Intern', stage: 'INTERVIEW_ROUND' },
                        { student: 'Arjun Sharma', branch: 'COMPS', cgpa: '9.45', job: 'SDE FTE', stage: 'OA_CLEARED' },
                        { student: 'Priya Patil', branch: 'IT', cgpa: '8.80', job: 'Software Analyst', stage: 'APPLIED' }
                      ].map((cand, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50/50 transition-colors">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-900">{cand.student} <span className="font-mono text-[10px] text-slate-400">({cand.branch} | CGPA: {cand.cgpa})</span></p>
                            <p className="text-[10px] text-slate-500">Applied Role: {cand.job}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
                              {cand.stage}
                            </span>
                            <button 
                              onClick={() => {
                                // Simulate recruiter advancing candidate stage
                                alert(`Candidate ${cand.student} advanced successfully.`);
                              }}
                              className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                            >
                              Shortlist
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB B: CANDIDATES */}
              {activeTab === 'candidates' && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-800">Recruiter Applicant Directories</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Filter applicants based on CGPA cutoffs and overlap of required skills</p>
                    </div>
                  </div>

                  <div className="border border-slate-200/60 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Branch</th>
                          <th className="px-4 py-2.5">CGPA</th>
                          <th className="px-4 py-2.5">Skills Match</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { name: 'Sanket Bhat', branch: 'IT', cgpa: '9.12', match: '92%', status: 'Interviewing' },
                          { name: 'Arjun Sharma', branch: 'COMPS', cgpa: '9.45', match: '87%', status: 'OA Completed' },
                          { name: 'Sneha Kulkarni', branch: 'IT', cgpa: '8.30', match: '64%', status: 'Screened' },
                          { name: 'Rohan Joshi', branch: 'MECH', cgpa: '7.90', match: '40%', status: 'Under Review' }
                        ].map((row) => (
                          <tr key={row.name} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-semibold text-slate-800">{row.name}</td>
                            <td className="px-4 py-3 text-slate-500">{row.branch}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-700">{row.cgpa}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{row.match}</span>
                                <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-[#6366F1] h-full" style={{ width: row.match }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700">
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB C: JOBS CAMPAIGNS */}
              {activeTab === 'jobs' && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-800">Hiring Campaigns</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage live job listings, package details, and matching requirements</p>
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      Post New Opening
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {companies.slice(0, 3).map((job) => (
                      <div key={job.id} className="border border-slate-200/60 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-slate-900 text-sm">{job.name} — SDE</h4>
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">LIVE</span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">Package: {job.packageLpa} LPA | CGPA Cutoff: {job.minCgpa}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {job.requiredSkills.map(sk => <span key={sk} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{sk}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB D: INTERVIEWS CALENDAR */}
              {activeTab === 'calendar' && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-semibold text-sm text-slate-800">Drive Interview Schedules</h3>
                  </div>

                  <div className="space-y-3">
                    {[
                      { time: '10:00 AM - 11:00 AM', date: 'June 10', candidate: 'Sanket Bhat', round: 'Technical Round 1 (Algorithms)' },
                      { time: '11:30 AM - 12:30 PM', date: 'June 10', candidate: 'Arjun Sharma', round: 'Technical Round 1 (System Design)' },
                      { time: '02:00 PM - 03:00 PM', date: 'June 11', candidate: 'Priya Patil', round: 'Managerial Fit & Projects' }
                    ].map((item, i) => (
                      <div key={i} className="flex gap-4 p-3 border border-slate-100 rounded-lg text-xs items-center">
                        <div className="text-center font-mono py-1 px-3 bg-slate-50 border border-slate-200 rounded-lg flex-shrink-0">
                          <p className="text-[9px] font-bold text-indigo-600">{item.date.split(' ')[0]}</p>
                          <p className="text-sm font-bold text-slate-800">{item.date.split(' ')[1]}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{item.candidate} — <span className="text-indigo-600 font-medium">{item.round}</span></p>
                          <p className="text-[10px] text-slate-400">Scheduled slot: {item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================== */}
          {/* TPO PORTAL VIEWS                           */}
          {/* ========================================== */}
          {selectedRole === 'tpo' && (
            <div className="space-y-6">
              
              {/* TAB A: TPO OVERVIEW */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* PowerBI-style metrics cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    {[
                      { label: 'Placements Rate', val: '84.3%', desc: '245 / 300 Placed' },
                      { label: 'Average Package', val: '18.4 LPA', desc: 'Highest: 45 LPA' },
                      { label: 'Visiting Recruiters', val: '120', desc: 'Active campaigns' },
                      { label: 'Pending Drives', val: '15', desc: 'Tests scheduled' }
                    ].map((kpi) => (
                      <div key={kpi.label} className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                        <p className="text-3xl font-black text-slate-900 mt-2">{kpi.val}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{kpi.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Branch statistics splits */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="font-semibold text-sm text-slate-800">Branch Placements Analytics</h3>
                      </div>
                      <div className="space-y-3 text-xs">
                        {[
                          { branch: 'Information Technology', placed: '47 / 50', pct: 94 },
                          { branch: 'Computer Engineering', placed: '46 / 50', pct: 92 },
                          { branch: 'Electronics Engineering', placed: '38 / 50', pct: 76 },
                          { branch: 'Mechanical Engineering', placed: '30 / 50', pct: 60 }
                        ].map((br) => (
                          <div key={br.branch} className="space-y-1">
                            <div className="flex justify-between font-medium text-slate-700">
                              <span>{br.branch}</span>
                              <span className="font-mono">{br.placed} ({br.pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-[#6366F1] h-full" style={{ width: `${br.pct}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Drive calendar lists */}
                    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="font-semibold text-sm text-slate-800">Drive Timeline Calendar</h3>
                      </div>
                      <div className="space-y-3.5">
                        {[
                          { date: 'June 10', company: 'Amazon', task: 'Online Assessment drive' },
                          { date: 'June 12', company: 'Google', task: 'Pre-Placement Talk (PPT)' },
                          { date: 'June 15', company: 'J.P. Morgan', task: 'CodeForGood hackathon results' }
                        ].map((item, idx) => (
                          <div key={idx} className="flex gap-3 text-xs">
                            <div className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded font-mono text-center flex-shrink-0">
                              <p className="text-[9px] font-bold text-indigo-600 uppercase">{item.date.split(' ')[0]}</p>
                              <p className="text-xs font-bold text-slate-800">{item.date.split(' ')[1]}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{item.company}</p>
                              <p className="text-slate-500 text-[10px] mt-0.5">{item.task}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OTHER TPO TABS MOCKED IN SIMULATOR */}
              {activeTab !== 'dashboard' && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm text-center py-12 text-slate-500 text-xs">
                  <Activity className="h-8 w-8 mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="font-semibold">TPO Sub-panel: {activeTab} view</p>
                  <p className="mt-1">Use the Role Switcher at the top right to explore other simulated portals.</p>
                </div>
              )}

            </div>
          )}

          {/* ========================================== */}
          {/* ADMINISTRATOR PORTAL VIEWS                 */}
          {/* ========================================== */}
          {selectedRole === 'admin' && (
            <div className="space-y-6">
              
              {/* TAB A: ADMIN DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* System health diagnostics */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-semibold text-sm text-slate-800">System Connection Health</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      {[
                        { name: 'Database Connectivity', val: 'Postgre SQL', status: 'Online', desc: '5432 active pool' },
                        { name: 'Redis Cache Memory', val: 'Upstash Redis', status: 'Online', desc: '6379 clusters' },
                        { name: 'BullMQ Job Queues', val: 'BullMQ Workers', status: 'Active', desc: 'Listening 5 channels' },
                        { name: 'FastAPI AI Engine', val: 'FastAPI Service', status: 'Connected', desc: '8000 microservice' }
                      ].map((item) => (
                        <div key={item.name} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-between min-h-[90px]">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{item.name}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-bold text-slate-800 font-sans">{item.val}</span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security audit logs stream */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                      <h3 className="font-semibold text-sm text-slate-800">Real-Time Security Audit Logs</h3>
                      <span className="text-[10px] text-slate-400 font-mono">STREAMING IN REAL-TIME</span>
                    </div>

                    <div className="border border-slate-200/60 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">Action</th>
                            <th className="px-4 py-2.5">Actor</th>
                            <th className="px-4 py-2.5">IP Address</th>
                            <th className="px-4 py-2.5">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { action: 'RESUME_UPLOADED', actor: 'student:sbbhat_b22', ip: '192.168.1.104', date: 'June 9, 14:23:11' },
                            { action: 'JOB_APPLIED', actor: 'student:sbbhat_b22', ip: '192.168.1.104', date: 'June 9, 14:20:45' },
                            { action: 'SECURITY_REPLAY_BREACH', actor: 'user:attacker_x', ip: '203.0.113.50', date: 'June 8, 23:44:02' }
                          ].map((log, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                                  log.action.includes('BREACH') 
                                    ? 'bg-red-50 text-red-700 border border-red-200' 
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-700">{log.actor}</td>
                              <td className="px-4 py-3 font-mono text-slate-500">{log.ip}</td>
                              <td className="px-4 py-3 text-slate-400">{log.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* OTHER ADMIN TABS */}
              {activeTab !== 'dashboard' && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm text-center py-12 text-slate-500 text-xs">
                  <Database className="h-8 w-8 mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="font-semibold">Admin Registry: {activeTab} view</p>
                  <p className="mt-1">Redis evictions and BullMQ dashboard diagnostics live on this view.</p>
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* --- FUZZY OVERLAY: COMMAND PALETTE (CTRL+K) --- */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommandPaletteOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Dialog Panel */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-slate-800 font-sans"
            >
              <div className="p-4 flex items-center border-b border-slate-100">
                <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Simulate: type 'boost cgpa' or keyword search..."
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  className="w-full bg-white text-sm border-0 pl-3 focus:outline-none focus:ring-0 text-slate-900"
                />
                <button 
                  onClick={() => setCommandPaletteOpen(false)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Dynamic search results list */}
              {paletteQuery.trim() ? (
                <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                  {searching ? (
                    <div className="text-center text-xs text-slate-400 py-6">Searching...</div>
                  ) : searchResults ? (
                    <div className="space-y-3 p-2 text-xs">
                      {/* Companies search results */}
                      {searchResults.companies.length > 0 && (
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-1">Companies</p>
                          {searchResults.companies.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => executePaletteCommand(() => {
                                setSelectedRole('student');
                                setActiveTab('radar');
                              })}
                              className="p-2 hover:bg-slate-50 cursor-pointer rounded-lg font-semibold text-slate-800 flex justify-between"
                            >
                              <span>{c.name}</span>
                              <span className="text-slate-400">{c.industry}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Jobs search results */}
                      {searchResults.jobs.length > 0 && (
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-1">Jobs</p>
                          {searchResults.jobs.map(j => (
                            <div 
                              key={j.id} 
                              onClick={() => executePaletteCommand(() => {
                                setSelectedRole('student');
                                setActiveTab('radar');
                              })}
                              className="p-2 hover:bg-slate-50 cursor-pointer rounded-lg font-semibold text-slate-800 flex justify-between"
                            >
                              <span>{j.title}</span>
                              <span className="text-[#6366F1] font-mono">{j.packageLpa} LPA</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* No results */}
                      {searchResults.companies.length === 0 && searchResults.jobs.length === 0 && (
                        <div className="text-center text-slate-400 py-6 italic">No keyword match found. Try &apos;Google&apos; or &apos;SDE&apos;.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Static Simulation macros list */
                <div className="p-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2.5">Simulation Macros</p>
                  <div className="space-y-1 text-xs">
                    {[
                      { label: 'Boost CGPA to 9.80', desc: 'Increases simulated credentials for maximum opening matches', action: () => updateProfile({ cgpa: 9.80 }) },
                      { label: 'Boost Coding Score to 920', desc: 'Updates student simulated coding performance criteria', action: () => updateProfile({ codingScore: 920 }) }
                    ].map((cmd) => (
                      <button
                        key={cmd.label}
                        onClick={() => executePaletteCommand(cmd.action)}
                        className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{cmd.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{cmd.desc}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
