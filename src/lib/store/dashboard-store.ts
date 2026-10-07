import { create } from 'zustand';

export interface StudentProfile {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  personalEmail: string;
  cgpa: number;
  branch: string;
  skills: string[];
  codingScore: number;
  atsScore: number;
  atsFeedback: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  trustScore: number;
  minCgpa: number;
  requiredSkills: string[];
  packageLpa: number;
}

export interface Application {
  id: string;
  jobId: string;
  companyName: string;
  title: string;
  status: 'APPLIED' | 'OA_CLEARED' | 'INTERVIEW_ROUND' | 'SELECTED' | 'REJECTED';
  packageLpa: number;
  timeline: { status: string; timestamp: string; note: string }[];
}

export interface DashboardState {
  student: StudentProfile;
  companies: Company[];
  applications: Application[];
  selectedCompanyA: string;
  selectedCompanyB: string;
  commandPaletteOpen: boolean;
  searchQuery: string;
  readinessScore: number;
  missingSkills: string[];
  recommendedJobs: Company[];
  
  // Actions
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  updateProfile: (updates: Partial<StudentProfile>) => void;
  submitApplication: (jobId: string) => void;
  setBattleCompanies: (compA: string, compB: string) => void;
  recalculateSimulator: () => void;
  advanceApplicationStatus: (appId: string) => void;
}

// Initial mock data to ensure dashboard displays high-fidelity state immediately
const initialCompanies: Company[] = [
  { id: 'c-1', name: 'Google', industry: 'Tech', trustScore: 4.9, minCgpa: 8.5, requiredSkills: ['Go', 'Algorithms', 'Distributed Systems'], packageLpa: 32.5 },
  { id: 'c-2', name: 'Microsoft', industry: 'Tech', trustScore: 4.8, minCgpa: 8.0, requiredSkills: ['C#', 'SQL', 'System Design'], packageLpa: 28.0 },
  { id: 'c-3', name: 'Amazon', industry: 'E-Commerce', trustScore: 4.7, minCgpa: 8.2, requiredSkills: ['Java', 'AWS', 'Data Structures'], packageLpa: 30.0 },
  { id: 'c-4', name: 'Morgan Stanley', industry: 'Finance', trustScore: 4.6, minCgpa: 7.8, requiredSkills: ['C++', 'Multithreading', 'Linux'], packageLpa: 22.0 },
  { id: 'c-5', name: 'Barclays', industry: 'Finance', trustScore: 4.4, minCgpa: 7.5, requiredSkills: ['Java', 'Spring Boot', 'REST APIs'], packageLpa: 14.5 },
];

const initialApplications: Application[] = [
  {
    id: 'a-1',
    jobId: 'c-3',
    companyName: 'Amazon',
    title: 'SDE Intern',
    status: 'INTERVIEW_ROUND',
    packageLpa: 30.0,
    timeline: [
      { status: 'APPLIED', timestamp: '2026-06-01T10:00:00.000Z', note: 'Resume parsed and uploaded successfully.' },
      { status: 'OA_CLEARED', timestamp: '2026-06-04T14:30:00.000Z', note: 'Passed both coding problems in 45 mins.' },
      { status: 'INTERVIEW_ROUND', timestamp: '2026-06-08T09:00:00.000Z', note: 'Technical Round 1: Data structures & OS.' },
    ],
  },
  {
    id: 'a-2',
    jobId: 'c-4',
    companyName: 'Morgan Stanley',
    title: 'Technology Analyst',
    status: 'SELECTED',
    packageLpa: 22.0,
    timeline: [
      { status: 'APPLIED', timestamp: '2026-05-25T11:00:00.000Z', note: 'Application registered.' },
      { status: 'OA_CLEARED', timestamp: '2026-05-28T16:00:00.000Z', note: 'Cleared online assessment.' },
      { status: 'INTERVIEW_ROUND', timestamp: '2026-06-02T10:00:00.000Z', note: 'Technical Round 1 & 2 completed.' },
      { status: 'SELECTED', timestamp: '2026-06-05T17:00:00.000Z', note: 'Congratulations! Final offer extended.' },
    ],
  },
];

