# Blood Bank

Four separate projects that share one Firebase project (Firestore + Authentication):

| Folder                | What it is                                                       | Who uses it                                  | Sign-in                |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------- | ---------------------- |
| [server/](server)     | REST API (Node.js, Express, Firebase Admin)                      | both apps                                    | verifies Firebase tokens |
| [client/](client)     | User app: phone-sized UI, runs in the browser, can be installed  | donors, hospitals, blood banks               | phone number + SMS OTP |
| [admin/](admin)       | Admin website (React)                                            | admins only                                  | email + password       |
| [hospitalandbloodbanksubadmin/](hospitalandbloodbanksubadmin) | Hospital and blood bank website (React): register, stock, requests | hospitals and blood banks | phone number + SMS OTP |

The API has three doors: `/api/v1/*` for the user app, `/api/admin/*` for the admin website and `/api/org/*` for the
hospital and blood bank website. Each is open only to its own website's origin. An admin token is refused by the user
and organisation APIs, a phone-number token is refused by the admin API, and the organisation API refuses donors.
A hospital or blood bank has **one account for both the mobile app and its website**: the same phone number, the
same stock, the same requests.

```
server/
  src/
    config/         validated environment (env.js), Firebase Admin setup (firebase.js)
    constants/      roles, blood groups, limits
    middlewares/    authenticate, authenticateAdmin, requireRole, validate, rateLimit, errorHandler
    validators/     zod schemas for every request body and query string
    routes/         one router per area, mounted in routes/index.js
    controllers/    thin request handlers (admin/ for the admin API)
    services/       business logic and every Firestore / Firebase Auth call
    utils/          HttpError, logger, time, pagination
    app.js          builds the Express app (used by the tests)   server.js  starts it, graceful shutdown
  scripts/          create-admin, rebuild-stock, migrate-units, sweep-expired
  tests/            vitest + supertest
  firestore.rules   denies all direct client access, only the API reads and writes data
client/ and admin/
  src/
    app/            root component, routes, store
    features/       one folder per feature (screens, components, API calls of that feature)
    components/     shared UI
    hooks/  lib/    shared hooks, API client, Firebase, formatting
    styles/
```

## Requirements

Node.js 20.12 or newer. A Firebase project with **Firestore** and **Authentication** turned on: enable the
**Phone** provider (user app) and the **Email/Password** provider (admin website).

## Setup

1. **Server**: `cd server && npm install`, copy `.env.example` to `.env`, and put the Firebase service account
   key at `server/credentials/serviceAccountKey.json` (Firebase console > Project settings > Service accounts).
2. **Client**: `cd client && npm install`, copy `.env.example` to `.env` and fill in the Firebase web app config.
3. **Admin**: `cd admin && npm install`, copy `.env.example` to `.env` and fill in the Firebase web app config.
4. **Hospital and blood bank website**: `cd hospitalandbloodbanksubadmin && npm install`, copy `.env.example` to `.env`
   and fill in the same Firebase web app config the user app uses. Put its address in `ORG_ORIGIN` in `server/.env`.
5. Create the first admin: `cd server && npm run create-admin -- you@example.com "Your Name"`.

## Run (development)

Four terminals:

| Command                  | Address               |
| ------------------------ | --------------------- |
| `cd server && npm run dev`  | http://localhost:8080 |
| `cd client && npm run dev`  | http://localhost:3100 |
| `cd admin && npm run dev`   | http://localhost:3101 |
| `cd hospitalandbloodbanksubadmin && npm run dev` | http://localhost:3102 |

In every folder: `npm test`, `npm run lint`, `npm run format` (the three websites also `npm run build`).
The server tests run the real services against a small in-memory Firestore (`server/tests/helpers/fakeFirestore.js`),
so stock checks, running totals and approval rules are tested without a database. It handles one request at a
time, so it does not test two people racing for the same blood, that needs the Firebase emulator.
`GET /health` reports that the API is up, `GET /health/ready` also checks Firestore and Firebase Auth.

## API

Every response is `{ success: true, ... }` or `{ success: false, message, errors? }`. Send the Firebase ID token as
`Authorization: Bearer <token>`.

**User app, `/api/v1`**

