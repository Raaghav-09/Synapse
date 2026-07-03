# Synapse

An ed-tech platform (course marketplace + LMS) with an added "Adaptive Practice" module for auto-generated practice questions, weak-area detection, and performance analytics.

## Overview

- **Backend**: Node.js / Express REST API (`server/`), MongoDB via Mongoose, Cloudinary for media, Razorpay for payments, Nodemailer for email/OTP.
- **Frontend**: React (Create React App) SPA (`client/`), Redux Toolkit for state, Tailwind for styling, Axios for API calls.

## Setup

### Prerequisites
- Node.js and npm
- A running MongoDB instance (local `mongod` or a MongoDB Atlas connection string)

### Backend
```bash
cd server
npm install
cp .env.sample .env   # then fill in real values (see Environment variables below)
npm run dev           # nodemon, or: npm start
```
Runs on `http://localhost:4000`.

### Frontend
```bash
cd client
npm install
npm start
```
Runs on `http://localhost:3000`.

### Environment variables (`server/.env`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `PORT` | API port (defaults to 4000) |
| `JWT_SECRET` | Signing secret for auth tokens |
| `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS` | SMTP creds for OTP/notification emails |
| `CLOUD_NAME`, `API_KEY`, `API_SECRET` | Cloudinary media uploads |
| `FOLDER_NAME` | Cloudinary upload folder |
| `RAZORPAY_KEY`, `RAZORPAY_SECRET` | Payment gateway |

### Environment variables (`client/.env`)
| Variable | Purpose |
|---|---|
| `REACT_APP_BASE_URL` | Backend API base, e.g. `http://localhost:4000/api/v1` |

## How backend and frontend connect

The frontend never hardcodes the API host — every request goes through [`apiConnector.js`](client/src/services/apiConnector.js), an Axios instance configured with `baseURL = process.env.REACT_APP_BASE_URL`. Endpoint paths live in [`apis.js`](client/src/services/apis.js) and are called from the `services/operations/*API.js` files, which dispatch results into Redux slices (`src/slices/*`). As long as `client/.env`'s `REACT_APP_BASE_URL` matches the backend's `PORT` + `/api/v1` prefix, the two are wired correctly (verified: `http://localhost:4000/api/v1` ↔ backend listening on `4000`).

CORS is restricted in [`index.js`](server/index.js) to `origin: "http://localhost:3000"` with `credentials: true` — if you change the frontend port, update this too.

## Project structure

