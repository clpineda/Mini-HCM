# Mini HCM Time Tracking

Docker-first Mini HCM activity for employee time tracking.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database/Auth: Firebase Auth and Firestore
- Runtime: Docker Compose

## Project Structure

```text
.
|-- backend/
|-- frontend/
|-- docker-compose.yml
|-- .env.example
|-- .gitignore
`-- README.md
```

## Docker Setup

Install Docker Desktop, then create a local env file:

```bash
cp .env.example .env
```

Start both services through Docker:

```bash
docker compose up --build
```

Do not run `npm run dev` manually outside Docker. Docker Compose starts:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

The frontend calls the backend through `VITE_API_BASE_URL=http://localhost:4000`. This is correct because API requests are made by the browser on your machine.

## Firebase Setup

Create a Firebase project, then enable these products:

1. Authentication
2. Firestore Database

Enable Email/Password sign-in:

1. Open Firebase Console.
2. Go to Authentication.
3. Open Sign-in method.
4. Enable Email/Password.

Get frontend config values:

1. Open Project settings.
2. In the General tab, create or select a Web app.
3. Copy the `firebaseConfig` values into `.env`.

Frontend variables use the required `VITE_` prefix:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Get backend Admin SDK credentials:

1. Open Project settings.
2. Open Service accounts.
3. Select Firebase Admin SDK.
4. Generate a new private key.

Use one backend credential method.

Method A, environment variables:

```text
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Keep newline characters in `FIREBASE_PRIVATE_KEY` escaped as `\n` in `.env`.

Method B, Application Default Credentials:

```text
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

`GOOGLE_APPLICATION_CREDENTIALS` must point to a service account JSON file that exists inside the backend container. Do not commit service account JSON files.

## Create An Admin User

1. Register a normal account in the app at `http://localhost:5173/register`.
2. Open Firestore in Firebase Console.
3. Go to `users/{uid}` for that account.
4. Change the `role` field from `employee` to `admin`.
5. Log out and log back in.

Admin users see an Admin link and can open `http://localhost:5173/admin`.

## App Routes

- `/register`: create account and Firestore user profile
- `/login`: sign in
- `/dashboard`: punch in/out and view today's summary
- `/history`: employee daily summary history
- `/admin`: admin-only users, punches, daily reports, weekly reports, punch editing

## Firestore Collections

`users/{uid}`

```js
{
  name,
  email,
  role,
  timezone,
  schedule: {
    start,
    end
  },
  createdAt
}
```

`attendance/{autoId}`

```js
{
  userId,
  type: "IN" | "OUT",
  timestamp,
  date,
  createdAt,
  editedBy,
  editedAt
}
```

`editedBy` and `editedAt` are added only when an admin edits a punch.

`dailySummary/{userId}_{date}`

```js
{
  userId,
  date,
  timezone,
  schedule,
  regularHours,
  overtimeHours,
  nightDiffHours,
  lateMinutes,
  undertimeMinutes,
  firstIn,
  lastOut,
  computedAt
}
```

## Computation Rules

Endpoint:

```bash
curl -X POST http://localhost:4000/api/attendance/compute \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_UID","date":"2026-05-25"}'
```

Rules:

- Date is `YYYY-MM-DD` using `Asia/Manila`.
- First `IN` punch is used as `firstIn`.
- Last `OUT` punch is used as `lastOut`.
- Regular hours are worked hours inside the scheduled shift.
- Overtime hours are worked hours after scheduled shift end.
- Night differential hours are worked time overlapping `22:00` to `06:00`.
- Late minutes are minutes after scheduled shift start.
- Undertime minutes are minutes leaving before scheduled shift end.
- The result is stored in `dailySummary/{userId}_{date}`.

## Sample Test Scenario

User schedule:

```text
09:00-18:00
```

Punches:

```text
Punch In:  09:15
Punch Out: 19:30
```

Expected result:

```text
lateMinutes: 15
regularHours: 8.75
overtimeHours: 1.5
undertimeMinutes: 0
nightDiffHours: 0
```

Why:

- Employee is 15 minutes late because they started at `09:15`.
- Regular work inside the shift is `09:15-18:00`, or 8 hours 45 minutes.
- Overtime is `18:00-19:30`, or 1 hour 30 minutes.

## Verify Submission

1. Start the app:

```bash
docker compose up --build
```

2. Check backend:

```bash
curl http://localhost:4000/api/health
```

Expected:

```json
{"status":"ok","service":"mini-hcm-time-tracking-api"}
```

3. Register a user at `http://localhost:5173/register`.
4. Punch In and Punch Out from the dashboard.
5. Confirm `attendance` documents are created.
6. Confirm `dailySummary/{userId}_{date}` is created after Punch Out.
7. Promote the user to admin in Firestore.
8. Log back in and open `/admin`.
9. Edit a punch, save it, then click Recompute Summary.

## Secrets

No secrets should be committed. Keep real Firebase values only in local `.env` files or your deployment secret manager. `.env`, service account JSON files, `node_modules`, logs, and build output are ignored by git.