| Method and path                      | Who                  | What                                                     |
| ------------------------------------ | -------------------- | -------------------------------------------------------- |
| `POST /auth/register`                | verified phone       | create the profile after the first sign-in (hospitals and blood banks also send `registrationNumber`) |
| `GET /auth/me`                       | verified phone       | the signed-in user (`user` is `null` before registering). Also answers while waiting for approval |
| `POST /auth/phone-login`             | development only     | sign in without an OTP (see below)                       |
| `POST /inventory`                    | blood bank           | record blood in from a donor (creates a unit) or out to a hospital (draws units FEFO) |
| `POST /inventory/:id/discard`        | blood bank           | throw away a unit that was never issued (`reason`, `note?`) |
| `GET /inventory`                     | blood bank           | all of its records                                       |
| `GET /inventory/mine?type=&bloodGroup=` | donor, hospital   | the records that involve the user                        |
| `GET /analytics/stock`               | blood bank           | blood in, out, discarded, available and expiring-soon ML, per blood group |
| `GET /directory/donors`              | blood bank           | donors it has recorded blood from                        |
| `GET /directory/hospitals`           | blood bank           | hospitals it has issued blood to                         |
| `GET /directory/organisations`       | donor, hospital      | blood banks that have dealt with the user                |
| `GET /directory/blood-banks`         | hospital              | every active, approved blood bank, to request from        |
| `POST /requests`                     | any role              | raise a request, broadcast to the requester city (optionally naming one blood bank) |
| `GET /requests?status=`              | blood bank            | requests naming it                                        |
| `GET /requests/mine?status=`         | any role              | the user's own requests                                     |
| `GET /requests/nearby?status=`       | any role              | other people's requests in the user's city                   |
| `POST /requests/:id/respond`, `.../responses/:responseId/confirm`, `.../decline`, `.../withdraw` | any role | offer units for a request, and the requester deciding on offers |
| `POST /requests/:id/fulfil`          | blood bank            | issues the blood now (FEFO), same as an ordinary issue     |
| `POST /requests/:id/reject`          | blood bank            | turns it down, with a reason the hospital sees (`reason`)  |
| `POST /requests/:id/cancel`          | requester              | withdraws its own request while still pending              |

Every route in the table except the two under `/auth` also needs an approved account (see below).

**Admin website, `/api/admin`** (admin accounts only): `GET /me`, `/dashboard`, `/system`, `/audit-logs`,
`/users` (list with `?role=&status=&verification=&q=`, detail, `PATCH`, `POST .../suspend`, `POST .../reactivate`,
`POST .../approve`, `POST .../reject`, `DELETE`), `/inventory` (list with `?status=&sort=expiry`, `DELETE`),
`/admins` (list, `POST`, `DELETE`). Every change an admin makes is written to the activity log.

## Approving hospitals and blood banks

Anyone can sign up, but a hospital or blood bank can not record or receive blood until an admin approves it.

- **Sign-up:** they give a registration or licence number. Their profile starts as `verification: "pending"`.
  Donors start as `approved`, they do not need a review.
- **While waiting:** the app shows a "Waiting for approval" screen and every route except `/auth/me` answers
  `403 Your account is waiting for admin approval`. Blood can not be issued to a hospital that is not approved.
- **Admin:** the dashboard's "Needs attention" list counts accounts waiting, and **Users > Approval** filters them.
  Open a user to **Approve** or **Reject**. A rejection needs a reason, which the person sees. A decision can be
  changed later, and both are recorded in the activity log with who decided.
- **Older accounts** (created before approval existed) have no `verification` and count as approved, so nobody is
  locked out. The registration number and the review notes are visible to admins and to the person themselves only.
- Approval checks the number a person typed. It does **not** verify it against any registry or document, so an admin
  still has to check it, for example against the regulator's list.

## Blood units and expiry

Every "in" record is one blood unit (one bag), not just an ML total.

- **Adding blood** gives the unit a short id (e.g. `U-20260922-4F7A1B`), a status (`available`), a collection
  date and an expiry date (`SHELF_LIFE_DAYS` after collection, 42 by default: the usual shelf life of whole
  blood / packed red cells stored refrigerated — change it if you store a different component).
