# iTHRIFT Clothes: website and Android application

[![Android application](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions/workflows/android.yml/badge.svg)](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions/workflows/android.yml)
[![API and website](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions/workflows/api-and-website.yml/badge.svg)](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions/workflows/api-and-website.yml)
[![Signed release build](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions/workflows/release.yml/badge.svg)](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions/workflows/release.yml)

![iTHRIFT Clothes: the website and the Android app](docs/task3/figures/readme-hero.png)

South African pre-loved branded fashion, sold through a native Android app and a
website that share one REST API and one database.

**XISD6329 Work Integrated Learning 3B, Group 11**
Vukosi Rikhotso (ST10439408) and Theo Golele (ST10439863)
IIE Rosebank College, Pretoria · Client: iTHRIFT Clothes, Pretoria

| Link | Where |
|---|---|
| Source code | <https://github.com/ST10439408-VRIKHOTSO/iTHRIFT> |
| Hosted website | <https://ithrift-api.onrender.com/> |
| Hosted REST API | <https://ithrift-api.onrender.com/api> |
| Demonstration video (unlisted on YouTube) | <https://youtu.be/7wly_1Y31v8> |
| Pipeline runs | <https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/actions> |
| Releases (signed APK and App Bundle) | <https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases> |
| Azure DevOps board | <https://dev.azure.com/ST10439408/iTHRIFT/_boards/board/t/iTHRIFT%20Team/Issues> |
| User guide | [`docs/user-guide.md`](docs/user-guide.md) |

## Contents