```
Synapse/
├── server/                        Express API
│   ├── index.js                   Entry point: middleware, route mounting, DB/Cloudinary connect, app.listen
│   ├── config/
│   │   ├── database.js            Mongoose connection (reads DATABASE_URL)
│   │   ├── cloudinary.js          Cloudinary SDK config
│   │   └── razorpay.js            Razorpay client instance
│   ├── middlewares/
│   │   └── auth.js                JWT auth guard + isStudent/isInstructor/isAdmin role gates
│   ├── controllers/
│   │   ├── Auth.js                 signup, login, sendotp, changePassword
│   │   ├── Category.js             create/list course categories
│   │   ├── Course.js               course CRUD, instructor course list, full course details
│   │   ├── Section.js / Subsection.js   course content structure (sections/lectures)
│   │   ├── Profile.js              profile update/delete, enrolled courses, instructor dashboard stats
│   │   ├── Payments.js             Razorpay order capture + signature verification
│   │   ├── RatingAndReview.js      course ratings/reviews
│   │   ├── ResetPassword.js        forgot/reset password flow
│   │   └── Practice.js             adaptive practice: generate questions, submit attempts, weak-area detection, analytics
│   ├── models/                     Mongoose schemas (User, Course, Section, SubSection, Category, Profile,
│   │                                CourseProgress, OTP, RatingAndReview, and the new Practice-feature
│   │                                schemas: PracticeQuestion, GeneratedQuestion, QuestionAttemptHistory,
│   │                                UserPerformanceMetric, WeakAreaProfile)
│   ├── routes/                     Express routers mounted in index.js under /api/v1/*
│   ├── services/
│   │   └── questionGenerationService.js   Generates parameterized question variations (algebra/calculus/mechanics) using mathjs
│   ├── mail/templates/             HTML email templates (OTP verification, password update, enrollment)
│   └── utils/                      imageUploader.js (Cloudinary upload), mailSender.js (Nodemailer wrapper)
│
└── client/                        React SPA
    ├── src/App.jsx                Top-level routes
    ├── src/index.js                React DOM root, Redux Provider
    ├── src/reducer/index.js        Root Redux reducer (combines all slices)
    ├── src/slices/                 Redux Toolkit slices: auth, cart, course, profile, viewCourse, and new
    │                                practiceSlice / weakAreaSlice
    ├── src/services/
    │   ├── apiConnector.js         Axios instance (baseURL from REACT_APP_BASE_URL)
    │   ├── apis.js                 Centralized endpoint URL constants
    │   └── operations/*API.js      Thunks that call apiConnector + dispatch to slices (incl. new practiceAPI.js)
    ├── src/components/             Reusable UI: Common/ (Navbar, Footer, Tab, modals), core/ (per-feature:
    │                                Auth, Dashboard, Course, Catalog, HomePage, ViewCourse, etc.)
    ├── src/pages/                  Route-level pages (Home, Login, Signup, Dashboard, Catalog,
    │                                CourseDetails, ViewCourse, and new pages/dashboard/adaptive-practice/*
    │                                — PracticeHome, PracticeSession, WeakAreas, RemedialPractice)
    ├── src/hooks/                   useOnClickOutside, useRouteMatch
    ├── src/data/                    Static config: navbar/footer/dashboard link lists, homepage content
    └── src/utils/                   Small helpers: date formatting, average rating calc, constants
```

## What was broken, and what was fixed

**Symptom**: `node index.js` in `server/` produced no output and never bound to a port — it just hung.

**Root cause**: The whole project lives under `~/Desktop`, which macOS syncs to iCloud Drive ("Desktop & Documents Folders"). Both `server/node_modules` and `client/node_modules` contain tens of thousands of small files (e.g. `mathjs` alone ships 1,256 JS files). iCloud's on-demand file-provider layer couldn't keep up with Node's rapid-fire `require()` file reads across that many files, so individual file opens blocked indefinitely — the process never got past its `require()` calls to reach `app.listen()`. This was confirmed directly: a bare `node -e "console.log(1)"` returned instantly, but `require('express')` and `require('mathjs')` each hung for 30+ seconds with near-zero CPU usage (blocked on I/O, not doing work), and `brctl status` showed this Desktop path actively mid-sync with a backlog of pending iCloud changes.

There was no actual bug in `index.js`, the env config, or any dependency version — `.env` was present and correctly populated, MongoDB was installed and running locally, and CORS/middleware ordering was all fine.

**Fix**: Reinstalled `node_modules` for both `server/` and `client/` directly on local (non-iCloud-synced) disk at `~/.node_modules_offload/synapse-{server,client}/node_modules`, then symlinked them back into place as `server/node_modules` and `client/node_modules`. This is transparent to Node/npm/webpack going forward and fully reversible. Confirmed working:
- Backend: `GET http://localhost:4000/` → `200 {"success":true,"message":"Your server is up and running"}`, MongoDB connects successfully.
- Frontend: `npm start` compiles (only pre-existing ESLint warnings, no errors) and serves `200` on `http://localhost:3000/`.

**Going forward**: avoid running Node projects from inside `~/Desktop` or `~/Documents` if iCloud Drive sync is enabled for those folders — `node_modules` (and any large-file-count directory) will repeatedly hit this same stall. Either work from a folder outside those two (e.g. `~/Developer`), or keep excluding `node_modules` via the symlink-to-local-disk trick above after every fresh `npm install`.
