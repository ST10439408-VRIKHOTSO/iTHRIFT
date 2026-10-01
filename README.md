# iTHRIFT Clothes: website and Android application

South African pre-loved branded fashion e-commerce platform.

**XISD6329 Work Integrated Learning 3B, Group 11**
Theo Golele (ST10439863) and Vukosi Rikhotso (ST10439408)
IIE Rosebank College, Pretoria · Client: iTHRIFT Clothes, Pretoria

iTHRIFT Clothes buys and resells pre-owned branded clothing. It sells from physical
stores in Pretoria and, for everything else, through WhatsApp and Instagram, with no
single system behind any of it. This repository holds the system that replaces that:
a customer storefront and staff console on the web, a native Android application for
customers, and one REST API and database behind both.

The work carries forward the project plan, requirement analysis and system design
produced for **XISD5319 Work Integrated Learning 3A**.

## Assessment status

| Task | Deliverable | State |
|---|---|---|
| Task 1 | Updated project plan, site map, wireframes | Complete, see [`docs/task1/`](docs/task1/) |
| Task 2 | Working prototype: Android app, API, database, tests | Complete, see [`docs/task2/`](docs/task2/) |
| Task 3 | Final project report and presentation | Not started |

The Task 1 document, together with all fifteen figures at full resolution, is in
[`docs/task1/`](docs/task1/).

The Task 2 report and its evidence screenshots are in [`docs/task2/`](docs/task2/).

**Demonstration video:** _add the unlisted YouTube link here_

## Task 2 at a glance

| What the brief asks for | Where it is |
|---|---|
| Android app that runs on a handset | [`app/`](app/): Kotlin, `minSdk` 24, built by CI on every push |
| Register and sign in, password encrypted | [`server/routes/auth.js`](server/routes/auth.js); salted scrypt in [`server/utils/password.js`](server/utils/password.js) |
| Single sign-on | Google, verified server-side in [`server/utils/sso.js`](server/utils/sso.js); client in [`GoogleSignIn.kt`](app/src/main/java/com/codecouture/ithrift/data/GoogleSignIn.kt) |
| Settings the user can change | [`SettingsFragment`](app/src/main/java/com/codecouture/ithrift/ui/account/SettingsFragment.kt): profile, password, theme, notifications, connection |
| REST API used by both clients | [`server/routes/`](server/routes/) |
| Database in a DBMS, ≥10 rows per table | [`server/init-db.js`](server/init-db.js); the seed script fails if any table falls short |
| Input handled without crashing | [`Validators.kt`](app/src/main/java/com/codecouture/ithrift/util/Validators.kt) and [`ApiResult.kt`](app/src/main/java/com/codecouture/ithrift/data/ApiResult.kt) |
| Help system and user documentation | In-app **Account → Help**, and [`docs/user-guide.md`](docs/user-guide.md) |
| Automated testing through GitHub Actions | 49 Kotlin unit tests, 9 API unit tests, 70 end-to-end checks. See [Automated testing](#automated-testing) |
| Logging | Per-request logging in [`server/index.js`](server/index.js); Logcat at the network boundary in the app |

## What's in here

| Piece | Where | What it does |
|---|---|---|
| Website | `public/`, served at `/` | Customer storefront plus the staff and administrator console |
| Android application | `app/` | Native Kotlin client, customer-facing |
| Installable web app | `public/mobile/`, served at `/mobile` | Progressive Web App build of the storefront |
| REST API | `server/`, served at `/api` | The shared application tier; every business rule lives here |
| Database | `data/ithrift.db` (generated) | SQLite, built and seeded by `npm run init-db` |
| MySQL schema | `database/mysql-schema.sql` | Production-equivalent Third Normal Form schema |
| API unit tests | `test/unit-tests.js` | 9 checks on the business rules (`npm run test:unit`) |
| Smoke test | `test/smoke-test.js` | 70 end-to-end API checks (`npm test`) |
| Kotlin unit tests | `app/src/test/` | 49 checks on validation, formatting and error handling |
| User guide | `docs/user-guide.md` | Written user documentation for customers and staff |
| CI pipelines | `.github/workflows/` | Build and test both clients on every push |

## Architecture

Three tiers, with two clients sharing the middle one:

```
Website (HTML5/CSS3/JS)      Android app (Kotlin)
            |                          |
            +----- HTTPS / JSON -------+
                       |
        REST API: Node.js + Express (server/)
        auth · roles · cart totals · stock locking
        order status rules · reporting
                       |
              parameterised SQL
                       |
        SQLite (prototype) / MySQL 8 (production)
```

Neither client is trusted. Cart totals, stock locking at checkout, order status
transitions and role permissions are all enforced server-side, so hiding a menu item
in a client is a convenience and never a control.

## Requirements

- **Node.js 24 or newer** for the API. `server/db.js` uses the built-in `node:sqlite`
  module, so there is no separate database server to install.
- **JDK 17** and **Android Studio** (or the Android SDK plus the Gradle wrapper) for
  the application. `compileSdk` 35, `minSdk` 24.

```bash
node --version
```

## Running the API and the website

```bash
npm install
npm run init-db
npm start
```

Then open:

- Website: <http://localhost:3000/>
- Installable web app: <http://localhost:3000/mobile>
- REST API: <http://localhost:3000/api>

## Running the Android application

1. Open the repository root in Android Studio and let Gradle sync.
2. Create `local.properties` with your SDK location. It is deliberately not
   committed:
   ```properties
   sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
   ```
3. Start the API first (`npm start`).
4. Run the app. On a physical handset, set the API endpoint under **Account →
   Settings → API server URL** to your machine's LAN address (for example
   `http://192.168.0.10:3000`); `localhost` on the phone means the phone itself.

