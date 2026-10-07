"""
PlacementOS AI Service — FastAPI Application
Exposes 5 endpoints consumed exclusively by the BullMQ worker (never called from browser):

  POST /analyze-resume   → ATS score + keyword match feedback
  POST /skill-gap        → Missing skills vs target role
  POST /roadmap          → Step-by-step learning roadmap
  POST /vault-rag        → RAG query over ChromaDB interview vault
  POST /placement-copilot → General placement Q&A
  POST /ingest-vault     → Admin: index interview questions into ChromaDB

All responses are JSON. All computation is CPU-only (no GPU required).
"""

import os
import re
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# ChromaDB service (graceful fallback if Chroma not running)
try:
    from chroma_service import query_vault, ingest_vault_questions, ingest_resume_chunk
    CHROMA_AVAILABLE = True
except Exception:
    CHROMA_AVAILABLE = False

app = FastAPI(
    title="PlacementOS AI Service",
    description="Internal AI microservice — consumed via BullMQ, never directly by browser",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class AnalyzeResumeRequest(BaseModel):
    resume_text: str = Field(..., min_length=10)
    job_keywords: List[str] = Field(..., min_items=1)
    student_id: Optional[str] = None
    tenant_id: Optional[str] = None

class AnalyzeResumeResponse(BaseModel):
    ats_score: int
    matched_keywords: List[str]
    missing_keywords: List[str]
    feedback: str
    recommendations: List[str]


class SkillGapRequest(BaseModel):
    current_skills: List[str]
    target_role: str
    branch: Optional[str] = None

class SkillGapResponse(BaseModel):
    target_role: str
    missing_skills: List[str]
    strong_skills: List[str]
    priority_order: List[str]
    estimated_weeks: int


class RoadmapRequest(BaseModel):
    current_skills: List[str]
    target_role: str
    weeks_available: int = Field(default=12, ge=4, le=52)

class RoadmapResponse(BaseModel):
    target_role: str
    total_weeks: int
    phases: List[dict]


class VaultRAGRequest(BaseModel):
    question: str = Field(..., min_length=5)
    company_id: Optional[str] = None
    tenant_id: str

class VaultRAGResponse(BaseModel):
    question: str
    similar_questions: List[dict]
    synthesis: str
    topics: List[str]


class CopilotRequest(BaseModel):
    message: str = Field(..., min_length=3)
    context: Optional[dict] = None

class CopilotResponse(BaseModel):
    answer: str
    suggestions: List[str]


class IngestVaultRequest(BaseModel):
    questions: List[dict]

# ---------------------------------------------------------------------------
# Role Skill Maps (deterministic, no LLM needed for gap analysis)
# ---------------------------------------------------------------------------

ROLE_SKILL_MAP = {
    "sde": ["Data Structures", "Algorithms", "System Design", "OOP", "SQL", "Git", "REST APIs"],
    "frontend": ["React", "TypeScript", "CSS", "HTML", "JavaScript", "Next.js", "Webpack"],
    "backend": ["Node.js", "Python", "SQL", "PostgreSQL", "REST APIs", "Docker", "Redis"],
    "fullstack": ["React", "Node.js", "TypeScript", "SQL", "Docker", "Git", "REST APIs"],
    "data engineer": ["Python", "SQL", "Spark", "Kafka", "Airflow", "AWS", "Data Modeling"],
    "devops": ["Docker", "Kubernetes", "CI/CD", "Linux", "AWS", "Terraform", "Bash"],
    "ml engineer": ["Python", "PyTorch", "scikit-learn", "SQL", "Docker", "MLflow", "Statistics"],
    "analyst": ["SQL", "Python", "Excel", "Tableau", "Statistics", "Data Visualization"],
}

ROADMAP_PHASES = {
    "sde": [
        {"phase": 1, "title": "DSA Foundations", "topics": ["Arrays", "Strings", "Linked Lists", "Stacks/Queues"], "weeks": 3},
        {"phase": 2, "title": "Core DSA", "topics": ["Trees", "Graphs", "Heaps", "Tries"], "weeks": 3},
        {"phase": 3, "title": "Advanced DSA", "topics": ["Dynamic Programming", "Backtracking", "Bit Manipulation"], "weeks": 3},
        {"phase": 4, "title": "System Design", "topics": ["Load Balancing", "Caching", "Databases", "Microservices"], "weeks": 3},
    ],
    "frontend": [
        {"phase": 1, "title": "JavaScript Mastery", "topics": ["ES6+", "Promises", "Event Loop", "DOM"], "weeks": 2},
        {"phase": 2, "title": "React Ecosystem", "topics": ["Components", "Hooks", "State Management", "React Router"], "weeks": 3},
        {"phase": 3, "title": "TypeScript + Next.js", "topics": ["Type System", "Generics", "App Router", "SSR"], "weeks": 3},
        {"phase": 4, "title": "Production Skills", "topics": ["Testing", "Performance", "Accessibility", "CI/CD"], "weeks": 4},
    ],
    "default": [
        {"phase": 1, "title": "Core Fundamentals", "topics": ["Programming Basics", "Data Structures", "Algorithms"], "weeks": 4},
        {"phase": 2, "title": "Domain Skills", "topics": ["Role-specific technologies", "Projects"], "weeks": 4},
        {"phase": 3, "title": "Interview Prep", "topics": ["Mock interviews", "Problem solving", "Communication"], "weeks": 4},
    ],
}

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "chroma": CHROMA_AVAILABLE}