- [Assessment status](#assessment-status)
- [Purpose of the app and the website](#purpose-of-the-app-and-the-website)
- [Screenshots](#screenshots)
- [Design considerations](#design-considerations)
- [How we used GitHub and GitHub Actions](#how-we-used-github-and-github-actions)
- [Demonstration video](#demonstration-video)
- [Running it](#running-the-api-and-the-website)
- [Automated testing](#automated-testing)
- [Publishing on Google Play](#publishing-on-google-play)
- [Release notes](#release-notes)
- [References](#references)

## Assessment status

| Task | Deliverable | State |
|---|---|---|
| Task 1 | Updated project plan, site map, wireframes | Complete, see [`docs/task1/`](docs/task1/) |
| Task 2 | Working prototype: Android app, API, database, tests | Complete, see [`docs/task2/`](docs/task2/) and the frozen [`task-2`](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/tree/task-2) branch |
| Task 3 | Final release, final report and presentation | Complete, see [`docs/task3/`](docs/task3/) and release [v1.3.4](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases) |

The `task-2` branch is left exactly as it was marked, so the links in the Task 2
report still show the prototype. `main` carries the final version.

## Purpose of the app and the website

### The problem

iTHRIFT Clothes buys pre-owned branded clothing, checks and grades every piece by hand,
and resells it from its store in Hatfield, Pretoria. Before this project everything
outside the store ran through WhatsApp and Instagram: stock lived in one person's head,
prices were quoted in direct messages and orders were tracked in chat threads. A
customer outside Pretoria had no reliable way to see what was in stock or to buy it,
and the owner could not tell what had sold, what was reserved or what was owed. The
business did not lack demand; it lacked a channel that could carry the demand it had.

### Who it is for

| User | What they need | Where they get it |
|---|---|---|
| Customers, mostly on mid-range Android phones | Find a specific piece, trust its condition, pay, and know when it arrives | The Android app, or the website on any device |
| Store staff | Pack orders, run collections, answer questions, handle returns and buy-back offers | The staff console on the website, and in the app |
| The owner (administrator) | See sales, stock and customers in one place, and control prices and promotions | The dashboard, listings, promo codes and customer pages |

### What each part does

- **The website** (`public/`) is the full storefront for customers and the console
  for staff: catalogue, filters and search, product pages with the condition meter,
  bag, checkout, orders, account, Thrift Points, Sell to us, help centre, and the
  staff dashboard with listings, inventory, orders, collections, returns, questions,
  buy-back offers, the support inbox, promo codes and customers.
- **The Android app** (`app/`) is a native Kotlin client in Jetpack Compose with every
  customer feature of the website plus the staff console, built for the phones most
  South African customers carry.
- **The REST API** (`server/`) is the one place every business rule lives: totals,
  stock locking, order status rules, roles, points and notifications. Both clients
  call the same routes.
- **The database** is a Third Normal Form schema of 25 tables, seeded with realistic
  data: SQLite for the prototype and the hosted demo, with the equivalent MySQL 8
  schema in `database/mysql-schema.sql`.

### Expected impact

- One stock count instead of a memory: a piece that sells on the phone disappears
  from the website at the same moment, so nothing is sold twice.
- Customers anywhere in South Africa can buy, pay and track an order without a
  single message to the owner.
- Honest grading (Excellent, Very Good, Good, Fair) and photographs on every piece
  reduce the most common complaint about second-hand clothing: "it was more worn than
  I expected".
- Thrift Points, price-drop alerts and the buy-back service bring customers back, and
  the buy-back service also feeds the store's supply.
- The owner sees revenue, return rate and what needs attention on one dashboard
  instead of scrolling through chats.

## Screenshots

All screenshots are of version 1.3.4. The app screens are rendered by the screenshot
test against the real API and seeded database (see [Automated testing](#automated-testing));
the website screens were taken in a browser against the same server. More, with
captions, are in [`docs/task3/figures/`](docs/task3/figures/).

### Android app: shopping

<table>
<tr>
<td><img src="docs/task3/figures/app-01-home.png" width="200" alt="Home"></td>
<td><img src="docs/task3/figures/app-03-shop.png" width="200" alt="Shop"></td>
<td><img src="docs/task3/figures/app-04-filters.png" width="200" alt="Filters"></td>
<td><img src="docs/task3/figures/app-06-product.png" width="200" alt="Product"></td>
</tr>
<tr>
<td align="center">Home, "Picked for your sizes"</td><td align="center">Shop with condition meters</td>
<td align="center">Combined filters</td><td align="center">Product, sizes in stock</td>
</tr>
<tr>
<td><img src="docs/task3/figures/app-09-bag.png" width="200" alt="Bag"></td>
<td><img src="docs/task3/figures/app-11-checkout-collection.png" width="200" alt="Checkout"></td>
<td><img src="docs/task3/figures/app-13-order-tracking.png" width="200" alt="Order tracking"></td>
<td><img src="docs/task3/figures/app-14-tax-invoice.png" width="200" alt="Tax invoice"></td>
</tr>
<tr>
<td align="center">Bag</td><td align="center">Checkout with a collection slot</td>
<td align="center">Order timeline</td><td align="center">Tax invoice (print or PDF)</td>
</tr>
</table>

### Android app: account, help and staff console

<table>
<tr>
<td><img src="docs/task3/figures/app-26-sign-in.png" width="200" alt="Sign in"></td>
<td><img src="docs/task3/figures/app-20-settings.png" width="200" alt="Settings"></td>
<td><img src="docs/task3/figures/app-21-thrift-points.png" width="200" alt="Thrift Points"></td>
<td><img src="docs/task3/figures/app-19-account-dark.png" width="200" alt="Account, dark"></td>
</tr>
<tr>
<td align="center">Sign in, with Google</td><td align="center">Settings</td>
<td align="center">Thrift Points</td><td align="center">Account in dark mode</td>
</tr>
<tr>
<td><img src="docs/task3/figures/app-23-sell-to-us.png" width="200" alt="Sell to us"></td>
<td><img src="docs/task3/figures/app-24-help-centre.png" width="200" alt="Help centre"></td>
<td><img src="docs/task3/figures/app-30-staff-dashboard.png" width="200" alt="Staff dashboard"></td>
<td><img src="docs/task3/figures/app-33-staff-process-order.png" width="200" alt="Process an order"></td>
</tr>
<tr>
<td align="center">Sell to us</td><td align="center">Help centre</td>
<td align="center">Staff dashboard</td><td align="center">Processing an order</td>
</tr>
</table>

### Website

| | |
|---|---|
| ![Website home](docs/task3/figures/web-01-home.png) | ![Product page](docs/task3/figures/web-03-product.png) |
| Home page | Product page with sizes, delivery dates and the condition meter |
| ![Checkout](docs/task3/figures/web-08-checkout.png) | ![Order detail](docs/task3/figures/web-10-order-detail.png) |
| Checkout, priced by the server | Order tracking and returns |
| ![Staff dashboard](docs/task3/figures/web-30-admin-dashboard.png) | ![Sign in with Google on the hosted site](docs/task3/figures/hosted-04-login.png) |
| Staff dashboard | Sign in on the hosted site, with Continue with Google |

## Design considerations

**One API, two clients, and the server decides.** The website and the app are both
thin clients over one REST API. Cart totals, stock locking at checkout, order status
transitions, points and role permissions are all enforced on the server, so a
repackaged app or an edited web page cannot set its own price. Hiding a menu item in a
client is a convenience, never a control.

```
Website (HTML5/CSS3/JS)      Android app (Kotlin, Compose)
            |                          |
            +----- HTTPS / JSON -------+
                       |
        REST API: Node.js + Express (server/)
        auth · roles · totals · stock locking
        order rules · points · notifications
                       |
              parameterised SQL
                       |
        SQLite (prototype) / MySQL 8 (production)
```

**One design system on both clients.** The app was rebuilt in Jetpack Compose in
1.3.1 so it could share the website's design system exactly: the Instrument Sans
typeface, the pine and marigold palette, light and dark modes, an 8-point spacing
scale, the same Lucide icons and the four-step condition meter. A customer who moves
from the website to the app finds the same shop.

**Built for second-hand phones and slow networks.** `minSdk` 24 reaches the older
handsets that are common in the market this shop sells to. Every screen has loading,
empty and error states with a retry; network failures never crash a screen because
every call goes through `safeApiCall`; and the app waits up to a minute for the free
hosted server to wake up and says so if it gives up.

**Security by design.** Passwords are hashed with scrypt and a per-account salt and
compared in constant time. Google sign-in is verified on the server (issuer, audience,
expiry, verified email), never in the app. The app's Google sign-in goes through the
website and comes back with a single-use code bound to a secret only the app holds
(the PKCE idea from RFC 7636), so an app that intercepted the link could not use it.
Every request is checked for its role on the server, the keystore and the OAuth client
id are never committed, and the logs never contain a password, token or code.

**A data model that keeps history honest.** Brand and Category are lookups, stock is
held per size so a size can sell out on its own, and an order keeps the prices,
discount, delivery fee and address it was placed with, so repricing a product never
rewrites an old order. A table constraint makes every customer have either a password
hash or a Google id.

**Accessible.** Visible keyboard focus, focus moved to each new page heading, labelled
controls, contrast checked in both modes, larger text and reduced motion settings on
both clients, and screen-reader headings in the app.

**Logging that explains the code.** The API writes one line per request (method, path,
status, time, role). The app logs under clear Logcat tags: `ApiCall` for every failed
request with its HTTP status, `AppState` for navigation, sign-in and settings,
`GoogleSignIn` and `Auth` for each step of single sign-on, `Checkout`, `Orders` and
`StaffConsole` for the actions that change data. Filter Logcat by `tag:ApiCall` to see
every problem a session ran into.

## How we used GitHub and GitHub Actions

**Repository.** One repository holds the website, the API, the database scripts, the
Android app, the tests, the documents and the pipelines, so a change to a shared
contract (an API route or a JSON field) lands in one commit instead of three. Code is
committed as it is written, with messages that say what changed. Nothing is uploaded as
a ZIP file.

**Branches and tags.**

| Ref | What it is |
|---|---|
| `main` | The current version. Every push is built and tested |
| `task-2` | The prototype exactly as it was marked for Task 2 |
| `v1.2.0` | The Task 2 release tag |
| `v1.3.4` | The final release tag; it produced the signed APK and App Bundle |

**Workflows.** Three workflows live in `.github/workflows/`. Two run on every push and
pull request; the release only runs on a tag, because a release is a decision and not a
side effect of committing.

| Workflow | Trigger | What it does |
|---|---|---|
| [`android.yml`](.github/workflows/android.yml) | push, pull request, manual | Sets up JDK 17 and Gradle, runs the 53 Kotlin unit tests, assembles the debug APK and uploads it as the `ithrift-debug-apk` artefact. On a failure it turns the Kotlin compiler errors into annotations and uploads the test reports. A manual run on a branch also starts the API and renders the screenshot test |
| [`api-and-website.yml`](.github/workflows/api-and-website.yml) | push, pull request, manual | Sets up Node 24, installs from the lock file, runs the 25 API unit tests, seeds the database, starts the server, then runs the 150-check smoke test and the 95-check feature test. Uploads the server log if anything fails |
| [`release.yml`](.github/workflows/release.yml) | tag `v*`, manual | Checks the signing secrets exist, restores the keystore from a secret, runs the unit tests again, assembles the signed release APK and App Bundle, uploads them as the `ithrift-release` artefact, and deletes the keystore from the runner even if the build failed |

The unit tests run first because they need no server and finish in seconds: if a
business rule is broken there is no point booting the API to find out. A red run is
fixed before anything else is pushed.

**Secrets.** The release keystore and its passwords are repository secrets
(`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). Anyone holding
the keystore could publish an update under our name, so it never touches the
repository.

**Hosting.** The API, the website and the seeded database are hosted on Render from
`render.yaml`: `npm ci && npm run init-db` then `npm start`. The Android app uses the
hosted server by default, so it works on any phone with no set-up.

## Demonstration video

**<https://youtu.be/7wly_1Y31v8>** (unlisted on YouTube, with a voice-over)

The video shows the app running on a physical Android phone, the website, Google
single sign-on, and the data behind them: the OAuth clients in the Google Cloud
console, the REST API's JSON and the stored rows in the database.

## Requirements

- **Node.js 24 or newer** for the API. `server/db.js` uses the built-in `node:sqlite`
  module, so there is no separate database server to install.
- **JDK 17** (or 21) and **Android Studio** (or the Android SDK plus the Gradle wrapper)
  for the application. `compileSdk` 35, `minSdk` 24.

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

The API, the website and the SQLite database are hosted on
[Render](https://render.com), defined in `render.yaml` at the repository root:
`npm ci && npm run init-db` installs the API and builds the seeded database, then
`npm start` runs it.

- Hosted website: `https://ithrift-api.onrender.com/`
- Hosted REST API: `https://ithrift-api.onrender.com/api`

On the free plan the service sleeps after 15 minutes without requests, so the first
request after that can take up to a minute. The disk is not persistent, so new orders
are reset to the seeded data on each deploy or restart.

## Running the Android application

1. Open the repository root in Android Studio and let Gradle sync.
2. Create `local.properties` with your SDK location. It is deliberately not
   committed:
   ```properties
   sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
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

The signed release APK and App Bundle for each version are attached to its
[GitHub release](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases).

## Single sign-on

Both the website and the app offer **Continue with Google**. Both ends use the same
OAuth **web** client id from a Google Cloud project, and neither the id nor anything
derived from it is committed.

1. In the Google Cloud console, create an OAuth 2.0 **Web application** client
   id. Give the server that value in its `GOOGLE_CLIENT_ID` environment
   variable (on Render, under the service's Environment settings):
   ```bash
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com npm start
   ```
2. Add each address the website runs on under **Authorised JavaScript
   origins** of that client, for example `https://ithrift-api.onrender.com` and
   `http://localhost:3000`.

The website reads the client id from `GET /api/auth/sso/status` and sends Google's ID
token to `POST /api/auth/sso`. The app's **Continue with Google** opens the website's
`#/app-sign-in` page in a browser tab. After Google signs the customer in, the server
issues a single-use code that the page hands back to the app through an
`ithrift://signed-in` link, and the app swaps the code for a session at
`POST /api/auth/sso/exchange`. The app proves it started the sign-in with a secret
whose SHA-256 it sent at the start, so another app that intercepted the link could not
use the code (see [`server/utils/app-codes.js`](server/utils/app-codes.js)).

Without a client id the project still builds and runs; both clients check
`GET /api/auth/sso/status` and hide the button rather than offering one that cannot
work. The token is verified on the server, never in the app (see
[`server/utils/sso.js`](server/utils/sso.js)).

## Signing in

Everyone signs in with an email address or a cellphone number.

| Role | Email | Password |
|---|---|---|
| Administrator | `vukosir@icloud.com` | `ithrift@2025` |

New customers register on the website or in the app. Registration asks for a
cellphone number (a South African mobile number that no other account uses) and the
password twice. A customer can then sign in with either their email or that number,
typed in any common form (`082 555 0101`, `0825550101` or `+27 82 555 0101`).

## Demonstrating the link between the two clients and the database

1. On the website, sign in as the administrator and open **Console → Listings**.
   Add a product with a price and stock quantity.
2. In the Android application, search for that product. It is already there, because
   the phone reads the same database the website just wrote to.
3. In the application, sign in as a customer, add the product to the bag and check out.
4. Stock drops by the quantity ordered. The server reserved the stock and recalculated
   the total, not the client.
5. Back on the website, open **Console → Orders**. The order placed on the phone is
   listed with its payment and total.
6. Mark it **Shipped** with a courier reference. In the application, open **Orders**;
   the timeline now shows **With the courier**.

`npm test` walks this same path automatically.

## Automated testing

**323 automated checks across four suites, plus a screenshot test**, all run by GitHub
Actions so the code is proven on a clean machine and not only on ours.

| Suite | Count | What it covers |
|---|---|---|
| Kotlin unit tests (`app/src/test/`) | 53 | Input validation (including cellphone numbers and matching passwords), server-address parsing, money and date formatting, network error handling, the theme setting |
| API unit tests (`test/unit-tests.js`) | 25 | Password hashing and the password policy, SSO configuration and token verification, the app sign-in codes, cart arithmetic, delivery fees, promo codes, cellphone numbers |
| End-to-end smoke test (`test/smoke-test.js`) | 150 | The whole API surface against a running server, every role, account deletion, and the cross-client database link |
| Feature test (`test/feature-test.js`) | 95 | Thrift Points, alerts and notifications, saved searches, the working-day calendar, collection slots, gift orders, selling to the shop, support messages, bulk markdowns, promo limits, analytics and the CSV export |
| Screenshot test (`app/src/test/.../ScreenshotTest.kt`) | 32 screens and 4 journeys | Every main app screen, light and dark, rendered with Robolectric against the seeded server; runs on a manual branch build |

### Running them locally

```bash
./gradlew testDebugUnitTest
```

```bash
npm run test:unit
```

The end-to-end suites need the server up, so start it in one terminal:

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

## Publishing on Google Play

The app is prepared for the Play Store:

| Requirement | State |
|---|---|
| Application id | `com.ithrift.app` |
| Version | 1.3.4 (versionCode 7), `targetSdk` 35 |
| Signed APK and App Bundle | Built by `release.yml` from tag `v1.3.4` and attached to the [release](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases) |
| Keystore | Kept out of the repository, in repository secrets |
| Privacy policy (required by Play for an app with accounts) | <https://ithrift-api.onrender.com/#/privacy> |
| Account deletion (required by Play) | In the app and on the website under Account, Settings, and described in the privacy policy |
| Store listing text, icon, feature graphic and phone screenshots | [`docs/task3/play-store/`](docs/task3/play-store/) |

## Project structure

```
ithrift/
├── public/                     web root: everything the browser downloads
│   ├── index.html              single-page shell for every route
│   ├── css/                    globals.css, style.css (the design system)
│   ├── js/                     app.js (router), views-shop.js, views-auth.js, views-account.js, views-admin.js
│   ├── images/                 brand/ and products/
│   └── manifest.webmanifest    makes the website installable on a phone
├── app/                        Android application (Kotlin, Jetpack Compose)
│   ├── src/main/java/com/ithrift/app/
│   │   ├── data/               API client, models, session, settings, Google sign-in
│   │   ├── ui/                 theme/, components/, screens/, staff/, AppState, navigation
│   │   └── util/               validators, URL parsing, formatting
│   ├── src/main/res/font/      Instrument Sans, the website's typeface
│   └── src/test/               JVM unit tests and the screenshot test, no emulator required
├── server/                     REST API (Node.js + Express)
│   ├── routes/                 auth, products, cart, orders, returns, account, sell, support, admin
│   ├── middleware/             authentication and role checks
│   └── utils/                  passwords, single sign-on, app codes, pricing, points, calendar
├── database/
│   └── mysql-schema.sql        production schema, Third Normal Form
├── test/                       API unit tests, smoke test, feature test
├── docs/
│   ├── user-guide.md           user documentation for customers and staff
│   ├── task1/ task2/ task3/    each task's document and its figures
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

Recorded here for transparency; also explained in the final report.

- **SQLite stands in for MySQL.** The design specifies MySQL 8. So the prototype runs
  with one command and no setup, it uses Node's built-in SQLite engine. The schema is
  the same Third Normal Form design; see `database/mysql-schema.sql`. SQLite treats
  `ORDER` as reserved, so that table is named `Orders`.
- **Payments are simulated.** No money changes hands. The payment step records a method
  and a status, which is enough to demonstrate the order and reporting flow. Live
  PayFast integration is the next step.
- **Sessions are in memory.** Signing in issues a bearer token held in the server's
  memory, so restarting the server signs everyone out. A production build would use a
  persistent session store.
- **There are no instrumented tests.** The Kotlin unit tests cover the logic that can
  be tested without a device, and the Robolectric screenshot test renders the screens;
  the app is checked by hand on a handset, not by Espresso on a device.
- **Notifications live inside the website and the app.** Nothing is sent by email, SMS
  or push.
- **The hosted server sleeps.** On Render's free plan the first request after a quiet
  spell can take up to a minute; the app waits that long and says so if it gives up.
- **Impact figures are estimates.** The water and carbon saved per piece use published
  averages per category, not measurements of the actual garment.
- **Collection slots do not cap bookings,** and **public holidays are listed for 2026 and
  2027**; later years need adding to `public/js/calendar.js`.
- **Product photography** under `public/images/products/` is brand photography used to
  make the catalogue realistic for assessment purposes.

## Release notes

### Since the prototype

The prototype marked for Task 2 was **version 1.2.0**. Everything below 1.2.0 in these
notes was added after it. In short, 1.3.0 rebuilt the website and added thirty
features, 1.3.1 rebuilt the Android app in Jetpack Compose with every one of those
features, 1.3.2 and 1.3.3 reworked sign-in, and 1.3.4 is the final release.

**Our innovative features, added after the prototype.** These go beyond what a
clothing shop usually offers and were designed around how a second-hand business
actually works:

| Feature | Why it matters for iTHRIFT | Added in |
|---|---|---|
| **Sell to us** (buy-back): a customer offers a piece, staff make an offer, the customer takes EFT or Thrift Points worth 20 percent more | Turns customers into suppliers, which a thrift store needs more than new stock | 1.3.0 web, 1.3.1 app |
| **Thrift Points** with Bronze, Silver and Gold tiers, spendable at checkout and refunded on a cancel | Rewards coming back, in a business where every piece is one of a kind | 1.3.0 web, 1.3.1 app |
| **Price-drop and back-in-stock alerts** on saved pieces, with how much the price fell | One-off pieces sell fast; the alert is the customer's only chance | 1.3.0 web, 1.3.1 app |
| **Working-day delivery dates** that skip South African public holidays, and **store collection slots** | "When will it arrive?" answered honestly before paying | 1.3.0 web, 1.3.1 app |
| **Impact estimate** of water and carbon saved by buying second hand | Makes the environmental case for thrift visible to the customer | 1.3.0 web, 1.3.1 app |
| **Gift orders** with a gift slip without prices, and a **VAT tax invoice** | Real documents a customer can print or save as PDF | 1.3.0 web, 1.3.1 app |
| **Staff console in the app** | Staff can process orders and collections from the shop floor | 1.3.1 |
| **App Google sign-in through the website with a single-use code** (PKCE) | Works with the same Google set-up as the website, without the app ever holding a reusable token in a link | 1.3.3 |

### 1.3.4: Final release (October 2026)

- **Delete your account**, on the website and in the app (Account, Settings). The
  personal details are erased at once and every session ends; orders, payments and
  returns are kept without them, as the law requires. Deletion waits while an order is
  on its way. A password account confirms with its password, a Google account by typing
  DELETE. Ten new smoke-test checks cover it.
- A **privacy policy** at `#/privacy`, written for POPIA and linked from the footer,
  Settings and the Play Store listing; the help centre explains how to delete an account.
- Logging across the app: every failed API call (with its HTTP status), navigation,
  sign-in and sign-out, each step of Google sign-in, settings changes, checkout,
  cancelling, returns and staff order updates are written to Logcat under named tags.
  No password, token, verifier or sign-in code is ever logged.
- Source references added to the comments of the Kotlin code and the security code on
  the server.
- Website: the compare tray no longer wraps "3 of 3" onto three lines on a phone.
- The app's compare tray holds three pieces, the same as the website (it allowed four).
- This README: purpose, design considerations, GitHub and GitHub Actions, screenshots
  and release notes for the final report.
- Final report, presentation and Play Store listing in `docs/task3/`.

### 1.3.3: Google sign-in in the app (October 2026)

- Continue with Google in the app now signs in through the website in a
  browser tab and comes back to the app, so it works with the same Google
  setup as the website. See Single sign-on.
- The app's package name is now `com.ithrift.app`.

### 1.3.2: Sign-in changes (October 2026)

- The demonstration accounts are gone from the sign-in screens.
- Sign in with an email or a cellphone number, on the website and in the app.
- Registration requires a cellphone number and asks for the password twice.
  The number stays required in Settings.
- APKs are signed with a fixed debug key (`app/debug.keystore`), so each one
  installs over the last.
- Website: the phone "Add to bag" bar is pinned above the tab bar again, and the white
  box behind Google's button in dark mode is gone.

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
- A screenshot test renders 32 screens and four journeys against the real API
  and seeded database on every manual branch build.

### 1.3.0: Redesign and thirty new features (October 2026)

The website and staff console were rebuilt with a new design system, and thirty
features were added. Every feature reads and writes real data through the API; none
of it is decoration.

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
6. Compare up to three pieces side by side.
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
- Cancelling an order from the staff console now puts the stock back.
- A product that is on someone's wishlist or has alerts can now be delisted.
- Order status changes follow fixed rules (Processing to Shipped, Delivered or Cancelled; Shipped to Delivered), so a delivered order cannot go back to processing.
- Promo codes can expire and can be limited to a number of uses.

**Database**
- New tables: `OrderStatusHistory`, `Notification`, `SavedSearch`, `StockAlert`, `PointsLedger`, `ProductQuestion`, `SellSubmission`, `SupportTicket`, `SupportMessage`. Each is seeded with at least ten rows.
- New columns on `Customer` (style profile and notification preferences), `WishlistItem` (price when saved), `PromoCode` (end date and usage limit) and `Orders` (collection slot, gift, points).

**Testing**
- A new feature suite of 95 checks (`npm run test:features`), run by GitHub Actions after the smoke test.

### 1.2.0: Shopping features, the Task 2 prototype (October 2026)

Sizes in stock per piece, a server-side wishlist, sale prices and promo codes, an
address book with three delivery methods and a server-side quote, cancelling and
returns, and five new tables (`ProductSize`, `Address`, `WishlistItem`, `PromoCode`,
`ReturnRequest`). The end-to-end suite grew from 70 checks to 131 and the API unit
tests from 9 to 22. Full notes are in the Task 2 report in `docs/task2/`.

### 1.1.0: Task 2, first working build (September 2026)

Google single sign-on verified on the server, the settings screen, the dark theme, the
in-app help and the user guide, 49 Kotlin unit tests, 9 API unit tests, the signed
release workflow, at least ten rows in every table, and per-request server logging.

### 0.2.0: Task 1 (August 2026)

The native Kotlin client, the site maps and wireframes, the first GitHub Actions
pipelines, and the project plan rebuilt with the DevOps lifecycle.

### 0.1.0: XISD5319 Task 3 (June 2026)

Website, installable web app, REST API and seeded database, with a 51-check smoke test.

## References

- Android Developers. 2025. *Guide to app architecture*. Available at: <https://developer.android.com/topic/architecture>
- Android Developers. 2025. *State and Jetpack Compose*. Available at: <https://developer.android.com/develop/ui/compose/state>
- Android Developers. 2025. *Navigation with Compose*. Available at: <https://developer.android.com/develop/ui/compose/navigation>
- Android Developers. 2025. *Save simple data with SharedPreferences*. Available at: <https://developer.android.com/training/data-storage/shared-preferences>
- Android Developers. 2025. *Sign your app*. Available at: <https://developer.android.com/studio/publish/app-signing>
- Chrome for Developers. 2025. *Custom Tabs*. Available at: <https://developer.chrome.com/docs/android/custom-tabs>
- GitHub. 2025. *GitHub Actions documentation*. Available at: <https://docs.github.com/en/actions>
- Google. 2025. *Verify the Google ID token on your server side*. Available at: <https://developers.google.com/identity/gsi/web/guides/verify-google-id-token>
- Node.js. 2025. *Crypto: scrypt*. Available at: <https://nodejs.org/api/crypto.html>
- OWASP. 2021. *Password Storage Cheat Sheet*. Available at: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- Sakimura, N., Bradley, J. and Agarwal, N. 2015. *RFC 7636: Proof Key for Code Exchange by OAuth Public Clients*. Available at: <https://datatracker.ietf.org/doc/html/rfc7636>
- Square. 2025. *Retrofit* and *OkHttp*. Available at: <https://square.github.io/retrofit/> and <https://square.github.io/okhttp/>
- The Independent Institute of Education. 2026. *Module manual XISD6329: Work Integrated Learning 3B*. Johannesburg: The Independent Institute of Education.

Fonts and icons: Instrument Sans (SIL Open Font Licence) and Lucide (ISC licence); the
licence texts are in `app/src/main/assets/licences/` and `public/js/icons-LICENSE.txt`.