- **Issuing blood** draws whole units first-expiring-first (FEFO), inside the same transaction as the check,
  so two issues can never both succeed against the same blood. It never returns less than asked for, but may
  split the last unit it needs: that unit's remaining ML stays available for someone else. A unit that has
  passed its expiry date is never drawn from, even though its status still says "available" until it is
  discarded (see below) — `available` figures everywhere already exclude it.
- **Discarding a unit** (contaminated, damaged, failed testing, expired, other) is only possible while the
  whole unit is still untouched; once any blood has been issued from it, only that remaining amount could be
  discarded, so a partly-issued unit is left as is rather than allowing a confusing partial discard. It is
  never deleted outright, so the record and the reason stay in the blood bank's history.
- **`npm run sweep-expired`** (in `server/`) marks every available unit whose expiry date has passed as
  discarded, reason "expired". Nothing depends on this for correctness, it only keeps the records and the
  discarded totals tidy; a unit that has been partly issued is left for a person to judge.
- The admin dashboard's "Needs attention" list, and a blood bank's own Stock page, both surface units that
  are expiring within `EXPIRY_WARNING_DAYS` (7 by default) or have already expired.
- **`npm run migrate-units`** (in `server/`) is a one-off: it tags every "in" record from before units
  existed as `status: "legacy"` (kept for history, never drawn from again) and, per organisation and blood
  group, opens one new "available" unit holding the balance those records leave behind — the same figure
  the dashboard already showed as available. It touches no running totals (that blood was already counted
  once) and is safe to run again: an organisation and blood group that already has its opening-balance unit
  is left alone, even if some of it has since been issued or discarded.

## Blood requests

Any donor, hospital or blood bank can raise a request, for themselves or for someone else. It is broadcast to the
requester's city rather than to one blood bank (details below). What follows is how a request that names one blood
bank directly still works, and it is what the mobile app and the website both use for it.

- **Asking:** a blood group, an amount, a priority (normal / urgent / emergency), the patient, where the blood is
  needed, and optional notes. The request starts `pending`. It may name a blood bank (from `/directory/blood-banks`),
  which is checked for existing and being approved, not for having enough stock: that is only known for certain
  when the request is answered.
- **Fulfilling** issues the blood right away, the same FEFO transaction as an ordinary issue, and links the
  request to the resulting record. If there is not enough stock it fails with the same "Only X ML
  available" error as issuing does normally, and the request is left `pending` to try again later or reject.
- **Rejecting** needs a reason, which the hospital sees. **Cancelling** is a hospital withdrawing its own
  request while it is still pending. Once a request is fulfilled, rejected or cancelled, nothing more can
  be done to it.
- There is no separate "approved, not yet fulfilled" state, and no reservation that holds stock aside with
  a timeout: fulfilling issues immediately, or fails immediately. Adding a timed hold would need a
  scheduler this project does not have; without one, a fake timeout would be worse than the current honest,
  synchronous flow.
- The admin dashboard's "Needs attention" list separately counts emergency requests (critical) and other
  pending requests (info), across every blood bank, and the admin website has a Requests page.
- A request no longer has to name a blood bank: it is broadcast to the requester's city (see "Requests, offers and
  notifications" below). Naming one is still accepted, and that blood bank alone can then fulfil or reject it.

## Hospital and blood bank website

[hospitalandbloodbanksubadmin/](hospitalandbloodbanksubadmin) is where a hospital or blood bank registers and runs
its blood operations. It uses the admin website's white-and-red design, is responsive from phones to TVs, and has no
placeholder text or pre-filled fields (edit forms start blank: blank keeps the saved value).

- **Sign in and registration:** phone number and SMS code, exactly like the mobile app (`VITE_AUTH_MODE=direct` gives
  the same development shortcut). A number that has not registered is asked for the organisation's details: type
  (hospital or blood bank), name, registration or licence number, address, city, contact details, opening hours. The
  account starts as **waiting for approval**; the site shows that and checks for a decision by itself. An admin
  approves or rejects it in the admin website. A rejection shows the reason, and the organisation can correct its
  details and **send for review again**. A registration number can only be registered once.
- **Dashboard:** stock by blood group, what is waiting on the organisation, emergencies in its city, the last 14 days
  of blood in and out, latest movements, and a "needs attention" list (low or empty groups, units expiring or expired,
  deliveries to confirm).
