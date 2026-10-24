# DoubtBridge — Demonstration Script (about 8–10 minutes)

**Before the demo**
1. `npm run db:reset` then `npm run db:seed-demo` for clean sample data.
2. `npm start` and open `http://localhost:3000` in a normal window **and** a private/incognito window (two users at once).
3. Keep VS Code open on `database/schema.sql`, `routes/doubts.js` and `public/js/room.js`.

---

## 1. Introduction (1 min)
> "DoubtBridge is a subject-wise doubt solving portal. Students post doubts in subject rooms, classmates and professors answer, and resolved doubts stay searchable. The frontend is plain HTML, CSS and JavaScript; the backend is Node.js with Express; data is stored in SQLite."

Show the landing page: tagline, Student Login and Professor Login cards.

## 2. Registration and validation (1.5 min)
1. Click **New student? Register**. Press *Create* with empty fields → show the error messages.
2. Fill in a weak password → show the strength rule.
3. Register properly (e.g. TE / A). You land on the dashboard.
> "The browser checks the form for quick feedback, but the server validates everything again because browser checks can be bypassed. The password is stored as a bcrypt hash."

Optional: open the database in *DB Browser for SQLite* and show the hash in `users`.

## 3. Role protection (1 min)
1. Log out. Open **Professor Login** and enter the student's email and password.
2. Show the message: *"This is a student account. Please use Student Login."*
3. Open `/register/professor` and register → show the "waiting for approval" message.
4. In the terminal: `npm run professors:list` and `npm run professors:approve -- that@email`.
> "The role is stored in the database, not decided by the browser, and professor accounts need administrator approval."

## 4. Dashboard (1 min)
Log in as `demo.student1@example.com`. Point out the three subject cards with participant counts, unanswered counts and the notification badge.
> "These numbers come from SQL `COUNT` queries, not hardcoded values."

## 5. Doubt room — the main feature (3 min)
1. Open **CN**. Explain the three columns: participants, unanswered doubts, all doubts.
2. Click **Ask a Doubt**, post *"What is the purpose of ARP?"*. It appears immediately in the middle and right columns.
3. Open **DAA** and **WT** → the CN doubt is not there.
4. In the private window, log in as `demo.professor@example.com`, open CN, click **Answer** on the new doubt and post a reply.
5. Back in the first window: the bell shows **1**. Open **Notifications** → "Professor … responded to your doubt". Click **Open discussion**.
6. Show the professor answer highlighted. Click **Mark as resolved**. The doubt leaves the middle column and shows *Resolved* in the right column.
7. Use the search box and filter chips (Unanswered / Answered / Resolved).
8. Click **Leave room** / **Join room** and watch the participant count change.

## 6. Responsive design (30 s)
Open DevTools → toggle device toolbar → iPhone size. The three columns become tabs.

## 7. Persistence (30 s)
Stop the server with `Ctrl + C`, run `npm start` again, refresh → you are still logged in and all doubts are still there.
> "Data and sessions are stored in the SQLite file."

## 8. Tests and code (1 min)
Run `npm test` and show all tests passing. Briefly show:
- `database/schema.sql` — tables, foreign keys, CHECK constraints
- `routes/doubts.js` — a parameterized query and the transaction that inserts an answer and creates a notification
- `public/js/common.js` — `textContent` used to prevent XSS

## 9. Conclusion
> "DoubtBridge covers HTML forms, CSS Grid and media queries, DOM manipulation with fetch, a REST API in Express, middleware, sessions, bcrypt, role-based authorization and a normalised SQLite database. Future work includes real-time updates, file attachments and an admin panel."
