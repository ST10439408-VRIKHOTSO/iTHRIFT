# Demonstration video for version 1.3.4: script and shot list

About six minutes. Record the phone with its built-in screen recorder (on Samsung:
swipe down, **Screen recorder**, sound **None**), and the computer with the Windows
Snipping Tool's video mode or the Xbox Game Bar (Windows + G). Put the clips and the
voice-over together in **Clipchamp** (it comes with Windows 11), export at 1080p,
upload to YouTube as **Unlisted**, and put the link in the README under
*Demonstration video*.

A computer-generated voice-over for each scene is in the Task 3 folder under
`Demo video/voice-over/` (one WAV per scene, named by scene number). Each scene's
narration is also below, so you can record your own voice instead.

## Before recording

1. Open <https://ithrift-api.onrender.com> a minute before you start, so the free
   server is awake.
2. Install the signed APK from the
   [v1.3.4 release](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases/tag/v1.3.4)
   (uninstall any debug build first: the keys differ).
3. Have a customer account with a password, a Google account on the phone, and a staff
   or administrator account for the website.
4. For scene 9, have the Google Cloud console (Credentials), the Render dashboard
   (Logs), and a local copy of the seeded database open (`npm run init-db`, then open
   `data/ithrift.db` in DB Browser for SQLite).

## Scenes

### 1. Opening (0:00 to 0:20)

**Show:** the phone's home screen; open iTHRIFT; Account, Settings; scroll to the
version line at the bottom.

> This is iTHRIFT, version one point three point four, the final release of our
> XISD6329 project by Group 11, Vukosi Rikhotso and Theo Golele. It is running on a
> physical Android phone, not an emulator, and it talks to our hosted API. Settings
> shows the version and the build number.

### 2. Single sign-on (0:20 to 0:45)

**Show:** sign out; Sign in; **Continue with Google**; the browser tab and the account
chooser; back in the app, signed in.

> Customers sign in with an email or cellphone number and a password, or with Google.
> Continue with Google opens our website's sign-in in a browser tab. The server checks
> Google's token, then gives the app a single-use code that only works with a secret
> the app kept. The app swaps that code for an iTHRIFT session, so a token never
> travels in the link.

### 3. Finding pieces (0:45 to 1:35)

**Show:** Home and *Picked for your sizes*; Shop; **Filters** (a category, a size, a
condition, a brand); **My sizes**; Search with suggestions; tap compare on two pieces
and open Compare.

> The home screen picks pieces in the customer's own sizes. In the shop, filters
> combine: several brands, sizes and condition grades at once, with a price range and
> a sale switch. My sizes limits the shop to the sizes in the style profile. Search
> suggests pieces as you type, and compare puts up to three pieces side by side.

### 4. Deciding (1:35 to 2:05)

**Show:** a product: the photo zoom, the condition meter and *How we grade*, the
sizes in stock, the delivery dates, questions and reviews; save it to the wishlist.

> Every piece shows its condition grade on a four-step meter, and only the sizes that
> are in stock can be chosen. Delivery dates are counted in South African working
> days, skipping public holidays. Customers can read reviews, ask a question, or save
> the piece and be told when its price drops.

### 5. Buying (2:05 to 2:50)

**Show:** choose a size, **Add to bag**, the bag; Checkout: **Collect from the
Pretoria store**, a day and a two-hour slot; apply the code `WELCOME10`; spend Thrift
Points; **Place order**; the confirmation.

> At checkout the customer chooses standard or express delivery, or a free collection
> slot at the store. Promo codes and Thrift Points are applied by the server, which
> works out the total, so the figure on the button is the amount the order is placed
> for. Placing the order locks the stock, so the same one-off piece cannot be sold
> twice.

### 6. After buying (2:50 to 3:25)

**Show:** Orders; the new order's timeline; the tax invoice; a delivered order and
**Return this piece**; the notification centre and an alert.

> Every order has a timeline of its status changes. The tax invoice shows the VAT
> included and can be printed or saved as a PDF. A delivered piece can be returned
> within thirty days, and the notification centre collects order updates, price drops
> and back-in-stock alerts.

### 7. Account (3:25 to 4:10)

**Show:** Thrift Points and the tier; **Sell to us** (offer a piece); the help centre
search; a message to the store; Settings: dark theme and larger text.

> Customers earn a Thrift Point for every ten rand, move up from Bronze to Gold, and
> spend points at checkout. Sell to us lets them offer their own clothes for cash, or
> for points worth twenty percent more. The help centre answers common questions, and
> customers can message the store. Settings has light and dark themes, larger text and
> reduced motion.

### 8. Staff console (4:10 to 4:50)

**Show:** on the computer, sign in to the website as staff; the dashboard; Orders; open
the order from scene 5 and mark it **Ready to collect**; back on the phone, the
order's timeline has updated.

> Staff run the shop from the console on the website or in the app: the dashboard
> shows what needs attention, revenue and the return rate. Here the order we placed on
> the phone is marked ready to collect, and the customer's timeline updates at once,
> because both clients share one API and one database.

### 9. Behind the screens (4:50 to 5:35)

**Show:** the Google Cloud console Credentials page (the OAuth clients); the hosted
API's JSON at `/api`; the Render log for the requests just made; the database in DB
Browser for SQLite: the `Customer` table (salted password hashes, the Google customer
with no password) and the newest `Orders`; Android Studio's Logcat filtered by
`tag:ApiCall`.

> Behind the screens: Google holds the account, and these are the OAuth clients
> registered for iTHRIFT. This is the REST API answering in JSON, and the server's log
> line for each request, with its status, time and role. In the database, passwords
> are stored only as salted scrypt hashes, and a Google customer has no password at
> all. In the app, Logcat records every failed call with its HTTP status, and never a
> password or a token.

### 10. Privacy and close (5:35 to 6:00)

**Show:** the privacy policy at `/#/privacy`; Settings, **Delete my account** on a
throwaway account, and the confirmation.

> Finally, privacy. Our policy is written for POPIA, and customers can delete their
> account at any time, which Google Play requires. Their personal details are erased
> and every session ends, while the shop keeps its order records. Thank you for
> watching.
