# PlacementOS API Endpoints Document

All endpoints are protected under CSRF validation and Token Bucket rate limiting middleware.

---

## Authentication Endpoints

### 1. Register Student
* **Endpoint**: `POST /api/auth/register`
* **Access**: Public
* **Request Body (JSON)**:
```json
{
  "tenantId": "e229adfb-295b-4b2e-a579-1bf4529dbb7b",
  "studentId": "221080045",
  "name": "Sanket Bhat",
  "email": "sbbhat_b22@it.vjti.ac.in",
  "password": "SecurePassword123",
  "phone": "+91-9876543210",
  "personalEmail": "sanket.bhat@gmail.com",
  "cgpa": 9.12,
  "branch": "IT",
  "skills": ["React", "TypeScript", "Node.js"]
}
```
* **Response (201 Created)**:
```json
{
  "message": "Registration successful"
}
```

### 2. Login User
* **Endpoint**: `POST /api/auth/login`
* **Access**: Public
* **Request Body (JSON)**:
```json
{
  "email": "sbbhat_b22@it.vjti.ac.in",
  "password": "SecurePassword123"
}
```
* **Response Headers**: Sets cookies `accessToken` (HttpOnly, Max-Age 900) and `refreshToken` (HttpOnly, Max-Age 604800).
* **Response Body (200 OK)**:
```json
{
  "message": "Login successful",
  "user": {
    "id": "student-uuid",
    "name": "Sanket Bhat",
    "email": "sbbhat_b22@it.vjti.ac.in",
    "role": "STUDENT"
  }
}
```

### 3. Refresh Access Token (RTR)
* **Endpoint**: `POST /api/auth/refresh`
* **Access**: Public (Cookie auth)
* **Response Headers**: Sets rotated cookies `accessToken` and `refreshToken`.
* **Response Body (200 OK)**:
```json
{
  "message": "Token rotation successful"
}
```
* **Error (401 Unauthorized - Replay Hack)**: Returns `{ "error": "Security breach detected. All sessions terminated." }` and clears cookies if the refresh token is presented multiple times.

### 4. Logout User
* **Endpoint**: `POST /api/auth/logout`
* **Access**: Public (Clears cookies)
* **Response Body (200 OK)**:
```json
{
  "message": "Logout successful"
}
```

---

## Core PlacementOS API v1 Endpoints

All core API routes under `/api/v1/` require an authenticated access token cookie.

### 5. Jobs Listing & Placement Matching (Opportunity Radar)
* **Endpoint**: `GET /api/v1/jobs`
* **Query Params**:
  - `page` (optional, default: 1)
  - `limit` (optional, default: 10)
  - `tenantId` (optional, for verification)
  - `studentId` (optional, triggers Opportunity Radar matching calculation)
* **Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "job-uuid",
      "companyId": "company-uuid",
      "title": "Graduate Engineer Trainee",
      "minCgpa": 8.0,
      "requiredSkills": ["React", "TypeScript"],
      "packageLpa": 14.5,
      "company": {
        "id": "company-uuid",
        "name": "Barclays"
      },
      "matchLevel": "HIGH",
      "eligible": true
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### 6. Create Job Opening
* **Endpoint**: `POST /api/v1/jobs`
* **Access**: Authenticated (Role: `TPO`, `RECRUITER`)
* **Request Body (JSON)**:
```json
{
  "companyId": "company-uuid",
  "title": "SDE Graduate Trainee",
  "description": "Full-stack entry-level SDE role.",
  "minCgpa": 8.5,
  "requiredSkills": ["Distributed Systems", "Go"],
  "packageLpa": 32.5
}
```
* **Response (201 Created)**: Returns the created job record. Generates a `JOB_UPDATED` audit log entry.

### 7. Companies List
* **Endpoint**: `GET /api/v1/companies`
* **Query Params**: `page`, `limit`
* **Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "company-uuid",
      "name": "Google",
      "industry": "Tech",
      "trustScore": 4.9
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### 8. Register Company
* **Endpoint**: `POST /api/v1/companies`
* **Access**: Authenticated (Role: `TPO`, `RECRUITER`)
* **Request Body (JSON)**:
```json
{
  "name": "Google",
  "industry": "Tech"
}
```
* **Response (201 Created)**: Returns the created company record. Generates a `COMPANY_UPDATED` audit log.