From the command line:

```bash
./gradlew assembleDebug
```

## Single sign-on (optional)

The app offers **Continue with Google**. Both ends need the same OAuth **web**
client id from a Google Cloud project, and neither the id nor anything derived
from it is committed.

1. In the Google Cloud console, create an OAuth 2.0 **Web application** client
   id, and an **Android** client id for `com.codecouture.ithrift` with your
   signing certificate's SHA-1.
2. Put the *web* client id in `local.properties` (which is git-ignored):
   ```properties
   GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   ```
3. Give the server the same value:
   ```bash
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com npm start
   ```

It is the *web* client id in both places because that is the audience Google
puts in the ID token it issues for a backend to verify.

Without this the project still builds and runs; the app checks
`GET /api/auth/sso/status` and hides the button rather than offering one that
cannot work. Email-and-password sign-in is unaffected.

The token is verified on the server, never in the app. See
[`server/utils/sso.js`](server/utils/sso.js). A client cannot be trusted to
say who its user is, because a repackaged client can say anything.

## Demonstration accounts

| Role | Email / username | Password |
|---|---|---|
| Customer | `lerato.m@gmail.com` | `Password1` |
| Customer | `sipho.n@gmail.com` | `Password2` |
| Customer | `amahle.d@gmail.com` | `Password3` |
| Administrator | `admin` | `Admin@123` |
| Staff | `staff01` | `Staff@123` |

Twelve customers and ten staff accounts are seeded in total; these are the ones
worth writing down. A new customer can register from either client. Staff and
administrator accounts sign in only on the website, because the console does
not exist in the application.

## Demonstrating the link between the two clients and the database

1. On the website, sign in as the administrator and open **Admin Console → Listings**.
   Add a product with a price and stock quantity.
2. In the Android application, search for that product. It is already there, because
   the phone reads the same database the website just wrote to.
3. In the application, sign in as a customer, add the product to the cart and check out.
4. Stock drops by the quantity ordered. The server reserved the stock and recalculated
   the total, not the client.
5. Back on the website, open **Admin Console → Process orders**. The order placed on
   the phone is listed with its payment and total.
6. Set the status to **Shipped** and capture a courier reference. In the application,
   open **Orders**; the tracker now shows **Shipped**.

`npm test` walks this same path automatically.

## Automated testing

**128 automated checks across three suites**, all run by GitHub Actions on every
push and pull request to `main`. A red pipeline blocks the merge.

