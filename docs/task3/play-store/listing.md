# Google Play listing for iTHRIFT

Everything the Play Console asks for, ready to paste. The graphics in this folder are
the sizes Play requires.

| File | Play Console field | Size |
|---|---|---|
| `app-icon-512.png` | App icon | 512 x 512 PNG |
| `feature-graphic.png` | Feature graphic | 1024 x 500 PNG, no transparency |
| `phone-screenshot-1.png` to `phone-screenshot-6.png` | Phone screenshots | 1080 x 1920 PNG (9:16) |

## Store listing

**App name** (30 characters at most)

> iTHRIFT: Pre-loved Fashion

**Short description** (80 characters at most)

> Buy and sell graded, pre-loved branded clothing from our Pretoria store.

**Full description**

> iTHRIFT sells pre-loved branded clothing, shoes and accessories that our team has
> checked, cleaned, measured and graded by hand at our store in Hatfield, Pretoria.
>
> Every piece carries an honest condition grade, from Fair to Excellent, with any flaw
> written in the description, so you know exactly what arrives.
>
> - Filter by brand, category, size, condition and price, or tap My sizes.
> - See which sizes are in stock and when a piece will arrive, in working days.
> - Choose standard or express delivery, or free collection from our Pretoria store.
> - Track every order from packing to your door.
> - Save pieces and get an alert when the price drops or a size comes back.
> - Earn Thrift Points on every order and spend them at checkout.
> - Sell us your own clothes for cash or for points worth 20 percent more.
> - Sign in with your email, your cellphone number or your Google account.
> - Light and dark themes, larger text and reduced motion.
>
> Most pieces are one of a kind. When it is gone, it is gone.

**App category:** Shopping
**Tags:** Fashion, Second-hand, Clothing
**Contact email:** support@ithrift.co.za
**Phone:** 012 345 6789
**Website:** https://ithrift-api.onrender.com
**Privacy policy:** https://ithrift-api.onrender.com/#/privacy

## App content

**Privacy policy URL:** https://ithrift-api.onrender.com/#/privacy

**App access:** Some features need an account. Give the reviewers a test customer
account (register one on the website first) and say that Continue with Google works
with any Google account.

**Ads:** The app contains no ads.

**Content rating:** Complete the IARC questionnaire as a shopping app with no violence,
no sexual content, no gambling and no user-to-user chat (messages go only to the store).
The expected rating is Everyone / PEGI 3.

**Target audience:** 18 and over.

**Data safety** (what the app collects and why):

| Data | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Name | Yes | No | Account management, order fulfilment | No |
| Email address | Yes | No | Account management, sign-in | No |
| Phone number | Yes | No | Account management, order fulfilment | No |
| Address | Yes | No | Order fulfilment (delivery) | Yes (collection needs none) |
| Purchase history | Yes | No | App functionality, order fulfilment | No |
| Other user-generated content (reviews, questions, messages) | Yes | No | App functionality | Yes |

- Data is encrypted in transit (HTTPS): **Yes**.
- Users can request that their data is deleted: **Yes**. In the app under Account,
  Settings, Delete my account, and on the web at
  https://ithrift-api.onrender.com/#/privacy (section "Deleting your account").
- No location, contacts, photos, files, health, financial account numbers or device
  identifiers are collected. Payments are simulated in this version, so no card details
  are handled.

**Account deletion URL** (Play asks for this separately):
https://ithrift-api.onrender.com/#/privacy

## Uploading the release

1. Sign in to the Google Play Console with the developer account and choose
   **Create app**: name *iTHRIFT: Pre-loved Fashion*, default language English
   (South Africa), App, Free, and accept the declarations.
2. Under **Set up your app**, complete each item using the sections above: privacy
   policy, app access, ads, content rating, target audience, data safety, and the
   store listing with the graphics in this folder.
3. Download the signed App Bundle `app-release.aab` from the
   [v1.3.4 release](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases/tag/v1.3.4).
4. Go to **Test and release, Testing, Internal testing**, create a release, choose
   **Play App Signing** when asked (Google keeps the app signing key; our keystore
   becomes the upload key), upload `app-release.aab`, name the release 1.3.4 (7) and
   paste the release notes below.
5. Add testers by email, then **Review release** and **Start rollout to Internal
   testing**.
6. Take a screenshot of the release page showing version 1.3.4 (7) and its status, and
   of the app's dashboard. These are the evidence of the upload for the final report.

**Release notes for the Play Console** (500 characters at most)

> First release of iTHRIFT on Google Play. Shop graded, pre-loved branded clothing,
> track your orders, earn and spend Thrift Points, sell us your clothes, and sign in
> with Google. Delete your account at any time under Account, Settings.
