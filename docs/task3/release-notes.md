## iTHRIFT 1.3.4: final release

The final version for XISD6329 Task 3. Attached below are the **signed release APK**
(install it on any Android 7.0 or newer phone) and the **signed Android App Bundle**
(the file the Google Play Console takes).

### What is new in 1.3.4

- **Delete your account** on the website and in the app (Account, Settings). Personal
  details are erased at once and every session ends; orders are kept without them, as
  the law requires.
- A **privacy policy** at `#/privacy`, written for POPIA and linked from the footer,
  Settings and the Play Store listing.
- **Logging** across the app under named Logcat tags (`ApiCall`, `AppState`,
  `GoogleSignIn`, `Auth`, `Checkout`, `Orders`, `StaffConsole`, `Settings`), with no
  password, token or code ever logged.
- Source references in the comments of the Kotlin code and the server's security code.
- Compare holds three pieces on both clients, and the tray no longer wraps on a phone.

### Since the prototype (1.2.0)

- **1.3.0** rebuilt the website and staff console with a new design system and added
  thirty features, among them Thrift Points, Sell to us, price-drop and back-in-stock
  alerts, working-day delivery dates, collection slots, gift orders, a VAT tax invoice,
  an impact estimate and a full staff dashboard.
- **1.3.1** rebuilt the Android app in Jetpack Compose with every one of those features,
  the same design system as the website, and the staff console.
- **1.3.2** moved sign-in to email or cellphone number and required a cellphone number
  at registration.
- **1.3.3** made Continue with Google in the app sign in through the website with a
  single-use code bound to a secret only the app holds (PKCE, RFC 7636).

The full notes, and which features are our innovative ones, are in the
[README](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT#release-notes).

### Checks

323 automated checks pass on GitHub Actions: 53 Kotlin unit tests, 25 API unit tests,
150 end-to-end checks and 95 feature checks.
