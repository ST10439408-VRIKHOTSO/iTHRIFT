## iTHRIFT 1.4.1: final release

The final version for XISD6329 Task 3, version 1.4.1 (build 9). Attached below are the
**signed release APK** (install it on any Android 7.0 or newer phone) and the **signed
Android App Bundle** (the file the Google Play Console takes).

### What is new since 1.3.4, the release we presented

**1.4.0: online payments.** Our innovative feature in this version.

- Checkout takes South African payment gateways in their test modes, on the website
  and in the app. **PayFast** (card, instant EFT, SnapScan, Zapper) works at once in its
  sandbox; **Ozow**, **Paystack** and **Yoco** switch on when their keys are set on the
  server. Bank transfer (EFT) stays.
- The customer pays on the provider's own page, so card and bank details never reach
  iTHRIFT. An order counts as paid only when the provider confirms it to the server,
  never because the customer came back to the site. **Pay now** makes a fresh link for
  an unpaid order.
- Staff **mark a bank transfer received**, and nothing can be shipped or collected
  before it is paid.

**1.4.1: a security and content audit.**

- Rate limits on sign-in, registration, password changes, checkout, payments and
  everything customers write; security headers with a Content-Security-Policy on every
  page; sessions end after 30 days without use; payment links are kept out of the log;
  Express 4.22.3 clears every `npm audit` finding.
- One review per customer per piece. The seeded sample reviews and questions are
  labelled **Sample** and left out of every rating.
- A Terms and conditions page; the privacy policy names the payment providers; the
  faint text colour now meets 4.5:1 contrast in both themes.
- Android: a release build refuses plain `http://`, backups are off and network
  logging is debug-only.

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
- **1.3.4** added Delete my account and a POPIA privacy policy, logging under named
  Logcat tags, and source references in the comments.
- **1.4.0** and **1.4.1**, above.

The full notes, and which features are our innovative ones, are in the
[README](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT#release-notes).

### Checks

374 automated checks pass on GitHub Actions: 53 Kotlin unit tests, 42 API unit tests,
179 end-to-end checks and 100 feature checks.
