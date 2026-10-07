'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  UploadCloud, 
  ArrowLeftRight, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Trash2, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardStore } from '@/lib/store/dashboard-store';

interface ResumeVersion {
  id: string;
  filename: string;
  version: number;
  size: number;
  hash: string;
  skills: string[];
  education: string;
  projects: string[];
  isActive: boolean;
  createdAt: string;
}

export default function IdentityPage() {
  const { student, applications, updateProfile } = useDashboardStore();
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Form states for resume details input (diff parsing simulator mock)
  const [inputSkills, setInputSkills] = useState('React, TypeScript, Next.js, Node.js, SQL, System Design');
  const [inputEducation, setInputEducation] = useState('B.Tech in Information Technology - VJTI (2027)');
  const [inputProjects, setInputProjects] = useState('PlacementOS Monorepo SaaS, Secure PDF WASM Sandbox');

  // Diff states
  const [diffA, setDiffA] = useState('');
  const [diffB, setDiffB] = useState('');

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchResumeHistory = async () => {
    try {
      const res = await fetch('/api/v1/resume/history');
      if (res.ok) {
        const data = await res.json();
        setResumes(data);
      }
    } catch (err) {
      console.error('Failed to load resume history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumeHistory();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Upload handler
  const handleFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('File exceeds 10MB size limit', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('skills', inputSkills);
    formData.append('education', inputEducation);
    formData.append('projects', inputProjects);

    try {
      const res = await fetch('/api/v1/resume', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const newResume = await res.json();
        showToast(`Successfully uploaded Version ${newResume.version}`);
        
        // Sync Zustand store active resume metadata
        updateProfile({
          atsFeedback: `Resume Version ${newResume.version} processed successfully. Keyword overlap looks excellent.`,
        });

        fetchResumeHistory();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Upload validation failed', 'error');
      }
    } catch (err) {
      console.error('Upload connection error', err);
      showToast('Connection error during upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => {
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Activate Version
  const activateResume = async (resumeId: string) => {
    try {
      const res = await fetch('/api/v1/resume/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId }),
      });

      if (res.ok) {
        showToast('Version activated successfully');
        fetchResumeHistory();
      } else {
        const err = await res.json();
        showToast(err.error || 'Activation failed', 'error');
      }
    } catch {
      showToast('Activation query error', 'error');
    }
  };

  // Delete Version
  const deleteResume = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/resume?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast('Resume version deleted');
        fetchResumeHistory();
      } else {
        const err = await res.json();
        showToast(err.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Deletion query error', 'error');
    }
  };

  // Diff Calculations
  const activeResume = resumes.find(r => r.isActive);
  const compResumeA = resumes.find(r => r.id === diffA);
  const compResumeB = resumes.find(r => r.id === diffB);

  // Compute skill differences
  const getDiffs = () => {
    if (!compResumeA || !compResumeB) return null;
    
    const skillsA = compResumeA.skills.map(s => s.toLowerCase());
    const skillsB = compResumeB.skills.map(s => s.toLowerCase());

    const addedSkills = compResumeB.skills.filter(s => !skillsA.includes(s.toLowerCase()));
    const removedSkills = compResumeA.skills.filter(s => !skillsB.includes(s.toLowerCase()));
    const matchingSkills = compResumeB.skills.filter(s => skillsA.includes(s.toLowerCase()));

    const projectsA = compResumeA.projects.map(p => p.toLowerCase());
    const projectsB = compResumeB.projects.map(p => p.toLowerCase());

    const addedProjects = compResumeB.projects.filter(p => !projectsA.includes(p.toLowerCase()));
    const removedProjects = compResumeA.projects.filter(p => !projectsB.includes(p.toLowerCase()));

    return {
      addedSkills,
      removedSkills,
      matchingSkills,
      addedProjects,
      removedProjects,
      eduA: compResumeA.education,
      eduB: compResumeB.education,
    };
  };

  const diffResult = getDiffs();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased p-4 md:p-6 lg:p-8">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg border flex items-center gap-2 text-sm shadow-lg ${
              toast.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="h-8 w-8 bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-center transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:text-slate-800" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 font-sans">
              Placement Identity & Resume Vault
            </h1>
            <p className="text-xs text-slate-400">Manage versioned resume files and verify credentials metrics</p>
          </div>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-xs font-semibold bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg">
            Secure Profile Verified
          </span>
        </div>
      </header>

      {/* CENTRAL 2-COLUMN PROFILE WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. LEFT COLUMN: STUDENT METRIC IDENTITY CARD */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4 mb-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-lg">
                SB
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{student.name}</h3>
                <p className="text-xs text-slate-500">{student.branch} Engineering Branch</p>
              </div>
            </div>

            {/* Profile Statistics Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">CGPA Value</span>
                <span className="font-bold font-mono text-slate-800 text-base">{student.cgpa.toFixed(2)} / 10.0</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Coding Score</span>
                <span className="font-bold font-mono text-indigo-600 text-base">{student.codingScore} pts</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Active Version</span>
                <span className="font-bold font-mono text-slate-800 text-base">
                  {activeResume ? `Version ${activeResume.version}` : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Applications</span>
                <span className="font-bold font-mono text-slate-800 text-base">{applications.length} filed</span>
              </div>
            </div>

            {/* Skills chip display */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-2">Verified Professional Skills</span>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                {student.skills.map((skill) => (
                  <span 
                    key={skill}
                    className="text-[11px] bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2.5 py-0.5"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* SIMULATED METADATA METRIC FOR DIFFERENTIALS */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> METADATA INPUT MOCKS (DIFF SIMULATION)
              </h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Define the parsed metadata values below to simulate skills and project modifications across upload versions:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">MOCK SKILLS</label>
                <input 
                  type="text" 
                  value={inputSkills}
                  onChange={(e) => setInputSkills(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">MOCK EDUCATION</label>
                <input 
                  type="text" 
                  value={inputEducation}
                  onChange={(e) => setInputEducation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">MOCK PROJECTS</label>
                <textarea 
                  value={inputProjects}
                  onChange={(e) => setInputProjects(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 font-mono text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. MIDDLE & RIGHT COLUMN: RESUME CONTROLS, PREVIEW & DIFFERENTIALS */}
        <div className="lg:col-span-2 space-y-6">

          {/* ACTIVE VERSION CONTROL MANAGER */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" /> RESUME VERSION MANAGER
            </h2>

            {/* Drag & drop upload target */}
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                dragOver 
                  ? 'border-indigo-500 bg-indigo-50/50' 
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <input 
                type="file" 
                id="resumeFileInput"
                accept=".pdf,.docx"
                onChange={onFileChange}
                className="hidden" 
              />
              <label htmlFor="resumeFileInput" className="cursor-pointer flex flex-col items-center justify-center">
                <UploadCloud className="h-9 w-9 text-indigo-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  {uploading ? 'Processing security validations...' : 'Drag resume file here or click to browse'}
                </p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-mono text-[9px]">SUPPORTS PDF & DOCX FILES UP TO 10MB</p>
              </label>
            </div>

            {/* History Table */}
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-2">Revision File System ({resumes.length} versions)</span>
              
              {loading ? (
                <p className="text-xs text-slate-400 py-4">Scanning repository history...</p>
              ) : resumes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No uploads registered in the repository.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 grid grid-cols-12 font-mono text-slate-500 text-[10px]">
                    <span className="col-span-2">VERSION</span>
                    <span className="col-span-4">FILENAME</span>
                    <span className="col-span-3">UPLOADED AT</span>
                    <span className="col-span-3 text-right">ACTIONS</span>
                  </div>

                  <div className="divide-y divide-slate-150">
                    {resumes.map((res) => (
                      <div 
                        key={res.id}
                        className={`px-4 py-3 grid grid-cols-12 items-center transition-colors ${
                          res.isActive ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <span className="col-span-2 font-mono font-bold flex items-center gap-1.5">
                          v{res.version}
                          {res.isActive && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
                          )}
                        </span>
                        <span className="col-span-4 font-mono truncate text-slate-700">{res.filename}</span>
                        <span className="col-span-3 text-slate-500" suppressHydrationWarning>{new Date(res.createdAt).toLocaleDateString()}</span>
                        
                        <div className="col-span-3 flex justify-end gap-2">
                          {!res.isActive && (
                            <button
                              onClick={() => activateResume(res.id)}
                              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-mono transition-colors font-semibold"
                            >
                              ACTIVATE
                            </button>
                          )}
                          <a
                            href={`/api/v1/resume/view?id=${res.id}`}
                            download
                            className="bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 p-1 rounded transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          <button
                            onClick={() => deleteResume(res.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent p-1 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resume Preview Window */}
            {activeResume && activeResume.filename.toLowerCase().endsWith('.pdf') && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-2">ACTIVE RESUME PDF PREVIEW</span>
                <div className="h-[380px] w-full border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <iframe 
                    src={`/api/v1/resume/view?id=${activeResume.id}#toolbar=0`} 
                    className="w-full h-full"
                    title="Active Resume Preview"
                  />
                </div>
              </div>
            )}
          </div>

          {/* GITHUB STYLE RESUME DIFF VIEWER */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-indigo-500" /> RESUME VERSION COMPARATOR
              </h2>
              <span className="text-[10px] text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">VERSION COMPARE</span>
            </div>

            {/* Select dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">COMPARE VERSION A (OLD)</label>
                <select
                  value={diffA}
                  onChange={(e) => setDiffA(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs rounded-lg p-2 text-slate-700 cursor-pointer"
                >
                  <option value="">Select Version A...</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>Version {r.version} ({r.filename})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">COMPARE VERSION B (NEW)</label>
                <select
                  value={diffB}
                  onChange={(e) => setDiffB(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs rounded-lg p-2 text-slate-700 cursor-pointer"
                >
                  <option value="">Select Version B...</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>Version {r.version} ({r.filename})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Differential Output details */}
            {!diffA || !diffB ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                Select two resume versions above to display change diff reports.
              </div>
            ) : diffResult ? (
              <div className="space-y-4 text-xs">
                
                {/* Skills Diff */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 font-sans text-[10px] uppercase">Skills Changes</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    {diffResult.addedSkills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#22C55E] font-bold mr-1.5">+ ADDED:</span>
                        {diffResult.addedSkills.map(s => (
                          <span key={s} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">{s}</span>
                        ))}
                      </div>
                    )}
                    {diffResult.removedSkills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#EF4444] font-bold mr-1.5">- REMOVED:</span>
                        {diffResult.removedSkills.map(s => (
                          <span key={s} className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full line-through">{s}</span>
                        ))}
                      </div>
                    )}
                    {diffResult.addedSkills.length === 0 && diffResult.removedSkills.length === 0 && (
                      <p className="text-slate-400 italic">No skill sets added or removed.</p>
                    )}
                  </div>
                </div>

                {/* Projects Diff */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 font-sans text-[10px] uppercase">Projects Changes</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    {diffResult.addedProjects.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-[#22C55E] font-bold block">+ ADDED PROJECTS:</span>
                        {diffResult.addedProjects.map(p => (
                          <div key={p} className="flex items-center gap-2 text-emerald-700 font-semibold">
                            <span>+</span>
                            <span className="font-mono">{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {diffResult.removedProjects.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-[#EF4444] font-bold block">- REMOVED PROJECTS:</span>
                        {diffResult.removedProjects.map(p => (
                          <div key={p} className="flex items-center gap-2 text-red-750 line-through">
                            <span>-</span>
                            <span className="font-mono">{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {diffResult.addedProjects.length === 0 && diffResult.removedProjects.length === 0 && (
                      <p className="text-slate-400 italic">No projects modified.</p>
                    )}
                  </div>
                </div>

                {/* Education Diff */}
                {diffResult.eduA !== diffResult.eduB && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 font-sans text-[10px] uppercase">Education Changes</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 font-mono">
                      <p className="text-red-600 line-through">- {diffResult.eduA}</p>
                      <p className="text-emerald-600">+ {diffResult.eduB}</p>
                    </div>
                  </div>
                )}

              </div>
            ) : null}
          </div>

        </div>

      </div>

      {/* PLACEMENT REPLAY SECTION */}
      <div className="mt-6 bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" /> Placement Event Replay timeline
          </h2>
          <span className="text-[10px] text-indigo-650 font-mono bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
            SYSTEM ENGINE REPLAY
          </span>
        </div>

        {/* 1. Milestone Timeline Pipeline */}
        <div className="relative pt-2">
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-150 -translate-y-1/2 hidden md:block"></div>
          <div className="grid grid-cols-2 md:grid-cols-8 gap-4 relative z-10 text-center">
            {[
              { id: 'sem1', label: 'Semester 1', desc: 'CGPA Setup & Academics', status: 'completed' },
              { id: 'sem2', label: 'Semester 2', desc: 'DSA Foundations Prep', status: 'completed' },
              { id: 'proj', label: 'Projects Added', desc: 'SaaS Architecture Built', status: 'completed' },
              { id: 'res', label: 'Resume Sync', desc: 'WASM Upload Checks Passed', status: 'completed' },
              { id: 'apply', label: 'Applied 20 Jobs', desc: 'Radar Cutoff Matches', status: 'completed' },
              { id: 'oa', label: 'OA Cleared', desc: 'Passed Coding Assessments', status: 'completed' },
              { id: 'int', label: 'Interview Round', desc: 'Technical Loops Screen', status: 'completed' },
              { id: 'sel', label: 'Selected Offer', desc: 'Google Offer Confirmed', status: 'active' },
            ].map((step, idx) => (
              <div key={step.id} className="flex flex-col items-center space-y-2">
                <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all ${
                  step.status === 'active' 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}>
                  {idx + 1}
                </div>
                <div className="space-y-0.5">
                  <h4 className={`text-xs font-bold ${step.status === 'active' ? 'text-indigo-600' : 'text-slate-800'}`}>{step.label}</h4>
                  <p className="text-[10px] text-slate-400 leading-tight max-w-[120px] mx-auto">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. GitHub-style Activity Heatmap Grid */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
            <div>
              <h3 className="font-sans text-xs font-bold text-slate-700">
                PLACEMENT ACTIVITY CONTRIBUTION HEATMAP
              </h3>
              <p className="text-[10px] text-slate-400">
                Visualizing student daily credentials simulator saves and job application events
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span>Less</span>
              <div className="h-2.5 w-2.5 rounded bg-slate-100 border border-slate-200"></div>
              <div className="h-2.5 w-2.5 rounded bg-indigo-100"></div>
              <div className="h-2.5 w-2.5 rounded bg-indigo-300"></div>
              <div className="h-2.5 w-2.5 rounded bg-indigo-500"></div>
              <div className="h-2.5 w-2.5 rounded bg-indigo-650"></div>
              <span>More</span>
            </div>
          </div>

          {/* Grid render */}
          <div className="overflow-x-auto pb-1">
            <div className="grid grid-flow-col grid-rows-7 gap-[3px] min-w-[640px]">
              {Array.from({ length: 364 }).map((_, idx) => {
                // Generate simulated values
                let density = 'bg-slate-100 border-slate-100/50';
                if (idx % 12 === 0) density = 'bg-indigo-100 border-indigo-200/20';
                else if (idx % 23 === 0) density = 'bg-indigo-300 border-indigo-400/20';
                else if (idx % 37 === 0) density = 'bg-indigo-500 border-indigo-500/20';
                else if (idx % 57 === 0) density = 'bg-indigo-650 border-indigo-600/20';

                return (
                  <div 
                    key={idx} 
                    className={`h-2.5 w-2.5 rounded-[1px] border ${density} hover:scale-125 transition-transform cursor-pointer`}
                    title={`Day ${idx + 1}: activity logged`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
