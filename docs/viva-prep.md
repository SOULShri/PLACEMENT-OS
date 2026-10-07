# PlacementOS — Viva Preparation Guide

13 technical questions you should be able to answer confidently in any interview or viva.

---

## 1. Why Next.js?

**Short answer**: Co-location, SSR, Edge middleware, and monorepo simplicity.

**Detailed**: Next.js App Router lets you colocate API routes with UI components in a single repository. This means one `npm run dev`, one deployment, and no CORS issues between frontend and backend. SSR is critical for placement dashboards — student data should never be fetched client-side because it exposes auth tokens in browser network tabs. Edge middleware enforces JWT validation and rate limiting before requests even reach API routes, which is faster than middleware in Express. Finally, Next.js 15 with Turbopack compiles 10x faster than Webpack, which matters during active development.

---

## 2. Why Prisma?

**Short answer**: Type safety from schema to query, zero SQL injection risk, migration tooling.

**Detailed**: Prisma generates TypeScript types from `schema.prisma`, so every query is type-safe at compile time. If you rename a field, the compiler tells you every place that breaks — no runtime surprises. The `where: { tenantId }` pattern is enforced by TypeScript types, making accidental cross-tenant queries impossible. Prisma Migrate provides version-controlled, reproducible database migrations — the same migrations run locally, in CI, and in production, guaranteeing schema consistency. Compared to raw SQL (pg driver), Prisma eliminates injection vectors via parameterized queries by default.

---

## 3. Why PostgreSQL?

**Short answer**: ACID transactions, JSONB for flexible data, composite indexes, proven at scale.

**Detailed**: Placement data is inherently relational — students apply to jobs posted by companies in tenants. PostgreSQL's foreign keys and cascade deletes enforce referential integrity that MongoDB cannot. `timelineHistory` uses `JSONB` — this lets us store a flexible array of `{ status, timestamp, note }` without an extra table, while still being queryable. Composite indexes like `(tenantId, createdAt)` allow paginated queries across 300 students in microseconds. PostgreSQL is deployed on Neon for production, which provides serverless branching — each PR can have an isolated database branch for testing.

---

## 4. Why Redis?

**Short answer**: Sub-millisecond cache reads, BullMQ's reliable queue backend, pattern-based invalidation.

**Detailed**: Company Battle comparisons aggregate data from multiple tables — without caching, each comparison runs 8–10 Prisma queries. Redis TTL caching stores these aggregates for 15 minutes, reducing P99 latency from ~200ms to ~3ms. BullMQ requires Redis for its queue state — job IDs, retry counts, DLQ entries, and worker locks all live in Redis. The `SCAN + DEL` pattern allows cache key eviction by glob pattern (e.g., `battle:*`) when company data changes, avoiding stale reads. In production, Upstash provides serverless Redis with TLS encryption and automatic failover.

---

## 5. Why BullMQ?

**Short answer**: Reliable job delivery, retry with exponential backoff, dead letter queue, priority queues.

**Detailed**: AI analysis (ATS scoring, RAG queries) takes 2–30 seconds. Doing this synchronously in an API route would block the Next.js server thread and time out the user's browser. BullMQ moves this to a background worker: the API returns `202 Accepted + jobId` immediately, the worker processes the job, and the browser polls `GET /api/v1/ai/analyze-resume?jobId=xxx`. If the worker crashes, BullMQ retries with exponential backoff (`2s → 4s → 8s`). After 3 failures, the job moves to the Dead Letter Queue for manual inspection. This is the same pattern used by Stripe, GitHub Actions, and Linear for async processing.

---

## 6. Why ChromaDB?

**Short answer**: Local-first vector store, no GPU required, runs in Docker, semantically searches interview questions.

**Detailed**: ChromaDB stores embeddings of 100+ interview questions. When a student asks "How do I solve a binary tree problem?", ChromaDB finds semantically similar past questions using `all-MiniLM-L6-v2` cosine similarity — not just keyword matching. This works offline (no OpenAI API key needed), runs on CPU (no VRAM requirement), and is open source. For production, ChromaDB Cloud provides a managed instance. Compared to `pgvector`, ChromaDB has a simpler Python SDK and natively integrates with sentence-transformers.

---

## 7. Why Multi-tenancy?

**Short answer**: One deployment serves VJTI, COEP, ICT — different institutions, isolated data, shared infrastructure.

**Detailed**: PlacementOS is designed as a SaaS platform. Every `Student`, `Company`, `Job`, `Application`, and `AuditLog` record has a `tenantId` foreign key. The JWT access token carries `tenantId` as a signed claim. Every repository method adds `where: { tenantId: payload.tenantId }` — making it cryptographically impossible to read another institution's data even if an attacker somehow gets a valid token from Tenant A. The single-database, shared-schema pattern keeps infrastructure costs low while strict row-level filtering provides logical isolation equivalent to separate databases.

---

