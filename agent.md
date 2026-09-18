# BACKEND AGENT.MD — Running Athlete, Coach & Club Platform

> **Target Repository:** `backend/` (`c:\learnings\sportzApp_27\backend`)  
> **Architecture Source:** [`running-platform-system-design.md`](file:///c:/learnings/sportzApp_27/running-platform-system-design.md)  
> **Role:** Authoritative implementation instructions, standards, and engineering rules for AI agents and backend engineers working on the NestJS / Supabase / BullMQ backend.

---

## 1. Backend Core Mission & Axioms

1. **A Training Operating System**: The platform powers structured training, coaching relationships, running clubs, and athlete performance tracking.
2. **External Platforms are Data Providers, NOT Domain Owners**:
   - Strava, Garmin, COROS, and Polar are external activity and telemetry providers.
   - The backend owns the canonical domain models: `User`, `Athlete`, `Coach`, `CoachingRelationship`, `Club`, `ClubMembership`, `ClubGroup`, `PlanTemplate`, `PlanVersion`, `AthletePlan`, `WorkoutTemplate`, `ScheduledWorkout`, `WorkoutStep`, `Activity`, `ActivitySample`, `ComplianceMetric`, and `ClubRun`.
3. **Architecture Style**: **NestJS 12 Modular Monolith** with clean domain module boundaries, Supabase PostgreSQL, Supabase Auth/Storage/Realtime, and Redis + BullMQ background queues.

---

## 2. Technology Stack & Runtime Configuration

- **Runtime & Language**: Node.js 24+, TypeScript 6 (`"strict": true`, `"type": "module"`, ESM imports)
- **Framework**: NestJS 12 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
- **Database**: Supabase PostgreSQL (Postgres 15+)
- **Database Best Practices**: Governed by `.agents/skills/supabase-postgres-best-practices`
- **Authentication**: Supabase Auth (JWT validation, session tokens, user metadata)
- **Storage**: Supabase Storage (S3-compatible bucket for avatars, club banners, workout attachments, raw payload archives)
- **Realtime**: Supabase Realtime (WebSockets for notifications, live run attendance, 1:1 and group chat)
- **Queues & Background Jobs**: Redis + BullMQ (`activity-ingestion`, `metrics-rollup`, `notifications`)
- **API Documentation**: Swagger / OpenAPI (`@nestjs/swagger`) accessible at `/api/docs`
- **Linting & Code Quality**: Oxlint (`npm run lint`), Prettier (`npm run format`)
- **Testing**: Vitest (`npm run test`, `npm run test:e2e`, coverage with `@vitest/coverage-v8`)

---

## 3. Modular Monolith Directory Structure

All backend application code resides strictly under `backend/src/`:

```text
backend/src/
├── main.ts                         # Bootstrap, Swagger setup, global pipes/filters/interceptors
├── app.module.ts                   # Root module composing domain modules
├── config/                         # Typed environment configuration & validation
│   ├── env.validation.ts           # class-validator schema for process.env
│   ├── supabase.config.ts          # Supabase URL and key configurations
│   └── redis.config.ts             # Redis connection config for BullMQ
│
├── common/                         # Shared kernel & cross-cutting concerns
│   ├── constants/                  # System-wide constants & enums
│   ├── decorators/                 # @CurrentUser(), @Roles(), @Public()
│   ├── filters/                    # Global HttpExceptionFilter (RFC 7807 problem details)
│   ├── guards/                     # SupabaseAuthGuard, RolesGuard, ClubAccessGuard
│   ├── interceptors/               # ResponseTransformInterceptor, LoggingInterceptor
│   ├── pipes/                      # ParseUUIDPipe, SanitizeInputPipe
│   └── types/                      # Common pagination, API response wrappers
│
├── database/                       # Supabase client & migration helpers
│   ├── supabase.service.ts         # Injected Supabase admin & authenticated clients
│   └── migrations/                 # Versioned SQL migrations
│
├── modules/                        # Domain Feature Modules
│   ├── auth/                       # Supabase JWT guard, token verification, session resolution
│   ├── users/                      # User account entity, base profile coordination
│   ├── athletes/                   # Athlete profiles, goals, baseline stats (VO2Max, threshold paces)
│   ├── coaches/                    # Coach profiles, specialties, roster management
│   ├── coaching/                   # CoachingRelationship entity (1:1 coaching, assignments, invites)
│   ├── clubs/                      # Running club entity, settings, club-level configurations
│   ├── memberships/                # Club memberships with roles: OWNER, ADMIN, COACH, CAPTAIN, MEMBER
│   ├── groups/                     # Sub-training groups (Beginners, 10k, 21k, Marathon, HYROX)
│   ├── training/                   # Training coordinator orchestrating plans and workouts
│   ├── plans/                      # PlanTemplate, PlanVersion, PlanAssignment, AthletePlan
│   ├── workouts/                   # WorkoutTemplate, ScheduledWorkout, WorkoutStep (phases & targets)
│   ├── activities/                 # Canonical Activity entity, ActivitySample telemetry streams
│   ├── metrics/                    # Compliance scoring engine, training load, volume, PR tracking
│   ├── integrations/               # Provider adapters & webhooks
│   │   ├── base/                   # ProviderAdapter interface (agnostic provider contract)
│   │   ├── strava/                 # StravaAdapter, OAuth token refresh, Webhook controller & receiver
│   │   └── garmin/                 # GarminAdapter (reserved for subsequent phase)
│   ├── events/                     # Club runs, group workouts, attendance matching with activities
│   ├── notifications/              # Dispatchers for push, email, in-app alerts
│   └── messaging/                  # Realtime chat channels (coach-athlete 1:1, club channels)
│
└── workers/                        # BullMQ background worker processors
    ├── activity-ingestion.worker.ts # Fetches vendor payload, normalizes to Activity, persists
    └── metrics-rollup.worker.ts     # Computes compliance and updates athlete/club statistics
```

---

## 4. Canonical Units & Data Normalization Standards

To prevent rounding errors, unit mismatch bugs, and vendor lock-in, the backend strictly enforces **canonical SI/standard units** across all entities, database columns, and DTOs:

| Metric | Canonical Unit | Type in DB / Code | Example |
|---|---|---|---|
| **Distance** | **Meters** (`m`) | `INTEGER` / `FLOAT` | `5000` (5 km), `42195` (Marathon) |
| **Duration** | **Seconds** (`s`) | `INTEGER` | `1800` (30 minutes), `3600` (1 hour) |
| **Pace** | **Seconds per kilometer** (`sec/km`) | `INTEGER` | `300` (5:00/km), `270` (4:30/km) |
| **Speed** | **Meters per second** (`m/s`) | `FLOAT` | `3.33` m/s |
| **Heart Rate** | **Beats per minute** (`bpm`) | `INTEGER` | `145` bpm |
| **Power** | **Watts** (`W`) | `INTEGER` | `280` W |
| **Elevation** | **Meters** (`m`) | `FLOAT` | `125.4` m |
| **Cadence** | **Steps per minute** (`spm`) | `INTEGER` | `175` spm |
| **RPE** | **Rate of Perceived Exertion** (1–10) | `SMALLINT` | `7` |
| **Timestamps** | **UTC ISO 8601** | `TIMESTAMPTZ` | `'2026-09-12T15:30:00.000Z'` |

---

## 5. PostgreSQL & Supabase Best Practices

All SQL migrations and Supabase interactions must comply with `.agents/skills/supabase-postgres-best-practices`:

1. **Identifier Conventions**:
   - Snake_case for table names and column names (`athlete_plans`, `workout_steps`, `user_id`).
   - Plural nouns for tables (`athletes`, `coaches`, `clubs`, `activities`).
2. **Primary Keys**:
   - Always use UUID primary keys: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
3. **Foreign Keys & Indexing**:
   - Every foreign key constraint MUST have a corresponding index to avoid table scans during joins and deletes:
     ```sql
     CREATE INDEX idx_athlete_plans_athlete_id ON athlete_plans(athlete_id);
     CREATE INDEX idx_scheduled_workouts_athlete_date ON scheduled_workouts(athlete_id, scheduled_date);
     ```
4. **Timestamps**:
   - Always use `TIMESTAMPTZ` for dates and times.
   - Include `created_at TIMESTAMPTZ DEFAULT now() NOT NULL` and `updated_at TIMESTAMPTZ DEFAULT now() NOT NULL` on every mutable table.
5. **JSONB Usage**:
   - Use `JSONB` for flexible sensor streams (`activity_samples`), workout step target configurations, and vendor raw webhook archives.
   - When querying inside JSONB columns, create GIN indexes:
     ```sql
     CREATE INDEX idx_workouts_steps ON scheduled_workouts USING gin (steps);
     ```
6. **Query Performance Rules**:
   - Never write `SELECT *` in services or repositories. Explicitly select needed fields.
   - Use partial indexes for hot queries (e.g. `CREATE INDEX idx_active_plans ON athlete_plans(athlete_id) WHERE status = 'ACTIVE';`).
7. **Connection Management**:
   - Always utilize connection pooling (Transaction mode via Supavisor / Supabase connection string) for high-throughput endpoints and workers.

---

## 6. Training Engine & Domain Specifications

### 6.1 Generic & Reusable Training Plans
- Plans must NEVER be hardcoded to specific race distances or athlete IDs.
- Hierarchy:
  ```text
  PlanTemplate ──> PlanVersion (v1, v2...) ──> Week (1..N) ──> WorkoutTemplate ──> WorkoutStep
  ```
- **Instantiation**: When a coach assigns a plan to an athlete:
  ```text
  PlanTemplate ──(PlanAssignment)──> AthletePlan ──> ScheduledWorkout ──> WorkoutStep
  ```
- **Immutability Rule**: Modifying an athlete's `ScheduledWorkout` or customized `AthletePlan` MUST NEVER alter the original `PlanTemplate` or `WorkoutTemplate`.

### 6.2 Structured Workout Targets
Workouts support granular target intervals:
- **Phases**: `WARMUP`, `MAIN_SET`, `INTERVAL`, `RECOVERY`, `COOLDOWN`
- **Target Types**: `PACE`, `HEART_RATE`, `POWER`, `CADENCE`, `RPE`, `SPEED`, `OPEN`
- Target values support ranges: e.g. `target_pace_min_sec_km = 270`, `target_pace_max_sec_km = 290`.

### 6.3 Running Club Domain Entities
- Running clubs are first-class domains with role-based memberships:
  - `OWNER`, `ADMIN`, `COACH`, `CAPTAIN`, `MEMBER`.
- Club sub-groups allow segmented training: (e.g., "Beginners 5K", "Sub-3 Marathon", "HYROX").
- **Club Runs & Attendance**:
  - Organizers create Club Runs with meeting time, location, distance, target pace group, and RSVP capability.
  - Completed activities synced from Strava/Garmin are matched against scheduled Club Runs (by location, date/time window, and distance) to verify attendance automatically.

---

## 7. Asynchronous Integration Pipeline (BullMQ + Redis)

```text
[Strava / Vendor Webhook POST]
            │
            ▼
[Integrations Webhook Controller]
            ├── 1. Validate signature / challenge verification token
            ├── 2. Return HTTP 200 OK immediately (< 200ms)
            └── 3. Enqueue job into BullMQ ('activity-ingestion')
                        │
                        ▼
            [Activity Ingestion Worker]
                        ├── 1. Load user's integration token (refresh if expired via ProviderAdapter)
                        ├── 2. Fetch full activity details & sensor streams from vendor API
                        ├── 3. Normalize vendor payload into canonical Activity & ActivitySample
                        ├── 4. Save Activity to database (deduplicating by external_id)
                        └── 5. Dispatch Domain Event: ActivityCreatedEvent
                                    │
                                    ▼
                        [Metrics & Compliance Listener / Worker]
                                    ├── 1. Match Activity with ScheduledWorkout (date window, sport type)
                                    ├── 2. Compute compliance score (0–100% based on distance/duration/pace)
                                    ├── 3. Match Activity against Club Run for automatic attendance
                                    └── 4. Update weekly volume, fitness stats, and leaderboards
```

---

## 8. API & Swagger / OpenAPI Design Standards

1. **Route Prefixing**: All endpoints must be namespaced under `/api/v1/...`.
2. **Swagger Decorators**:
   - Every Controller must specify `@ApiTags('DomainName')` and `@ApiBearerAuth()`.
   - Every Endpoint must specify `@ApiOperation({ summary: '...' })`, `@ApiResponse({ status: 200, type: ReturnDto })`, and error responses.
   - Every DTO property must specify `@ApiProperty({ description: '...', example: '...' })` or `@ApiPropertyOptional()`.
3. **DTO Validation**:
   - Use `class-validator` decorators (`@IsString()`, `@IsUUID()`, `@IsInt()`, `@Min()`, `@Max()`, `@IsEnum()`, `@IsOptional()`) on all fields.
   - Global `ValidationPipe` enabled with:
     ```typescript
     new ValidationPipe({
       whitelist: true,
       forbidNonWhitelisted: true,
       transform: true,
     })
     ```
4. **Standard Error Envelope**:
   - All uncaught exceptions must be formatted by `HttpExceptionFilter` to return:
     ```json
     {
       "statusCode": 400,
       "message": "Validation failed",
       "errors": ["targetPace must be a positive integer"],
       "timestamp": "2026-09-12T15:30:00.000Z",
       "path": "/api/v1/workouts"
     }
     ```

---

## 9. Security, Authorization & Tenant Scoping Rules

1. **Authentication via Supabase Auth**:
   - Never accept an unverified `user_id` or `athlete_id` in request payloads.
   - Extract the authenticated user from the validated Supabase JWT using `@CurrentUser()`.
2. **Role & Scope Boundaries**:
   - **Athletes**: Can only query or modify their own athlete profile, assigned plans, workouts, and activities.
   - **Coaches**: Can only access athletes who have an active `CoachingRelationship` or belong to the coach's club roster.
   - **Club Roles**: Modifying club settings requires `OWNER` or `ADMIN` membership; scheduling club runs requires `OWNER`, `ADMIN`, `COACH`, or `CAPTAIN`.
3. **Secrets Management**:
   - Never commit API keys, Supabase Service Role keys, or OAuth client secrets.
   - Read all environment variables through a typed `ConfigService`.

---

## 10. Verification & Quality Commands

Always run lint and tests before completing backend tasks:

```powershell
# Run fast linting (oxlint)
npm run lint

# Format code with Prettier
npm run format

# Run unit and integration tests (Vitest)
npm run test

# Run end-to-end tests
npm run test:e2e

# Verify TypeScript compilation and NestJS build
npm run build
```

> [!IMPORTANT]
> **Preserve Long-Running Processes**: The NestJS dev server (`npm run start:dev`) is running in the background. Never terminate or disrupt this process unless explicitly requested by the user.

---

## 11. Git & Version Control Workflow Rules

1. **Conventional Commit Messages**:
   - Use standard structured commit types: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
   - Examples: `docs(agent): add git workflow rules to agent.md`, `feat(athletes): add gender and dob fields to athlete DTO`.
2. **Atomic & Focused Commits**:
   - Stage and commit only related changes per commit. Do not bundle unrelated refactorings or transient build outputs (`tsconfig.build.tsbuildinfo`, `dist/`).
3. **Pre-Commit Verification**:
   - Always run linting (`npm run lint`), build checks (`npm run build`), and relevant unit tests (`npm run test`) before committing code changes.
4. **Secrets & Untracked Guardrails**:
   - Never stage or commit environment configuration files containing real secrets (`.env`), database credentials, API keys, or private keys.
5. **Clean Working Tree**:
   - Keep the repository in a clean state and avoid leaving orphan or untracked temporary files in source directories.

