# DoubtBridge — Viva Questions and Answers

Short, clear answers you can expand on with examples from the project.

---

## Project overview

**1. What is DoubtBridge?**
A web portal where students and professors join subject rooms, post academic doubts, answer them and mark them resolved. It has a landing page, registration/login, a subject dashboard, a three-column doubt room and notifications.

**2. Why did you choose this tech stack?**
HTML, CSS and vanilla JavaScript show the core web concepts without a framework hiding them. Express is a minimal Node.js framework that makes routing and middleware easy to understand. SQLite is a full relational database stored in one file, so no separate database server is needed.

**3. Explain the architecture.**
Three tiers: the browser (presentation), the Express server (business logic) and SQLite (data). The browser loads HTML pages, and JavaScript on those pages calls a JSON API using `fetch()`. The server validates the request, checks permissions, runs SQL and returns JSON.

---

## HTML

**4. What is semantic HTML? Where did you use it?**
Tags that describe meaning, such as `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` and `<time>`. Each doubt card is an `<article>`; timestamps use `<time datetime="...">`.

**5. How did you make forms accessible?**
Every input has a `<label for="...">`, errors are linked with `aria-describedby` and `aria-invalid`, alerts use `role="alert"`, there is a skip link, and focus outlines are visible.

**6. What is the `<dialog>` element?**
A native HTML modal. `showModal()` opens it with a backdrop and traps focus; the Escape key closes it. We use it for *Ask a Doubt* and the discussion view.

**7. Why `novalidate` on forms?**
It turns off the browser's default popups so our own JavaScript can show consistent error messages. The server still validates everything.

**8. GET vs POST in forms?**
GET puts data in the URL and should only read data. POST sends data in the request body and is used for actions that change data, such as login and posting a doubt.

---

## CSS

**9. How is the three-column layout built?**
With CSS Grid: `grid-template-columns: 250px minmax(0, 1.25fr) minmax(0, 1fr)`. Participants have a fixed width; the two doubt columns share the remaining space.

**10. How is the site responsive?**
Media queries. Below 1100px the grid becomes one column and tabs show one panel at a time; below 760px the navigation collapses into a menu button and form rows stack.

**11. Flexbox vs Grid?**
Flexbox lays items out in one direction (navigation bar, buttons in a row). Grid controls rows and columns together (subject cards, the room layout).

**12. What are CSS custom properties?**
Variables like `--primary: #3149c9` defined on `:root`. All colours, radii and shadows are defined once and reused, so changing the theme is easy.

**13. What is the box model?**
Every element is content + padding + border + margin. We set `box-sizing: border-box` so width includes padding and border, which makes layouts predictable.

---

## JavaScript

**14. What is the DOM?**
The Document Object Model is the browser's tree of objects representing the page. JavaScript changes the page by creating, updating and removing DOM nodes (`document.createElement`, `append`, `replaceChildren`).

**15. What does `fetch()` do?**
Sends an HTTP request from JavaScript and returns a Promise. We use it to call the API, for example `fetch('/api/subjects')`, then read the JSON response.

**16. What are `async` and `await`?**
A cleaner way to write Promise-based code. `await` pauses the function until the Promise resolves, without blocking the browser.

**17. Why `textContent` instead of `innerHTML`?**
`innerHTML` parses text as HTML, so a doubt containing `<script>` or `<img onerror=...>` could run code (XSS). `textContent` always inserts plain text.

**18. What is event handling? Give an example.**
Running code when something happens. `form.addEventListener('submit', ...)` calls `event.preventDefault()` to stop the page reload and sends the data with `fetch()`.

**19. What is debouncing? Where is it used?**
Waiting until the user stops typing before acting. The search box waits 250 ms after the last key press before calling the API, reducing requests.

---

## HTTP and REST

**20. What is HTTP?**
The request–response protocol of the web. A request has a method, URL, headers and an optional body; a response has a status code, headers and a body.

**21. Which HTTP methods does the project use?**
GET (read), POST (create: register, login, ask a doubt, post an answer), PATCH (partial update: resolve a doubt, mark a notification read) and DELETE (leave a room).

**22. Which status codes do you return?**
200 OK, 201 Created, 302 redirect, 400 validation error, 401 not logged in, 403 not allowed, 404 not found, 409 conflict (duplicate email), 429 too many requests, 500 server error.

**23. What is a REST API?**
An API where URLs represent resources (`/api/subjects/CN/doubts`) and HTTP methods represent actions on them. It is stateless per request and returns JSON.

**24. What is JSON?**
JavaScript Object Notation, a text format for data such as `{ "title": "...", "replyCount": 2 }`. `express.json()` parses request bodies and `res.json()` sends responses.

---

## Node.js and Express

**25. What is Node.js?**
A JavaScript runtime built on Chrome's V8 engine that runs JavaScript on the server. It uses an event loop and non-blocking I/O, so one process can serve many requests.

**26. What is Express?**
A minimal web framework for Node.js that provides routing (`app.get`, `router.post`), middleware and helpers like `res.json()` and `res.sendFile()`.

**27. What is middleware? Name some in your project.**
A function `(req, res, next)` that runs between receiving a request and sending a response. Ours: `helmet` (security headers), `express.json()` (body parsing), `express-session`, `loadUser`, `verifyCsrf`, `requireAuth`, the rate limiter and the error handler.

**28. What does `next()` do?**
It passes control to the next middleware or route. If a middleware sends a response instead (for example 401), the chain stops.

**29. How are errors handled?**
Routes throw `HttpError(status, message)`. Express 5 forwards thrown errors to the central `errorHandler`, which sends a JSON error. Unexpected errors are logged on the server and the user sees a generic message.

