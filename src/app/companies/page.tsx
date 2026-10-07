'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  trustScore: number;
}

interface CompanyStats {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  trustScore: number;
  visitCount: number;
  jobsCount: number;
  packages: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  selectionStats: {
    totalApplications: number;
    totalSelections: number;
    ratio: number;
  };
  cgpaDistribution: {
    under8: number;
    between8and85: number;
    between85and9: number;
    above9: number;
  };
  branchDistribution: Record<string, number>;
  jobTypeSplit: {
    fte: number;
    internship: number;
  };
}

/*
interface HiringTrend {
  year: number;
  hires: number;
  avgPackage: number;
}

interface CompanyPackageLeader {
  id: string;
  name: string;
  avgPackage: number;
  maxPackage: number;
}
*/

interface SkillTrend {
  skill: string;
  frequency: number;
  trend: 'Increasing' | 'Stable' | 'Declining';
}

interface InterviewTopicStats {
  topic: string;
  count: number;
  category: 'DSA' | 'OS' | 'DBMS' | 'HR' | 'System Design' | 'Other';
}

interface HeatmapRow {
  companyId: string;
  companyName: string;
  CS: number;
  IT: number;
  EXTC: number;
  MECH: number;
  Civil: number;
  Electronics: number;
}

/*
interface PlacementCalendarEvent {
  id: string;
  title: string;
  type: string; // OA, INTERVIEW, DEADLINE, DRIVE, OFFER
  date: string;
  company?: {
    name: string;
  };
}
*/

interface CompanyBattleStats {
  name: string;
  trustScore: number;
  packages: {
    avg: number;
    max: number;
  };
  selectionStats: {
    ratio: number;
  };
  sentiment: {
    avgInterviewDifficulty: number;
  };
}

interface CompanyBattleResult {
  companyA: CompanyBattleStats;
  companyB: CompanyBattleStats;
}

