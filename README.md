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
| Task 1 | Updated project plan, site map, wireframes | Complete. See [`docs/task1/`](docs/task1/) |
| Task 2 | Working prototype: Android app, API, database, tests | In progress |
| Task 3 | Final project report and presentation | Not started |

The Task 1 document, together with all fifteen figures at full resolution, is in
[`docs/task1/`](docs/task1/).

## What's in here

| Piece | Where | What it does |
|---|---|---|
| Website | `public/`, served at `/` | Customer storefront plus the staff and administrator console |
| Android application | `app/` | Native Kotlin client, customer-facing |
| Installable web app | `public/mobile/`, served at `/mobile` | Progressive Web App build of the storefront |
| REST API | `server/`, served at `/api` | The shared application tier, where every business rule lives |
| Database | `data/ithrift.db` (generated) | SQLite, built and seeded by `npm run init-db` |
| MySQL schema | `database/mysql-schema.sql` | Production-equivalent Third Normal Form schema |
| Smoke test | `test/smoke-test.js` | 51 end-to-end API checks (`npm test`) |
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
2. Create `local.properties` with your SDK location, which is deliberately not
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

## Demonstration accounts

| Role | Email / username | Password |
|---|---|---|
| Customer | `lerato.m@gmail.com` | `Password1` |
| Administrator | `admin` | `Admin@123` |
| Staff | `staff01` | `Staff@123` |

A new customer can register from either client. Staff and administrator accounts sign
in only on the website, because the console does not exist in the application.

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
   open **Orders**, and the tracker now shows **Shipped**.

`npm test` walks this same path automatically.

## Automated testing

Two GitHub Actions workflows run on every push and pull request to `main`.

| Workflow | What it does |
|---|---|
| `.github/workflows/api-and-website.yml` | Installs from the lock file, seeds the database, starts the server, runs the 51-check smoke test |
| `.github/workflows/android.yml` | Runs the unit tests, assembles the debug build, uploads the package as an artefact |

A red pipeline blocks the merge. To run the API tests locally, start the server in one
terminal and run the tests in another:

```bash
npm start
```

```bash
npm test
```

The suite covers registration and sign-in, catalogue browsing, filtering and search,
cart operations, checkout with server-side stock locking and total recalculation,
payment records, order status transitions, reviews, the sales and inventory reports,
role-based access across the customer, staff and administrator roles, and the
cross-client database link.

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
│   └── src/main/java/com/codecouture/ithrift/
│       ├── data/               API client, models, session, typed results
│       └── ui/                 shop/ search/ cart/ orders/ account/
├── server/                     REST API (Node.js + Express)
│   ├── routes/                 auth, products, cart, orders, admin
│   ├── middleware/             authentication and role checks
│   └── utils/                  password hashing, references, images
├── database/
│   └── mysql-schema.sql        production schema, Third Normal Form
├── test/
│   └── smoke-test.js           end-to-end checks across the API surface
├── docs/
│   └── task1/                  Task 1 document and its figures
└── .github/workflows/          automated build and test pipelines
```

### Naming convention

Every file and folder served over HTTP uses lowercase names, no spaces and no special
characters, with words separated by a single hyphen. URLs are case-sensitive on most
web servers, so a capital in a filename is a broken link waiting to happen. Two
deliberate exceptions: `README.md`, because that is the name GitHub renders, and the
Kotlin sources under `app/`, which follow the Android package conventions. Neither is
served over HTTP.

## Scope