- **Blood stock** (both kinds of account): every unit with its id, group, amount left, source, expiry, storage
  location and bag number. Record blood in (a blood bank: from a donor with an app account, found by phone number, or
  a walk-in donor by name; a hospital: from a named supplier), issue blood out first-expiring-first, correct a unit
  (storage, expiry, and the amount or group while none of it has been issued), discard a unit with a reason. A blood
  bank issuing to a hospital that has an account records it against that hospital.
- **Hospital stock is separate.** A blood bank's stock is the existing `inventory` collection (also read by the mobile
  app and the admin website, and the only one that feeds the platform-wide totals). A hospital's is `hospitalStock`,
  the same shape and the same code, so a hospital's own blood never inflates the blood bank figures the admin reports.
- **Deliveries (hospitals):** blood a blood bank issued to the hospital is listed until the hospital confirms it
  arrived. Confirming creates the hospital's own units with the expiry dates the blood bank gave them, and the blood
  bank's record shows it was received.
- **Movement history:** every unit received, issued or discarded, filterable, with a spreadsheet (CSV) export of what
  the filters show. It is worked out from the stock records, so it can not disagree with stock.
- **Requests, offers and notifications:** see below.
- **Profile:** the organisation's details, editing, and sharing its location on the mobile app's nearby map.
- **Activity log:** what the account did, from the website or the app.
- Live updates: the website keeps a server-sent-events connection and refreshes when the account's own data changes.

### Requests, offers and notifications

One request page for every kind of account, one list (no tabs): requests the organisation raised, requests sent
straight to it, and every request raised in its city, including those raised from the mobile app.

- A request is broadcast to the requester's city (`cityKey`). Every other approved hospital and blood bank there gets a
  **notification** when it is raised, and the requests page lists it too: nobody has to find it through notifications.
- Each row says how it relates to the organisation and what it can do: **respond** (offer a number of units, checked
  against its own stock), **withdraw** an offer, **hide** a request that is not for it, **fulfil** or **reject** one
  sent straight to a blood bank, and for its own requests **edit**, **cancel**, and **confirm or decline** offers.
- **Issuing blood for a confirmed offer:** once the requester confirms an offer, the responder issues the blood from
  its own stock (one unit is 450 ML, first-expiring-first, in one transaction, so it can not be issued twice), and the
  requester is told. For a hospital requester it appears under its deliveries.
- Notifications (`notifications` collection, one document per recipient) are written for: a new request in the city or
  sent to the organisation, an offer on its request, the requester's decision on its offer, blood issued for its
  request, a request it answered being cancelled, fulfilled or rejected, a blood group falling under the low-stock line
  (once, on the crossing), and an admin's approval decision. They are shown in the website (a bell, a count in the
  menu, a page, and a short message when one arrives). Writing one never blocks the action that caused it.

**Organisation API, `/api/org`** (hospitals and blood banks; approved unless marked)

| Method and path | What |
| --------------- | ---- |
| `POST /auth/register` (verified phone) | create the account (hospital or blood bank only), starts pending |
| `GET /auth/me` (verified phone) | the account, or `user: null` before registering |
| `GET, PATCH /profile`, `POST /profile/resubmit` (also while pending or refused) | own details, send a refused registration back |
| `GET /dashboard`, `GET /activity`, `GET /events` (SSE) | dashboard, the account's activity, live changes for this account only |
| `GET /stock`, `GET /stock/units`, `GET, PATCH /stock/units/:id` | stock by group, units (filters, sort, paging), correct a unit |
| `POST /stock/receive`, `/stock/issue`, `/stock/units/:id/discard` | blood in, out (first-expiring-first), discard |
| `GET /stock/movements` | movement history (filters, paging) |
| `GET /shipments`, `POST /shipments/:id/receive` | hospitals: blood issued to them, confirm it arrived |
| `GET /requests`, `GET /requests/:id`, `POST /requests`, `PATCH /requests/:id` | the unified list (with `stats`), one request with offers and a stock check, raise, edit |
| `POST /requests/:id/offer`, `.../cancel`, `.../fulfil`, `.../reject`, `.../dismiss`, `.../restore` | respond, cancel, fulfil or reject (blood banks), hide or show |
| `POST /requests/:id/responses/:responseId/confirm`, `.../decline`, `.../withdraw`, `.../dispatch` | decide on an offer, withdraw one, issue blood for a confirmed one |
| `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` | the account's notifications |
| `GET /reports/movements.csv`, `GET /reports/requests.csv` | spreadsheet exports, following the list's filters |
| `/camps/*`, `/location/*` | the mobile app's camp and nearby-map routes, unchanged |

