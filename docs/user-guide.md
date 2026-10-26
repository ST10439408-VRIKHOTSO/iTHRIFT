# iTHRIFT Clothes user guide

For customers using the Android application, and for staff using the website.

This is the written half of the user support for the project. The other half
is the Help screen inside the app (**Account → Help**), which carries the same
answers in shorter form. If you change one, change the other.

- [Part 1: The Android application](#part-1--the-android-application)
- [Part 2: The website](#part-2--the-website)
- [Part 3: For staff and administrators](#part-3--for-staff-and-administrators)
- [Part 4: When something goes wrong](#part-4--when-something-goes-wrong)
- [Part 5: For the marker, running it yourself](#part-5--for-the-marker-running-it-yourself)

---

## Part 1: The Android application

The application looks and works like the website: the same design, the same
features and the same account, because both talk to the same server. Part 2
describes the features in detail; this part covers what is different on a
phone.

### Installing it

The application is not on the Google Play Store yet, so it installs from a
file.

1. Copy `app-debug.apk` to the phone. You can also download it from the
   **Actions** tab on GitHub: open the most recent **Android application**
   run and take the `ithrift-debug-apk` artefact.
2. Open the file on the phone. Android will ask whether to allow installs
   from this source; say yes. This is normal for an application that has not
   come from the Play Store.
3. Open **iTHRIFT** from the app drawer. Its icon is the pine square with an i.

### Which server it uses

Out of the box the app uses the hosted iTHRIFT server,
`https://ithrift-api.onrender.com`, the same one the hosted website uses.
Nothing needs setting up.

The hosted server sleeps after 15 quiet minutes, so the very first screen can
take up to a minute to load. After that it is quick.

To use a server running on your own computer instead, open **Account,
Settings, Connection**, type the address and tap **Save and test**:

| Where the app is running | Address to use |
|---|---|
| Android emulator on the same computer as the server | `http://10.0.2.2:3000` |
| A real phone on the same Wi-Fi as the server | `http://<the computer's IP>:3000`, e.g. `http://192.168.0.10:3000` |

**Use the hosted server** puts it back.

> **`localhost` will not work on a phone.** On a phone, `localhost` means the
> phone itself, and the phone is not running the server.

### Getting around

The tab bar at the bottom has **Shop**, **Search**, **Bag**, **Orders** and
**Account**. The bell at the top opens your notifications; the number on it is
how many are unread. The number on **Bag** is how many pieces are in it.

Signed in as staff or the administrator, the tabs become **Shop**, **Search**,
**Console**, **Orders** and **Account**, and the console works as described in
Part 3.

### Getting an account

Tap **Account**, then **Sign in** or **Create an account**. A new account
starts with 50 Thrift Points and a short welcome that asks for your sizes and
favourite brands. **Not now** skips it; you can set them later under
**Account, Your sizes and brands**.

If the server has Google sign-in switched on, **Continue with Google** appears
under the form.

### Things that work a little differently on a phone

- **Photos.** Tap a product photo to open it full screen, then pinch or double
  tap to zoom.
- **Sharing.** **Share** on a product opens Android's share sheet.
- **Receipts.** **Receipt** on an order shows the tax invoice or the gift slip.
  **Print or save as PDF** opens Android's print screen, where **Save as PDF**
  is one of the printers.
- **Help.** **Call** and **Email support** in the Help centre open your phone
  and email apps.
- **Appearance.** **Account, Settings, Appearance** has light, dark or
  automatic, larger text and reduced motion. These are kept on the phone.
  Notification choices are kept on your account, so they match the website.

---

## Part 2: The website

Open `http://localhost:3000/` (or wherever the server is running).

The website does everything the application does, adds the features below, and
holds the staff and administrator console. On a phone the main sections sit in a
tab bar at the bottom: **Shop**, **Search**, **Bag**, **Orders** and **Account**.

On a phone, the browser's **Install** or **Add to Home screen** puts the website
on the home screen like an app. The old separate web app at `/mobile` now
sends people to the website.

### Finding pieces

- **Shop** shows everything. Tap **Filters** to combine brands, categories,
  sizes, condition grades, a price range, sale items and in-stock items. Each
  active filter shows as a chip you can remove on its own.
- **My sizes** limits the shop to the sizes in your style profile.
- **Save search** keeps the current filters under a name. When a new piece
  matches, you get a notification. Manage them under **Account, Saved searches**.
- Start typing in the search box for suggestions; press `/` anywhere to jump to it.
- The compare button on a piece adds it to a tray; open **Compare** to see up to
  three side by side.

### Deciding on a piece

- Tap the photo to zoom.
- **Size guide** and **How we grade** explain sizes and condition.
- The delivery box shows when the piece would arrive by each method, counted in
  working days, so weekends and public holidays are skipped.
- **Ask a question** sends a question to the store. The answer appears on the
  page and you get a notification.
- If a size is sold out, **Tell me if it comes back** sets an alert.

### Your account

| Section | What it does |
|---|---|
| **Thrift Points** | Your balance, tier and history. You earn one point per R10 once an order is delivered. |
| **Style profile** | Your sizes and favourite brands, used for **For you** and **My sizes**. |
| **Saved searches** and **Back-in-stock alerts** | What you are watching; remove anything you no longer want. |
| **Notifications** | Order updates, price drops, alerts and replies. |
| **Settings** | Profile, password, which notifications you get, and appearance: light, dark or system theme, larger text and reduced motion. At the bottom, **Delete my account** erases your personal details and signs you out everywhere (see the privacy policy at `#/privacy`). |
| **Sell to us** | Offer a piece to the shop. When an offer arrives, take it by EFT or as Thrift Points worth 20 percent more. |
| **Help** | Searchable answers, the size guide, and **Message us** for anything else. Replies arrive under **Messages**. |

### Checking out

1. Choose standard, express or collection. For collection, pick a day and a
   two-hour slot; bring your order number to the Hatfield store.
2. Tick **This is a gift** to add a message. The gift slip leaves the prices off.
3. Choose how to pay. Payments are simulated; no money changes hands.
4. Apply a promo code or spend Thrift Points (100 points for R10 off).
5. Place the order. The order page shows a timeline of every change, and
   **Receipt** opens a printable tax invoice or gift slip.

---

## Part 3: For staff and administrators

Sign in with a staff or administrator email address and open
**Console**. Numbers beside a section show how many items are waiting.

| Section | Who | What it does |
|---|---|---|
| **Dashboard** | Staff, Administrator | What needs attention, revenue for the last 30 days, sales by category and brand, return rate. **Export orders (CSV)** downloads every order for the bookkeeper. |
| **Listings** | Staff, Administrator | Add, edit and delist pieces, with stock per size and a sale price. Tick several pieces to mark them down or end a sale in one go. |
| **Inventory** | Staff, Administrator | Stock value, sold-out and low-stock pieces |
| **Promo codes** | Staff can view; Administrator can create and edit | Percentage or rand codes with a minimum spend, an end date and a usage limit |
| **Orders** | Staff, Administrator | Filter by status and delivery method, then open an order to move it along |
| **Collections** | Staff, Administrator | Collection orders by day and slot; **Collected** completes one |
| **Returns** | Staff, Administrator | Approve, reject and refund returns |
| **Support inbox** | Staff, Administrator | Customer messages; replying notifies the customer |
| **Questions** | Staff, Administrator | Answer product questions; answers appear on the product page |
| **Buy-back offers** | Staff, Administrator | Make offers on pieces customers want to sell, then mark them received and paid |
| **Customers** | Administrator only | Customer accounts; suspend and reactivate |

### Moving an order along

Open the order and choose the next status under **Process order**. For a
delivery, **Shipped** asks for the courier reference. For a collection the
choices read **Ready to collect** and **Collected**. Add a note if it helps;
it appears in the customer's timeline. An order can only move forward:
Processing to Shipped, Delivered or Cancelled, and Shipped to Delivered.
Cancelling puts the stock back, refunds a paid order and returns any points.

### Handling a return

Open **Returns** in the console. Each return shows the order, the customer,
the item and the reason.

| Action | When to use it |
|---|---|
| **Approve** | The return is valid and the parcel is on its way back. |
| **Reject** | The return does not meet the policy. A rejected return can still be approved later. |
| **Refund** | The piece has arrived and passed inspection. It goes back on sale in its size, and anyone waiting for it is told. |

### Marking pieces down

In **Listings**, tick the pieces, choose a percentage and press **Mark down**.
The discount is taken from the full price, so marking a piece down twice does
not compound. Customers who saved a piece are told the price dropped.
**End sale** returns the pieces to full price.

### Permissions are enforced on the server

The **Customers** section and promo editing are only shown to an
administrator. That is a convenience, not the control: the server refuses the
request from any other role even if the address is typed in by hand. The same
is true of every administrative action in the app and on the website.

---

## Part 4: When something goes wrong

### "Couldn't reach iTHRIFT."

The phone is offline, the hosted server is still waking up, or the app is
pointed at the wrong address.

1. Wait a minute and tap **Try again**. The hosted server can take that long
   after a quiet spell.
2. **Account, Settings, Connection, Save and test.** It will say whether it got
   through. **Use the hosted server** puts the default address back.
3. If you use your own server, check it is up: on the computer running it,
   `npm start` should be printing request lines.
3. On a real phone, check the address is the computer's network address and
   not `localhost`.
4. Check the phone and the computer are on the same network. Guest Wi-Fi
   often blocks devices from seeing each other.

### "Incorrect email or password."

The message is deliberately the same whether the email or the password was
wrong, so that nobody can use the sign-in form to find out which email
addresses have accounts.

If you know the email is right, check whether you originally signed up with
Google. In that case there is no password to type, and the app will tell you
to use **Continue with Google** instead.

### "This account signs in with Google."

You created the account through Google sign-in, so it has no password on our
system. Use the **Continue with Google** button.

### "An account with that email already exists."

You already have a password account on that address. Sign in with your email
and password. We deliberately do not link a Google account to an existing
password account automatically, because anyone who could create a Google
account on your address would then walk into your iTHRIFT account.

### "Only 2 in stock." / "That item is out of stock."

Someone else bought it while it was sitting in your cart. Stock is only
reserved when an order is placed. Nothing is wrong.

### The app was signed in and now it isn't

The prototype keeps sessions in the server's memory, so restarting the server
signs everybody out. Sign in again. A production build would use a persistent
session store.

### Something else

**Account → Help** has the same answers, plus a panel at the bottom showing
the app version, the server address it is using and who is signed in. Read
that out when asking for help, because it answers the first three questions anyone
will ask.

Support: `support@ithrift.co.za`, or WhatsApp 012 345 6789, Monday to Friday,
09:00 to 17:00. Quote your order reference.

---

## Part 5: For the marker, running it yourself

Full setup instructions are in the [README](../README.md). The short version:

```bash
npm install
npm run init-db
npm start
```

Then open <http://localhost:3000/> for the website, and run the Android
application from Android Studio against `http://10.0.2.2:3000`.

### Signing in

Sign in with an email address or a cellphone number. The administrator
account is `vukosir@icloud.com` with the password `ithrift@2025`. Customers
create their own accounts; registration asks for a cellphone number and for
the password twice.

### Seeing the two clients share one database

1. On the website, sign in as `admin` and open **Admin Console → Listings**.
   Add a piece with a price and a stock quantity.
2. In the Android application, search for it. It is already there.
3. Sign in as a customer on the phone, add it to the cart, and check out.
4. Stock drops by the quantity ordered. The server recalculated the total and
   reserved the stock. The phone was not trusted to do either.
5. On the website, open **Admin Console → Process orders**. The order placed
   on the phone is in the queue.
6. Set it to **Shipped** and enter a courier reference. On the phone, open
   **Orders**; the tracker now reads **Shipped**.

`npm test` walks this same path automatically, in 131 checks.
