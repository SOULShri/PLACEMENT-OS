# PlacementOS Database Architecture & Caching Strategy

This document describes the PostgreSQL schema models, relational association constraints, composite indexing rules, and Redis caching layers deployed in PlacementOS.

---

## Database Schema Model Relationships

Our schema maps multi-tenant isolation, session audit trails, and placement milestones:

```
                  ┌──────────────┐
                  │    Tenant    │
                  └──────┬───────┘
                         │ 1
        ┌────────────────┼────────────────┬────────────────┐
        │ 1:N            │ 1:N            │ 1:N            │ 1:N
        ▼                ▼                ▼                ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │   Student   │  │   Company   │  │   AuditLog  │  │   Session   │
 └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘
        │ 1              │ 1
        │ 1:N            │ 1:N
        ▼                ▼
 ┌─────────────┐  ┌─────────────┐
 │ Application │◄─┤     Job     │
 └─────────────┘  └─────────────┘
```

### Associations & Cascade Contraints
1. **Tenant (1) -> Student (N)**: Cascade deletion not enforced.
2. **Student (1) -> UserPreference (1)**: Casade deletion.
3. **Student (1) -> Application (N)**: Casade deletion.
4. **Company (1) -> Job (N)**: Cascade deletion. If a recruiter company node is deleted, its related openings are automatically purged.
5. **Job (1) -> Application (N)**: Cascade deletion.
6. **Student (1) -> Resume (N)**: Cascade deletion.

### Resume Schema Details

The `Resume` table stores student resumes (PDF/DOCX) using PostgreSQL's `Bytes` (`bytea`) field for high portability across local/Docker environments without requiring external object store mocks (like AWS S3).

| Field | Type | Constraint / Default | Purpose |
|---|---|---|---|
| `id` | `String` | Primary Key (UUID) | Unique identifier for each resume version. |
| `tenantId` | `String` | Foreign Key | Multi-tenant institutional partition identifier. |
| `studentId` | `String` | Foreign Key (onDelete: Cascade) | Identifies the student owner. |
| `filename` | `String` | - | Name of the uploaded file (e.g., `resume.pdf`). |
| `version` | `Int` | Default: 1 | Tracks version iterations incrementally. |
| `size` | `Int` | - | File size in bytes. |
| `hash` | `String` | - | SHA-256 integrity hash to prevent duplicate uploads. |
| `content` | `Bytes` | `bytea` binary | Raw binary file content stored inside PostgreSQL. |
| `skills` | `String[]` | - | Extracted skills associated with the resume. |
| `education` | `String?` | - | Extracted education snippet. |
| `projects` | `String[]` | - | Extracted project descriptions. |
| `isActive` | `Boolean` | Default: false | Marks if this version is active for job applications. |
| `createdAt` | `DateTime` | Now | Upload timestamp. |
| `updatedAt` | `DateTime` | Auto-update | Modification tracking. |
| `deletedAt` | `DateTime?` | Nullable | Field used for soft deletion. |

---

## Indexing Policy & Optimizations

To handle high-read analytical operations during active placement seasons (such as searching matching candidates or comparing company aggregates), the database enforces specific indexing rules:

| Table | Index Columns | Index Type | Purpose |
|---|---|---|---|
| **Student** | `[tenantId, createdAt]` | Composite | Speeds up paginated candidate queries. |
| **Student** | `[studentId, createdAt]` | Composite | Roll number lookup and indexing. |
| **Company** | `[tenantId, createdAt]` | Composite | Speeds up company lists query scanning. |
| **Company** | `[name]` | Single-column | Prevents duplicate names in tenant. |
| **Job** | `[tenantId, createdAt]` | Composite | Speeds up opportunity lists. |
| **Job** | `[companyId, tenantId]` | Composite | Optimizes recruiter salary comparisons. |
| **Application** | `[tenantId, createdAt]` | Composite | Speeds up application list tracking. |
| **Application** | `[studentId, createdAt]` | Composite | Optimizes student application dashboard. |
| **Application** | `[jobId, createdAt]` | Composite | Speeds up recruiter applicant dashboards. |
| **InterviewVault** | `[companyId, tenantId]` | Composite | Speeds up company battle topic aggregates. |
| **StudentSentiment**| `[companyId, tenantId]` | Composite | Speeds up sentiment calculation scans. |
| **Resume** | `[tenantId, studentId]` | Composite | Speeds up version history query scanning. |
| **Resume** | `[studentId, isActive]` | Composite | Optimizes profile active version lookups. |
| **Session** | `[refreshToken]` | Unique Index | Optimizes token matching for session rotation. |
| **PlacementEvent** | `[tenantId, date]` | Composite | Optimizes placement calendar range queries. |
| **PlacementEvent** | `[companyId, tenantId]` | Composite | Optimizes company-specific event lookups. |

---

## Sprint 7 Schema Additions

### New Fields on Existing Tables

#### `Company` Table (Sprint 7 additions)
| Field | Type | Default | Purpose |
|---|---|---|---|
| `visitCount` | `Int` | `0` | Number of times this company has visited for campus recruitment. |
| `description` | `String?` | `null` | Free-text company description for the recruiter profile page. |

#### `Job` Table (Sprint 7 additions)
| Field | Type | Enum | Purpose |
|---|---|---|---|
| `type` | `JobType` | `FTE` | Whether the opening is a Full-Time Employee (`FTE`) or `INTERNSHIP` role. |

### `PlacementEvent` Table (Sprint 7 — New)

Stores time-stamped institutional placement milestones (campus drives, PPTs, OA events). Used by the placement calendar and Placement Replay contribution grid.

| Field | Type | Constraint | Purpose |
|---|---|---|---|
| `id` | `String` | Primary Key (UUID) | Unique event identifier. |
| `tenantId` | `String` | Foreign Key | Multi-tenant partition. |
| `companyId` | `String?` | Foreign Key (nullable) | Optional link to a specific company. |
| `title` | `String` | — | Event display name (e.g., "Google PPT"). |
| `type` | `String` | — | Category tag (e.g., `PPT`, `OA`, `INTERVIEW`, `OFFER`, `RESULT`). |
| `date` | `DateTime` | — | Scheduled event date and time. |
| `description` | `String?` | Nullable | Extended event notes. |
| `createdAt` | `DateTime` | Now | Record creation timestamp. |

### `JobType` Enum (Sprint 7 — New)
```prisma
enum JobType {
  FTE
  INTERNSHIP
}
```

---

## Redis Caching Strategy

Caching is handled by the unified `cacheManager` utilizing Redis TTLs:
1. **Read-Through Recruiter Battle Aggregates**:
   - **Endpoint**: `/api/v1/company-battle`
   - **Cache Key**: `battle:${companyIdA}:${companyIdB}:${tenantId}`
   - **TTL**: 15 minutes (900 seconds).
   - **Invalidation**: Upon company update or new sentiment submission, keys matching `battle:*` pattern are evicted.
2. **Analytics Query Cache** (Sprint 7):
   - **Endpoints**: `/api/v1/company/stats`, `/api/v1/company/trends`, `/api/v1/company/packages`
   - **Cache Key**: `analytics:${endpoint}:${tenantId}`
   - **TTL**: 10 minutes (600 seconds).
3. **Caching Client**: ioredis client is shared in a pooled connection to prevent socket leakage.
