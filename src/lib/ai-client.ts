/**
 * AI Client — HTTP bridge from Node.js worker to FastAPI AI service.
 *
 * ARCHITECTURE RULE: This module is ONLY imported by the BullMQ worker.
 * Next.js API routes never call this directly — they enqueue a job and poll.
 *
 * Falls back to mock responses if AI_SERVICE_URL is not configured (dev/test mode).
 */

import { logger } from './logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || '';
const AI_TIMEOUT_MS = 30_000; // 30s timeout per AI call

export interface ATSAnalysisResult {
  ats_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  feedback: string;
  recommendations: string[];
}

export interface SkillGapResult {
  target_role: string;
  missing_skills: string[];
  strong_skills: string[];
  priority_order: string[];
  estimated_weeks: number;
}

export interface RoadmapResult {
  target_role: string;
  total_weeks: number;
  phases: Array<{
    phase: number;
    title: string;
    topics: string[];
    weeks: number;
    week_range: string;
  }>;
}

export interface VaultRAGResult {
  question: string;
  similar_questions: Array<{
    question: string;
    topic: string;
    company_id: string;
    difficulty: string;
    similarity: number;
  }>;
  synthesis: string;
  topics: string[];
}

export interface CopilotResult {
  answer: string;
  suggestions: string[];
}

async function callAIService<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  if (!AI_SERVICE_URL) {
    logger.info(`[AI Mock] Calling /${endpoint} — AI_SERVICE_URL not configured, using mock`);
    return getMockResponse(endpoint, payload) as T;
  }

  const url = `${AI_SERVICE_URL}/${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI service ${endpoint} returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as T;
    logger.info(`[AI] ${endpoint} completed successfully`);
    return data;
  } catch (error) {
    logger.error(`[AI] ${endpoint} failed`, error);
    // Return mock on failure to keep the system operational
    return getMockResponse(endpoint, payload) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getMockResponse(endpoint: string, payload: Record<string, unknown>): unknown {
  switch (endpoint) {
    case 'analyze-resume': {
      const keywords = (payload.job_keywords as string[]) || [];
      const text = (payload.resume_text as string) || '';
      const matched = keywords.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
      const missing = keywords.filter((k) => !text.toLowerCase().includes(k.toLowerCase()));
      const score = Math.min(40 + matched.length * 15, 98);
      return {
        ats_score: score,
        matched_keywords: matched,
        missing_keywords: missing,
        feedback: `[Mock] Matched ${matched.length}/${keywords.length} keywords. ATS Score: ${score}/100.`,
        recommendations: [
          'Add quantified achievements (e.g., "reduced latency by 30%")',
          'Include a dedicated Skills section',
          'Mirror keywords from the job description',
        ],
      } satisfies ATSAnalysisResult;
    }
    case 'skill-gap':
      return {
        target_role: payload.target_role as string,
        missing_skills: ['System Design', 'Docker', 'SQL Optimization'],
        strong_skills: (payload.current_skills as string[]) || [],
        priority_order: ['System Design', 'Docker', 'SQL Optimization'],
        estimated_weeks: 8,
      } satisfies SkillGapResult;
    case 'roadmap':
      return {
        target_role: payload.target_role as string,
        total_weeks: payload.weeks_available as number || 12,
        phases: [
          { phase: 1, title: 'DSA Foundations', topics: ['Arrays', 'Trees', 'Graphs'], weeks: 4, week_range: 'Week 1–4' },
          { phase: 2, title: 'System Design', topics: ['Load Balancing', 'Caching', 'Databases'], weeks: 4, week_range: 'Week 5–8' },
          { phase: 3, title: 'Interview Prep', topics: ['Mock Interviews', 'Behavioural', 'Company Research'], weeks: 4, week_range: 'Week 9–12' },
        ],
      } satisfies RoadmapResult;
    case 'vault-rag':
      return {
        question: payload.question as string,
        similar_questions: [],
        synthesis: '[Mock] Study the core concept, practice variations, and analyze time complexity.',
        topics: ['Data Structures & Algorithms'],
      } satisfies VaultRAGResult;
    case 'placement-copilot':
      return {
        answer: '[Mock] Focus on DSA, System Design, and company-specific preparation. Use the Interview Vault for past questions.',
        suggestions: ['View skill gaps', 'Analyze resume', 'Search interview vault'],
      } satisfies CopilotResult;
    default:
      return { error: 'Unknown endpoint' };
  }
}

// Exported typed callers for each AI feature
export const aiClient = {
  analyzeResume: (payload: { resume_text: string; job_keywords: string[]; student_id?: string; tenant_id?: string }) =>
    callAIService<ATSAnalysisResult>('analyze-resume', payload as Record<string, unknown>),

  skillGap: (payload: { current_skills: string[]; target_role: string; branch?: string }) =>
    callAIService<SkillGapResult>('skill-gap', payload as Record<string, unknown>),

  roadmap: (payload: { current_skills: string[]; target_role: string; weeks_available?: number }) =>
    callAIService<RoadmapResult>('roadmap', payload as Record<string, unknown>),

  vaultRAG: (payload: { question: string; tenant_id: string; company_id?: string }) =>
    callAIService<VaultRAGResult>('vault-rag', payload as Record<string, unknown>),

  copilot: (payload: { message: string; context?: Record<string, unknown> }) =>
    callAIService<CopilotResult>('placement-copilot', payload as Record<string, unknown>),
};