| Suite | Count | What it covers |
|---|---|---|
| Kotlin unit tests (`app/src/test/`) | 49 | Input validation, server-address parsing, money and date formatting, network error handling, the theme setting |
| API unit tests (`test/unit-tests.js`) | 9 | Password hashing and verification, the password policy, SSO configuration, cart arithmetic |
| End-to-end smoke test (`test/smoke-test.js`) | 70 | The whole API surface against a running server |

### Workflows

| Workflow | What it does |
|---|---|
| `.github/workflows/android.yml` | Runs the Kotlin unit tests, assembles the debug build, uploads the package as an artefact |
| `.github/workflows/api-and-website.yml` | Runs the API unit tests, seeds the database, starts the server, runs the smoke test |
| `.github/workflows/release.yml` | On a `v*` tag: runs the tests, then assembles a signed APK and App Bundle for the Play Console |

### Running them locally

```bash
./gradlew testDebugUnitTest
```

```bash
npm run test:unit
```

The end-to-end suite needs the server up, so start it in one terminal:

```bash
npm start
```

and run the tests in another:

```bash
npm test
```

The unit suites run in seconds and need neither a server nor an emulator, which is
why they run first in CI: if a business rule is broken there is no point spending a
minute booting the API to find out.

The end-to-end suite covers registration and sign-in, single sign-on rejecting an
unverified token, reading and updating the account profile, changing a password,
catalogue browsing, filtering and search, cart operations, checkout with server-side
stock locking and total recalculation, payment records, order status transitions,
reviews, the sales and inventory reports, role-based access across the customer,
staff and administrator roles, and the cross-client database link.

## Project structure

```
ithrift/
├── public/                     web root: everything the browser downloads
│   ├── index.html              single-page shell for every route
│   ├── css/                    globals.css (design tokens), style.css (components)
│   ├── js/                     app.js (router), views-shop.js, views-auth.js, views-admin.js
│   ├── images/                 brand/ and products/
│   └── mobile/                 installable web app build
├── app/                        Android application (Kotlin)
│   ├── src/main/java/com/codecouture/ithrift/
│   │   ├── data/               API client, models, session, settings, Google sign-in
│   │   ├── ui/                 shop/ search/ cart/ orders/ account/ (settings, help)
│   │   └── util/               validators, URL parsing, formatting
│   ├── src/main/res/values/    light palette, strings, styles
│   ├── src/main/res/values-night/  dark palette
│   └── src/test/               JVM unit tests, no emulator required
├── server/                     REST API (Node.js + Express)
│   ├── routes/                 auth, products, cart, orders, admin
│   ├── middleware/             authentication and role checks
│   └── utils/                  password hashing, single sign-on, references, images
├── database/
│   └── mysql-schema.sql        production schema, Third Normal Form
├── test/
│   ├── unit-tests.js           the API's business rules, in isolation
│   └── smoke-test.js           end-to-end checks across the API surface
├── docs/
│   ├── user-guide.md           user documentation for customers and staff
│   └── task1/                  Task 1 document and its figures
└── .github/workflows/          automated build, test and release pipelines
```

### Naming convention

Every file and folder served over HTTP uses lowercase names, no spaces and no special
characters, with words separated by a single hyphen. URLs are case-sensitive on most
web servers, so a capital in a filename is a broken link waiting to happen. Two
deliberate exceptions: `README.md`, because that is the name GitHub renders, and the
Kotlin sources under `app/`, which follow the Android package conventions. Neither is
served over HTTP.

## Scope and limitations

Recorded here for transparency; also explained in the project report.

- **SQLite stands in for MySQL.** The design specifies MySQL 8. So the prototype runs
  with one command and no setup, it uses Node's built-in SQLite engine. The schema is
  the same Third Normal Form design; see `database/mysql-schema.sql`. SQLite treats
  `ORDER` as reserved, so that table is named `Orders`; everything else matches the
  design.
- **Payments are simulated.** No money changes hands. The payment step records a method
  and a status, which is enough to demonstrate the order and reporting flow. Live
  PayFast integration is a stretch goal.