@app.post("/analyze-resume", response_model=AnalyzeResumeResponse)
def analyze_resume(req: AnalyzeResumeRequest):
    """
    ATS score: keyword match percentage + section completeness heuristics.
    No external API calls — pure text analysis.
    """
    text_lower = req.resume_text.lower()
    matched = [kw for kw in req.job_keywords if kw.lower() in text_lower]
    missing = [kw for kw in req.job_keywords if kw.lower() not in text_lower]

    # Base score: keyword match ratio (60% weight)
    match_ratio = len(matched) / max(len(req.job_keywords), 1)
    keyword_score = match_ratio * 60

    # Section completeness heuristics (40% weight)
    sections = {
        "experience": any(w in text_lower for w in ["experience", "intern", "project", "work"]),
        "education": any(w in text_lower for w in ["education", "university", "college", "b.tech", "degree"]),
        "skills": any(w in text_lower for w in ["skills", "technologies", "stack"]),
        "contact": any(w in text_lower for w in ["email", "phone", "linkedin", "github"]),
    }
    section_score = (sum(sections.values()) / 4) * 40
    ats_score = min(int(keyword_score + section_score), 98)

    # Generate recommendations
    recommendations = []
    if not sections["experience"]:
        recommendations.append("Add a dedicated Experience/Projects section with measurable outcomes.")
    if not sections["skills"]:
        recommendations.append("Add a Skills section listing all technical competencies.")
    if missing:
        recommendations.append(f"Incorporate these missing keywords naturally: {', '.join(missing[:3])}.")
    if len(req.resume_text) < 500:
        recommendations.append("Resume appears too short — add more project details and metrics.")
    if ats_score >= 80:
        recommendations.append("Strong keyword alignment. Ensure quantified achievements (e.g., 'reduced latency by 30%').")

    feedback = (
        f"Matched {len(matched)}/{len(req.job_keywords)} keywords. "
        f"ATS score: {ats_score}/100. "
        f"{'All key sections present.' if all(sections.values()) else 'Some sections are missing — see recommendations.'}"
    )

    # Optionally ingest resume into ChromaDB for future similarity search
    if CHROMA_AVAILABLE and req.student_id and req.tenant_id:
        try:
            ingest_resume_chunk(req.student_id, req.tenant_id, req.resume_text)
        except Exception:
            pass

    return AnalyzeResumeResponse(
        ats_score=ats_score,
        matched_keywords=matched,
        missing_keywords=missing,
        feedback=feedback,
        recommendations=recommendations,
    )


