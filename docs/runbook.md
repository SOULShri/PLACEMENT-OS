# PlacementOS Operational Runbook

This document details setup, migration, execution, troubleshooting, and configuration details for PlacementOS administrators.

---

## 1. System Prerequisites

Before running the application, ensure the host machine has the following tools installed:
- **Node.js**: Version 20.x or higher
- **Package Manager**: npm v10.x or higher
- **Container Runtime**: Docker Desktop with Docker Compose

---

## 2. Environment Configuration

Create a `.env` file in the project root directory. Below is the reference blueprint with sensitive entries:

```bash
# Node environment mode (development / production)
NODE_ENV=development

# Server port
PORT=3000

# PostgreSQL Connection URI (Used by Prisma Client)
DATABASE_URL="postgresql://postgres:postgres_password@localhost:5432/placement_os?schema=public"

# Redis Connection URL (Used by ioredis and BullMQ)
REDIS_URL="redis://localhost:6379"

# JWT Secret Keys (Must be strong 256-bit keys in production)
JWT_ACCESS_SECRET="super_secret_access_token_signing_key_32_chars_long"
JWT_REFRESH_SECRET="super_secret_refresh_token_signing_key_32_chars_long"

# Rate Limiter Configuration (Toggled in src/middleware.ts)
# Defaults: GUEST=30/min, STUDENT=100/min, RECRUITER=300/min
```

---

## 3. Database & Container Infrastructure Setup

### A. Boot up PostgreSQL & Redis Services
PlacementOS contains a local container configuration. Start the database and cache nodes using:

```bash
# Start containers in background mode
docker-compose up -d
```

To stop infrastructure containers and keep data volumes:
```bash
docker-compose down
```

To wipe the database completely (including persisted volumes):
```bash
docker-compose down -v
```

### B. Prisma Schema Migrations
Once containers are healthy, generate client models and sync PostgreSQL tables:

```bash
# Generate the database tables from schema.prisma definition
npx prisma migrate dev --name init

# Generate the type-safe Prisma client binary
npx prisma generate
```

---

## 4. Running the Application

### A. Development Mode
Runs the Next.js server with hot reloading enabled (using Next.js Turbopack compiler):

```bash
npm run dev
```
The server will bind to `http://localhost:3000`.

### B. Production Build & Execution
Compile the project to optimized static/server targets and start the daemon:

```bash
# Compile and optimize code
npm run build

# Start the optimized server
npm start
```

---

## 5. Verification, Testing, and Quality Control

### A. Running Tests
We enforce a testing criteria. Run Jest unit and integration test suites:

```bash
# Execute Jest tests
npm run test
```

### B. Code Linting
Scan for code styling issues and typescript compile conflicts:

```bash
npm run lint
```

---

## 6. Troubleshooting & Operational Guide

### A. Database Connection Failures
If you receive the error `PrismaClientInitializationError: Can't reach database server at localhost:5432`:
1. Check container health status: `docker ps`.
2. Verify docker log stream: `docker logs placement-os-postgres-1`.
3. Test connectivity manually using psql:
   ```bash
   docker exec -it placement-os-postgres-1 psql -U postgres -d placement_os
   ```

### B. Redis Socket Pool Exhaustion
If BullMQ queues stop executing background worker events or `/api/v1/company-battle` endpoints hang:
1. Verify Redis is active: `docker exec -it placement-os-redis-1 redis-cli ping` (should output `PONG`).
2. If memory leak occurs, flush Redis cache:
   ```bash
   docker exec -it placement-os-redis-1 redis-cli FLUSHALL
   ```

### C. File Upload Sizes Adjustments
By default, the `validateDocument` engine blocks uploads larger than `10MB`. To adjust this limit:
1. Open [document-validator.ts](file:///C:/Users/bhats/.gemini/antigravity-ide/scratch/placement-os/src/lib/document-validator.ts#L11).
2. Edit the default parameter `maxSizeBytes = 10 * 1024 * 1024` to your institutional requirements.
3. Update standard body parser settings in Next.js routes if you increase this past `10MB`.

### D. Session Hijack Recovery (RTR Activation)
If a student complains that they are logged out of all active devices repeatedly, it indicates that a browser has replayed a stale refresh token.
1. The security middleware has automatically revoked all active sessions for that student in PostgreSQL to secure their account.
2. Instruct the user to clear browser cookie caches and log in again to generate a new credentials rotation flow.
3. Review audit logs to verify the client IP mismatch in the revoked tokens:
   ```sql
   SELECT * FROM "AuditLog" WHERE action = 'SECURITY_REPLAY_BREACH' ORDER BY "createdAt" DESC;
   ```

### E. Analytics Cache Stale Data (Sprint 7)
If analytics dashboards show outdated selection or package statistics:
1. Flush the analytics cache namespace in Redis:
   ```bash
   docker exec -it placement-os-redis-1 redis-cli --scan --pattern "analytics:*" | xargs redis-cli del
   ```
2. If the issue persists, restart the Next.js server to reset in-process caches.
3. Verify that the `PlacementEvent` table has been migrated:
   ```sql
   SELECT COUNT(*) FROM "PlacementEvent";
   ```

---

## 7. Sprint 7 Database Migration Commands

After pulling Sprint 7 changes, run the following to apply schema additions (`PlacementEvent` table, `JobType` enum, `visitCount`/`description` on Company, `type` on Job):

```bash
# Apply Sprint 7 schema migration
npx prisma migrate dev --name sprint7_company_intelligence

# Regenerate Prisma client types
npx prisma generate
```

To seed sample placement events for local development testing:
```sql
INSERT INTO "PlacementEvent" (id, "tenantId", title, type, date, "createdAt")
VALUES 
  (gen_random_uuid(), '<your-tenant-id>', 'Google PPT', 'PPT', '2025-08-14 10:00:00', NOW()),
  (gen_random_uuid(), '<your-tenant-id>', 'Google OA', 'OA', '2025-08-21 14:00:00', NOW()),
  (gen_random_uuid(), '<your-tenant-id>', 'Google Technical Interview', 'INTERVIEW', '2025-09-03 09:00:00', NOW());
```

To update a company's visit count and description:
```sql
UPDATE "Company" 
SET "visitCount" = 4, description = 'Global technology leader specializing in search, cloud, and AI.'
WHERE name = 'Google' AND "tenantId" = '<your-tenant-id>';
```