export const useDashboardStore = create<DashboardState>((set, get) => ({
  student: {
    id: 's-vjti-1',
    studentId: '221080045',
    name: 'Sanket Bhat',
    email: 'sbbhat_b22@it.vjti.ac.in',
    phone: '+91-9876543210',
    personalEmail: 'sanket.bhat@gmail.com',
    cgpa: 9.12,
    branch: 'IT',
    skills: ['React', 'TypeScript', 'Node.js', 'SQL', 'Data Structures'],
    codingScore: 820,
    atsScore: 88,
    atsFeedback: 'Strong keyword overlap on React and SQL. Recommended action: Add more cloud computing / AWS metrics.',
  },
  companies: initialCompanies,
  applications: initialApplications,
  selectedCompanyA: 'c-1',
  selectedCompanyB: 'c-2',
  commandPaletteOpen: false,
  searchQuery: '',
  readinessScore: 84,
  missingSkills: ['System Design', 'AWS', 'Go'],
  recommendedJobs: [initialCompanies[0], initialCompanies[2]],

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  updateProfile: (updates) => {
    set((state) => ({
      student: { ...state.student, ...updates },
    }));
    get().recalculateSimulator();
  },

  submitApplication: (jobId) => {
    const { student, companies, applications } = get();
    const job = companies.find((c) => c.id === jobId);
    if (!job) return;

    // Prevents duplicate applications
    if (applications.some((app) => app.jobId === jobId)) return;

    // Enforce eligibility cutoff check
    if (student.cgpa < job.minCgpa) return;

    const newApp: Application = {
      id: `a-${Date.now()}`,
      jobId,
      companyName: job.name,
      title: 'Graduate Engineer Trainee',
      status: 'APPLIED',
      packageLpa: job.packageLpa,
      timeline: [
        {
          status: 'APPLIED',
          timestamp: new Date().toISOString(),
          note: 'Application submitted successfully via PlacementOS.',
        },
      ],
    };

    set({ applications: [...applications, newApp] });
  },

  setBattleCompanies: (compA, compB) => set({ selectedCompanyA: compA, selectedCompanyB: compB }),

  recalculateSimulator: () => {
    const { student, companies } = get();
    
    // 1. Calculate Readiness Score (bounded between 20 and 99)
    const cgpaWeight = student.cgpa * 6; // max 60
    const codeWeight = student.codingScore / 25; // max 40
    const skillWeight = student.skills.length * 3; // max 30
    const rawScore = cgpaWeight + codeWeight + skillWeight;
    const readinessScore = Math.min(Math.max(Math.round(rawScore / 1.3), 30), 99);

    // 2. Filter eligible jobs
    const eligibleJobs = companies.filter((job) => student.cgpa >= job.minCgpa);
    
    // 3. Match missing skills
    const allDemandedSkills = Array.from(
      new Set(companies.flatMap((c) => c.requiredSkills))
    );
    const missingSkills = allDemandedSkills.filter(
      (skill) => !student.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
    ).slice(0, 4);

    // 4. Recommendation based on packages
    const recommendedJobs = [...eligibleJobs]
      .sort((a, b) => b.packageLpa - a.packageLpa)
      .slice(0, 2);

    set({ readinessScore, missingSkills, recommendedJobs });
  },

  advanceApplicationStatus: (appId) => {
    const { applications } = get();
    const appIndex = applications.findIndex((a) => a.id === appId);
    if (appIndex === -1) return;

    const app = applications[appIndex];
    let nextStatus: Application['status'] = 'APPLIED';
    let note = '';

    switch (app.status) {
      case 'APPLIED':
        nextStatus = 'OA_CLEARED';
        note = 'Cleared online assessment with 100% test case match.';
        break;
      case 'OA_CLEARED':
        nextStatus = 'INTERVIEW_ROUND';
        note = 'Technical interview scheduled with SDE panel.';
        break;
      case 'INTERVIEW_ROUND':
        nextStatus = 'SELECTED';
        note = 'Congratulations! Placed successfully at this company.';
        break;
      case 'SELECTED':
        return; // Already selected, final state
    }

    const updatedTimeline = [
      ...app.timeline,
      {
        status: nextStatus,
        timestamp: new Date().toISOString(),
        note,
      },
    ];

    const updatedApplications = [...applications];
    updatedApplications[appIndex] = {
      ...app,
      status: nextStatus,
      timeline: updatedTimeline,
    };

    set({ applications: updatedApplications });
  },
}));