@app.post("/skill-gap", response_model=SkillGapResponse)
def skill_gap(req: SkillGapRequest):
    """
    Compares student's current skills against role requirements.
    Uses deterministic role→skill mapping, no LLM.
    """
    role_key = req.target_role.lower()
    # Find closest matching role
    matched_role = "default"
    for key in ROLE_SKILL_MAP:
        if key in role_key or role_key in key:
            matched_role = key
            break

    required = ROLE_SKILL_MAP.get(matched_role, ROLE_SKILL_MAP["sde"])
    current_lower = [s.lower() for s in req.current_skills]

    strong = [r for r in required if r.lower() in current_lower]
    missing = [r for r in required if r.lower() not in current_lower]

    # Priority order: missing skills sorted by typical interview frequency
    priority = missing[:6]  # Top 6 gaps

    # Rough estimate: 2 weeks per missing skill (with parallel learning)
    estimated_weeks = max(len(missing) * 2 // 3, 2)

    return SkillGapResponse(
        target_role=req.target_role,
        missing_skills=missing,
        strong_skills=strong,
        priority_order=priority,
        estimated_weeks=estimated_weeks,
    )


@app.post("/roadmap", response_model=RoadmapResponse)
def roadmap(req: RoadmapRequest):
    """
    Generates a phased learning roadmap based on target role.
    Phases are scaled to fit the available week count.
    """
    role_key = req.target_role.lower()
    template = ROADMAP_PHASES.get("default")
    for key in ROADMAP_PHASES:
        if key != "default" and (key in role_key or role_key in key):
            template = ROADMAP_PHASES[key]
            break

    # Scale phase weeks to fit available time
    total_template_weeks = sum(p["weeks"] for p in template)
    scale = req.weeks_available / max(total_template_weeks, 1)

    phases = []
    week_cursor = 1
    for p in template:
        scaled_weeks = max(int(p["weeks"] * scale), 1)
        phases.append({
            "phase": p["phase"],
            "title": p["title"],
            "topics": p["topics"],
            "weeks": scaled_weeks,
            "week_range": f"Week {week_cursor}–{week_cursor + scaled_weeks - 1}",
        })
        week_cursor += scaled_weeks

    return RoadmapResponse(
        target_role=req.target_role,
        total_weeks=req.weeks_available,
        phases=phases,
    )


@app.post("/vault-rag", response_model=VaultRAGResponse)
def vault_rag(req: VaultRAGRequest):
    """
    RAG query over ChromaDB interview vault.
    Returns similar past questions + a synthesis answer.
    Falls back to topic-based keyword search if Chroma unavailable.
    """
    similar_questions = []

    if CHROMA_AVAILABLE:
        similar_questions = query_vault(
            query=req.question,
            tenant_id=req.tenant_id,
            company_id=req.company_id,
            top_k=5,
        )

    # Fallback: keyword-based topic detection
    q_lower = req.question.lower()
    topics = []
    topic_map = {
        "tree": "Trees & Binary Search Trees",
        "graph": "Graph Theory (BFS/DFS)",
        "dp": "Dynamic Programming",
        "dynamic": "Dynamic Programming",
        "sql": "SQL & Database Queries",
        "join": "SQL Joins",
        "os": "Operating Systems",
        "process": "Process & Thread Management",
        "cache": "Caching & Redis",
        "design": "System Design",
        "linked list": "Linked Lists",
        "sort": "Sorting Algorithms",
        "hash": "Hashing & Hash Maps",
    }
    for keyword, topic in topic_map.items():
        if keyword in q_lower and topic not in topics:
            topics.append(topic)

    if not topics:
        topics = ["General Computer Science"]

    # Generate synthesis from similar questions context
    if similar_questions:
        context = " ".join(q["question"] for q in similar_questions[:3])
        synthesis = (
            f"Based on {len(similar_questions)} similar past interview questions, "
            f"this topic frequently appears in {topics[0]} rounds. "
            f"Key patterns to study: {', '.join(q['topic'] for q in similar_questions[:3] if q.get('topic'))}. "
            f"Focus on understanding time complexity and edge cases."
        )
    else:
        synthesis = (
            f"This question relates to {topics[0]}. "
            f"Study the core concept thoroughly — interviewers often follow up with complexity analysis. "
            f"Practice 5-7 variations of this problem on LeetCode before your interview."
        )

    return VaultRAGResponse(
        question=req.question,
        similar_questions=similar_questions,
        synthesis=synthesis,
        topics=topics,
    )


@app.post("/placement-copilot", response_model=CopilotResponse)
def placement_copilot(req: CopilotRequest):
    """
    General placement Q&A copilot.
    Matches common placement queries to structured advice patterns.
    No external API — deterministic pattern matching.
    """
    msg_lower = req.message.lower()
    context = req.context or {}

    # Pattern matching for common placement queries
    patterns = [
        (["resume", "cv", "ats"], (
            "For ATS-optimized resumes: (1) Mirror exact keywords from the job description. "
            "(2) Use a single-column format — ATS systems struggle with multi-column layouts. "
            "(3) Quantify every achievement (e.g., 'reduced API latency by 40%'). "
            "(4) Keep it to 1 page for < 3 years experience.",
            ["Upload your resume to get an ATS score", "View skill gaps for target role", "Generate learning roadmap"]
        )),
        (["cgpa", "cutoff", "eligible"], (
            "Most top-tier companies (Google, Microsoft, Goldman) set 7.5–8.0 CGPA cutoffs. "
            "If your CGPA is below cutoff: focus on companies without CGPA filters, "
            "build strong project portfolios, and target startups or product companies. "
            "Your skills and projects often matter more than CGPA for tech roles.",
            ["Check eligible companies in Opportunity Radar", "View company CGPA cutoffs in Company Intelligence"]
        )),
        (["interview", "prepare", "round"], (
            "Interview preparation roadmap: (1) DSA: 150 LeetCode problems covering arrays, trees, graphs, and DP. "
            "(2) System Design: Study distributed systems concepts — consistent hashing, CAP theorem, load balancing. "
            "(3) CS Fundamentals: DBMS (SQL joins, normalization), OS (scheduling, deadlocks), Networks. "
            "(4) Behavioral: Prepare STAR-format answers for leadership, failure, and teamwork scenarios.",
            ["Search interview vault for company-specific questions", "Generate role-specific roadmap"]
        )),
        (["package", "salary", "lpa", "ctc"], (
            "Package ranges by company tier in campus placements: "
            "Tier 1 (Google, Microsoft, Goldman): 30–60 LPA. "
            "Tier 2 (Barclays, Oracle, Capgemini): 10–25 LPA. "
            "Service companies (TCS, Infosys): 3.5–7 LPA. "
            "Negotiate with competing offers — always have a backup offer before negotiating.",
            ["Compare packages in Company Battle", "View package distribution in Company Intelligence"]
        )),
        (["skill", "learn", "roadmap", "tech"], (
            "For SDE roles: prioritize DSA > System Design > one backend framework (Node.js/Spring) > one cloud platform. "
            "For frontend: React + TypeScript + Next.js is the most in-demand stack in 2025. "
            "For data roles: Python + SQL + one distributed system (Spark/Kafka) covers 80% of JD requirements.",
            ["Generate personalized roadmap", "View skill demand trends in Company Intelligence"]
        )),
    ]

    answer = (
        "I can help with resume optimization, interview preparation, company research, "
        "skill gap analysis, and placement strategy. What specific aspect would you like to explore?"
    )
    suggestions = ["Analyze my resume", "Show skill gaps for SDE role", "Generate interview roadmap"]

    for keywords, (response, sugs) in patterns:
        if any(kw in msg_lower for kw in keywords):
            answer = response
            suggestions = sugs
            break

    # Personalize if context provided
    if context.get("cgpa"):
        cgpa = context["cgpa"]
        if cgpa < 7.5:
            answer += f" With CGPA {cgpa}, focus on skill-based companies that don't filter on grades."
        elif cgpa >= 9.0:
            answer += f" Your CGPA {cgpa} makes you eligible for all companies — prioritize early applications."

    return CopilotResponse(answer=answer, suggestions=suggestions)


@app.post("/ingest-vault")
def ingest_vault(req: IngestVaultRequest):
    """Admin endpoint to bulk-index interview questions into ChromaDB."""
    if not CHROMA_AVAILABLE:
        raise HTTPException(status_code=503, detail="ChromaDB not available")
    count = ingest_vault_questions(req.questions)
    return {"ingested": count}
