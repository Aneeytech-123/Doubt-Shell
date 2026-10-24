# DoubtBridge

**Ask. Answer. Understand.**

DoubtBridge is a Student–Professor doubt solving portal. Students and professors log in, join subject rooms (DAA, CN, WT), post academic doubts, answer each other and keep every discussion organised by subject.

It is built with plain **HTML5, CSS3 and vanilla JavaScript** on the frontend and **Node.js, Express and SQLite** on the backend, as a third-year Computer Science Web Technology project.

---

## Table of contents

1. [Objectives](#objectives)
2. [Features](#features)
3. [Technology stack](#technology-stack)
4. [Architecture](#architecture)
5. [Folder structure](#folder-structure)
6. [Database schema](#database-schema)
7. [API reference](#api-reference)
8. [Installation](#installation)
9. [Environment variables](#environment-variables)
10. [Running the project](#running-the-project)
11. [Approving professor accounts](#approving-professor-accounts)
12. [Testing](#testing)
13. [Security measures](#security-measures)
14. [Deployment](#deployment)
15. [Screenshots](#screenshots)
16. [Future enhancements](#future-enhancements)

---

## Objectives

- Give every subject its own discussion room so doubts are easy to find.
- Let students ask doubts and receive answers from classmates and professors.
- Show clearly which doubts are still unanswered, which are answered and which are resolved.
- Notify students as soon as someone responds to their doubt.
- Demonstrate core Web Technology concepts: HTML forms, CSS layout, DOM manipulation, `fetch()`, HTTP methods, REST APIs, Express middleware, sessions, authentication and relational databases.

## Features

**Accounts and roles**
- Landing page with separate **Student Login** and **Professor Login**.
- Student registration (name, class, division, email, password) and professor registration (name, email, password).
- Email format, required field and password strength validation on both browser and server.
- Duplicate email registrations are rejected (case-insensitive).
- Passwords hashed with bcrypt; hashes are never sent to the browser.
- Role is stored on the server. Logging in through the wrong portal is refused, and editing JavaScript cannot change a user's role.
- Configurable professor registration policy (`approval`, `open`, `closed`) with an administrator approval command.
- Logout, and all private pages protected on the server.

**Subject dashboard**
- Subject cards for DAA, CN and WT loaded from the database.
- Live participant count, unanswered doubt count and total doubts for each subject.
- Unread notification count.
- New subjects can be added by editing one file.

**Subject doubt room** (three columns, as in the hand-drawn layout)
- **Left — Participants:** total count, names, class and division for students, professor labels. Join / leave the room.
- **Middle — Unanswered doubts:** every unresolved doubt with title, full description, author, class-division, date and time, reply count, a quick-answer box and a *Mark resolved* button for the author or a professor.
- **Right — All doubts:** every doubt in the subject, newest first, with keyword search and filters (All / Unanswered / Answered / Resolved). Clicking a doubt opens its discussion.
- **Discussion view:** question details, all answers with author names, roles and timestamps, a reply box and resolved / unresolved status. Professor replies are highlighted.
- **Ask a Doubt** form: title and description only. The subject comes from the room and the author, class and division come from the logged-in account.
- On tablets and phones the three columns become accessible tabs.

**Notifications**
- In-app notification when someone answers your doubt, a separate type when a professor responds, and one when a professor resolves your doubt.
- Stored in the database, with an unread badge in the navigation bar and a notifications page.
- Optional email copies through Nodemailer when SMTP is configured. Everything still works without SMTP.

## Technology stack

| Layer | Technology | Why |
| --- | --- | --- |
| Structure | HTML5 | Semantic pages, accessible forms, native `<dialog>` |
| Styling | CSS3 | Custom properties, Flexbox, Grid, media queries |
| Behaviour | Vanilla JavaScript | DOM manipulation and `fetch()` calls to the API |
| Icons | Lucide (served locally from `node_modules`) | Open-source SVG icons |
| Server | Node.js + Express 5 | Routing, middleware, JSON API |
| Database | SQLite via `better-sqlite3` | Single-file relational database, no separate server needed |
| Authentication | `express-session` + `bcryptjs` | Session cookies and bcrypt password hashing |
| Security | `helmet`, `express-rate-limit`, custom CSRF middleware | Security headers, brute-force protection, CSRF tokens |
| Email | Nodemailer | Optional notification emails over SMTP |
| Testing | Node.js built-in test runner + Supertest | Automated API tests |

> `bcryptjs` is a pure-JavaScript implementation of the bcrypt algorithm. It produces standard bcrypt hashes and avoids native build problems on Windows.

## Architecture

DoubtBridge follows a classic **three-tier client–server architecture**:

```
 Browser (HTML + CSS + JS)              Express server (Node.js)                    SQLite
┌──────────────────────────┐  HTTP   ┌────────────────────────────────────┐  SQL  ┌──────────────┐
│ views/*.html  (pages)    │ ──────► │ helmet → json parser → session      │ ────► │ users        │
│ public/css/style.css     │  JSON   │ → loadUser → CSRF check             │       │ subjects     │
│ public/js/*.js           │ ◄────── │ → routes (auth, subjects, doubts,   │ ◄──── │ doubts ...   │
│  fetch('/api/...')       │         │   notifications, pages)             │       │ sessions     │
└──────────────────────────┘         │ → error handler                     │       └──────────────┘
                                     │ services: mailer, notifications     │
                                     └────────────────────────────────────┘
```

**Frontend responsibilities** (`views/`, `public/`)
- Display pages and forms, give instant validation feedback, call the API with `fetch()` and update the page with the results.
- All user-written text is inserted with `textContent`, never `innerHTML`, so it can't run as code.

**Backend responsibilities** (`app.js`, `routes/`, `middleware/`, `services/`)
- Authenticate users, decide what each user is allowed to do, validate every input again, run SQL queries, create notifications and send emails.
- The server never trusts role names, user IDs, author names or class/division values sent by the browser. These always come from the session and the database.

**Database responsibilities** (`database/`)
- Store users, subjects, memberships, doubts, answers, notifications and sessions permanently.
- Enforce rules with constraints: unique emails, valid roles and statuses, foreign keys between tables.

**Typical request — posting an answer**
1. The browser sends `POST /api/doubts/12/answers` with JSON `{ "body": "..." }` and the `X-CSRF-Token` header.
2. `express-session` reads the session cookie; `loadUser` loads the user from the database.
3. `verifyCsrf` checks the token. `requireAuth` makes sure someone is logged in.
4. The route checks that the user has joined the room and validates the answer text.
5. In one transaction it inserts the answer, changes the doubt status to `answered` and creates a notification for the question's author.
6. The server replies `201 Created` with JSON; the page re-renders the lists.

## Folder structure

```
doubt-shell/
├── app.js                  # Builds the Express app (middleware + routes)
├── server.js               # Entry point: opens the database and starts listening
├── config.js               # Reads settings from .env
├── database/
│   ├── schema.sql          # Table definitions, constraints and indexes
│   ├── db.js               # Opens SQLite, applies the schema, seeds subjects
│   ├── subjects.js         # The list of subject rooms (add new subjects here)
│   ├── init.js             # npm run db:init / db:reset
│   ├── seed-demo.js        # npm run db:seed-demo (optional demo accounts)
│   └── sessionStore.js     # Saves login sessions in SQLite
├── middleware/
│   ├── auth.js             # loadUser, requireAuth, requirePageAuth, requireRole
│   ├── csrf.js             # CSRF token creation and checking
│   └── errors.js           # 404 handler and central error handler
├── routes/
│   ├── auth.js             # /api/session, register, login, logout
│   ├── subjects.js         # Dashboard cards, rooms, join/leave, list & create doubts
│   ├── doubts.js           # Discussion view, answers, resolve/reopen
│   ├── notifications.js    # List, unread count, mark read
│   └── pages.js            # Serves the HTML pages, protects private ones
├── services/
│   ├── doubtQueries.js     # Shared SQL for doubts + permission helper
│   ├── mailer.js           # Optional Nodemailer email sending
│   └── notifications.js    # Creates notifications (+ email)
├── utils/
│   └── validate.js         # Server-side validation rules
├── scripts/
│   └── professors.js       # Admin tool: list / approve / reject professors
├── views/                  # HTML pages
│   ├── index.html          # Landing page with role selection
│   ├── login.html          # Student / professor login
│   ├── register-student.html
│   ├── register-professor.html
│   ├── dashboard.html      # Subject cards
│   ├── room.html           # Three-column doubt room
│   ├── notifications.html
│   └── 404.html
├── public/
│   ├── css/style.css       # All styles (design tokens at the top)
│   ├── js/                 # One script per page + common.js helpers
│   └── favicon.svg
├── tests/                  # Automated tests (node --test)
├── docs/
│   ├── VIVA.md             # Viva questions and answers
│   └── DEMO-SCRIPT.md      # Step-by-step demonstration script
├── .env.example            # Placeholder environment variables
├── .gitignore
└── package.json
```

## Database schema

```
users ───────────────┐
  id PK              │ 1
  full_name          │
  email UNIQUE       ├──────────< subject_participants >──────────┐
  password_hash      │             user_id  FK → users.id         │
  role (student|professor)         subject_id FK → subjects.id    │
  class_name, division (students)  PK (user_id, subject_id)       │
  status (active|pending|rejected)                                │
  created_at         │                                     subjects
                     │                                       id PK
                     ├──────────< doubts >──────────────────── code UNIQUE
                     │  author_id FK      subject_id FK         name, description
                     │  title, description, status
                     │  resolved_by FK → users.id, resolved_at
                     │  created_at, updated_at
                     │        │ 1
                     │        └──────< answers
                     │                  doubt_id FK, author_id FK, body, created_at
                     │
                     └──────────< notifications
                                  user_id FK (receiver), actor_id FK, doubt_id FK
                                  type (answer|professor_answer|resolved), message, is_read

sessions (sid PK, sess JSON, expires) — login sessions
```

| Table | Purpose | Key rules |
| --- | --- | --- |
| `users` | Students and professors | `email` unique (case-insensitive); `role` is `student` or `professor`; a CHECK constraint requires class and division for students and forbids them for professors; `status` handles professor approval |
| `subjects` | Subject rooms | `code` unique (DAA, CN, WT) |
| `subject_participants` | Who joined which room (many-to-many) | Composite primary key stops duplicate joins |
| `doubts` | Questions in a room | Belongs to one subject and one author; `status` is `unanswered`, `answered` or `resolved` |
| `answers` | Replies to a doubt | One doubt has many answers; deleted with the doubt (`ON DELETE CASCADE`) |
| `notifications` | In-app alerts | Belongs to the receiving user; `is_read` flag |
| `sessions` | Login sessions | Lets users stay logged in after a server restart |

Indexes are created for the most common lookups: doubts by subject and date, doubts by subject and status, answers by doubt, participants by subject and unread notifications by user.

The reply count is not stored; it is calculated with `COUNT(*)` so it can never go out of sync (normalisation).

## API reference

All endpoints return JSON. Requests other than `GET` must include the `X-CSRF-Token` header (get it from `GET /api/session`).

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/api/session` | Current user (or `null`) and CSRF token | Public |
| POST | `/api/auth/register/student` | Register a student | Public |
| POST | `/api/auth/register/professor` | Register a professor (policy applies) | Public |
| POST | `/api/auth/login` | Log in. Body: `email`, `password`, `role` | Public |
| POST | `/api/auth/logout` | Log out | Logged in |
| GET | `/api/subjects` | Dashboard cards with counts | Logged in |
| GET | `/api/subjects/:code` | Room details and participants | Logged in |
| POST / DELETE | `/api/subjects/:code/join` | Join / leave a room | Logged in |
| GET | `/api/subjects/:code/doubts?status=&q=` | List doubts (`all`, `unresolved`, `unanswered`, `answered`, `resolved`) with search | Logged in |
| POST | `/api/subjects/:code/doubts` | Ask a doubt | Room members |
| GET | `/api/doubts/:id` | Doubt + all answers | Logged in |
| POST | `/api/doubts/:id/answers` | Post an answer | Room members |
| PATCH | `/api/doubts/:id/resolve` | `{ "resolved": true/false }` resolve or reopen | Author or professor |
| GET | `/api/notifications` | Your notifications | Logged in |
| GET | `/api/notifications/unread-count` | Unread count | Logged in |
| PATCH | `/api/notifications/:id/read` | Mark one as read | Owner only |
| POST | `/api/notifications/read-all` | Mark all as read | Logged in |

## Installation

**Requirements:** [Node.js 22 LTS or newer](https://nodejs.org/) and Git.

```bash
git clone https://github.com/Aneeytech-123/doubt-shell.git
cd doubt-shell
npm install
```

## Environment variables

Copy the example file and edit it:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows Command Prompt
copy .env.example .env
```

Generate a session secret and paste it as `SESSION_SECRET` in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | Port for the server | `3000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `SESSION_SECRET` | Secret used to sign session cookies (**required in production**) | random per run |
| `DB_PATH` | Location of the SQLite file | `./data/doubtbridge.db` |
| `PROFESSOR_REGISTRATION` | `approval`, `open` or `closed` | `approval` |
| `AUTH_RATE_LIMIT_MAX` | Login/register attempts per IP per 15 minutes | `20` |
| `APP_URL` | Public site URL used in email links | `http://localhost:3000` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Optional email settings. Leave `SMTP_HOST` empty to turn email off | empty |

**Gmail example:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, your Gmail address as `SMTP_USER` and a Google *App Password* (not your normal password) as `SMTP_PASS`.

`.env` is listed in `.gitignore`, so your secrets are never committed.

## Running the project

```bash
npm run db:init        # create tables and the DAA, CN, WT subjects
npm run db:seed-demo   # OPTIONAL: demo accounts and sample doubts
npm start              # start the server
```

Open <http://localhost:3000>.

Demo accounts created by `db:seed-demo` (password `Demo@1234` for all):

| Role | Email |
| --- | --- |
| Student (TE-A) | `demo.student1@example.com` |
| Student (TE-B) | `demo.student2@example.com` |
| Professor | `demo.professor@example.com` |

Other useful commands:

```bash
npm run dev            # restart automatically when files change
npm run db:reset       # DELETE the database and create a fresh one
```

**Adding a subject:** add an entry to `database/subjects.js`, then run `npm run db:init` again. Existing data is kept.

**Changing classes or divisions:** edit `classOptions` and `divisionOptions` in `config.js`.

## Approving professor accounts

Students should not be able to register as professors just to gain extra permissions (resolving any doubt). DoubtBridge therefore has a configurable policy in `.env`:

| `PROFESSOR_REGISTRATION` | Behaviour |
| --- | --- |
| `approval` (default) | Professors can register, but their account is `pending` and cannot log in until approved |
| `open` | Professor accounts are active immediately (only for local testing) |
| `closed` | Professor self-registration is disabled |

The administrator (whoever has access to the server terminal) manages accounts with:

```bash
npm run professors:list
npm run professors:approve -- professor@college.edu
npm run professors:reject  -- professor@college.edu
```

## Testing

```bash
npm test
```

The tests use a temporary in-memory database, so your real data is never touched. They cover:

- Student registration, validation, login and logout
- Password hashing and never exposing hashes
- Duplicate email rejection
- Professor approval policy, professor login and role authorization (wrong-portal login is refused)
- Rate limiting of login attempts
- Joining / leaving rooms and accurate participant counts
- Creating doubts, validation, newest-first ordering
- A CN doubt not appearing in DAA or WT
- Posting answers, reply counts and status changes
- Filtering unanswered / answered / resolved doubts and keyword search
- Resolving and reopening doubts (author or professor only)
- Notification creation, professor-response notifications, email sending with a fake mailer, and in-app notifications without SMTP
- Users not being able to impersonate another author or change class, division, subject or status
- Unauthorized access returning 401 / redirecting, CSRF rejection, cookie flags and security headers
- Every internal link in the HTML pages loading correctly
- Data and login sessions persisting after a server restart

**Manual checklist** (for the demo):
- [ ] Landing page → Student Login / Professor Login / Register links work
- [ ] Register a student, log out, log in again
- [ ] Join CN, ask a doubt, see it appear immediately in the middle and right columns
- [ ] Check the doubt does not appear in DAA or WT
- [ ] Log in as another user in a private window, answer the doubt; the first user's bell shows 1
- [ ] Mark the doubt resolved; it leaves the middle column and shows "Resolved" on the right
- [ ] Restart the server (`Ctrl + C`, `npm start`) and confirm everything is still there
- [ ] Resize the browser below 1100px; the columns become tabs

## Security measures

| Threat | Protection |
| --- | --- |
| Stolen passwords | bcrypt hashing with salt (12 rounds) |
| SQL injection | Every query uses `?` placeholders (prepared statements) |
| Cross-site scripting (XSS) | User text rendered with `textContent`; Content-Security-Policy only allows scripts from this site |
| Cross-site request forgery (CSRF) | Secret token per session checked on every POST/PATCH/DELETE, plus `SameSite=Lax` cookies |
| Session hijacking | `HttpOnly` cookie, `Secure` in production, session id regenerated at login |
| Brute-force login | Rate limit on login and registration |
| Privilege escalation | Role, author and class/division taken only from the database; professor approval policy |
| Impersonation | Doubts and answers always use the logged-in user's id |
| User enumeration | Same error message for unknown email and wrong password |
| Crashes leaking details | Central error handler hides internal errors from users |
| Leaked secrets | `.env` ignored by Git; only placeholders in `.env.example` |

## Deployment

The app runs on any host that supports Node.js and a persistent disk (SQLite is a file).

1. Push the repository to GitHub.
2. Create a Node.js web service (for example on Render, Railway or a college server).
3. Build command: `npm install`. Start command: `npm start`.
4. Set environment variables in the host's dashboard: `NODE_ENV=production`, a long random `SESSION_SECRET`, `APP_URL` with your public URL, and `DB_PATH` pointing to a **persistent disk** (for example `/var/data/doubtbridge.db`). Without a persistent disk, the database is wiped on each redeploy.
5. The host must serve the site over HTTPS, because production cookies are marked `Secure`.

## Screenshots

Add your own screenshots to `docs/screenshots/` and replace these placeholders.

| Page | Screenshot |
| --- | --- |
| Landing page | `docs/screenshots/landing.png` |
| Student login | `docs/screenshots/login.png` |
| Registration | `docs/screenshots/register.png` |
| Dashboard | `docs/screenshots/dashboard.png` |
| Doubt room (desktop) | `docs/screenshots/room-desktop.png` |
| Discussion view | `docs/screenshots/discussion.png` |
| Doubt room (mobile) | `docs/screenshots/room-mobile.png` |
| Notifications | `docs/screenshots/notifications.png` |

<!-- Example once added: ![Dashboard](docs/screenshots/dashboard.png) -->

## Future enhancements

- Admin web panel for approving professors and managing subjects
- Upvoting answers and marking an "accepted answer"
- Image and file attachments (diagrams, code screenshots)
- Code blocks and formatting in questions (Markdown with safe sanitising)
- Real-time updates with WebSockets instead of refreshing lists
- Password reset by email
- Pagination for large rooms
- Tags (e.g. "Unit 3", "Exam") and per-professor subject assignment
- Analytics for professors: most-asked topics per subject

## Project documents

- [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) — what to show and say during the demonstration
- [`docs/VIVA.md`](docs/VIVA.md) — likely viva questions with answers

## License

No open-source license has been chosen yet, so all rights are reserved by the author. If you want others to reuse the code, add a `LICENSE` file (for example MIT) and update the `license` field in `package.json`.
