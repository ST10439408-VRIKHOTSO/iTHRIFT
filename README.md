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

**Demonstration video:** https://youtu.be/7wly_1Y31v8 (unlisted on YouTube)

## Task 2 at a glance

| What the brief asks for | Where it is |
|---|---|
| Android app that runs on a handset | [`app/`](app/): Kotlin, `minSdk` 24, built by CI on every push |
| Register and sign in, password encrypted | [`server/routes/auth.js`](server/routes/auth.js); salted scrypt in [`server/utils/password.js`](server/utils/password.js) |
| Single sign-on | Google, verified server-side in [`server/utils/sso.js`](server/utils/sso.js); client in [`GoogleSignIn.kt`](app/src/main/java/com/ithrift/app/data/GoogleSignIn.kt) |
| Settings the user can change | [`AccountScreens.kt`](app/src/main/java/com/ithrift/app/ui/screens/AccountScreens.kt): profile, password, notifications, theme, larger text, reduced motion, connection |
| REST API used by both clients | [`server/routes/`](server/routes/) |
| Database in a DBMS, ≥10 rows per table | [`server/init-db.js`](server/init-db.js); the seed script fails if any table falls short |
| Input handled without crashing | [`Validators.kt`](app/src/main/java/com/ithrift/app/util/Validators.kt) and [`ApiResult.kt`](app/src/main/java/com/ithrift/app/data/ApiResult.kt) |
| Help system and user documentation | In-app **Account, Help centre** (searchable answers, size guide, messages with the store), and [`docs/user-guide.md`](docs/user-guide.md) |
| Automated testing through GitHub Actions | 50 Kotlin unit tests, a screenshot test of 32 screens and four tap-throughs against the real API, 22 API unit tests, 131 end-to-end checks, 95 feature checks. See [Automated testing](#automated-testing) |
| Logging | Per-request logging in [`server/index.js`](server/index.js); Logcat at the network boundary in the app |

## What's in here

| Piece | Where | What it does |
|---|---|---|
| Website | `public/`, served at `/` | Customer storefront plus the staff and administrator console; installable on a phone |
| Android application | `app/` | Native Kotlin client in Jetpack Compose: the storefront for customers and the console for staff |
| REST API | `server/`, served at `/api` | The shared application tier; every business rule lives here |
| Database | `data/ithrift.db` (generated) | SQLite, built and seeded by `npm run init-db` |
| MySQL schema | `database/mysql-schema.sql` | Production-equivalent Third Normal Form schema |
| API unit tests | `test/unit-tests.js` | 22 checks on the business rules (`npm run test:unit`) |
| Smoke test | `test/smoke-test.js` | 131 end-to-end API checks (`npm test`) |
| Feature test | `test/feature-test.js` | 95 checks on the 1.3.0 features (`npm run test:features`) |
| Kotlin unit tests | `app/src/test/` | 50 checks on validation, formatting and error handling |
| Screenshot test | `app/src/test/.../ScreenshotTest.kt` | Renders 32 app screens and four tap-throughs against a running server |
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

- Website: <http://localhost:3000/> (on a phone, use the browser's Install or Add to Home screen)
- REST API: <http://localhost:3000/api>

## Hosted deployment on Render

The API, the website and the SQLite database are also hosted online on
[Render](https://render.com), defined in `render.yaml` at the repository root.
Render builds the service on every push to `main`: `npm ci && npm run init-db`
installs the API and builds the seeded database, then `npm start` runs it.

- Hosted website: `https://ithrift-api.onrender.com/`
- Hosted REST API: `https://ithrift-api.onrender.com/api`

The Android app uses the hosted server by default, so it works on any phone
with no set-up. To point it somewhere else, use **Account, Settings,
Connection**. On the free plan the
service sleeps after 15 minutes without requests, so the first request after
that can take up to a minute. The disk is not persistent, so new orders are
reset to the seeded data on each deploy or restart.

## Running the Android application

1. Open the repository root in Android Studio and let Gradle sync.
2. Create `local.properties` with your SDK location. It is deliberately not
   committed:
   ```properties
   sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
   ```
3. Run the app. It talks to the hosted server
   (`https://ithrift-api.onrender.com`) out of the box.
4. To use a server on your own computer instead, run `npm start`, then set
   **Account, Settings, Connection** to `http://10.0.2.2:3000` in the emulator,
   or to your computer's network address (for example `http://192.168.0.10:3000`)
   on a handset; `localhost` on the phone means the phone itself.

From the command line:

```bash
./gradlew assembleDebug
```

## Single sign-on (optional)

The app offers **Continue with Google**. Both ends need the same OAuth **web**
client id from a Google Cloud project, and neither the id nor anything derived
from it is committed.

1. In the Google Cloud console, create an OAuth 2.0 **Web application** client
   id. Give the server that value in its `GOOGLE_CLIENT_ID` environment
   variable (on Render, under the service's Environment settings):
   ```bash
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com npm start
   ```
2. Add each address the website runs on under **Authorised JavaScript
   origins** of that client.

The Android app needs nothing of its own. Its **Continue with Google** opens
the website's `#/app-sign-in` page in a browser tab. After Google signs the
customer in, the server issues a single-use code that the page hands back to
the app through an `ithrift://signed-in` link, and the app swaps the code for
a session at `POST /api/auth/sso/exchange`. The app proves it started the
sign-in with a secret whose SHA-256 it sent at the start, so another app that
intercepted the link could not use the code (the PKCE idea from RFC 7636; see
[`server/utils/app-codes.js`](server/utils/app-codes.js)).

The website offers the same **Continue with Google** button on its sign-in and
register pages. It reads the web client id from `GET /api/auth/sso/status` and
sends Google's ID token to `POST /api/auth/sso`. For
the button to work, add each address the website runs on under **Authorised
JavaScript origins** of the web client in the Google Cloud console, for example
`https://ithrift-api.onrender.com` and `http://localhost:3000`.

Without this the project still builds and runs; the app checks
`GET /api/auth/sso/status` and hides the button rather than offering one that
cannot work. Email-and-password sign-in is unaffected.

The token is verified on the server, never in the app. See
[`server/utils/sso.js`](server/utils/sso.js). A client cannot be trusted to
say who its user is, because a repackaged client can say anything.

## Signing in

Everyone signs in with an email address or a cellphone number. Usernames are
no longer accepted.

| Role | Email | Password |
|---|---|---|
| Administrator | `vukosir@icloud.com` | `ithrift@2025` |

New customers register on the website or in the app. Registration asks for a
cellphone number (required, a South African mobile number that no other
account uses) and the password twice. A customer can then sign in with either
their email or that number, typed in any common form (`082 555 0101`,
`0825550101` or `+27 82 555 0101`). Staff sign in with their work email.

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

**298 automated checks across four suites**, all run by GitHub Actions on every
push and pull request to `main`. A red run is fixed before any further work is pushed.

| Suite | Count | What it covers |
|---|---|---|
| Kotlin unit tests (`app/src/test/`) | 50 | Input validation, server-address parsing, money and date formatting, network error handling, the theme setting |
| API unit tests (`test/unit-tests.js`) | 22 | Password hashing and verification, the password policy, SSO configuration and token verification, cart arithmetic, delivery fees and promo codes |
| Screenshot test (`app/src/test/.../ScreenshotTest.kt`) | 36 images | Every main app screen, light and dark, and four tap-throughs (filters, add to bag, checkout with collection, writing a review), rendered against the seeded server. Runs on a manual branch build |
| End-to-end smoke test (`test/smoke-test.js`) | 131 | The whole API surface against a running server |
| Feature test (`test/feature-test.js`) | 95 | Thrift Points, alerts and notifications, saved searches, the working-day calendar, collection slots, gift orders, order history, selling to the shop, support messages, bulk markdowns, promo limits, analytics and the CSV export |

### Workflows

| Workflow | What it does |
|---|---|
| `.github/workflows/android.yml` | Runs the Kotlin unit tests, assembles the debug build, uploads the package as an artefact. A manual run on a branch also starts the API, renders the screenshot test and publishes the images |
| `.github/workflows/api-and-website.yml` | Runs the API unit tests, seeds the database, starts the server, runs the smoke test and then the feature test |
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

```bash
npm run test:features
```

Run `npm run init-db` first if you want a fresh database; both suites expect the
seeded data.

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
│   └── manifest.webmanifest    makes the website installable on a phone
├── app/                        Android application (Kotlin)
│   ├── src/main/java/com/ithrift/app/
│   │   ├── data/               API client, models, session, settings, Google sign-in
│   │   ├── ui/                 theme/ (colours, type, icons), components/, screens/, staff/
│   │   └── util/               validators, URL parsing, formatting
│   ├── src/main/res/font/      Instrument Sans, the website's typeface
│   └── src/test/               JVM unit tests and the screenshot test, no emulator required
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
- **There are no instrumented tests.** The 50 Kotlin unit tests cover the logic that
  can be tested without a device: validation, parsing, formatting, error handling.
  Screens are rendered by the Robolectric screenshot test and checked by hand on a
  handset, not by Espresso on a device. Adding an instrumented suite is the obvious
  next step.
- **Single sign-on needs credentials to demonstrate.** The code path is complete and
  the server verifies the token properly, but a Google Cloud OAuth client id has to be
  supplied (see above). Without one the button is hidden rather than broken.
- **Notifications live inside the website and the app.** Price drops, back-in-stock alerts, order
  updates and replies appear in the notification centre and respect the customer's
  preferences, but nothing is sent by email, SMS or push.
- **The screenshot test is not a device test.** It renders the screens with
  Robolectric on the build machine, which is close to a phone but not the same;
  the debug package is still checked by hand on a handset.
- **The hosted server sleeps.** On Render's free plan the first request after a
  quiet spell can take up to a minute; the app waits that long and says so if it
  gives up.
- **Impact figures are estimates.** The water and carbon saved per piece use published
  averages per category, not measurements of the actual garment.
- **Collection slots do not cap bookings.** Any number of customers can choose the same
  slot; a real store would set a limit per slot.
- **Public holidays are listed for 2026 and 2027.** Later years need adding to
  `public/js/calendar.js`.
- **Product photography** under `public/images/products/` is real brand photography
  used to make the catalogue realistic for assessment purposes.

## Release notes

### 1.3.3: Google sign-in in the app (October 2026)

- Continue with Google in the app now signs in through the website in a
  browser tab and comes back to the app, so it works with the same Google
  setup as the website. See Single sign-on.
- The app's package name is now `com.ithrift.app`.

### 1.3.2: Sign-in changes (October 2026)

- The demonstration accounts are gone from the sign-in screens. The
  administrator is `vukosir@icloud.com`.
- Sign in with an email or a cellphone number, on the website and in the app.
- Registration requires a cellphone number and asks for the password twice.
  The number stays required in Settings.
- APKs are signed with a fixed debug key (`app/debug.keystore`), so each one
  installs over the last.
- Website: the phone "Add to bag" bar is pinned above the tab bar again (the
  page animation left a transform that trapped it at the bottom of the page),
  and the white box behind Google's button in dark mode is gone.

### 1.3.1: The Android app redesigned to match (October 2026)

The Android application was rebuilt in Jetpack Compose so it looks and works
like the website, against the same API.

- The same design system: Instrument Sans, the pine and marigold palette, light
  and dark modes, the condition meter, the same Lucide icons, sheets, toasts and
  loading, empty and error states. A new launcher icon matches the logo.
- Every customer feature from 1.3.0: Thrift Points, notifications and their
  settings, price-drop and back-in-stock alerts, saved searches, the style
  profile and welcome steps, combined filters and My sizes, search suggestions,
  compare, recently viewed, similar pieces, reviews with a summary, product
  questions, the size and condition guides, working-day delivery dates,
  collection slots, gift orders, spending points, order timelines, a printable
  tax invoice and gift slip (Android print, which also saves as PDF), Sell to us,
  the help centre and messages with the store.
- The staff console for staff and administrator accounts: dashboard, orders and
  processing, collections, returns, questions, buy-back offers, the support inbox,
  listings with stock per size and bulk markdowns, inventory, promo codes and,
  for the administrator, customers.
- Uses the hosted server `https://ithrift-api.onrender.com` by default, with a
  longer timeout for when it is waking up.
- Larger text and reduced motion settings, as on the website.
- The separate installable web app at `/mobile` was retired: the website itself is
  now installable on a phone, and `/mobile` sends people there.
- A screenshot test renders 32 screens and four tap-throughs against the real API
  and seeded database on every manual branch build.

### 1.3.0: Redesign and thirty new features (October 2026)

The website and staff console were rebuilt with a new design system, and thirty
features were added. Every feature reads and writes real data through the API; none
of it is decoration. Existing behaviour and data are unchanged, so the Android
application keeps working.

**Design**
- A new design system in `public/css/style.css`: one typeface (Instrument Sans), a
  pine and marigold palette, light and dark modes, an 8-point spacing scale, and the
  4-step condition meter used everywhere a grade appears.
- Phones get a bottom tab bar and bottom sheets; larger screens get a frosted header,
  side sheets and a sidebar console.
- Every screen has loading skeletons, empty states that say what to do next, error
  states with a retry, and toasts that confirm what changed (with undo where it helps).
- Accessibility: visible keyboard focus, focus moved to each new page's heading,
  focus trapped in dialogs, labelled controls, colour contrast checked in both modes,
  and the reduce-motion setting respected.
- Icons are a subset of Lucide (ISC licence, see `public/js/icons-LICENSE.txt`).

**The thirty features**

Finding pieces
1. Filters that combine: several brands, categories, sizes and grades at once, plus a price range, sale and in-stock switches.
2. "My sizes": one tap limits the shop to the sizes saved in the style profile.
3. Search suggestions as you type, keyboard navigation, recent searches, and the `/` shortcut.
4. Saved searches, with a notification when a new listing matches one.
5. A style profile (sizes and favourite brands) set during a three-step welcome, and a "For you" row built from it.
6. Compare up to four pieces side by side.
7. Recently viewed pieces and similar pieces on each product page.

Deciding
8. A photo lightbox with zoom.
9. A size guide per category and a guide to what each condition grade means.
10. Delivery dates on the product page and at checkout, counted in South African working days with public holidays.
11. Review summary with average, star histogram, sorting and a "verified purchase" mark.
12. Questions and answers on each product, answered by staff and visible to everyone.
13. Share a piece (native share sheet, or the link copied).

Alerts and account
14. A notification centre with unread counts, grouped by day, with mark read and delete.
15. Notification preferences for order updates and for alerts, honoured by the server.
16. Price-drop alerts on wishlisted pieces, showing how much the price fell since it was saved.
17. "Tell me when it is back" alerts for sold-out pieces and sizes.
18. Thrift Points: one point per R10 on delivered orders, Bronze, Silver and Gold tiers, and a full points history.
19. An impact page estimating water and carbon saved by buying second hand.
20. Appearance settings: light, dark or system theme, larger text, and reduced motion.

Buying
21. Spend Thrift Points at checkout (100 points for R10), refunded if the order is cancelled.
22. Book a store collection day and two-hour slot.
23. Gift orders with a message and a gift slip without prices.
24. A printable tax invoice showing the 15 percent VAT included.
25. An order timeline with every status change, time and note.
26. Save for later in the bag, one-tap fixes when a piece sells out, and undo on remove.

Selling and help
27. Sell to us: offer a piece, receive an offer, and take it by EFT or as points worth 20 percent more.
28. A help centre with searchable answers and a messages inbox for conversations with the store.

Staff console
29. A dashboard with a needs-attention list, 30-day revenue chart, sales by category and brand, return rate, and an orders CSV export.
30. Store tools: bulk markdowns with price-drop alerts, a listing editor with stock per size and sale price, a collections board by day and slot, a questions queue, a buy-back queue, the support inbox, and promo codes with end dates and usage limits.

**Fixes**
- Cancelling an order from the staff console now puts the stock back (before, only a customer cancel did).
- A product that is on someone's wishlist or has alerts can now be delisted.
- Order status changes follow fixed rules (Processing to Shipped, Delivered or Cancelled; Shipped to Delivered), so a delivered order cannot go back to processing.
- Promo codes can expire and can be limited to a number of uses.

**Database**
- New tables: `OrderStatusHistory`, `Notification`, `SavedSearch`, `StockAlert`, `PointsLedger`, `ProductQuestion`, `SellSubmission`, `SupportTicket`, `SupportMessage`. Each is seeded with at least ten rows.
- New columns on `Customer` (style profile and notification preferences), `WishlistItem` (price when saved), `PromoCode` (end date and usage limit) and `Orders` (collection slot, gift, points).

**Testing**
- A new feature suite of 95 checks (`npm run test:features`), run by GitHub Actions after the smoke test.
- Every screen was opened in a real browser at phone and desktop widths, in light and dark mode, as a guest, a customer, staff and the administrator, with no script errors and no sideways scrolling; and the main journeys (checkout with a collection slot and points, selling, support, listing edits, bulk markdowns, returns, promos, order processing) were clicked through end to end.

### 1.2.0: Shopping features (October 2026)

Four groups of shopping features, each working on the website and in the Android
application against the same API and database.

**Sizes**
- Every piece is stocked by size. Shoes run from UK 3 to UK 10, tops and dresses from
  XS to XXL, trousers and jeans from waist 28 to 44. Only sizes that are in stock can be
  chosen, and the sizes of a piece always add up to its stock.
- The cart, the order and the stock count all work per size.

**Wishlist**
- Save a piece for later from the product page. The wishlist is stored on the server,
  so it is the same on the website and on the phone.
- Move a saved piece to the cart, or remove it. Sold-out pieces stay on the list.

**Sale prices and promo codes**
- A piece on sale shows its new price, the old price crossed out and the percentage off.
  Both clients can filter the catalogue to sale items only.
- Promo codes at checkout: percentage or fixed amount, with an optional minimum spend.
  An unknown, expired or under-spend code is refused with a message that says why.

**Delivery and addresses**
- An address book with a default address, used at checkout.
- Three delivery methods: standard (R80, free from R1,000), express (R150) and collection
  from the Pretoria store (free). Optional delivery instructions.
- The total is worked out on the server in one place (`server/utils/pricing.js`). Both
  clients ask for a quote and show what comes back.

**Cancelling and returns**
- A customer can cancel an order while it is still processing. The stock goes back on
  sale in the right size and a paid order is marked refunded.
- A delivered item can be returned within 30 days, with a reason. Staff approve, reject
  and refund returns in a new Returns section of the admin console; a refunded piece
  goes back on sale.

**Fixes**
- The Shop and Search tabs no longer crash when a screen closes while it is loading.
- Dark-mode colours corrected so every block has readable text.
- The website's pages keep their side margin on every screen.
- The app signs out cleanly when the server no longer recognises its session, instead of
  repeating "Sign in is required" on every action.
- Google sign-in no longer fails on a slow connection. The server waits up to ten seconds
  for Google, and says whether Google was unreachable or rejected the token.

**Testing**
- The end-to-end suite grew from 70 checks to 131, and the API unit tests from 9 to 22,
  covering sizes, the wishlist, addresses, delivery fees, promo codes, cancelling,
  returns and the Google sign-in check.

**Database**
- New tables: `ProductSize`, `Address`, `WishlistItem`, `PromoCode`, `ReturnRequest`.
  Each is seeded with at least ten rows.

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