### 9. Applications List
* **Endpoint**: `GET /api/v1/applications`
* **Access**: Authenticated (Role: `STUDENT` only views own; `TPO` and `RECRUITER` view all)
* **Query Params**: `studentId` or `jobId` (Required), `page`, `limit`
* **Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "application-uuid",
      "studentId": "student-uuid",
      "jobId": "job-uuid",
      "status": "APPLIED",
      "timelineHistory": [
        {
          "status": "APPLIED",
          "timestamp": "2026-06-09T13:00:00Z",
          "note": "Applied successfully through PlacementOS."
        }
      ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### 10. Submit Job Application
* **Endpoint**: `POST /api/v1/applications`
* **Access**: Authenticated (Role: `STUDENT` applies for self; `TPO` applies on behalf)
* **Request Body (JSON)**:
```json
{
  "jobId": "job-uuid",
  "studentId": "student-uuid" // Only required/used for TPO submissions
}
```
* **Response (201 Created)**: Returns the application record. Triggers checks for student CGPA cutoffs and duplicates. Generates a `JOB_APPLIED` audit log.

### 11. Company Battle Comparator
* **Endpoint**: `GET /api/v1/company-battle`
* **Access**: Authenticated (Any role)
* **Query Params**: `companyIdA` (Required), `companyIdB` (Required)
* **Cache Control**: Caches results in Redis using `battle:${companyIdA}:${companyIdB}:${tenantId}` keys for 15 minutes.
* **Response (200 OK)**:
```json
{
  "companyA": {
    "id": "company-a-uuid",
    "name": "Google",
    "industry": "Tech",
    "trustScore": 4.9,
    "jobsCount": 5,
    "packages": { "min": 22.0, "max": 42.0, "avg": 32.5 },
    "cgpaCutoff": { "min": 8.5, "max": 9.2, "avg": 8.7 },
    "selectionStats": { "totalApplications": 45, "totalSelections": 5, "ratio": 0.1111 },
    "topTopics": [{ "topic": "Trees", "count": 12 }, { "topic": "DP", "count": 8 }],
    "sentiment": { "avgOaDifficulty": 4.6, "avgInterviewDifficulty": 4.8, "overallSentiment": "positive" }
  },
  "companyB": {
    "id": "company-b-uuid",
    "name": "Morgan Stanley",
    "industry": "Finance",
    "trustScore": 4.6,
    "jobsCount": 3,
    "packages": { "min": 14.5, "max": 26.0, "avg": 22.0 },
    "cgpaCutoff": { "min": 7.8, "max": 8.0, "avg": 7.9 },
    "selectionStats": { "totalApplications": 30, "totalSelections": 6, "ratio": 0.2000 },
    "topTopics": [{ "topic": "Linux", "count": 6 }, { "topic": "C++", "count": 5 }],
    "sentiment": { "avgOaDifficulty": 3.8, "avgInterviewDifficulty": 4.2, "overallSentiment": "positive" }
  }
}
```

---

## Resume Management Endpoints

All resume endpoints are prefixed with `/api/v1/resume` and require validated cookie session tokens.

### 12. Get Active Resume Metadata
* **Endpoint**: `GET /api/v1/resume`
* **Access**: Authenticated (`STUDENT` role)
* **Response (200 OK)**:
```json
{
  "id": "resume-uuid",
  "tenantId": "tenant-uuid",
  "studentId": "student-uuid",
  "filename": "sanket_resume.pdf",
  "version": 2,
  "size": 142048,
  "hash": "sha256-hash-value",
  "skills": ["React", "TypeScript", "Node.js"],
  "education": "VJTI Mumbai, B.Tech IT",
  "projects": ["PlacementOS", "Compiler Design Project"],
  "isActive": true,
  "createdAt": "2026-06-09T13:30:00.000Z",
  "updatedAt": "2026-06-09T13:30:00.000Z",
  "deletedAt": null
}
```
* **Response (404 Not Found)**:
```json
{
  "message": "No active resume found"
}
```

### 13. Upload Resume Document
* **Endpoint**: `POST /api/v1/resume`
* **Access**: Authenticated (`STUDENT` role)
* **Request Format**: `multipart/form-data`
* **Request Fields**:
  - `file` (File): The PDF or DOCX file (size must be under 10MB).
  - `skills` (String, optional): Comma-separated list of extracted skills.
  - `education` (String, optional): Extracted educational qualification snippet.
  - `projects` (String, optional): Comma-separated list of projects.
* **Security & Validations**:
  - Validates file size (limit: < 10MB).
  - Validates file extensions (`.pdf` or `.docx`).
  - Scans binary headers to prevent spoofed/executable uploads (`MZ` executable headers).
  - Verifies magic numbers (`%PDF-` for PDFs, `PK` zip structure for DOCX).
  - Performs dangerous script searches for PDF documents (`/JS`, `/JavaScript`, `/AA`, `/OpenAction` blocks).
  - Scans zip archive contents for DOCX validity (requires `[Content_Types].xml` and `word/document.xml` blocks) to block spoofed generic archives.
  - Calculates a unique SHA-256 integrity hash.
* **Behavior**:
  - Auto-deactivates previous versions.
  - Automatically pushes/synchronizes newly extracted skills to the student's profile database.
  - Writes a `RESUME_UPLOADED` audit log entry with tracking metadata.
* **Response (201 Created)**: Returns the saved resume metadata object (excluding raw binary content).

### 14. Get Resume Version History
* **Endpoint**: `GET /api/v1/resume/history`
* **Access**: Authenticated (`STUDENT` role)
* **Response (200 OK)**:
```json
[
  {
    "id": "resume-uuid-2",
    "tenantId": "tenant-uuid",
    "studentId": "student-uuid",
    "filename": "sanket_resume_v2.pdf",
    "version": 2,
    "size": 142048,
    "hash": "sha256-hash-value-2",
    "skills": ["React", "TypeScript", "Next.js"],
    "education": "VJTI Mumbai, B.Tech IT",
    "projects": ["PlacementOS", "Compiler Design Project"],
    "isActive": true,
    "createdAt": "2026-06-09T13:30:00.000Z",
    "updatedAt": "2026-06-09T13:30:00.000Z",
    "deletedAt": null
  },
  {
    "id": "resume-uuid-1",
    "tenantId": "tenant-uuid",
    "studentId": "student-uuid",
    "filename": "sanket_resume_v1.pdf",
    "version": 1,
    "size": 139021,
    "hash": "sha256-hash-value-1",
    "skills": ["React", "JavaScript"],
    "education": "VJTI Mumbai, B.Tech IT",
    "projects": ["Personal Portfolio"],
    "isActive": false,
    "createdAt": "2026-06-09T13:10:00.000Z",
    "updatedAt": "2026-06-09T13:30:00.000Z",
    "deletedAt": null
  }
]
```

### 15. Activate Resume Version
* **Endpoint**: `POST /api/v1/resume/activate`
* **Access**: Authenticated (`STUDENT` role)
* **Request Body (JSON)**:
```json
{
  "resumeId": "resume-uuid"
}
```
* **Behavior**:
  - Transactionally updates the target resume as `isActive: true` and sets all other active student resumes to `isActive: false`.
  - Re-syncs the activated resume's skills array to the student's profile.
  - Logs a `RESUME_ACTIVATED` event in the `AuditLog` table.
* **Response (200 OK)**:
```json
{
  "message": "Version activated successfully"
}
```

### 16. View/Download Resume Binary
* **Endpoint**: `GET /api/v1/resume/view`
* **Access**: Authenticated (Student can preview self; TPO and Recruiter roles can view any student resume in their institution's tenant partition).
* **Query Params**:
  - `id` (String, optional): Specific resume UUID. If omitted, returns the student's current active version.
* **Response Headers**:
  - `Content-Type`: `application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `Content-Disposition`: `inline; filename="[filename]"` (triggers built-in browser renderer preview).
* **Behavior**:
  - Streams raw file binary bytes from `bytea` Postgres content.
  - Generates a `RESUME_DOWNLOADED` entry in the `AuditLog` table.
* **Response (200 OK)**: Raw binary file payload.

### 17. Delete Resume
* **Endpoint**: `DELETE /api/v1/resume`
* **Access**: Authenticated (`STUDENT` role)
* **Query Params**:
  - `id` (String, optional): Specific resume UUID. If omitted, soft-deletes the student's active resume.
* **Behavior**:
  - Sets `deletedAt` field timestamp (soft deletion).
  - Logs a `RESUME_UPDATED` entry in the `AuditLog` table.
* **Response (200 OK)**:
```json
{
  "message": "Resume deleted successfully"
}
```

---

## Company Intelligence & Analytics Endpoints (Sprint 7)

All analytics endpoints are prefixed with `/api/v1/company` and require authenticated cookie sessions.

### 18. Company Recruiter Statistics
* **Endpoint**: `GET /api/v1/company/stats`
* **Access**: Authenticated (Any role)
* **Query Params**: `companyId` (Required), `tenantId` (Required)
* **Response (200 OK)**:
```json
{
  "companyId": "company-uuid",
  "companyName": "Google",
  "visitCount": 4,
  "description": "Global technology leader...",
  "selectionRate": 0.1111,
  "medianPackageLpa": 32.5,
  "fteCount": 12,
  "internshipCount": 5,
  "cgpaDistribution": [
    { "range": "9.0-10.0", "count": 3 },
    { "range": "8.0-8.9", "count": 8 },
    { "range": "7.0-7.9", "count": 2 }
  ],
  "branchSelections": [
    { "branch": "IT", "selected": 5 },
    { "branch": "COMPS", "selected": 4 },
    { "branch": "ETRX", "selected": 3 }
  ]
}
```

### 19. Skill Demand Trends
* **Endpoint**: `GET /api/v1/company/trends`
* **Access**: Authenticated (Any role)
* **Query Params**: `tenantId` (Required)
* **Description**: Returns demand trend counts for key technology skills across all placed students' resumes.
* **Response (200 OK)**:
```json
{
  "skills": [
    { "skill": "React", "count": 18 },
    { "skill": "Node.js", "count": 14 },
    { "skill": "SQL", "count": 12 },
    { "skill": "Python", "count": 10 },
    { "skill": "AWS", "count": 8 },
    { "skill": "Docker", "count": 6 },
    { "skill": "Java", "count": 5 }
  ]
}
```

### 20. Package Distribution
* **Endpoint**: `GET /api/v1/company/packages`
* **Access**: Authenticated (Any role)
* **Query Params**: `tenantId` (Required)
* **Description**: Returns per-company package statistics for charting salary distributions.
* **Response (200 OK)**:
```json
{
  "packages": [
    { "company": "Google", "min": 22.0, "max": 42.0, "median": 32.5, "count": 8 },
    { "company": "Morgan Stanley", "min": 14.5, "max": 26.0, "median": 20.0, "count": 6 }
  ]
}
```

### 21. Interview Topic Categories
* **Endpoint**: `GET /api/v1/company/topics`
* **Access**: Authenticated (Any role)
* **Query Params**: `companyId` (Required), `tenantId` (Required)
* **Description**: Returns grouped interview question category frequencies from the `InterviewVault`.
* **Response (200 OK)**:
```json
{
  "categories": {
    "DSA": [
      { "topic": "Trees", "count": 12 },
      { "topic": "Dynamic Programming", "count": 8 }
    ],
    "DBMS": [
      { "topic": "SQL Joins", "count": 6 }
    ],
    "OS": [
      { "topic": "Process Scheduling", "count": 4 }
    ],
    "System Design": [
      { "topic": "Load Balancing", "count": 5 }
    ]
  }
}
```

### 22. Selection Density Heatmap
* **Endpoint**: `GET /api/v1/company/heatmap`
* **Access**: Authenticated (Any role)
* **Query Params**: `tenantId` (Required)
* **Description**: Returns a month × company matrix of selection counts for the heatmap visualization.
* **Response (200 OK)**:
```json
{
  "heatmap": [
    { "company": "Google", "month": "2025-08", "selections": 3 },
    { "company": "Google", "month": "2025-09", "selections": 2 },
    { "company": "Morgan Stanley", "month": "2025-10", "selections": 5 }
  ]
}
```

### 23. Placement Calendar Events
* **Endpoint**: `GET /api/v1/company/calendar`
* **Access**: Authenticated (Any role)
* **Query Params**: `tenantId` (Required), `month` (optional, format: `YYYY-MM`)
* **Description**: Returns placement events (PPTs, OAs, Interviews, Offers, Results) for calendar rendering.
* **Response (200 OK)**:
```json
{
  "events": [
    {
      "id": "event-uuid",
      "title": "Google PPT",
      "type": "PPT",
      "date": "2025-08-14T10:00:00Z",
      "companyId": "company-uuid",
      "description": "Pre-placement talk for Google SDE role."
    }
  ]
}
```

### 24. Global Search
* **Endpoint**: `GET /api/v1/company/search`
* **Access**: Authenticated (Any role)
* **Query Params**: `q` (Required, min 2 chars), `tenantId` (Required)
* **Description**: Unified keyword search across Companies, Jobs, Students, Interview Questions, and Resumes. Powers the Ctrl+K Command Palette.
* **Response (200 OK)**:
```json
{
  "results": {
    "companies": [
      { "id": "company-uuid", "name": "Google", "industry": "Tech" }
    ],
    "jobs": [
      { "id": "job-uuid", "title": "SDE Graduate Trainee", "companyName": "Google" }
    ],
    "students": [
      { "id": "student-uuid", "name": "Sanket Bhat", "branch": "IT", "cgpa": 9.12 }
    ],
    "questions": [
      { "id": "vault-uuid", "topic": "Binary Trees", "companyName": "Google" }
    ],
    "resumes": [
      { "id": "resume-uuid", "filename": "sanket_resume.pdf", "skills": ["React"] }
    ]
  }
}
```