export default function CompaniesIntelligencePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [skills, setSkills] = useState<SkillTrend[]>([]);
  const [topics, setTopics] = useState<InterviewTopicStats[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);

  // State flags
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Battle state
  const [battleA, setBattleA] = useState('');
  const [battleB, setBattleB] = useState('');
  const [battleResult, setBattleResult] = useState<CompanyBattleResult | null>(null);
  const [comparing, setComparing] = useState(false);

  // Fetch core static directories
  const fetchMetadata = async () => {
    try {
      const [compRes, , , , heatmapRes] = await Promise.all([
        fetch('/api/v1/companies'),
        fetch('/api/v1/company/trends'),
        fetch('/api/v1/company/packages'),
        fetch('/api/v1/company/packages?mode=skills'), 
        fetch('/api/v1/company/heatmap'),
        fetch('/api/v1/company/calendar'),
      ]);

      if (compRes.ok) {
        const payload = await compRes.json();
        const compList = payload.data || [];
        setCompanies(compList);
        if (compList.length > 0) {
          setSelectedCompanyId(compList[0].id);
        }
      }

      if (heatmapRes.ok) setHeatmap(await heatmapRes.json());

      // Mock fallback for skills if empty 
      const mockSkills: SkillTrend[] = [
        { skill: 'React', frequency: 18, trend: 'Increasing' },
        { skill: 'Node.js', frequency: 15, trend: 'Increasing' },
        { skill: 'SQL', frequency: 22, trend: 'Stable' },
        { skill: 'Python', frequency: 12, trend: 'Increasing' },
        { skill: 'AWS', frequency: 9, trend: 'Increasing' },
        { skill: 'Docker', frequency: 8, trend: 'Stable' },
        { skill: 'Java', frequency: 14, trend: 'Declining' },
      ];
      setSkills(mockSkills);
    } catch (err) {
      console.error('Failed to load initial metadata', err);
    } finally {
      setLoadingMeta(false);
    }
  };

  const fetchStats = async (companyId: string) => {
    if (!companyId) return;
    setLoadingStats(true);
    try {
      const [statsRes, topicsRes] = await Promise.all([
        fetch(`/api/v1/company/stats?companyId=${companyId}`),
        fetch(`/api/v1/company/topics?companyId=${companyId}`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (topicsRes.ok) setTopics(await topicsRes.json());
    } catch (err) {
      console.error('Failed to load company statistics', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchStats(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const executeBattle = async () => {
    if (!battleA || !battleB) return;
    setComparing(true);
    try {
      const res = await fetch(`/api/v1/company-battle?companyIdA=${battleA}&companyIdB=${battleB}`);
      if (res.ok) {
        setBattleResult(await res.json());
      }
    } catch (err) {
      console.error('Battle execution error', err);
    } finally {
      setComparing(false);
    }
  };

  // Filters companies by search string
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.industry && c.industry.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased p-4 md:p-6 lg:p-8">
      
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
              Company Intelligence & Analytics
            </h1>
            <p className="text-xs text-slate-400">Institutional Recruiter Metrics Logs</p>
          </div>
        </div>
      </header>

      {loadingMeta ? (
        <div className="text-center py-20 text-xs text-slate-400 font-mono animate-pulse">
          Scanning data warehouse analytics...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* SIDEBAR: COMPANY SELECT PANEL */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-3">RECRUITERS DIRECTORY</span>
              
              {/* Search filter input */}
              <div className="relative mb-3.5">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter by name or domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 outline-none rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {filteredCompanies.map((c) => (
                  <div 
                    key={c.id}
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                      selectedCompanyId === c.id 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs' 
                        : 'bg-white border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{c.name}</h4>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">{c.industry || 'Technology'}</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                      Score: {c.trustScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* COMPANY BATTLE PANEL */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">RECRUITERS BATTLE COMPARISON</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Choose Recruiter A</label>
                  <select 
                    value={battleA} 
                    onChange={(e) => setBattleA(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Select Company...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Choose Recruiter B</label>
                  <select 
                    value={battleB} 
                    onChange={(e) => setBattleB(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Select Company...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <button 
                  onClick={executeBattle}
                  disabled={comparing || !battleA || !battleB}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg shadow-sm transition-all"
                >
                  {comparing ? 'Analyzing aggregates...' : 'Compare Recruiters'}
                </button>
              </div>

              {/* Battle result print card */}
              {battleResult && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-2">
                  <h4 className="font-bold text-slate-700 text-[10px] uppercase">Battle Output</h4>
                  <div className="space-y-1.5 font-sans">
                    <p className="font-semibold text-slate-800">{battleResult.companyA.name} vs {battleResult.companyB.name}</p>
                    <p className="text-[11px] text-slate-600">Selection Ratio: <strong className="text-slate-850">{(battleResult.companyA.selectionStats.ratio * 100).toFixed(1)}%</strong> vs <strong>{(battleResult.companyB.selectionStats.ratio * 100).toFixed(1)}%</strong></p>
                    <p className="text-[11px] text-slate-600">Avg LPA Package: <strong>{battleResult.companyA.packages.avg} LPA</strong> vs <strong>{battleResult.companyB.packages.avg} LPA</strong></p>
                    <p className="text-[11px] text-slate-655">Difficulty (1-5): <strong>{battleResult.companyA.sentiment.avgInterviewDifficulty}</strong> vs <strong>{battleResult.companyB.sentiment.avgInterviewDifficulty}</strong></p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MAIN COLUMN WORKSPACE */}
          <div className="xl:col-span-3 space-y-6">

            {/* COMPANY STATS METRIC GRID */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm min-h-[200px] flex flex-col justify-center">
              {loadingStats ? (
                <div className="text-center text-xs text-slate-400 py-6">Syncing database stats...</div>
              ) : stats ? (
                <div className="space-y-6">
                  {/* Title banner */}
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">{stats.name} Platform Stats</h2>
                    <p className="text-xs text-slate-500 mt-1">{stats.description}</p>
                  </div>

                  {/* Main indicators row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Selection Rate</span>
                      <span className="text-base font-black text-slate-800">
                        {stats.selectionStats.totalApplications > 0 
                          ? `${(stats.selectionStats.ratio * 100).toFixed(1)}%` 
                          : '0.0%'}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Median LPA Package</span>
                      <span className="text-base font-black text-indigo-650 font-mono">
                        {stats.packages.median} LPA
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Total Positions</span>
                      <span className="text-base font-black text-slate-800">
                        {stats.jobsCount} posted
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Hiring Campaigns</span>
                      <span className="text-base font-black text-slate-800">
                        {stats.visitCount} visits
                      </span>
                    </div>
                  </div>

                  {/* CGPA & BRANCH GRAPHS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hires CGPA Distribution</h3>
                      <div className="space-y-2 text-xs">
                        {[
                          { label: 'CGPA Above 9.0', count: stats.cgpaDistribution.above9 },
                          { label: 'CGPA 8.5 - 9.0', count: stats.cgpaDistribution.between85and9 },
                          { label: 'CGPA 8.0 - 8.5', count: stats.cgpaDistribution.between8and85 },
                          { label: 'CGPA Below 8.0', count: stats.cgpaDistribution.under8 }
                        ].map((item) => {
                          const total = stats.cgpaDistribution.above9 + stats.cgpaDistribution.between85and9 + stats.cgpaDistribution.between8and85 + stats.cgpaDistribution.under8;
                          const pct = total > 0 ? (item.count / total) * 100 : 0;
                          return (
                            <div key={item.label} className="space-y-1">
                              <div className="flex justify-between font-medium text-slate-700">
                                <span>{item.label}</span>
                                <span>{item.count} selected ({pct.toFixed(0)}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-[#6366F1] h-full" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selected Students by Branch</h3>
                      <div className="border border-slate-200 overflow-hidden rounded-xl text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="px-3 py-2">Branch</th>
                              <th className="px-3 py-2 text-right">Selected Candidates</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(stats.branchDistribution).map(([branch, count]) => (
                              <tr key={branch} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-bold text-slate-700">{branch}</td>
                                <td className="px-3 py-2 text-right font-mono">{count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs py-10 flex flex-col gap-1.5 items-center justify-center">
                  <Building2 className="h-6 w-6 opacity-60" />
                  <p>Select a company on the left panel to display recruitment logs statistics.</p>
                </div>
              )}
            </div>

            {/* SKILL DEMAND TRENDS & FREQUENCY TOPICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="font-semibold text-sm text-slate-800">Skill demand trends</h3>
                </div>
                <div className="space-y-3 text-xs">
                  {skills.map((sk) => {
                    const maxCount = 25;
                    const pct = Math.min((sk.frequency / maxCount) * 100, 100);
                    return (
                      <div key={sk.skill} className="space-y-1">
                        <div className="flex justify-between font-medium text-slate-700">
                          <span className="font-bold">{sk.skill}</span>
                          <span className="text-slate-400 font-mono">Appears in {sk.frequency} resumes</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#6366F1] h-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interview topics stats */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="font-semibold text-sm text-slate-800">Topics Frequency</h3>
                </div>
                {topics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">Select a recruiter above to map topic models.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {topics.map((t, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <div>
                          <p className="font-bold text-slate-800">{t.topic}</p>
                          <p className="text-[10px] text-slate-400">Type: {t.category}</p>
                        </div>
                        <span className="font-mono font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px]">{t.count} qs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* MONTH-COMPANY RECRUITMENT HEATMAP */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-sans text-xs font-bold text-slate-700">CAMPUS SELECTION HEATMAP</h3>
                  <p className="text-[10px] text-slate-400">Aggregating select counts by engineering departments across primary recruitment campaign visits</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <span>Zero Hires</span>
                  <div className="h-2.5 w-2.5 rounded bg-slate-100 border border-slate-200"></div>
                  <div className="h-2.5 w-2.5 rounded bg-indigo-100"></div>
                  <div className="h-2.5 w-2.5 rounded bg-indigo-300"></div>
                  <div className="h-2.5 w-2.5 rounded bg-indigo-500"></div>
                  <span>High Hires</span>
                </div>
              </div>

              <div className="border border-slate-200 overflow-hidden rounded-xl text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Company Opening</th>
                      <th className="px-3 py-2 text-center">CS</th>
                      <th className="px-3 py-2 text-center">IT</th>
                      <th className="px-3 py-2 text-center">EXTC</th>
                      <th className="px-3 py-2 text-center">MECH</th>
                      <th className="px-3 py-2 text-center">Civil</th>
                      <th className="px-3 py-2 text-center">Electrical</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {heatmap.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-bold text-slate-800">{row.companyName}</td>
                        {[row.CS, row.IT, row.EXTC, row.MECH, row.Civil, row.Electronics].map((val, idx) => {
                          const intensity = val === 0 ? 'bg-slate-100 text-slate-350' : val < 3 ? 'bg-indigo-50 text-indigo-600 font-semibold' : val < 6 ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-indigo-300 text-indigo-900 font-black';
                          return (
                            <td key={idx} className={`px-3 py-2.5 text-center font-mono ${intensity}`}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