- **Sessions are in memory.** Signing in issues a bearer token held in the server's
  memory, so restarting the server signs everyone out. A production build would use a
  persistent session store.
- **There are no instrumented tests.** The 49 Kotlin unit tests cover the logic that
  can be tested without a device: validation, parsing, formatting, error handling.
  Screen-level journeys are covered by the manual test pass and the demonstration
  video, not by Espresso. Adding an instrumented suite is the obvious next step.
- **Single sign-on needs credentials to demonstrate.** The code path is complete and
  the server verifies the token properly, but a Google Cloud OAuth client id has to be
  supplied (see above). Without one the button is hidden rather than broken.
- **Notification preferences are recorded, not delivered.** The setting is honoured by
  the app; there is no push service behind it.
- **Product photography** under `public/images/products/` is real brand photography
  used to make the catalogue realistic for assessment purposes.

## Release notes

### 1.1.0: Task 2, working prototype (September 2026)

The prototype the module brief asks for: a working Android application, an
updated website, the shared API and database behind both, and automated tests
that run on the pipeline rather than on one developer's machine.

**Sign-in and security**
- **Single sign-on with Google.** Added end to end: Credential Manager on the phone,
  `POST /api/auth/sso` on the server. The ID token is verified with Google for issuer,
  audience, expiry and a verified email address, before any session is issued.
  Neither the app nor the repository holds the client id.
- The `Customer` table now records how an account authenticates (`AuthProvider`,
  `ProviderSubject`), with a constraint that a password account carries a hash and an
  SSO account carries a provider subject.
- Signing in with Google on an address that already has a password account is refused
  rather than linked, so a Google account on that address cannot be used to take over
  an existing one.
- **Change your password** from the app, with the current password required.

**Settings** *(new)*
- A real settings screen under Account: your details, password, appearance,
  notifications, connection and reset.
- **Dark theme**, applied before the first screen is drawn so the app does not flash
  light on launch. Light, dark or follow the system setting.
- Name, phone and delivery address are saved to the account through the API, so the
  website and the app never disagree about them.
- The server address moved here from the Account tab and gained a **Test connection**
  button that says plainly what is wrong.

**Help and documentation** *(new)*
- In-app **Help**: eight task-based topics, plus a panel showing the app version,
  server address and signed-in account, which are the three things support always asks for.
- `docs/user-guide.md`: written user documentation for customers and for staff.

**Testing** *(new)*
- 49 Kotlin unit tests. Before this the Android CI job ran `testDebugUnitTest` against
  an empty source set and passed without testing anything.
- 9 API unit tests covering password hashing, the password policy and cart arithmetic.
- The end-to-end suite grew from 51 checks to 70, covering single sign-on, the profile
  routes and password changes.
- A release workflow that produces a signed APK and App Bundle from a tag.

**Database**
- Every table now holds at least ten rows, as the brief requires. The seed script
  checks this and fails rather than quietly under-filling a table.
- Twelve customers, ten staff accounts, twelve orders across all four statuses and all
  three payment methods, twelve open carts, fifteen reviews, and not all five stars,
  because a catalogue where every rating is perfect tells a shopper nothing.
- Four categories split out of the broader ones: Polos, Shirts, Hoodies, Jackets.

**Everywhere else**
- Per-request server logging: method, path, status, duration and who was signed in.
  Failures go to stderr so they can be filtered out of a CI log.
- Input validation collected into one tested place, matching the server's rules, so a
  customer is not told a password is fine and then rejected by the API.

### 0.2.0: Task 1 (August 2026)
- Native Kotlin Android client added: five bottom-navigation tabs, shared API client,
  typed network results, session handling.
- Site maps and wireframes produced for both clients; see `docs/task1/`.
- GitHub Actions pipelines added for the API and for the Android build.
- Project plan rebuilt against the twelve-week schedule with the DevOps lifecycle.

### 0.1.0: XISD5319 Task 3 (June 2026)
- Website, installable web app, REST API and seeded database.
- 51-check end-to-end smoke test.
