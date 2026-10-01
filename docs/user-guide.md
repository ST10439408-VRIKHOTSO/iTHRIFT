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

### Installing it

The application is not on the Google Play Store yet, so it installs from a
file.

1. Copy `app-debug.apk` to the phone. You can also download it from the
   **Actions** tab on GitHub: open the most recent **Android application**
   run and take the `ithrift-debug-apk` artefact.
2. Open the file on the phone. Android will ask whether to allow installs
   from this source; say yes. This is normal for an application that has not
   come from the Play Store.
3. Open **iTHRIFT** from the app drawer.

### Pointing it at the server

The application talks to the iTHRIFT server. Until it knows where that is,
nothing will load.

Open **Account → Settings → Connection** and set the server address:

| Where the app is running | Address to use |
|---|---|
| Android emulator on the same computer as the server | `http://10.0.2.2:3000` (already set) |
| A real phone on the same Wi-Fi as the server | `http://<the computer's IP>:3000`, e.g. `http://192.168.0.10:3000` |

Tap **Save address**, then **Test connection**. It will tell you plainly
whether it got through.

> **`localhost` will not work on a phone.** On a phone, `localhost` means the
> phone itself, and the phone is not running the server. Use the computer's
> address on the network. On Windows, `ipconfig` prints it; on macOS and
> Linux, `ifconfig` or `ip addr`.

### Getting an account

**If you already have one**, open the **Account** tab, type your email
address and password, and tap **Sign in**.

**If you don't**, either:

- fill in the **Create account** form: first name, last name, email address
  and a password of at least 8 characters with an uppercase letter and a
  number; or
- tap **Continue with Google** and pick an account. We never see your Google
  password. Google gives the app a signed token, and our server checks that
  token with Google before letting you in. If you don't see the button, this
  build has no Google sign-in configured; use the form instead.

Staff and administrator accounts cannot sign in here. The console lives on
the website, and this application has no administrative screens at all.

### Finding something

The five tabs along the bottom are the whole application.

| Tab | What it is for |
|---|---|
| **Shop** | Everything in stock, newest first. The chips along the top filter by brand and category. |
| **Search** | For when you know what you want. Type part of a brand or a description, then narrow by size or condition. |
| **Cart** | What you are about to buy. The badge is the number of items in it. |
| **Orders** | Everything you have bought, and where each parcel is. |
| **Account** | Signing in and out, and the way through to Settings and Help. |

Everything here is second-hand, so every piece carries a condition grade:

| Grade | What it means |
|---|---|
| **Excellent** | As new. No visible wear. |
| **Very Good** | Lightly worn. No marks. |
| **Good** | Worn. Small marks or fading, noted in the description. |
| **Fair** | Visible wear, priced to match. |

Read the description before buying anything graded Good or Fair, because that is
where a specific flaw is written down.

### Buying something

1. Tap a piece to open it. Check the size, the grade and the description.
2. Tap **Add to cart**.
3. Open the **Cart** tab and check the total.
4. Tap **Checkout**, choose a payment method, and tap **Place order**.
5. You will get a reference like `ORD-0007`. Keep it, because it is what support
   will ask for.

> **Adding something to your cart does not hold it for you.** Most pieces are
> one of a kind. Stock is only reserved when you place the order, so if two
> people check out at the same time the first one gets it and the second is
> told the item has gone. This is deliberate: a cart that reserved stock
> would let abandoned baskets take the shop's stock off sale.

### Tracking an order

The **Orders** tab lists everything you have bought, newest first, with the
stage it has reached:

| Stage | What is happening |
|---|---|
| **Processing** | We have your order and are picking and packing it. |
| **Shipped** | It is with the courier. Open the order for the courier reference. |
| **Delivered** | It has arrived. |
| **Cancelled** | The order was cancelled. Any payment is refunded. |

Open an order to see what is in it, what you paid, and the courier reference.

### Changing your settings

**Account → Settings.**

| Section | What it changes | Where it is kept |
|---|---|---|
| **Your details** | Name, phone number, delivery address | Your account, so the website shows the same details |
| **Password** | Your password. Asks for the current one first | Your account |
| **Appearance** | Light, dark, or follow the phone's setting | This phone only |
| **Notifications** | Order updates, new arrivals | This phone only |
| **Connection** | Which server the app talks to | This phone only |
| **Reset** | Clear cached data, sign out | This phone only |

Two things worth knowing:

- **There is no Password section if you signed in with Google.** Google holds
  your password, not us, so there is nothing here to change.
- **Clear cached data does not sign you out.** It empties the saved brand and
  category lists and forces a fresh fetch. Use it if a filter looks stale.

---

## Part 2: The website

Open `http://localhost:3000/` (or wherever the server is running).

The website does everything the application does, and adds the staff and
administrator console. The storefront works the same way: browse or search,
open a piece, add to cart, check out, track the order under **Orders**.

There is also an installable version at `/mobile`, which is the storefront
built as a Progressive Web App. It is a fallback for anyone who cannot
install the Android application.

---

## Part 3: For staff and administrators

Sign in on the website with a staff or administrator username. The **Admin
Console** appears in the navigation.

| Section | Who | What it does |
|---|---|---|
| **Dashboard** | Staff, Administrator | Sales and stock at a glance |
| **Listings** | Staff, Administrator | Add, edit and remove pieces |
| **Inventory** | Staff, Administrator | Stock levels, with out-of-stock flagged |
| **Process orders** | Staff, Administrator | Move an order along and record a courier reference |
| **Customers** | Administrator only | Customer accounts; suspend and reactivate |
| **Reports** | Staff, Administrator | Sales and inventory reporting |

### Moving an order along

Open **Process orders**, find the order, set its new status and, for
**Shipped**, enter the courier reference. Save. The customer sees the change
on their phone the next time they open the order; there is nothing to
synchronise, because both are reading the same database.

### Permissions are enforced on the server

The **Customers** section is only rendered for an administrator. That is a
convenience, not the control: the server refuses the request from any other
role even if the address is typed in by hand. The same is true of every
administrative action in the app and on the website.

---

## Part 4: When something goes wrong

### "Couldn't reach the server."

The app is pointed at the wrong address, or the server is not running.

1. **Account → Settings → Connection → Test connection.** It will say which.
2. Check the server is up: on the computer running it, `npm start` should be
   printing request lines.
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

### Demonstration accounts

| Role | Email / username | Password |
|---|---|---|
| Customer | `lerato.m@gmail.com` | `Password1` |
| Customer | `sipho.n@gmail.com` | `Password2` |
| Administrator | `admin` | `Admin@123` |
| Staff | `staff01` | `Staff@123` |

Staff and administrator accounts sign in on the website only.

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

`npm test` walks this same path automatically, in 70 checks.