Not built on the website: staff sub-accounts with roles (one account per organisation), a blood camps screen (the API
is there), email and password sign-in, push or SMS notifications (notifications are in the website only, and there is
no scheduler, so expiring stock is shown live rather than sent), and hospital-to-hospital transfers.

## Activity log

Admin actions and what people do in the app go to the same log (`auditLogs`), shown on **Activity log** with a
"Done by" filter. Recorded for the app: signing up, adding blood, issuing blood, discarding a unit, and every
request action (asking, fulfilling, rejecting, cancelling). Each entry stores who acted (`actorType`, `actorId`,
`actorLabel`, `actorRole`), what, on what, and details. Writing to it never blocks the
person. It only covers blood bank actions that succeed: a refused issue (for example not enough stock) is not logged.

## Security

- `firestore.rules` denies all direct access. Deploy it with `firebase deploy --only firestore:rules` from `server/`.
- Never commit `.env` files or `server/credentials/`. Each folder's `.gitignore` already excludes them. On a host
  where you cannot ship a file, set `FIREBASE_SERVICE_ACCOUNT_JSON` instead, or use Application Default Credentials.
- Requests are validated with zod before they reach any logic, unexpected errors are logged with a request id and
  never sent to the caller, and login and API routes are rate limited per IP.
- Suspending a user disables their Firebase account and revokes their sessions. Admin sessions end after 30 minutes
  without activity and when the browser tab closes.

## Production checklist

- Server: `NODE_ENV=production`, `CLIENT_ORIGIN` and `ADMIN_ORIGIN` set to the real site addresses (the server refuses
  to start without them), `TRUST_PROXY=1` behind one reverse proxy, `ADMIN_TIMEZONE` set to your time zone.
- Serve `client` and `admin` from `npm run build` output (`dist/`) over HTTPS.
- The server refuses to start in production with `ALLOW_PHONE_LOGIN=true`, and the client ignores
  `VITE_AUTH_MODE=direct` and `VITE_DISABLE_APP_VERIFICATION` in production builds.

## Development shortcut: phone sign-in without an OTP

SMS costs money on Firebase, so a number can be signed in with no code while developing: set `ALLOW_PHONE_LOGIN=true`
in `server/.env` and `VITE_AUTH_MODE=direct` in `client/.env` (restart both). **Anyone who knows a number can sign in
as it**, which is why production refuses it. Remove both settings to go back to SMS codes; nothing else changes.

## Sign-in SMS (phone OTP)

- Firebase sends the SMS itself and the code is always 6 digits.
- **Region policy:** SMS only goes to countries allowed under Authentication > Settings > SMS region policy. Keep
  `VITE_SMS_COUNTRIES` in `client/.env` in step with it.
- **Test numbers:** a number listed under Authentication > Sign-in method > Phone > "Phone numbers for testing" never
  receives an SMS, you type its fixed code instead.
- **reCAPTCHA:** Firebase runs an invisible reCAPTCHA before sending. Occasionally it shows an image check.
- Real SMS needs the Blaze (pay as you go) plan.

## Good to know

- Donors are stored with the role `donar` (a spelling kept so existing data keeps working). People always see "Donor".
- Lists read whole collections and are sorted in memory, which avoids Firestore composite indexes and is fine for
  thousands of records. Admin lists read at most 2,000 documents and say so when they were cut off. If a blood bank
  grows far beyond that, add composite indexes and move filtering and paging into the queries.
- `npm run rebuild-stock` (in `server/`) recomputes the blood-in-stock totals from every record, if they ever drift.
- `SHELF_LIFE_DAYS` and `EXPIRY_WARNING_DAYS` (in `server/.env`) control unit expiry, see "Blood units and expiry".
