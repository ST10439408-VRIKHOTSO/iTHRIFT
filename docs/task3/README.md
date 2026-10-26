# Task 3: final release, report and presentation

Everything for XISD6329 Task 3 that lives in the repository.

| What | Where |
|---|---|
| Script for the final demonstration video | [`video-script.md`](video-script.md) |
| Release notes for the final version, 1.3.4 | [`release-notes.md`](release-notes.md) and the [GitHub release](https://github.com/ST10439408-VRIKHOTSO/iTHRIFT/releases/tag/v1.3.4) |
| Google Play listing, graphics and upload steps | [`play-store/`](play-store/) |
| Screenshots of the app and the website (version 1.3.4) | [`figures/`](figures/), captioned below |
| Final report and presentation | Submitted on ARC; the report links back here |

The app screenshots were rendered by the screenshot test
(`app/src/test/java/com/ithrift/app/ScreenshotTest.kt`), which opens the real screens with
Robolectric against the API and the seeded database. The website screenshots were taken
in Microsoft Edge against the same server, at desktop width (1440 px) unless the name says
phone (390 px) or dark. Files named `hosted-` were taken from the hosted site on Render.

## Android app

| File | Caption |
|---|---|
| `app-01-home.png` | Home: the hero, stock figures and "Picked for your sizes" |
| `app-02-home-dark.png` | Home in the dark theme |
| `app-03-shop.png` | Shop: the catalogue with condition meters, filters and My sizes |
| `app-04-filters.png` | The combined filters sheet: category, size, condition, brand |
| `app-05-search.png` | Search: popular brands and categories |
| `app-06-product.png` | Product: photo, price, condition grade and the sizes in stock |
| `app-07-product-sale-dark.png` | A product on sale, dark theme: old price crossed out and the saving |
| `app-08-added-to-bag.png` | Added to the bag in size UK 8, with a toast to view the bag |
| `app-09-bag.png` | The bag with three pieces and the summary |
| `app-10-checkout.png` | Checkout: delivery method and the saved address |
| `app-11-checkout-collection.png` | Checkout with store collection: day and two-hour slot |
| `app-12-orders.png` | Orders list |
| `app-13-order-tracking.png` | Order detail: tracking timeline, courier reference and returns |
| `app-14-tax-invoice.png` | The tax invoice with VAT, ready to print or save as PDF |
| `app-15-wishlist.png` | Wishlist with price-drop badges |
| `app-16-compare.png` | Compare, empty state |
| `app-17-write-review.png` | Writing a review |
| `app-18-account.png` | Account hub: points, orders, wishlist, alerts, returns, help |
| `app-19-account-dark.png` | Account hub in the dark theme |
| `app-20-settings.png` | Settings: details and password |
| `app-20b-settings-delete-account.png` | Settings: Delete your account |
| `app-21-thrift-points.png` | Thrift Points: balance, tier and history |
| `app-22-notifications.png` | Notification centre |
| `app-23-sell-to-us.png` | Sell to us: offering a piece to the store |
| `app-24-help-centre.png` | Help centre with searchable answers |
| `app-25-support-message.png` | A conversation with the store |
| `app-26-sign-in.png` | Sign in, with Continue with Google |
| `app-27-register.png` | Create an account |
| `app-30-staff-dashboard.png` | Staff console: dashboard with what needs attention |
| `app-31-staff-dashboard-dark.png` | Staff dashboard in the dark theme |
| `app-32-staff-orders.png` | Staff: orders filtered to Processing |
| `app-33-staff-process-order.png` | Staff: processing a collection order |
| `app-34-staff-listings.png` | Staff: listings with stock per size |
| `app-35-staff-returns.png` | Staff: returns to approve or reject |
| `app-36-staff-buy-back.png` | Staff: buy-back offers from customers |
| `app-37-staff-promo-codes.png` | Staff: promo codes |

## Website

| File | Caption |
|---|---|
| `web-01-home.png` | Home page |
| `web-02-shop.png` | Shop with category chips and condition meters |
| `web-03-product.png` | Product page: sizes, delivery dates, share, compare and questions |
| `web-04-sale.png` | Sale: percentage off and old prices |
| `web-05-login.png` | Sign in, with Continue with Google |
| `web-06-register.png` | Create an account |
| `web-07-bag.png` | Bag with the running total |
| `web-08-checkout.png` | Checkout: delivery, address, promo code and points |
| `web-09-orders.png` | Orders list |
| `web-10-order-detail.png` | Order tracking and returns |
| `web-11-receipt.png` | Tax invoice |
| `web-12-account.png` | Account with the impact estimate |
| `web-13-settings.png` | Settings |
| `web-14-points.png` | Thrift Points |
| `web-15-notifications.png` | Notifications |
| `web-16-wishlist.png` | Wishlist with price drops |
| `web-17-compare.png` | Compare three pieces |
| `web-18-sell.png` | Sell to us |
| `web-19-help.png` | Help centre |
| `web-20-messages.png` | Messages with the store |
| `web-21-privacy.png` | Privacy policy |
| `web-22-settings-delete-account.png` | Settings: Delete your account |
| `web-23-delete-account-confirm.png` | The confirmation before an account is deleted |
| `web-30-admin-dashboard.png` | Staff dashboard: revenue, orders and what needs attention |
| `web-31-admin-orders.png` | Staff: orders |
| `web-32-admin-listings.png` | Staff: listings |
| `web-33-admin-inventory.png` | Staff: inventory, sold out and low stock |
| `web-34-admin-collections.png` | Staff: collections by day and slot |
| `web-35-admin-returns.png` | Staff: returns |
| `web-36-admin-questions.png` | Staff: product questions |
| `web-37-admin-sell.png` | Staff: buy-back offers |
| `web-38-admin-support.png` | Staff: support inbox |
| `web-39-admin-promos.png` | Staff: promo codes |
| `web-40-admin-customers.png` | Administrator: customers |
| `web-50-phone-home.png` to `web-54-phone-compare-tray.png` | The website on a phone: home, product, bag, account, compare tray |
| `web-60-dark-home.png` to `web-62-dark-admin.png` | The website in the dark theme |
| `hosted-01-home.png` | The hosted website on Render |
| `hosted-02-api.png` | The hosted REST API answering with its version and routes |
| `hosted-03-sso-status.png` | The hosted API reporting Google sign-in as enabled |
| `hosted-04-login.png` | Sign in on the hosted site, with Continue with Google |
| `readme-hero.png` | The banner at the top of the README |