## 8. Why Audit Logs?

**Short answer**: Security compliance, breach forensics, GDPR traceability, and Refresh Token Rotation alerting.

**Detailed**: The `AuditLog` table records every state-changing action: `RESUME_UPLOADED`, `JOB_APPLIED`, `COMPANY_UPDATED`, `SECURITY_REPLAY_BREACH`. In a placement system, a TPO needs to know if a recruiter modified student data, or if a student application was submitted on their behalf. `SECURITY_REPLAY_BREACH` entries are created when RTR detects a stolen refresh token replay — the admin can query `WHERE action = 'SECURITY_REPLAY_BREACH'` to identify breach IP addresses. Without audit logs, forensic investigation after a breach is impossible.

---

## 9. Why the Repository Pattern?

**Short answer**: Testability, DI, and the ability to swap Prisma for a different ORM without touching business logic.

**Detailed**: Every data access method lives in a Repository class (`StudentRepository`, `CompanyRepository`, etc.). Tests mock the repository interface — they never touch real PostgreSQL. This gives us 59 passing tests without a running database. The Dependency Injection Container (`container.ts`) wires concrete implementations to service classes. If we ever need to migrate from Prisma to Drizzle, only the repository implementations change — services, API routes, and tests remain untouched. This is the same pattern used in enterprise Spring Boot applications, just adapted for TypeScript.

---

## 10. Why RAG instead of fine-tuning?

**Short answer**: No training data needed, always fresh, no GPU cost, interpretable sources.

**Detailed**: Fine-tuning requires thousands of labeled question-answer pairs and GPU compute (typically $50–500 per training run). Results are also frozen — a fine-tuned model doesn't know about new interview questions added next month. RAG (Retrieval-Augmented Generation) instead: (1) embeds new questions into ChromaDB as they're added, (2) at query time, retrieves the 5 most similar past questions, (3) synthesizes an answer from that context. The retrieval step is deterministic and auditable — you can show the user exactly which past questions influenced the answer. This is why OpenAI, Notion, and Linear use RAG for their in-app assistants rather than fine-tuned models.

---

## 11. How does Refresh Token Rotation work?

**Short answer**: Every refresh invalidates the old token. A replayed old token triggers full session wipe.

**Detailed**:
```
Login → issue accessToken (15min) + refreshToken (7d)
                    ↓
AccessToken expires → POST /api/auth/refresh with refreshToken
                    ↓
Session table: check refreshToken exists AND matches userId
  → Found: delete old session, create new session with new refreshToken
  → Return new accessToken (15min) + new refreshToken (7d)
  → NOT Found (already rotated): BREACH DETECTED
      → Delete ALL sessions for that user
      → Log SECURITY_REPLAY_BREACH audit entry
      → Return 401 — all devices logged out
```
This prevents token replay attacks. If an attacker steals a refresh token and uses it after the legitimate user has already rotated it, the system detects the reuse and locks down the entire account.

---

## 12. How does Tenant Isolation work?

**Short answer**: `tenantId` is signed into the JWT. Every database query filters by `tenantId`. No cross-tenant access is possible.

**Detailed**:
```
1. Login → JWT payload: { userId, tenantId, role, exp }
2. JWT is signed with HS256 using JWT_ACCESS_SECRET
3. API routes call authenticateRequest(req) → verifies JWT → extracts payload
4. Every repository method: prisma.student.findMany({ where: { tenantId: payload.tenantId } })
5. Client cannot inject a different tenantId — it's embedded in the signed token
6. Even if an attacker modifies the request body with tenantId: "other-tenant", the repository ignores it
```
This is a single-database multi-tenant design. Data is not physically isolated (no separate schemas or databases per tenant), but logical isolation is enforced at the repository layer on every query. The pattern is identical to how Vercel, Stripe, and Linear handle multi-tenancy.

---

## 13. How does Company Intelligence work?

**Short answer**: Pure relational aggregates — no AI, no vectors. TypeScript statistics on Prisma query results.

**Detailed**:
- **Selection Rate**: `COUNT(applications WHERE status=SELECTED) / COUNT(ALL applications)` per company
- **Median Package**: Prisma fetches all `packageLpa` values for selected applications → sorts in JavaScript → `array[mid]`
- **CGPA Distribution**: Groups selected students by CGPA ranges (9+, 8–9, 7–8, <7) using filter chains
- **Skill Trends**: Counts how many active resumes contain each of 7 tracked skills using `array.filter().length`
- **Heatmap**: Groups applications by `month(createdAt)` and company using `Intl.DateTimeFormat`
- **Global Search**: `prisma.company.findMany({ where: { name: { contains: q, mode: 'insensitive' } } })` across 5 entities in parallel
- **Placement Replay**: Queries `PlacementEvent` and `Application` tables, groups by date, renders 364 cells

No LLMs involved. Every metric is computable from existing relational data. This is what makes the system fast, deterministic, and auditable.