**30. What is `package.json`?**
The project manifest: name, scripts (`npm start`, `npm test`), dependencies and the required Node version. `package-lock.json` records exact installed versions.

---

## Sessions and authentication

**31. What is the difference between authentication and authorization?**
Authentication checks *who you are* (login with email and password). Authorization checks *what you may do* (only the author or a professor can resolve a doubt).

**32. How do sessions work?**
After login the server stores `userId` in a session and sends the browser a cookie containing only the session id. On each request the browser sends the cookie, and the server looks up the session in the `sessions` table.

**33. Why not store the role in the cookie?**
Anything in the browser can be edited. The cookie only holds a random, signed session id; the role is read from the database on every request.

**34. What cookie settings did you use and why?**
`HttpOnly` (JavaScript cannot read it), `SameSite=Lax` (not sent with cross-site POSTs), `Secure` in production (HTTPS only) and a 7-day `maxAge`.

**35. What is bcrypt and why not store plain passwords?**
bcrypt is a slow, salted hashing algorithm. If the database leaks, attackers get hashes, not passwords, and the salt plus slowness make guessing very expensive. At login we use `bcrypt.compare()`.

**36. What is a salt?**
Random data added to each password before hashing, so identical passwords produce different hashes and precomputed (rainbow) tables are useless.

**37. What is session fixation and how do you prevent it?**
An attacker makes a victim use a session id the attacker knows. We call `req.session.regenerate()` at login so the user always gets a fresh id.

**38. What is CSRF and how do you prevent it?**
Cross-Site Request Forgery tricks a logged-in user's browser into sending a request from another site. We store a random token in the session; our pages send it in the `X-CSRF-Token` header, and the server rejects state-changing requests without the correct token.

**39. Why rate limiting?**
To stop brute-force password guessing. Login and registration are limited per IP address per 15 minutes; extra attempts get HTTP 429.

**40. How do you stop someone registering as a professor to get extra rights?**
The `PROFESSOR_REGISTRATION` policy. By default new professor accounts are `pending` and cannot log in until the administrator runs `npm run professors:approve -- email`.

---

## SQLite and SQL

**41. What is SQLite?**
A serverless relational database engine that stores the whole database in one file. It supports SQL, transactions, foreign keys and indexes.

**42. List your tables and relationships.**
`users`, `subjects`, `subject_participants`, `doubts`, `answers`, `notifications`, `sessions`.
- users ↔ subjects is **many-to-many** through `subject_participants`.
- A subject has **many** doubts; a user authors **many** doubts (one-to-many).
- A doubt has **many** answers.
- A user receives **many** notifications.

**43. Primary key vs foreign key?**
A primary key uniquely identifies a row (`users.id`). A foreign key refers to a primary key in another table (`doubts.author_id → users.id`) and keeps the relationship valid.

**44. What is a composite primary key? Where used?**
A key made of several columns. `subject_participants` uses `(user_id, subject_id)`, so the same user cannot join the same room twice.

**45. What constraints did you use?**
`PRIMARY KEY`, `FOREIGN KEY ... ON DELETE CASCADE`, `UNIQUE` (email, subject code), `NOT NULL`, `DEFAULT` timestamps and `CHECK` (allowed roles, statuses, and "students must have class and division").

**46. What is normalization? Is your schema normalized?**
Organising data to avoid duplication. Yes: user details live only in `users`; doubts store `author_id`, not the author's name. The reply count is calculated with `COUNT(*)` rather than stored, so it can't become wrong.

**47. What is a JOIN? Give an example.**
Combining rows from tables using a related column. The doubt list joins `doubts` with `users` (author name, class, division) and `subjects` (code).

**48. What is SQL injection and how do you prevent it?**
Inserting SQL code through input, e.g. `' OR 1=1 --`. Every query uses prepared statements with `?` placeholders; the values are sent separately and are never treated as SQL.

**49. What is a transaction? Where did you use one?**
A group of SQL statements that succeed or fail together. Posting an answer inserts the answer, updates the doubt status and creates a notification in one transaction.

**50. What are indexes and why did you add them?**
Data structures that speed up lookups, like a book index. We index doubts by subject and date, answers by doubt and notifications by user and read status.

---

## CRUD

**51. What is CRUD? Map it to your project.**
- **Create:** register, ask a doubt, post an answer, join a room (`INSERT`)
- **Read:** dashboard, room lists, discussion, notifications (`SELECT`)
- **Update:** resolve/reopen a doubt, mark notifications read (`UPDATE`)
- **Delete:** leave a room (`DELETE`)

---

## Features and testing

**52. How does the unanswered list update?**
A doubt's `status` changes from `unanswered` to `answered` when the first reply is posted, and to `resolved` when marked resolved. The middle column requests `status=unresolved`, so a resolved doubt disappears from it but remains in the right column.

**53. How do notifications work without email?**
Notifications are rows in the `notifications` table, so the bell and the notifications page work regardless of email. If `SMTP_HOST` is set, Nodemailer also sends an email in the background; email failures are logged and never break the request.

**54. How do you ensure a student can't impersonate someone?**
The doubt and answer routes ignore any `authorId`, name, class or division in the request body and use `req.user`, which is loaded from the database using the session.

**55. How did you test the project?**
With Node's built-in test runner and Supertest, which sends real HTTP requests to the app using an in-memory database. Tests cover registration, login, roles, duplicates, rooms, doubts, answers, filtering, resolving, notifications, CSRF, unauthorized access, navigation links and persistence after restart.

**56. What would you improve?**
Real-time updates with WebSockets, an admin web panel, file attachments, accepted answers and upvotes, password reset by email and pagination.
