# LearnHub – Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Backend – Django Apps](#4-backend--django-apps)
   - 4.1 [users App](#41-users-app)
   - 4.2 [courses App](#42-courses-app)
5. [Database Models](#5-database-models)
6. [API Endpoints](#6-api-endpoints)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Background Tasks (Celery)](#8-background-tasks-celery)
9. [Real-time Communication (Django Channels)](#9-real-time-communication-django-channels)
10. [File Storage](#10-file-storage)
11. [Frontend – React App](#11-frontend--react-app)
12. [Environment Variables](#12-environment-variables)
13. [Running the Project](#13-running-the-project)
14. [Deployment Guide](#14-deployment-guide)

---

## 1. Project Overview

**LearnHub** is a full-stack Learning Management System (LMS) built to support structured, batch-based course delivery. It allows institutions to manage instructors and students, deliver video-based course content, conduct AI-evaluated assessments, and enable real-time collaboration — all within a role-governed platform.

### Core Concepts

| Concept | Description |
|---|---|
| **Course** | A reusable template defining weeks, sessions, tests, and MCQs |
| **Batch** | A live offering of a course assigned to a teacher and a group of students |
| **Week** | A time-boxed unit within a course/batch, unlocked on a schedule |
| **Session** | A recorded video class within a week |
| **Test** | A weekly assessment per batch week, submitted by students and evaluated by AI |
| **Enrollment** | The link between a student and a batch |

The platform serves four user roles: **SuperAdmin**, **Admin**, **Teacher**, and **Student**, each with scoped access to features and data.

---

## 2. Technology Stack

### Backend

| Layer | Technology |
|---|---|
| Framework | Django 6.0.1 |
| API | Django REST Framework (DRF) 3.16.1 |
| Authentication | SimpleJWT (access + refresh tokens, blacklist) |
| Real-time | Django Channels 4.3.2 + Redis channel layer |
| Task Queue | Celery 5.6.2 + Redis broker |
| AI Evaluation | OpenAI API / Groq API |
| File Storage | Cloudflare R2 (S3-compatible, via boto3/django-storages) |
| Database | PostgreSQL (production), SQLite (development) |
| API Docs | drf-spectacular (OpenAPI 3 / Swagger UI) |
| ASGI Server | Daphne |
| File Parsing | pdfminer.six (PDF), pandas + openpyxl (Excel), JSON (Jupyter) |
| CORS | django-cors-headers |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18.3.1 + TypeScript |
| Build Tool | Vite 5.4.19 |
| Styling | Tailwind CSS 3.4.17 |
| UI Components | shadcn/ui (Radix UI primitives) |
| State / Data | TanStack React Query 5.83.0 |
| Forms | React Hook Form 7.61.1 + Zod validation |
| HTTP Client | Axios 1.13.4 |
| Routing | React Router DOM 6.30.1 |
| Charts | Recharts 2.15.4 |
| Rich Text | React Quill 2.0.0 |
| Video Player | Plyr |
| Testing | Vitest 3.2.4 + Testing Library |

### Infrastructure

| Component | Technology |
|---|---|
| Message broker | Redis |
| WebSocket layer | Redis (Django Channels) |
| Object storage | Cloudflare R2 |
| Live video | Jitsi (self-hosted meeting rooms) |
| Reverse proxy | Nginx (production) |

---

## 3. Directory Structure

```
learn-hub/
├── dev.sh                          # Concurrent dev startup (Django + Celery + Vite)
│
├── backend/
│   └── elearn-backend/
│       ├── manage.py
│       ├── requirements.txt
│       ├── db.sqlite3              # Dev database (SQLite)
│       ├── .env                    # Environment variables
│       │
│       ├── config/
│       │   ├── settings.py         # All Django settings
│       │   ├── urls.py             # Root URL configuration
│       │   ├── asgi.py             # ASGI app (HTTP + WebSocket)
│       │   ├── wsgi.py             # WSGI app (HTTP only)
│       │   ├── celery.py           # Celery app configuration
│       │   └── channels_middleware.py  # JWT auth for WebSocket connections
│       │
│       ├── apps/
│       │   ├── users/              # Auth, user management, notifications
│       │   │   ├── models.py
│       │   │   ├── views/
│       │   │   ├── serializers/
│       │   │   ├── urls.py
│       │   │   └── migrations/
│       │   │
│       │   └── courses/            # Course content, batches, tests, chat
│       │       ├── models.py
│       │       ├── views/
│       │       ├── serializers/
│       │       ├── urls.py
│       │       ├── ai_services.py  # OpenAI/Groq evaluation logic
│       │       ├── tasks.py        # Celery async tasks
│       │       ├── consumers.py    # WebSocket consumer
│       │       ├── routing.py      # WebSocket URL routing
│       │       ├── services.py     # Shared business logic
│       │       └── migrations/
│       │
│       └── utils/
│           ├── common.py           # Shared helpers
│           ├── constants.py        # Role name constants
│           ├── email_utils.py      # Email sending
│           ├── exceptions.py       # Custom DRF exception handler
│           ├── pagination.py       # Custom pagination class
│           ├── permissions.py      # 8 role-based permission classes
│           └── progress_utils.py  # Week/session progress helpers
│
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── components.json             # shadcn/ui config
    ├── .env                        # Frontend environment variables
    │
    └── src/
        ├── main.tsx                # React entry point
        ├── App.tsx                 # Route definitions
        ├── pages/                  # 28+ page components
        ├── components/             # Reusable UI & feature components
        │   └── ui/                 # shadcn/ui base components
        ├── contexts/
        │   └── AuthContext.tsx     # JWT state + user role context
        ├── hooks/                  # Custom React hooks
        ├── lib/                    # Utility functions
        └── types/                  # TypeScript type definitions
```

---

## 4. Backend – Django Apps

### 4.1 `users` App

Handles everything related to users: registration, authentication, profile management, role enforcement, notifications, and system configuration.

**Responsibilities:**
- Custom `User` model with email-based login and soft-delete support
- `UserType` model defining the four platform roles
- JWT login, logout, and token refresh
- Password reset via OTP (10-minute expiry)
- User profile (address, DOB, bio, profile picture)
- Notification system (per-user, linkable to any model via GenericForeignKey)
- `AppConfiguration` singleton (business name, AI API keys, timezone)
- `EmailSetting` — SMTP configuration managed through the UI

---

### 4.2 `courses` App

The core of the platform. Manages all course content in two layers:
- **Template layer** — reusable `Course`, `CourseWeek`, `CourseClassSession`, `CourseWeeklyTest` objects created once
- **Batch layer** — batch-specific copies (`BatchWeek`, `BatchClassSession`, `BatchWeeklyTest`) that are independent after cloning

**Responsibilities:**
- Course and batch CRUD
- Content tree: weeks → sessions → MCQs and tests → questions → attachments
- Student enrollment and progress tracking
- Week unlock logic (date-based + manual override per student)
- Test submission, AI evaluation, and grading
- Live sessions (Jitsi) and webinars/special sessions
- Real-time batch chat via WebSocket + REST

---

## 5. Database Models

### Users App Models

#### `UserType`
| Field | Type | Notes |
|---|---|---|
| name | CharField | `SUPERADMIN`, `ADMIN`, `TEACHER`, `STUDENT` |
| description | TextField | |

#### `User`
| Field | Type | Notes |
|---|---|---|
| user_code | CharField | Unique, e.g. `USR12345678` |
| email | EmailField | Unique, used as username |
| fullname | CharField | |
| phone_number_code | CharField | Country dial code |
| contact_number | CharField | |
| user_type | FK → UserType | |
| status | CharField | `ACTIVE`, `INACTIVE`, `DELETED` |
| is_deleted | BooleanField | Soft delete flag |
| deleted_at | DateTimeField | |
| created_by / updated_by / deleted_by | FK → User | Audit fields |
| created_at / updated_at | DateTimeField | |

#### `Profile` (OneToOne → User)
| Field | Type |
|---|---|
| address | TextField |
| date_of_birth | DateField |
| profile_picture | ImageField |
| bio | TextField |

#### `PasswordResetOTP`
| Field | Type | Notes |
|---|---|---|
| user | FK → User | |
| otp | CharField | 6-digit code |
| created_at | DateTimeField | Expires after 10 minutes |
| is_used | BooleanField | |

#### `Notification`
| Field | Type | Notes |
|---|---|---|
| user | FK → User | Recipient |
| title, message | CharField / TextField | |
| notification_type | CharField | `info`, `warning`, `success`, `error` |
| content_type + object_id | GenericFK | Optional linked object |
| action_url | URLField | |
| is_read | BooleanField | |
| created_at | DateTimeField | |

#### `AppConfiguration` (Singleton)
| Field | Type |
|---|---|
| business_name | CharField |
| timezone | CharField |
| logo | ImageField |
| openai_api_key / openai_model | CharField |
| groq_api_key / groq_model | CharField |

#### `EmailSetting`
| Field | Type |
|---|---|
| host, port, username, password | CharField |
| use_tls, use_ssl | BooleanField |
| from_email | EmailField |
| is_active | BooleanField |

---

### Courses App Models — Template Layer

#### `Course`
| Field | Type | Notes |
|---|---|---|
| course_code | CharField | Unique, `CRSxxxxxx` |
| title, description | CharField / TextField | |
| difficulty_level | CharField | `beginner`, `intermediate`, `advanced` |
| tags | M2M → Tag | |
| thumbnail | ImageField | |
| is_active | BooleanField | |
| created_by / updated_by | FK → User | |

#### `CourseWeek`
| Field | Type |
|---|---|
| course | FK → Course |
| week_number | PositiveIntegerField |
| title, description | CharField / TextField |
| is_published | BooleanField |

#### `CourseClassSession`
| Field | Type | Notes |
|---|---|---|
| course_week | FK → CourseWeek | |
| session_number | PositiveIntegerField | |
| title, description | CharField / TextField | |
| weekday | CharField | `monday` … `sunday` |
| video_file | CharField | R2 object key |
| thumbnail | ImageField | |
| duration_seconds | PositiveIntegerField | |

#### `CourseWeeklyTest`
| Field | Type |
|---|---|
| course_week | OneToOne → CourseWeek |
| title, instructions | CharField / TextField |
| answer_key | FileField |
| pass_percentage | DecimalField |

#### `CourseTestQuestion`
| Field | Type |
|---|---|
| test | FK → CourseWeeklyTest |
| text | TextField |
| question_file, image | FileField / ImageField |
| order | PositiveIntegerField |
| marks | DecimalField |

---

### Courses App Models — Batch Layer

#### `Batch`
| Field | Type | Notes |
|---|---|---|
| batch_code | CharField | Unique, `BATxxxxxx` |
| name, description | CharField / TextField | |
| course | FK → Course | |
| teacher | FK → User | Primary instructor |
| co_teachers | M2M → User | |
| max_students | PositiveIntegerField | |
| start_date | DateField | |
| status | CharField | `ACTIVE`, `COMPLETED` |

#### `BatchEnrollment`
| Field | Type | Notes |
|---|---|---|
| batch | FK → Batch | |
| student | FK → User | |
| status | CharField | `active`, `completed`, `dropped` |
| enrolled_at | DateTimeField | |
| notes | TextField | |
| enrolled_by | FK → User | |
| [unique_together] | | batch + student |

#### `BatchWeek`
| Field | Type | Notes |
|---|---|---|
| batch | FK → Batch | |
| week_number | PositiveIntegerField | |
| title, description | CharField / TextField | |
| unlock_date | DateField | Auto-scheduled |
| is_extended | BooleanField | Set when timeline extended |
| is_published | BooleanField | |

#### `StudentSessionView`
| Field | Type | Notes |
|---|---|---|
| enrollment | FK → BatchEnrollment | |
| batch_session | FK → BatchClassSession | |
| watched_percent | DecimalField | 0–100 |
| is_completed | BooleanField | |
| first_watched_at / last_watched_at | DateTimeField | |

#### `ManualStudentWeekUnlock`
| Field | Type |
|---|---|
| enrollment | FK → BatchEnrollment |
| batch_week | FK → BatchWeek |
| unlocked_at | DateTimeField |
| unlocked_by | FK → User |

#### `TestSubmission`
| Field | Type | Notes |
|---|---|---|
| batch_weekly_test | FK → BatchWeeklyTest | |
| enrollment | FK → BatchEnrollment | |
| attempt_number | PositiveIntegerField | |
| submitted_at | DateTimeField | |
| status | CharField | `pending`, `evaluating`, `pending_review`, `published` |
| ai_job_status | CharField | `idle`, `queued`, `running`, `succeeded`, `failed` |
| ai_score / ai_feedback | DecimalField / TextField | |
| ai_response | JSONField | Full AI response payload |
| ai_evaluated_at | DateTimeField | |
| marks_obtained | DecimalField | Final (human or AI) |
| is_passed | BooleanField | |
| grader_remarks | TextField | |
| graded_at / graded_by | DateTimeField / FK → User | |

#### `TestSubmissionAnswer`
| Field | Type |
|---|---|
| submission | FK → TestSubmission |
| question | FK → BatchTestQuestion |
| answer_file | FileField |
| answer_text | TextField |
| marks_obtained / ai_score | DecimalField |
| ai_feedback | TextField |
| ai_response | JSONField |

#### `LiveSession`
| Field | Type | Notes |
|---|---|---|
| batch | FK → Batch | |
| title, description | CharField / TextField | |
| scheduled_at | DateTimeField | |
| duration_mins | PositiveIntegerField | |
| meeting_room | CharField | Auto-generated Jitsi room name |
| hosted_by | FK → User | |

#### `ScheduledWebinar`
| Field | Type | Notes |
|---|---|---|
| batch | FK → Batch | |
| title | CharField | |
| session_type | CharField | `webinar`, `special_session` |
| description | TextField | |
| unlock_at | DateTimeField | |
| duration_secs | PositiveIntegerField | |
| video_file | CharField | R2 object key |

#### `BatchChatMessage`
| Field | Type | Notes |
|---|---|---|
| batch | FK → Batch | |
| sender | FK → User | |
| live_session | FK → LiveSession | Optional — links chat to live session |
| message | TextField | |
| attachment / attachment_name | FileField / CharField | |
| reply_to | FK → self | Threaded replies |
| is_edited / edited_at | BooleanField / DateTimeField | |
| sent_at | DateTimeField | |

#### `BatchChatReadReceipt`
| Field | Type |
|---|---|
| batch | FK → Batch |
| user | FK → User |
| last_read_at | DateTimeField |

---

## 6. API Endpoints

Base URL pattern: `/api/{app}/v1/`

### Users API — `/api/users/v1/`

#### Authentication
| Method | Path | Description |
|---|---|---|
| POST | `/login/` | Obtain JWT access + refresh tokens |
| POST | `/logout/` | Blacklist refresh token |
| POST | `/token/refresh/` | Get new access token |
| POST | `/change-password/` | Change own password |

#### Password Reset
| Method | Path | Description |
|---|---|---|
| POST | `/password-reset/request/` | Send OTP to email |
| POST | `/password-reset/verify/` | Verify OTP code |
| POST | `/password-reset/confirm/` | Set new password |

#### User Profile
| Method | Path | Description |
|---|---|---|
| GET / PUT | `/profile/` | View or update current user's profile |

#### User Management *(Admin)*
| Method | Path | Description |
|---|---|---|
| GET | `/list/` | Filter users by role |
| GET / POST | `/manage/` | List all users / create user |
| GET / PUT / DELETE | `/manage/<pk>/` | User detail, update, soft-delete |

#### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/notifications/` | List current user's notifications |
| PUT | `/notifications/<id>/` | Mark notification as read |
| POST | `/notifications/read-all/` | Mark all as read |

#### Email Config *(Admin)*
| Method | Path | Description |
|---|---|---|
| GET | `/email-config/` | Active email config |
| GET | `/email-config/list/` | All email configs |
| POST | `/email-config/save/` | Create or update config |
| POST | `/email-config/<pk>/toggle/` | Activate / deactivate config |

#### App Config *(Admin)*
| Method | Path | Description |
|---|---|---|
| GET / PUT | `/app-config/` | View or update global app settings |

---

### Courses API — `/api/courses/v1/`

#### Dashboard
| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard/` | Admin, Teacher |
| GET | `/dashboard/student/` | Student |

#### Course Templates
| Method | Path | Description |
|---|---|---|
| GET | `/courses/` | List all courses |
| POST | `/courses/create/` | Create course |
| GET | `/courses/<pk>/` | Course detail |
| PUT | `/courses/<pk>/update/` | Update course |
| POST | `/courses/<pk>/toggle-active/` | Activate / deactivate |
| GET | `/courses/my-summary/` | Student's enrolled courses |

#### Course Weeks & Sessions (Template)
| Method | Path |
|---|---|
| GET / POST | `/courses/<course_id>/weeks/` |
| GET / PUT / DELETE | `/courses/<course_id>/weeks/<week_id>/` |
| GET / POST | `/courses/<course_id>/weeks/<week_id>/sessions/` |
| GET / PUT / DELETE | `/courses/<course_id>/weeks/<week_id>/sessions/<session_id>/` |
| GET / POST | `/courses/<course_id>/weeks/<week_id>/sessions/<session_id>/mcq/` |
| GET / PUT / DELETE | `/courses/<course_id>/weeks/<week_id>/sessions/<session_id>/mcq/<mcq_id>/` |

#### Course Weekly Tests (Template)
| Method | Path |
|---|---|
| GET / PUT | `/courses/<course_id>/weeks/<week_id>/test/` |
| GET / POST | `/courses/<course_id>/weeks/<week_id>/test/questions/` |
| GET / PUT / DELETE | `/courses/<course_id>/weeks/<week_id>/test/questions/<q_id>/` |
| GET / POST | `/courses/<course_id>/weeks/<week_id>/test/questions/<q_id>/attachments/` |
| DELETE | `/courses/<course_id>/weeks/<week_id>/test/questions/<q_id>/attachments/<att_id>/` |

#### Video Uploads (Multipart)
| Method | Path | Description |
|---|---|---|
| POST | `/courses/upload/init/` | Initialize multipart upload to R2 |
| POST | `/courses/upload/complete/` | Complete multipart upload |
| POST | `/courses/upload/abort/` | Abort and clean up |

#### Batches
| Method | Path | Description |
|---|---|---|
| GET | `/batches/summary/` | Enrollment statistics |
| GET | `/batches/` | List all batches |
| POST | `/batches/create/` | Create batch |
| GET | `/batches/<pk>/` | Batch detail |
| PUT | `/batches/<pk>/update/` | Update batch |
| POST | `/batches/<pk>/status/` | Change status (ACTIVE / COMPLETED) |
| POST | `/batches/<pk>/clone-content/` | Clone course template content into batch |
| POST | `/batches/<pk>/extend-timeline/` | Extend batch schedule |

#### Batch Enrollment
| Method | Path | Description |
|---|---|---|
| GET | `/batches/available-students/` | Students not yet enrolled |
| POST | `/batches/<pk>/add-student/` | Enroll a student |
| GET | `/batches/<pk>/students/` | List enrolled students |
| PUT | `/batches/<pk>/students/<enrollment_id>/` | Update enrollment status |
| POST | `/batches/<pk>/students/bulk-update/` | Bulk enroll or update |
| POST | `/batches/<pk>/students/<enrollment_id>/toggle-week-unlock/` | Manual unlock |

#### Batch Weeks & Sessions
| Method | Path |
|---|---|
| GET | `/batches/<batch_id>/weeks/` |
| GET | `/batches/<batch_id>/weeks/<week_id>/` |
| GET / POST | `/batches/<batch_id>/weeks/<week_id>/sessions/` |
| GET / PUT | `/batches/<batch_id>/weeks/<week_id>/sessions/<session_id>/` |
| POST | `/batches/<batch_id>/weeks/<week_id>/sessions/<session_id>/complete/` |
| GET / POST | `/batches/<batch_id>/weeks/<week_id>/sessions/<session_id>/mcq/` |
| GET / PUT / DELETE | `/batches/<batch_id>/weeks/<week_id>/sessions/<session_id>/mcq/<mcq_id>/` |

#### Batch Weekly Tests & Submissions
| Method | Path | Description |
|---|---|---|
| GET | `/batches/<batch_id>/weeks/<week_id>/test/` | Student test view |
| GET | `/batches/<batch_id>/weeks/<week_id>/test/manage/` | Admin/Teacher test management view |
| GET / POST | `/batches/<batch_id>/weeks/<week_id>/test/manage/questions/` | |
| GET / PUT / DELETE | `/batches/<batch_id>/weeks/<week_id>/test/manage/questions/<q_id>/` | |
| POST | `/batches/<batch_id>/weeks/<week_id>/test/submit/` | Student submits test |

#### Test Submissions & AI Evaluation
| Method | Path | Description |
|---|---|---|
| GET | `/batches/<batch_id>/test-submissions/` | All submissions (Admin/Teacher) |
| GET | `/batches/<batch_id>/test-submissions/my-submissions/` | Student's own submissions |
| GET | `/batches/<batch_id>/test-submissions/<pk>/` | Submission detail |
| POST | `/batches/<batch_id>/test-submissions/<pk>/trigger-ai/` | Start AI evaluation for submission |
| POST | `/batches/<batch_id>/test-submissions/<submission_pk>/answers/<answer_pk>/trigger-ai/` | Start AI evaluation for single answer |

#### Live Sessions & Webinars
| Method | Path |
|---|---|
| GET / POST | `/batches/<batch_id>/live-sessions/` |
| GET / PUT | `/batches/<batch_id>/live-sessions/<session_id>/` |
| GET / POST | `/batches/<batch_id>/webinars/` |
| GET / PUT / DELETE | `/batches/<batch_id>/webinars/<webinar_id>/` |

#### Chat (REST)
| Method | Path | Description |
|---|---|---|
| GET | `/chat/batches/` | Batches the user can chat in |
| GET / POST | `/chat/batches/<batch_id>/messages/` | List/send messages |
| DELETE | `/chat/batches/<batch_id>/messages/<message_id>/` | Delete message |
| POST | `/chat/batches/<batch_id>/mark-read/` | Update read receipt |

#### Chat (WebSocket)
```
WS   /ws/chat/batch/<batch_id>/
```
Requires a valid JWT token passed as a query parameter or via cookie.

---

## 7. Authentication & Authorization

### JWT Flow

1. Client sends `POST /api/users/v1/login/` with `{ email, password }`
2. Server returns `{ access, refresh }` tokens
3. Client attaches `Authorization: Bearer <access>` to every API request
4. When access token expires (30 min), client calls `POST /api/users/v1/token/refresh/` with the refresh token
5. On logout, `POST /api/users/v1/logout/` blacklists the refresh token

**Token lifetimes** (configured in `settings.py`):
- Access token: **30 minutes**
- Refresh token: **1 day**, rotated on every refresh

### Role-Based Permission Classes

Defined in `utils/permissions.py`:

| Class | Allowed roles |
|---|---|
| `IsSuperAdmin` | SuperAdmin |
| `IsAdmin` | Admin |
| `IsTeacher` | Teacher |
| `IsStudent` | Student |
| `IsSuperAdminOrAdmin` | SuperAdmin, Admin |
| `IsAdminOrTeacher` | Admin, Teacher |
| `IsSuperAdminAdminOrTeacher` | SuperAdmin, Admin, Teacher |
| `IsTeacherOrStudent` | Teacher, Student |

### WebSocket Authentication

`config/channels_middleware.py` implements a `JWTAuthMiddleware` that:
- Reads the JWT token from the WebSocket query string or cookie
- Validates it and populates the connection scope with the user object
- Rejects unauthenticated connections before the consumer runs

---

## 8. Background Tasks (Celery)

Celery is configured in `config/celery.py` with Redis as both the broker and result backend.

### Task: `run_ai_evaluation_for_submission`
*(defined in `apps/courses/tasks.py`)*

**Purpose:** Asynchronously evaluate a student's test submission using OpenAI or Groq.

**Flow:**
1. Teacher/Admin triggers via `POST .../trigger-ai/`
2. Submission `ai_job_status` → `QUEUED`
3. Celery worker picks up the task:
   - Extracts text from uploaded answer files (PDF → pdfminer, Excel → pandas, Jupyter → JSON parse)
   - Builds a prompt with all questions, answers, and the answer key
   - Calls OpenAI or Groq API
   - Parses the JSON response
   - Saves per-question scores and feedback to `TestSubmissionAnswer`
   - Updates `TestSubmission.ai_score`, `ai_feedback`, `ai_job_status` → `SUCCEEDED`
4. On failure: `ai_job_status` → `FAILED`, error stored in `ai_error_message`
5. Retries: 3 attempts with exponential backoff

**Celery Worker Start:**
```bash
celery -A config worker -l info --concurrency=2
```

**Configuration (`.env`):**
```
CELERY_TASK_TIME_LIMIT=900        # Hard kill after 15 min
CELERY_TASK_SOFT_TIME_LIMIT=840   # Graceful shutdown warning at 14 min
```

---

## 9. Real-time Communication (Django Channels)

### WebSocket Endpoint
```
ws://<host>/ws/chat/batch/<batch_id>/
```

### How It Works

1. Student or teacher connects via WebSocket (authenticated via JWT middleware)
2. Access check: user must be enrolled in the batch or be the teacher/admin
3. User joins a Redis channel group named `batch_<batch_id>`
4. When a REST message is POSTed (`POST /chat/batches/<batch_id>/messages/`), the view calls `channel_layer.group_send()` to broadcast the saved message to all connected clients
5. When a message is deleted, a deletion event is broadcast to the group

### Channel Layer Configuration
```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [("localhost", 6379)],
        },
    },
}
```

---

## 10. File Storage

### Production — Cloudflare R2 (S3-compatible)

All media files go to a Cloudflare R2 bucket via `django-storages`'s `S3Boto3Storage` backend.

**Folder layout inside the bucket:**

| Path | Contents |
|---|---|
| `/course_thumbnails/` | Course cover images |
| `/course_sessions/thumbnails/` | Course session thumbnails |
| `/batch_sessions/thumbnails/` | Batch session thumbnails |
| `/test_answer_keys/` | Instructor-uploaded answer keys |
| `/test_questions/course/files/` | Course question files |
| `/test_questions/batch/files/` | Batch question files |
| `/test_submissions/answers/` | Student answer file uploads |
| `/chat_attachments/` | Batch chat file attachments |
| `/profile_pictures/` | User profile photos |
| `/app_config/logos/` | Platform logo |

**Videos** are stored as raw R2 object keys (not django-storages managed) and accessed directly. Multipart uploads are handled via three custom endpoints (`/upload/init/`, `/upload/complete/`, `/upload/abort/`).

### Development — Local Filesystem

Switch back to local storage by restoring the commented block in `settings.py`:
```python
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'
```

---

## 11. Frontend – React App

### Route Map

| Path | Page | Roles |
|---|---|---|
| `/login` | Login | Public |
| `/forgot-password` | Forgot Password | Public |
| `/verify-otp` | OTP Verification | Public |
| `/reset-password` | Reset Password | Public |
| `/dashboard` | Dashboard | All |
| `/admin-courses` | Course Management | Admin, Teacher |
| `/admin-courses/:courseId/content` | Course Editor | Admin, Teacher |
| `/batches` | Batch List | Admin, Teacher |
| `/batches/:batchId/students` | Enrollment Management | Admin, Teacher |
| `/admin/batches/:batchId/content` | Batch Content | Admin, Teacher |
| `/admin/batches/:batchId/webinars` | Webinar Management | Admin, Teacher |
| `/courses` | Student Course List | Student |
| `/courses/:courseId` | Course Detail | Student |
| `/assessments` | Test Submission | Student |
| `/progress` | Progress Dashboard | Student |
| `/chat` | Batch Chat | All enrolled |
| `/live-sessions` | Live Sessions | All |
| `/schedule` | Batch Calendar | All |
| `/users` | User Management | Admin |
| `/settings` | App Configuration | Admin |
| `/email-config` | SMTP Settings | Admin |
| `/notifications` | Notifications | All |
| `/access-denied` | 403 Error Page | — |

### Auth Context

`src/contexts/AuthContext.tsx` stores:
- Current user object and role
- Access + refresh tokens (persisted to localStorage)
- Axios interceptors for automatic token refresh

### API Client

Axios is configured with a base URL from `VITE_API_URL` (`.env`). The auth context attaches the `Authorization` header to every request and handles `401` responses by attempting a token refresh before retrying.

---

## 12. Environment Variables

### Backend (`.env` in `backend/elearn-backend/`)

```env
# Django
SECRET_KEY=your-secret-key
DEBUG=True

# Database (PostgreSQL for production)
DB_NAME=learnhub
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1
CELERY_TASK_TIME_LIMIT=900
CELERY_TASK_SOFT_TIME_LIMIT=840

# AI
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GROQ_BASE_URL=https://api.groq.com/openai/v1
AI_ALLOW_MOCK_EVALUATION=False

# Cloudflare R2 (production storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=learnhub
AWS_S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN=cdn.yourdomain.com   # optional CDN
```

### Frontend (`.env` in `frontend/`)

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## 13. Running the Project

### Quick Start (Development)

```bash
# From project root
./dev.sh
```

This starts three processes concurrently:
1. Django ASGI server on `0.0.0.0:8000`
2. Celery worker (concurrency=2)
3. Vite dev server (frontend)

### Manual Start

```bash
# Backend
cd backend/elearn-backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# Celery (separate terminal)
celery -A config worker -l info --concurrency=2

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### First-time Setup

```bash
# Create database tables
python manage.py migrate

# Create a superuser
python manage.py createsuperuser

# (Optional) Load initial UserType data if fixtures exist
python manage.py loaddata initial_data
```

---

## 14. Deployment Guide

### Architecture Overview

```
Internet
  │
  ▼
Nginx (reverse proxy)
  ├── /api/      → Daphne (Django ASGI, port 8000)
  ├── /ws/       → Daphne (WebSocket)
  └── /          → Frontend static files (dist/)

Daphne process
  └── Django app
        ├── PostgreSQL (database)
        ├── Redis (Channels + Celery broker)
        └── Cloudflare R2 (file storage)

Celery worker(s) (separate process/container)
  └── Same Django settings, connects to Redis + PostgreSQL
```

### Daphne (ASGI — handles both HTTP and WebSocket)

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Celery Workers

```bash
celery -A config worker -l info --concurrency=4
```

### Frontend Build

```bash
cd frontend
npm run build
# Outputs to frontend/dist/ — serve via Nginx or CDN
```

### Nginx Configuration Skeleton

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

### Production Checklist

- [ ] `DEBUG=False` in `.env`
- [ ] `SECRET_KEY` is a strong random value
- [ ] `ALLOWED_HOSTS` set to your domain(s)
- [ ] PostgreSQL configured and migrated
- [ ] Redis running (managed service recommended)
- [ ] Cloudflare R2 bucket created and credentials set
- [ ] Celery worker running as a managed service (systemd / supervisor / Docker)
- [ ] Daphne running behind Nginx with WebSocket upgrade headers
- [ ] Frontend built and served from CDN or Nginx
- [ ] HTTPS configured (Let's Encrypt / Cloudflare proxy)
- [ ] `CORS_ALLOW_ALL_ORIGINS = False` and `CORS_ALLOWED_ORIGINS` set to your frontend domain
- [ ] `CSRF_TRUSTED_ORIGINS` set appropriately
