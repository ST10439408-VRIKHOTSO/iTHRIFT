'use strict';

/**
 * Builds the iTHRIFT Clothes database from scratch and loads sample data.
 * Run with: npm run init-db
 *
 * The schema follows the Third Normal Form entity model from the System
 * Design document (Database Design section). SQLite is used as the data
 * tier so the prototype runs with zero external services. The design
 * itself is unchanged and a MySQL-equivalent schema is kept under
 * /database/mysql-schema.sql for production traceability.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./utils/password');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'ithrift.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Start from an empty database. Deleting the file is the simple way, but
// Windows refuses to delete a file that another program still has open (a
// server left running, or a database viewer). In that case the file is kept
// and emptied instead, which gives the same result.
let emptyInPlace = process.env.INIT_DB_IN_PLACE === '1';
if (fs.existsSync(DB_PATH) && !emptyInPlace) {
  try {
    fs.rmSync(DB_PATH);
  } catch (err) {
    console.log(`The database file is open in another program (${err.code}); emptying it in place instead.`);
    emptyInPlace = true;
  }
}

const db = new DatabaseSync(DB_PATH);
if (emptyInPlace) {
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = OFF;');
  const leftovers = db.prepare(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'view', 'trigger')"
  ).all();
  // Views and triggers first, so no table is dropped while something still refers to it.
  for (const kind of ['trigger', 'view', 'table']) {
    for (const row of leftovers.filter((r) => r.type === kind)) {
      db.exec(`DROP ${kind.toUpperCase()} IF EXISTS "${row.name}";`);
    }
  }
  db.exec('VACUUM;');
}
db.exec('PRAGMA foreign_keys = ON;');

console.log('Creating schema...');

db.exec(`
CREATE TABLE Brand (
  BrandID    INTEGER PRIMARY KEY AUTOINCREMENT,
  Name       TEXT NOT NULL UNIQUE
);

CREATE TABLE Category (
  CategoryID INTEGER PRIMARY KEY AUTOINCREMENT,
  Name       TEXT NOT NULL UNIQUE
);

CREATE TABLE Product (
  ProductID      INTEGER PRIMARY KEY AUTOINCREMENT,
  Name           TEXT NOT NULL,
  Description    TEXT NOT NULL,
  BrandID        INTEGER NOT NULL REFERENCES Brand(BrandID),
  CategoryID     INTEGER NOT NULL REFERENCES Category(CategoryID),
  Size           TEXT NOT NULL,
  ConditionGrade TEXT NOT NULL CHECK (ConditionGrade IN ('Excellent','Very Good','Good','Fair')),
  Price          NUMERIC NOT NULL CHECK (Price >= 0),
  -- Set when a piece is marked down: the price it was before the sale.
  OriginalPrice  NUMERIC CHECK (OriginalPrice IS NULL OR OriginalPrice > Price),
  StockQty       INTEGER NOT NULL DEFAULT 0 CHECK (StockQty >= 0),
  ImageFile      TEXT,
  CreatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PasswordHash/PasswordSalt are nullable because a customer who signs in
-- through single sign-on never chooses a password on this system; their
-- identity is proved by the provider instead. AuthProvider records which
-- of the two routes an account uses, and ProviderSubject holds the
-- provider's own immutable user id ("sub" in the Google ID token), which
-- is the correct key to match on, because an email address can be reassigned.
-- Each product's sizes and how many of each are in stock. Product.StockQty
-- is always the sum of these rows, so a product with two pieces left can
-- never offer more than two sizes.
CREATE TABLE ProductSize (
  ProductSizeID INTEGER PRIMARY KEY AUTOINCREMENT,
  ProductID     INTEGER NOT NULL REFERENCES Product(ProductID),
  Size          TEXT NOT NULL,
  StockQty      INTEGER NOT NULL DEFAULT 0 CHECK (StockQty >= 0),
  UNIQUE (ProductID, Size)
);

CREATE TABLE Customer (
  CustomerID      INTEGER PRIMARY KEY AUTOINCREMENT,
  FirstName       TEXT NOT NULL,
  LastName        TEXT NOT NULL,
  Email           TEXT NOT NULL UNIQUE,
  PasswordHash    TEXT,
  PasswordSalt    TEXT,
  AuthProvider    TEXT NOT NULL DEFAULT 'password' CHECK (AuthProvider IN ('password','google')),
  ProviderSubject TEXT UNIQUE,
  Phone           TEXT,
  AddressLine     TEXT,
  City            TEXT,
  PostalCode      TEXT,
  Status          TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active','suspended')),
  CreatedAt       TEXT NOT NULL DEFAULT (datetime('now')),
  -- A password account must carry a hash; an SSO account must carry a subject.
  CHECK (
    (AuthProvider = 'password' AND PasswordHash IS NOT NULL AND PasswordSalt IS NOT NULL)
    OR
    (AuthProvider = 'google' AND ProviderSubject IS NOT NULL)
  )
);

CREATE TABLE Admin (
  AdminID      INTEGER PRIMARY KEY AUTOINCREMENT,
  Username     TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  PasswordSalt TEXT NOT NULL,
  FullName     TEXT NOT NULL,
  Role         TEXT NOT NULL CHECK (Role IN ('admin','staff')),
  CreatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE Cart (
  CartID     INTEGER PRIMARY KEY AUTOINCREMENT,
  CustomerID INTEGER NOT NULL UNIQUE REFERENCES Customer(CustomerID),
  CreatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE CartItem (
  CartItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  CartID     INTEGER NOT NULL REFERENCES Cart(CartID),
  ProductID  INTEGER NOT NULL REFERENCES Product(ProductID),
  Size       TEXT,
  Quantity   INTEGER NOT NULL CHECK (Quantity > 0),
  UNIQUE (CartID, ProductID, Size)
);

-- Saved delivery addresses. One per customer is the default.
CREATE TABLE Address (
  AddressID   INTEGER PRIMARY KEY AUTOINCREMENT,
  CustomerID  INTEGER NOT NULL REFERENCES Customer(CustomerID),
  Label       TEXT NOT NULL,
  Recipient   TEXT NOT NULL,
  Phone       TEXT,
  Line1       TEXT NOT NULL,
  Suburb      TEXT,
  City        TEXT NOT NULL,
  PostalCode  TEXT NOT NULL CHECK (length(PostalCode) = 4),
  IsDefault   INTEGER NOT NULL DEFAULT 0 CHECK (IsDefault IN (0,1)),
  CreatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pieces a customer has saved for later.
CREATE TABLE WishlistItem (
  WishlistItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  CustomerID     INTEGER NOT NULL REFERENCES Customer(CustomerID),
  ProductID      INTEGER NOT NULL REFERENCES Product(ProductID),
  CreatedAt      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (CustomerID, ProductID)
);

CREATE TABLE PromoCode (
  PromoCodeID   INTEGER PRIMARY KEY AUTOINCREMENT,
  Code          TEXT NOT NULL UNIQUE,
  Description   TEXT NOT NULL,
  DiscountType  TEXT NOT NULL CHECK (DiscountType IN ('percent','fixed')),
  DiscountValue NUMERIC NOT NULL CHECK (DiscountValue > 0),
  MinSpend      NUMERIC NOT NULL DEFAULT 0 CHECK (MinSpend >= 0),
  Active        INTEGER NOT NULL DEFAULT 1 CHECK (Active IN (0,1))
);

CREATE TABLE Orders (
  OrderID     INTEGER PRIMARY KEY AUTOINCREMENT,
  CustomerID  INTEGER NOT NULL REFERENCES Customer(CustomerID),
  Status      TEXT NOT NULL DEFAULT 'Processing' CHECK (Status IN ('Processing','Shipped','Delivered','Cancelled')),
  -- TotalAmount = Subtotal - DiscountAmount + DeliveryFee, worked out on the server.
  Subtotal       NUMERIC NOT NULL DEFAULT 0 CHECK (Subtotal >= 0),
  DiscountAmount NUMERIC NOT NULL DEFAULT 0 CHECK (DiscountAmount >= 0),
  DeliveryFee    NUMERIC NOT NULL DEFAULT 0 CHECK (DeliveryFee >= 0),
  DeliveryMethod TEXT NOT NULL DEFAULT 'standard' CHECK (DeliveryMethod IN ('standard','express','collection')),
  PromoCode      TEXT,
  DeliveryAddress TEXT,
  DeliveryInstructions TEXT,
  TotalAmount NUMERIC NOT NULL CHECK (TotalAmount >= 0),
  CourierRef  TEXT,
  CreatedAt   TEXT NOT NULL DEFAULT (datetime('now')),
  UpdatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE OrderItem (
  OrderItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderID     INTEGER NOT NULL REFERENCES Orders(OrderID),
  ProductID   INTEGER NOT NULL REFERENCES Product(ProductID),
  Size        TEXT,
  Quantity    INTEGER NOT NULL CHECK (Quantity > 0),
  UnitPrice   NUMERIC NOT NULL CHECK (UnitPrice >= 0)
);

CREATE TABLE Payment (
  PaymentID INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderID   INTEGER NOT NULL UNIQUE REFERENCES Orders(OrderID),
  Method    TEXT NOT NULL CHECK (Method IN ('payfast','card','eft')),
  Status    TEXT NOT NULL CHECK (Status IN ('pending','paid','refunded')),
  Amount    NUMERIC NOT NULL CHECK (Amount >= 0),
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A return request for one line of a delivered order.
CREATE TABLE ReturnRequest (
  ReturnID     INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderItemID  INTEGER NOT NULL UNIQUE REFERENCES OrderItem(OrderItemID),
  CustomerID   INTEGER NOT NULL REFERENCES Customer(CustomerID),
  Reason       TEXT NOT NULL,
  Comment      TEXT,
  Status       TEXT NOT NULL DEFAULT 'Requested' CHECK (Status IN ('Requested','Approved','Rejected','Refunded')),
  RefundAmount NUMERIC NOT NULL DEFAULT 0 CHECK (RefundAmount >= 0),
  CreatedAt    TEXT NOT NULL DEFAULT (datetime('now')),
  UpdatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE Review (
  ReviewID   INTEGER PRIMARY KEY AUTOINCREMENT,
  ProductID  INTEGER NOT NULL REFERENCES Product(ProductID),
  CustomerID INTEGER NOT NULL REFERENCES Customer(CustomerID),
  Rating     INTEGER NOT NULL CHECK (Rating BETWEEN 1 AND 5),
  Comment    TEXT,
  CreatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_product_brand ON Product(BrandID);
CREATE INDEX idx_product_category ON Product(CategoryID);
CREATE INDEX idx_productsize_product ON ProductSize(ProductID);
CREATE INDEX idx_orderitem_order ON OrderItem(OrderID);
CREATE INDEX idx_cartitem_cart ON CartItem(CartID);
CREATE INDEX idx_review_product ON Review(ProductID);
`);

console.log('Seeding brands and categories...');

const brandNames = ['Adidas', 'Calvin Klein', 'Dickies', 'Generic', 'Guess', 'H&M', 'L.L.Bean', 'Mocome', 'Next', 'Nike', 'Puma', 'Tommy Hilfiger', 'Woolrich', 'Wrangler', 'Zara'];
const categoryNames = ['Accessories', 'Dresses', 'Footwear', 'Hoodies', 'Jackets', 'Jeans', 'Knitwear', 'Outerwear', 'Polos', 'Shirts', 'Tees', 'Trousers'];

const insertBrand = db.prepare('INSERT INTO Brand (Name) VALUES (?)');
const brandIds = {};
for (const name of brandNames) {
  const info = insertBrand.run(name);
  brandIds[name] = Number(info.lastInsertRowid);
}

const insertCategory = db.prepare('INSERT INTO Category (Name) VALUES (?)');
const categoryIds = {};
for (const name of categoryNames) {
  const info = insertCategory.run(name);
  categoryIds[name] = Number(info.lastInsertRowid);
}

console.log('Seeding products...');

const products = [
  { name: 'EQT Running Shoes', brand: 'Adidas', category: 'Footwear', size: 'UK 8', condition: 'Excellent', price: 899, stock: 2, desc: 'Adidas EQT running shoe in a soft grey knit upper with the classic red trim, barely creased.', image: 'adidas-eqt.jpg' },
  { name: 'Samba OG Trainers', brand: 'Adidas', category: 'Footwear', size: 'UK 9', condition: 'Very Good', price: 1099, stock: 3, desc: 'The Samba OG in navy suede and leather, gum sole shows light honest wear.', image: 'adidas-samba.jpg' },
  { name: 'Samba Suede Trainers', brand: 'Adidas', category: 'Footwear', size: 'UK 7', condition: 'Excellent', price: 1149, stock: 2, desc: 'White and green leather Samba with the classic gum outsole, crisp and clean.', image: 'adidas-samba2.jpg' },
  { name: 'Spezial Trainers', brand: 'Adidas', category: 'Footwear', size: 'UK 8', condition: 'Good', price: 949, stock: 1, desc: 'Taupe suede Spezial trainer with pink detailing, comfortable broken-in feel.', image: 'adidas-spezial.jpg' },
  { name: 'Ultraboost Sneakers', brand: 'Adidas', category: 'Footwear', size: 'UK 9', condition: 'Excellent', price: 1399, stock: 2, desc: 'Lightweight Ultraboost runner in lilac and coral, Boost midsole still springy.', image: 'adidas-ultraboost.jpg' },
  { name: 'Air Force 1 Low', brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Very Good', price: 1199, stock: 4, desc: 'The classic all-white Air Force 1 low, cleaned up with only light creasing on the toe box.', image: 'nike-airforce1.jpg' },
  { name: 'Air Max 90', brand: 'Nike', category: 'Footwear', size: 'UK 9', condition: 'Good', price: 999, stock: 2, desc: 'Black and white Air Max 90 with visible Air unit, honest wear on the sole.', image: 'nike-airmax90.jpg' },
  { name: 'Air Max 90 White', brand: 'Nike', category: 'Footwear', size: 'UK 7', condition: 'Excellent', price: 1049, stock: 2, desc: 'All-white Air Max 90, barely worn with a crisp midsole.', image: 'nike-airmax90-2.jpg' },
  { name: 'Dunk Low', brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Very Good', price: 1099, stock: 3, desc: 'Dunk Low in a deep green and black colourway, light scuffing on the toe only.', image: 'nike-dunklow.jpg' },
  { name: 'Air Jordan 1 Low', brand: 'Nike', category: 'Footwear', size: 'UK 9', condition: 'Good', price: 1299, stock: 1, desc: 'Low-top Air Jordan 1, comfortable with general signs of wear consistent with use.', image: 'nike-jordan1.jpg' },
  { name: 'Air Jordan 1 High \'85', brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Excellent', price: 1599, stock: 1, desc: 'High-top Air Jordan 1 in green and white with gold Wings hit, almost like new.', image: 'nike-jordan1-high.jpg' },
  { name: 'Suede Basket Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 7', condition: 'Very Good', price: 749, stock: 3, desc: 'Green and white Puma Suede with the classic basket silhouette, light wear on the sole.', image: 'puma-basket.jpg' },
  { name: 'Speedcat Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 8', condition: 'Excellent', price: 799, stock: 2, desc: 'Low-profile racing-inspired Speedcat in black with white Formstripe, hardly worn.', image: 'puma-speedcat.jpg' },
  { name: 'Speedcat Navy Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 9', condition: 'Very Good', price: 779, stock: 2, desc: 'Navy Speedcat with classic Puma stripe, comfortable everyday trainer.', image: 'puma-speedcat2.jpg' },
  { name: 'Suede Classic Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 8', condition: 'Good', price: 649, stock: 5, desc: 'The timeless suede low-top, cleaned and re-laced, honest signs of wear on the toe.', image: 'puma-suede.jpg' },
  { name: '3-Stripe Trefoil Tee', brand: 'Adidas', category: 'Tees', size: 'M', condition: 'Very Good', price: 280, stock: 6, desc: 'Classic black 3-Stripe tee with the Trefoil logo, soft cotton with light wash wear.', image: 'black-adidas-3stripe-tshirt.jpg' },
  { name: 'CK96 Graphic Tee', brand: 'Calvin Klein', category: 'Tees', size: 'L', condition: 'Excellent', price: 320, stock: 4, desc: 'Black crew-neck tee with the CK96 logo print across the chest, barely worn.', image: 'ck-graphictee.jpg' },
  { name: 'Long Sleeve Tee', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Very Good', price: 220, stock: 3, desc: 'Olive green long-sleeve cotton tee, simple and versatile, light fading.', image: 'green-long-sleeve-tshirt.jpg' },
  { name: 'Oversized Tee', brand: 'Generic', category: 'Tees', size: 'L', condition: 'Good', price: 199, stock: 4, desc: 'Washed grey oversized tee with a relaxed drop-shoulder fit.', image: 'grey-oversized-tshirt.jpg' },
  { name: 'Iconic Triangle Logo Tee', brand: 'Guess', category: 'Tees', size: 'M', condition: 'Excellent', price: 299, stock: 3, desc: 'White cotton tee with the iconic Guess triangle logo print, like new.', image: 'guess-iconictee.jpg' },
  { name: 'Triangle Logo Tee Black', brand: 'Guess', category: 'Tees', size: 'L', condition: 'Very Good', price: 289, stock: 2, desc: 'Black cotton tee with the classic Guess triangle logo, light wash wear only.', image: 'guess-tshirt.jpg' },
  { name: 'Money Is The Motive Graphic Tee', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Good', price: 179, stock: 2, desc: 'Cream oversized graphic tee with bold red and black print lettering.', image: 'money-is-the-motive-graphic-tshirt.jpg' },
  { name: '5-Pack Crew Tees', brand: 'Next', category: 'Tees', size: 'M', condition: 'Very Good', price: 399, stock: 1, desc: 'Set of five plain crew-neck tees in assorted colours, sold as one bundle.', image: 'multicolor-tshirt-5pack-next.jpg' },
  { name: 'Crew Tee Multipack', brand: 'Mocome', category: 'Tees', size: 'L', condition: 'Good', price: 349, stock: 1, desc: 'Assorted multipack of relaxed-fit crew tees in brown, teal, white and stone.', image: 'multicolor-tshirt-pack-mocome.jpg' },
  { name: 'V-Neck Tee', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Excellent', price: 189, stock: 4, desc: 'Olive green v-neck tee in soft cotton, minimal wear.', image: 'olive-vneck-tshirt.jpg' },
  { name: 'Plaid Cropped Shirt', brand: 'Generic', category: 'Tees', size: 'S', condition: 'Very Good', price: 259, stock: 2, desc: 'Short-sleeve cropped plaid shirt in rust and brown check, cute boxy fit.', image: 'red-plaid-cropped-shirt.jpg' },
  { name: 'Flag Logo Tee', brand: 'Tommy Hilfiger', category: 'Tees', size: 'M', condition: 'Excellent', price: 339, stock: 5, desc: 'Cream tee with the signature Tommy flag logo on the chest, excellent condition.', image: 'tommy-flagtee.jpg' },
  { name: 'Pique Polo Shirt', brand: 'Tommy Hilfiger', category: 'Tees', size: 'L', condition: 'Very Good', price: 359, stock: 3, desc: 'Classic navy pique polo with embroidered flag logo, light wear at the collar.', image: 'tommy-polo.jpg' },
  { name: 'Cotton Pique Golfer', brand: 'Generic', category: 'Tees', size: 'L', condition: 'Excellent', price: 249, stock: 3, desc: 'Coral cotton pique golf shirt with classic two-button placket, tag still attached.', image: 'woolworths-golfer.jpg' },
  { name: 'Tommy Hilfiger Tee', brand: 'Tommy Hilfiger', category: 'Tees', size: 'M', condition: 'Excellent', price: 329, stock: 2, desc: 'Black crew tee with embroidered Tommy Hilfiger wordmark, barely worn.', image: 'woolworths-shirt.jpg' },
  { name: 'Heritage Polo Shirt', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Very Good', price: 269, stock: 2, desc: 'Soft pink pique polo, classic fit with light pilling only.', image: 'pink-polo-shirt.jpg' },
  { name: 'Classic Polo Shirt', brand: 'Generic', category: 'Tees', size: 'L', condition: 'Excellent', price: 279, stock: 3, desc: 'Plain black pique polo, clean lines, like new.', image: 'black-polo-shirt.jpg' },
  { name: 'CK96 Crew Sweater', brand: 'Calvin Klein', category: 'Knitwear', size: 'M', condition: 'Excellent', price: 549, stock: 2, desc: 'Heavyweight grey crew sweater with the bold CK96 logo print, near-new.', image: 'ck-sweater.jpg' },
  { name: 'Faux-Fur Logo Jacket', brand: 'Guess', category: 'Knitwear', size: 'S', condition: 'Very Good', price: 699, stock: 1, desc: 'Black faux-fur zip-up with embroidered Guess wordmark on the hood, cosy and warm.', image: 'guess-jacket.jpg' },
  { name: 'Zip-Up Track Top', brand: 'Guess', category: 'Knitwear', size: 'M', condition: 'Good', price: 459, stock: 2, desc: 'Fitted black zip-up top with Guess script logo, light wear from regular use.', image: 'guess-zip.jpg' },
  { name: 'Mohair-Blend Jumper', brand: 'H&M', category: 'Knitwear', size: 'M', condition: 'Excellent', price: 489, stock: 2, desc: 'Camel mohair-blend jumper with a relaxed fit, soft and barely worn.', image: 'hm-knit.jpg' },
  { name: 'Turtleneck Knit Jumper', brand: 'H&M', category: 'Knitwear', size: 'L', condition: 'Very Good', price: 459, stock: 2, desc: 'Oatmeal turtleneck jumper in a chunky knit, warm and comfortable.', image: 'hm-knit2.jpg' },
  { name: 'Heritage Crest Sweatshirt', brand: 'Tommy Hilfiger', category: 'Knitwear', size: 'L', condition: 'Excellent', price: 599, stock: 2, desc: 'Cream crew sweatshirt with the Tommy Hilfiger flag crest, excellent condition.', image: 'tommy-heritage.jpg' },
  { name: 'Cable Knit Jumper', brand: 'Tommy Hilfiger', category: 'Knitwear', size: 'M', condition: 'Very Good', price: 629, stock: 1, desc: 'Navy cable-knit crew jumper with embroidered flag logo, classic preppy style.', image: 'tommy-knit.jpg' },
  { name: 'Fine Knit Jumper', brand: 'Generic', category: 'Knitwear', size: 'S', condition: 'Good', price: 379, stock: 2, desc: 'Light grey fine-knit jumper, soft and easy to layer, honest signs of wear.', image: 'woolworths-knits.jpg' },
  { name: 'V-Neck Wool Jumper', brand: 'Woolrich', category: 'Knitwear', size: 'L', condition: 'Very Good', price: 499, stock: 1, desc: 'Grey v-neck wool jumper with logo patch, warm midweight knit.', image: 'woolworths-sweater.jpg' },
  { name: 'Quilted Puffer Gilet', brand: 'Calvin Klein', category: 'Outerwear', size: 'M', condition: 'Excellent', price: 749, stock: 1, desc: 'Black quilted puffer gilet, lightweight warmth for layering, like new.', image: 'ck-gilet.jpg' },
  { name: 'Zip-Through Hoodie', brand: 'Calvin Klein', category: 'Outerwear', size: 'L', condition: 'Very Good', price: 599, stock: 2, desc: 'Black zip-up hoodie with embroidered CK logo on the chest, soft brushed fleece.', image: 'ck-zip.jpg' },
  { name: 'Tie-Waist Maxi Dress', brand: 'Generic', category: 'Dresses', size: 'M', condition: 'Excellent', price: 449, stock: 1, desc: 'Flowing beige maxi dress with a tie waist and bishop sleeves, elegant and barely worn.', image: 'woolworths-maxidress.jpg' },
  { name: 'Floral Halter Maxi Dress', brand: 'Zara', category: 'Dresses', size: 'S', condition: 'Very Good', price: 499, stock: 1, desc: 'Black and cream floral print dress with a halter neckline, statement piece.', image: 'zara-floraldress.jpg' },
  { name: 'Green Floral Slip Dress', brand: 'Zara', category: 'Dresses', size: 'S', condition: 'Excellent', price: 459, stock: 2, desc: 'Green ditsy floral slip dress with adjustable straps, light and breezy.', image: 'zara-floraldress2.jpg' },
  { name: 'Green Printed Shirt Dress', brand: 'Zara', category: 'Dresses', size: 'M', condition: 'Very Good', price: 479, stock: 1, desc: 'Button-through shirt dress in a green leaf print, short sleeves, lovely for summer.', image: 'zara-printeddress.jpg' },
  { name: 'Slim Chino Trousers', brand: 'Generic', category: 'Trousers', size: '32', condition: 'Excellent', price: 399, stock: 3, desc: 'Beige slim-fit chinos, smart-casual staple, barely worn.', image: 'beige-chino-trousers.jpg' },
  { name: 'Classic Chino Trousers', brand: 'Generic', category: 'Trousers', size: '34', condition: 'Very Good', price: 379, stock: 2, desc: 'Black straight-leg chinos, versatile and comfortable, light wear.', image: 'black-chino-trousers.jpg' },
  { name: 'Formal Dress Trousers', brand: 'Generic', category: 'Trousers', size: '32', condition: 'Excellent', price: 449, stock: 1, desc: 'Tailored black dress trousers with a flat front, smart finish.', image: 'black-formal-dress-trousers.jpg' },
  { name: 'Pleated Wool Trousers', brand: 'Generic', category: 'Trousers', size: '34', condition: 'Good', price: 369, stock: 1, desc: 'Brown pleated-front trousers in a wool blend, honest signs of wear.', image: 'brown-pleated-trousers.jpg' },
  { name: 'Workwear Chino Trousers', brand: 'Dickies', category: 'Trousers', size: '32', condition: 'Very Good', price: 429, stock: 2, desc: 'Olive Dickies workwear chinos, durable twill fabric, light fading.', image: 'olive-chino-trousers-dickies.jpg' },
  { name: 'Sage Green Chinos', brand: 'Generic', category: 'Trousers', size: '33', condition: 'Excellent', price: 409, stock: 2, desc: 'Sage green slim chinos, soft cotton twill, like new.', image: 'sage-green-chino-trousers.jpg' },
  { name: 'Slim Fit Jeans', brand: 'Wrangler', category: 'Jeans', size: '32', condition: 'Very Good', price: 449, stock: 2, desc: 'Light wash slim-fit jeans, comfortable stretch denim, light fading.', image: 'blue-slim-jeans-wrangler.jpg' },
  { name: 'Slim Fit Jeans Dark Wash', brand: 'Next', category: 'Jeans', size: '32', condition: 'Excellent', price: 429, stock: 2, desc: 'Dark indigo slim-fit jeans, barely worn with crisp stitching.', image: 'dark-blue-slim-jeans-next.jpg' },
  { name: 'Straight Leg Jeans', brand: 'Generic', category: 'Jeans', size: '32', condition: 'Good', price: 349, stock: 1, desc: 'Classic straight-leg dark denim, honest signs of regular wear.', image: 'dark-blue-straight-jeans.jpg' },
  { name: 'Straight Leg Jeans Medium Wash', brand: 'L.L.Bean', category: 'Jeans', size: '32', condition: 'Good', price: 449, stock: 1, desc: 'Medium blue straight-leg jeans, sturdy denim with classic five-pocket styling.', image: 'medium-blue-straight-jeans-llbean.jpg' },
  { name: 'Gold Clover & Mother of Pearl Bracelet', brand: 'Generic', category: 'Accessories', size: 'One Size', condition: 'Excellent', price: 349, stock: 2, desc: 'Gold-tone clover-link bracelet set with mother-of-pearl inlays, elegant and lightly worn.', image: 'gold-clover-bracelet-mother-of-pearl.jpg' },
  { name: 'Gold Diamond-Set Bangle Trio', brand: 'Generic', category: 'Accessories', size: 'One Size', condition: 'Excellent', price: 599, stock: 1, desc: 'Set of three gold-tone bangles, one fully pave-set, stackable and versatile.', image: 'gold-diamond-bangle-set.jpg' },
  { name: 'Malachite Clover Jewellery Set', brand: 'Generic', category: 'Accessories', size: 'One Size', condition: 'Excellent', price: 449, stock: 1, desc: 'Matching necklace, bracelet and earring set with green clover motifs in a gold setting.', image: 'green-malachite-clover-jewelry-set.jpg' },
  { name: 'Silver Cuban Link Bracelet', brand: 'Generic', category: 'Accessories', size: 'One Size', condition: 'Excellent', price: 299, stock: 3, desc: 'Chunky silver-tone Cuban link bracelet with a fold-over clasp.', image: 'silver-cuban-link-bracelet.jpg' },
  { name: 'Silver Diamond Halo Ring', brand: 'Generic', category: 'Accessories', size: 'One Size', condition: 'Excellent', price: 459, stock: 0, desc: 'Twist-shank ring with a halo-set centre stone in a silver-tone setting. This one-off piece has just sold.', image: 'silver-diamond-halo-ring.jpg' },
  { name: 'Silver Diamond Solitaire Ring', brand: 'Generic', category: 'Accessories', size: 'One Size', condition: 'Excellent', price: 429, stock: 1, desc: 'Classic four-prong solitaire ring with a pave-set band, timeless design.', image: 'silver-diamond-solitaire-ring.jpg' },
];

const insertProduct = db.prepare(`
  INSERT INTO Product (Name, Description, BrandID, CategoryID, Size, ConditionGrade, Price, StockQty, ImageFile)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Four categories were split out of the broader ones so that a shopper
 * filtering for a polo is not wading through sixteen t-shirts. The products
 * themselves are listed above with their original category, and this map
 * moves the affected ones at insert time; that keeps the change in one
 * readable place instead of scattered through sixty product literals.
 */
const CATEGORY_OVERRIDES = {
  'Classic Polo Shirt': 'Polos',
  'Heritage Polo Shirt': 'Polos',
  'Pique Polo Shirt': 'Polos',
  'Cotton Pique Golfer': 'Polos',
  'Plaid Cropped Shirt': 'Shirts',
  'Green Printed Shirt Dress': 'Shirts',
  'Zip-Through Hoodie': 'Hoodies',
  'Heritage Crest Sweatshirt': 'Hoodies',
  'Zip-Up Track Top': 'Hoodies',
  'Faux-Fur Logo Jacket': 'Jackets',
  'Quilted Puffer Gilet': 'Jackets',
};

/**
 * The size range each category is sold in. Shoes run UK 3 to UK 10, tops and
 * dresses XS to XXL, and trousers and jeans by waist from 28 to 44.
 */
const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SIZE_RANGES = {
  Footwear: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'],
  Tees: LETTER_SIZES, Shirts: LETTER_SIZES, Polos: LETTER_SIZES, Hoodies: LETTER_SIZES,
  Knitwear: LETTER_SIZES, Jackets: LETTER_SIZES, Outerwear: LETTER_SIZES, Dresses: LETTER_SIZES,
  Trousers: ['28', '30', '32', '34', '36', '38', '40', '42', '44'],
  Jeans: ['28', '30', '32', '34', '36', '38', '40', '42', '44'],
  Accessories: ['One Size'],
};

const insertSize = db.prepare('INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)');

/**
 * Spreads a product's stock across real sizes. Second-hand stock is mostly
 * one piece per size, so each piece gets its own size until the range runs
 * out, starting from the size the listing was photographed in and working
 * outwards. The number of sizes offered can therefore never exceed the number
 * of pieces in stock.
 */
function seedSizes(productId, category, listedSize, stock) {
  const range = SIZE_RANGES[category] || ['One Size'];
  if (stock <= 0) return;
  // Snap the listed size onto the range (e.g. a 33 waist becomes 32).
  let start = range.indexOf(listedSize);
  if (start < 0) {
    const n = parseInt(String(listedSize).replace(/\D/g, ''), 10);
    const nums = range.map((r) => parseInt(r.replace(/\D/g, ''), 10));
    start = Number.isNaN(n) ? Math.floor(range.length / 2)
      : nums.reduce((best, v, i) => (Math.abs(v - n) < Math.abs(nums[best] - n) ? i : best), 0);
  }
  const order = [range[start]];
  for (let step = 1; order.length < range.length; step++) {
    if (start + step < range.length) order.push(range[start + step]);
    if (start - step >= 0) order.push(range[start - step]);
  }
  const chosen = order.slice(0, Math.min(stock, range.length));
  const qty = Object.fromEntries(chosen.map((size) => [size, 1]));
  for (let left = stock - chosen.length, i = 0; left > 0; left--, i++) qty[chosen[i % chosen.length]] += 1;
  for (const size of range) if (qty[size]) insertSize.run(productId, size, qty[size]);
}

const productIds = [];
for (const p of products) {
  const imagePath = '/images/products/' + p.image;
  const category = CATEGORY_OVERRIDES[p.name] || p.category;
  const info = insertProduct.run(
    p.name, p.desc, brandIds[p.brand], categoryIds[category], p.size, p.condition, p.price, p.stock, imagePath
  );
  const id = Number(info.lastInsertRowid);
  productIds.push({ id, ...p, category, image: imagePath });
  seedSizes(id, category, p.size, p.stock);
}


/**
 * Markdowns. Each listed piece keeps its current selling price and gains the
 * price it was before the sale, so the shop can show the saving honestly.
 */
const SALE_ORIGINAL_PRICES = {
  'Ultraboost Sneakers': 1799, 'Air Max 90 White': 1299, 'Suede Classic Sneakers': 899,
  'Mohair-Blend Jumper': 699, 'Heritage Crest Sweatshirt': 749, 'Faux-Fur Logo Jacket': 1199,
  'Slim Fit Jeans Dark Wash': 549, 'Workwear Chino Trousers': 499, 'Green Floral Slip Dress': 699,
  'Oversized Tee': 349, 'Pique Polo Shirt': 449, 'Silver Cuban Link Bracelet': 399,
};
const setOriginalPrice = db.prepare('UPDATE Product SET OriginalPrice = ? WHERE ProductID = ? AND Price < ?');
for (const p of productIds) {
  const original = SALE_ORIGINAL_PRICES[p.name];
  if (original) setOriginalPrice.run(original, p.id, original);
}

console.log('Seeding customers...');

/**
 * Twelve customers. The module requires at least ten rows in every table, so
 * the demonstration data is sized to that rather than to the three accounts
 * the walk-through actually uses. The first three are the documented demo
 * accounts and keep their original passwords, so anything written down
 * elsewhere still works.
 *
 * These people are invented. The names, addresses and numbers are simulated
 * data for assessment; no real customer's details appear anywhere in this
 * repository.
 */
const customers = [
  { first: 'Lerato', last: 'Mokoena', email: 'lerato.m@gmail.com', password: 'Password1', phone: '082 555 0101', address: '14 Jacaranda Street', city: 'Pretoria', postal: '0181' },
  { first: 'Sipho', last: 'Ndlovu', email: 'sipho.n@gmail.com', password: 'Password2', phone: '083 555 0202', address: '8 Church Street', city: 'Centurion', postal: '0157' },
  { first: 'Amahle', last: 'Dube', email: 'amahle.d@gmail.com', password: 'Password3', phone: '084 555 0303', address: '21 Brooklyn Road', city: 'Pretoria', postal: '0011' },
  { first: 'Thabo', last: 'Molefe', email: 'thabo.molefe@gmail.com', password: 'Password4', phone: '072 555 0404', address: '5 Lynnwood Ridge', city: 'Pretoria', postal: '0081' },
  { first: 'Nandi', last: 'Zulu', email: 'nandi.zulu@outlook.com', password: 'Password5', phone: '076 555 0505', address: '112 Hatfield Square', city: 'Pretoria', postal: '0028' },
  { first: 'Kagiso', last: 'Sithole', email: 'kagiso.s@gmail.com', password: 'Password6', phone: '081 555 0606', address: '3 Menlyn Close', city: 'Pretoria', postal: '0063' },
  { first: 'Zanele', last: 'Mahlangu', email: 'zanele.m@gmail.com', password: 'Password7', phone: '073 555 0707', address: '48 Rooihuiskraal Road', city: 'Centurion', postal: '0157' },
  { first: 'Tshepo', last: 'Radebe', email: 'tshepo.r@outlook.com', password: 'Password8', phone: '079 555 0808', address: '27 Sunnyside Avenue', city: 'Pretoria', postal: '0002' },
  { first: 'Palesa', last: 'Nkosi', email: 'palesa.nkosi@gmail.com', password: 'Password9', phone: '074 555 0909', address: '9 Waterkloof Heights', city: 'Pretoria', postal: '0181' },
  { first: 'Bongani', last: 'Khoza', email: 'bongani.k@gmail.com', password: 'Password10', phone: '083 555 1010', address: '61 Wonderboom Road', city: 'Pretoria', postal: '0182' },
  { first: 'Refilwe', last: 'Motaung', email: 'refilwe.m@outlook.com', password: 'Password11', phone: '071 555 1111', address: '15 Garsfontein Drive', city: 'Pretoria', postal: '0042' },
  { first: 'Ayanda', last: 'Mthembu', email: 'ayanda.mthembu@gmail.com', password: 'Password12', phone: '078 555 1212', address: '33 Highveld Boulevard', city: 'Centurion', postal: '0169' },
];

const insertCustomer = db.prepare(`
  INSERT INTO Customer (FirstName, LastName, Email, PasswordHash, PasswordSalt, Phone, AddressLine, City, PostalCode)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertCart = db.prepare('INSERT INTO Cart (CustomerID) VALUES (?)');

const customerIds = [];
for (const c of customers) {
  const { hash, salt } = hashPassword(c.password);
  const info = insertCustomer.run(c.first, c.last, c.email, hash, salt, c.phone, c.address, c.city, c.postal);
  const id = Number(info.lastInsertRowid);
  customerIds.push(id);
  insertCart.run(id); // every customer gets an empty cart on creation
}

console.log('Seeding addresses...');

const insertAddress = db.prepare(`
  INSERT INTO Address (CustomerID, Label, Recipient, Phone, Line1, Suburb, City, PostalCode, IsDefault)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// Every customer's own address becomes their default delivery address.
customers.forEach((c, i) => {
  insertAddress.run(customerIds[i], 'Home', `${c.first} ${c.last}`, c.phone, c.address, null, c.city, c.postal, 1);
});
// A few customers also deliver to campus or work.
insertAddress.run(customerIds[0], 'Campus', 'Lerato Mokoena', '082 555 0101', 'IIE Rosebank College, 248 Lynnwood Road', 'Menlo Park', 'Pretoria', '0081', 0);
insertAddress.run(customerIds[1], 'Work', 'Sipho Ndlovu', '083 555 0202', '1 Centurion Lane', 'Highveld', 'Centurion', '0157', 0);
insertAddress.run(customerIds[2], 'Res', 'Amahle Dube', '084 555 0303', 'Tuks Res, Lynnwood Road', 'Hatfield', 'Pretoria', '0083', 0);

console.log('Seeding promo codes...');

const insertPromo = db.prepare(`
  INSERT INTO PromoCode (Code, Description, DiscountType, DiscountValue, MinSpend, Active) VALUES (?, ?, ?, ?, ?, ?)
`);
[
  ['WELCOME10', '10% off your order', 'percent', 10, 0, 1],
  ['STUDENT15', '15% off orders of R300 or more', 'percent', 15, 300, 1],
  ['THRIFT50', 'R50 off orders of R500 or more', 'fixed', 50, 500, 1],
  ['SNEAKER100', 'R100 off orders of R1,000 or more', 'fixed', 100, 1000, 1],
  ['WINTER20', '20% off orders of R800 or more', 'percent', 20, 800, 1],
  ['PRELOVED25', 'R25 off orders of R200 or more', 'fixed', 25, 200, 1],
  ['FIRSTORDER', 'R75 off orders of R400 or more', 'fixed', 75, 400, 1],
  ['SAVE5', '5% off any order', 'percent', 5, 0, 1],
  ['BIGSPEND200', 'R200 off orders of R2,000 or more', 'fixed', 200, 2000, 1],
  ['SPRING12', '12% off orders of R600 or more', 'percent', 12, 600, 1],
  ['SUMMER30', '30% off (campaign ended)', 'percent', 30, 0, 0],
].forEach((row) => insertPromo.run(...row));

console.log('Seeding staff and administrator accounts...');

/**
 * Ten staff and administrator accounts, again to meet the ten-row minimum.
 * `admin` and `staff01` are the documented demo accounts; the rest are the
 * counter and stockroom staff across the two Pretoria branches. Only two
 * hold the administrator role, because the console's destructive actions
 * (suspending a customer, deleting a listing) should not be within reach of
 * every till operator.
 */
const staffAccounts = [
  { username: 'admin', password: 'Admin@123', fullName: 'Naledi Khumalo', role: 'admin' },
  { username: 'staff01', password: 'Staff@123', fullName: 'Kabelo Tau', role: 'staff' },
  { username: 'staff02', password: 'Staff@234', fullName: 'Dineo Mabaso', role: 'staff' },
  { username: 'staff03', password: 'Staff@345', fullName: 'Sizwe Ngcobo', role: 'staff' },
  { username: 'staff04', password: 'Staff@456', fullName: 'Karabo Pillay', role: 'staff' },
  { username: 'staff05', password: 'Staff@567', fullName: 'Lindiwe Botha', role: 'staff' },
  { username: 'staff06', password: 'Staff@678', fullName: 'Mpho Jacobs', role: 'staff' },
  { username: 'staff07', password: 'Staff@789', fullName: 'Sanele Adams', role: 'staff' },
  { username: 'staff08', password: 'Staff@890', fullName: 'Thandeka Naidoo', role: 'staff' },
  { username: 'admin02', password: 'Admin@234', fullName: 'Johan van Wyk', role: 'admin' },
];

const insertAdmin = db.prepare(`
  INSERT INTO Admin (Username, PasswordHash, PasswordSalt, FullName, Role)
  VALUES (?, ?, ?, ?, ?)
`);
for (const a of staffAccounts) {
  const { hash, salt } = hashPassword(a.password);
  insertAdmin.run(a.username, hash, salt, a.fullName, a.role);
}

console.log('Seeding orders, payments and reviews...');

const insertOrder = db.prepare(`
  INSERT INTO Orders (CustomerID, Status, Subtotal, DeliveryMethod, DeliveryAddress, TotalAmount, CourierRef, CreatedAt, UpdatedAt)
  VALUES (?, ?, ?, 'standard', ?, ?, ?, datetime('now', ?), datetime('now', ?))
`);
const addressTextFor = db.prepare(`
  SELECT Recipient || ', ' || Line1 || ', ' || City || ', ' || PostalCode AS text
  FROM Address WHERE CustomerID = ? AND IsDefault = 1
`);
const insertOrderItem = db.prepare(`
  INSERT INTO OrderItem (OrderID, ProductID, Size, Quantity, UnitPrice) VALUES (?, ?, ?, ?, ?)
`);
const insertPayment = db.prepare(`
  INSERT INTO Payment (OrderID, Method, Status, Amount) VALUES (?, ?, ?, ?)
`);
const decrementStock = db.prepare('UPDATE Product SET StockQty = StockQty - ? WHERE ProductID = ?');
const firstSizeWithStock = db.prepare('SELECT Size FROM ProductSize WHERE ProductID = ? AND StockQty >= ? ORDER BY ProductSizeID LIMIT 1');
const decrementSize = db.prepare('UPDATE ProductSize SET StockQty = StockQty - ? WHERE ProductID = ? AND Size = ?');

function findProduct(name) {
  const p = productIds.find((x) => x.name === name);
  if (!p) throw new Error(`Seed data error: product "${name}" not found`);
  return p;
}

function placeSeedOrder({ customerId, items, status, method, paymentStatus, daysAgo }) {
  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const offset = `-${daysAgo} days`;
  const address = addressTextFor.get(customerId);
  const info = insertOrder.run(customerId, status, total, address ? address.text : null, total,
    status === 'Shipped' || status === 'Delivered' ? `CR-${1000 + customerId}` : null, offset, offset);
  const orderId = Number(info.lastInsertRowid);
  for (const it of items) {
    const sizeRow = firstSizeWithStock.get(it.productId, it.qty);
    const size = sizeRow ? sizeRow.Size : null;
    insertOrderItem.run(orderId, it.productId, size, it.qty, it.unitPrice);
    decrementStock.run(it.qty, it.productId);
    if (size) decrementSize.run(it.qty, it.productId, size);
  }
  insertPayment.run(orderId, method, paymentStatus, total);
  return orderId;
}
const seededOrderIds = [];

/**
 * Twelve orders across four statuses and all three payment methods.
 *
 * The spread is deliberate rather than decorative. The staff console's order
 * queue, the status filter, the sales report and the app's order tracker are
 * all only worth looking at if there is something in every state, and a
 * demonstration that shows four Processing orders and nothing else proves
 * none of them work. Ages run from twelve weeks back to yesterday so the
 * "last 30 days" figures on the dashboard are not the same as the totals.
 *
 * `product` names are looked up rather than hard-coded ids, so re-ordering
 * the product list above cannot silently point an order at the wrong item.
 */
const seedOrders = [
  { customer: 0, products: ['Air Force 1 Low', 'Slim Chino Trousers'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 84 },
  { customer: 1, products: ['Cable Knit Jumper'], status: 'Delivered', method: 'payfast', payment: 'paid', daysAgo: 61 },
  { customer: 3, products: ['Samba OG Trainers', 'Flag Logo Tee'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 45 },
  { customer: 4, products: ['Tie-Waist Maxi Dress'], status: 'Delivered', method: 'eft', payment: 'paid', daysAgo: 38 },
  { customer: 5, products: ['Air Max 90', 'Oversized Tee', 'Straight Leg Jeans'], status: 'Delivered', method: 'payfast', payment: 'paid', daysAgo: 27 },
  { customer: 6, products: ['Silver Cuban Link Bracelet'], status: 'Cancelled', method: 'eft', payment: 'pending', daysAgo: 22 },
  { customer: 7, products: ['Zip-Through Hoodie', 'Classic Chino Trousers'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 18 },
  { customer: 8, products: ['Floral Halter Maxi Dress', 'Fine Knit Jumper'], status: 'Shipped', method: 'payfast', payment: 'paid', daysAgo: 11 },
  { customer: 9, products: ['Dunk Low'], status: 'Shipped', method: 'card', payment: 'paid', daysAgo: 7 },
  { customer: 2, products: ["Air Jordan 1 High '85", 'CK96 Crew Sweater'], status: 'Processing', method: 'eft', payment: 'pending', daysAgo: 3 },
  { customer: 10, products: ['Heritage Polo Shirt', 'Sage Green Chinos'], status: 'Processing', method: 'card', payment: 'paid', daysAgo: 2 },
  { customer: 11, products: ['Speedcat Sneakers'], status: 'Processing', method: 'payfast', payment: 'paid', daysAgo: 1 },
  // Older delivered orders, so that the returns history has something to show.
  { customer: 0, products: ['3-Stripe Trefoil Tee'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 150 },
  { customer: 1, products: ['CK96 Graphic Tee', 'Classic Polo Shirt'], status: 'Delivered', method: 'payfast', payment: 'paid', daysAgo: 132 },
  { customer: 2, products: ['V-Neck Tee'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 118 },
  { customer: 3, products: ['Cotton Pique Golfer'], status: 'Delivered', method: 'eft', payment: 'paid', daysAgo: 104 },
  { customer: 4, products: ['Suede Basket Sneakers'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 96 },
  { customer: 5, products: ['Long Sleeve Tee', 'Iconic Triangle Logo Tee'], status: 'Delivered', method: 'payfast', payment: 'paid', daysAgo: 20 },
  { customer: 8, products: ['Tommy Hilfiger Tee'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 14 },
  { customer: 10, products: ['Money Is The Motive Graphic Tee'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 9 },
  // Recent deliveries with no return yet, so the demo accounts can try a return.
  // (Well-stocked pieces, so seeding these does not sell anything out.)
  { customer: 1, products: ['3-Stripe Trefoil Tee'], status: 'Delivered', method: 'card', payment: 'paid', daysAgo: 8 },
  { customer: 0, products: ['Suede Classic Sneakers', 'Flag Logo Tee'], status: 'Delivered', method: 'payfast', payment: 'paid', daysAgo: 5 },
];

for (const order of seedOrders) {
  seededOrderIds.push(placeSeedOrder({
    customerId: customerIds[order.customer],
    items: order.products.map((name) => {
      const product = findProduct(name);
      return { productId: product.id, qty: 1, unitPrice: product.price };
    }),
    status: order.status,
    method: order.method,
    paymentStatus: order.payment,
    daysAgo: order.daysAgo,
  }));
}

console.log('Seeding open carts...');

/**
 * Baskets left mid-shop. Real stores always have some, and the cart tables
 * would otherwise be empty in a demonstration until somebody adds an item by
 * hand. Each of these customers can sign in and find their basket waiting.
 */
const insertCartItem = db.prepare(`
  INSERT INTO CartItem (CartID, ProductID, Size, Quantity) VALUES (?, ?, ?, ?)
`);
const cartIdFor = db.prepare('SELECT CartID FROM Cart WHERE CustomerID = ?');

const openCarts = [
  { customer: 0, products: ['V-Neck Wool Jumper', 'Straight Leg Jeans Medium Wash'] },
  { customer: 2, products: ['Suede Classic Sneakers'] },
  { customer: 4, products: ['Green Floral Slip Dress', 'Gold Clover & Mother of Pearl Bracelet'] },
  { customer: 5, products: ['Pleated Wool Trousers'] },
  { customer: 7, products: ['Turtleneck Knit Jumper', 'Plaid Cropped Shirt'] },
  { customer: 9, products: ['Spezial Trainers', 'Long Sleeve Tee'] },
  { customer: 11, products: ['Silver Diamond Halo Ring', 'Quilted Puffer Gilet'] },
];

for (const cart of openCarts) {
  const { CartID } = cartIdFor.get(customerIds[cart.customer]);
  for (const name of cart.products) {
    const product = findProduct(name);
    const sizeRow = firstSizeWithStock.get(product.id, 1);
    insertCartItem.run(CartID, product.id, sizeRow ? sizeRow.Size : null, 1);
  }
}

console.log('Seeding wishlists...');

const insertWish = db.prepare('INSERT INTO WishlistItem (CustomerID, ProductID) VALUES (?, ?)');
[
  [0, 'Ultraboost Sneakers'], [0, 'Faux-Fur Logo Jacket'], [0, 'Green Floral Slip Dress'],
  [1, 'Air Max 90 White'], [1, 'Mohair-Blend Jumper'], [2, 'Suede Classic Sneakers'],
  [2, 'Slim Fit Jeans Dark Wash'], [3, 'Heritage Crest Sweatshirt'], [4, 'Pique Polo Shirt'],
  [5, 'Workwear Chino Trousers'], [6, 'Oversized Tee'], [7, 'Silver Cuban Link Bracelet'],
  [8, 'Dunk Low'], [9, 'Samba Suede Trainers'],
].forEach(([customer, name]) => insertWish.run(customerIds[customer], findProduct(name).id));

console.log('Seeding returns...');

/**
 * Ten return requests on delivered order lines, in every state, so the
 * customer's returns history and the staff returns queue both have work in
 * them. A refunded return puts the piece back on sale in its size.
 */
const RETURN_REASONS = ["Doesn't fit", 'Not as described', 'Damaged or faulty', 'Changed my mind', 'Wrong item received'];
const deliveredLines = db.prepare(`
  SELECT oi.OrderItemID, oi.ProductID, oi.Size, oi.Quantity, oi.UnitPrice, o.CustomerID
  FROM OrderItem oi JOIN Orders o ON o.OrderID = oi.OrderID
  WHERE o.Status = 'Delivered' ORDER BY oi.OrderItemID LIMIT 10
`).all();
const insertReturn = db.prepare(`
  INSERT INTO ReturnRequest (OrderItemID, CustomerID, Reason, Comment, Status, RefundAmount, CreatedAt, UpdatedAt)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
`);
const restockProduct = db.prepare('UPDATE Product SET StockQty = StockQty + ? WHERE ProductID = ?');
const restockSize = db.prepare(`
  INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)
  ON CONFLICT (ProductID, Size) DO UPDATE SET StockQty = StockQty + excluded.StockQty
`);
const RETURN_STATUSES = ['Refunded', 'Rejected', 'Approved', 'Requested', 'Refunded', 'Requested', 'Approved', 'Rejected', 'Refunded', 'Requested'];
const RETURN_COMMENTS = [
  'Runs a size small.', 'The fade was worse than in the photos.', 'Seam came apart on first wear.', null,
  'Received a different colourway.', 'Too long in the sleeves.', null, 'Changed my mind after delivery.', 'Sole is separating.', null,
];
deliveredLines.forEach((line, i) => {
  const status = RETURN_STATUSES[i];
  const refund = status === 'Refunded' || status === 'Approved' ? line.UnitPrice * line.Quantity : 0;
  const age = `-${40 - i * 3} days`;
  insertReturn.run(line.OrderItemID, line.CustomerID, RETURN_REASONS[i % RETURN_REASONS.length], RETURN_COMMENTS[i], status, refund, age, age);
  if (status === 'Refunded') {
    restockProduct.run(line.Quantity, line.ProductID);
    if (line.Size) restockSize.run(line.ProductID, line.Size, line.Quantity);
  }
});

console.log('Seeding reviews...');

const insertReview = db.prepare(`
  INSERT INTO Review (ProductID, CustomerID, Rating, Comment) VALUES (?, ?, ?, ?)
`);

/**
 * Fifteen reviews, and not all of them are five stars.
 *
 * A catalogue where every rating is perfect tells a shopper nothing, and it
 * hides the bug where the star widget cannot render three. The low ratings
 * here are also the honest ones for second-hand stock: the complaint is
 * almost always that a Good or Fair piece was more worn than the photographs
 * suggested, which is exactly what the condition grade is meant to prevent.
 */
const reviews = [
  { product: 'Air Force 1 Low', customer: 0, rating: 5, comment: 'Looked exactly like the photos and arrived really well packaged. Great find!' },
  { product: 'Slim Chino Trousers', customer: 0, rating: 4, comment: 'Lovely fit, slightly more worn than I expected but still great value.' },
  { product: 'Cable Knit Jumper', customer: 1, rating: 5, comment: 'Barely worn, smells fresh, fits true to size. Will shop here again.' },
  { product: 'Samba OG Trainers', customer: 3, rating: 5, comment: 'Gum sole is barely marked. For the price of one new pair I got these and a tee.' },
  { product: 'Flag Logo Tee', customer: 3, rating: 3, comment: 'Graded Good and it is Good, but the print has cracked a little. Fair enough for the price.' },
  { product: 'Tie-Waist Maxi Dress', customer: 4, rating: 4, comment: 'Beautiful fabric. Runs slightly small, size up if you are between sizes.' },
  { product: 'Air Max 90', customer: 5, rating: 5, comment: 'Cleaner in person than in the listing. Delivered to Centurion in two days.' },
  { product: 'Oversized Tee', customer: 5, rating: 4, comment: 'Exactly the oversized fit I wanted. Would have liked more photos of the back.' },
  { product: 'Straight Leg Jeans', customer: 5, rating: 2, comment: 'Hem was frayed in a way the photographs did not show. Support sorted it out but check yours.' },
  { product: 'Zip-Through Hoodie', customer: 7, rating: 5, comment: 'Thick and warm, no bobbling at all. Hard to believe it is second hand.' },
  { product: 'Classic Chino Trousers', customer: 7, rating: 4, comment: 'Good honest condition, pressed and ready to wear.' },
  { product: 'Floral Halter Maxi Dress', customer: 8, rating: 5, comment: 'Wore it to a wedding and got three compliments. Nobody guessed it was pre-loved.' },
  { product: 'Fine Knit Jumper', customer: 8, rating: 3, comment: 'Fine but there is a small pull on the sleeve that was not mentioned.' },
  { product: 'Dunk Low', customer: 9, rating: 5, comment: 'Sizing advice on the listing was spot on. Very happy.' },
  { product: 'Heritage Polo Shirt', customer: 10, rating: 4, comment: 'Collar still stands up properly, which is rare second hand. Good buy.' },
];

for (const review of reviews) {
  insertReview.run(findProduct(review.product).id, customerIds[review.customer], review.rating, review.comment);
}

// A seed script that quietly under-fills a table is worse than one that
// fails, because the gap is only found during the demonstration. The module
// requires at least ten rows in every table, so that is checked here rather
// than trusted.
const MINIMUM_ROWS = 10;
const tables = ['Brand', 'Category', 'Product', 'ProductSize', 'Customer', 'Address', 'Admin', 'Cart', 'CartItem',
  'WishlistItem', 'PromoCode', 'Orders', 'OrderItem', 'Payment', 'ReturnRequest', 'Review'];
const counts = {};
const shortfall = [];

for (const table of tables) {
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get();
  counts[table] = total;
  if (total < MINIMUM_ROWS) shortfall.push(`${table} (${total})`);
}

console.log('Database created at', DB_PATH);
console.log('Seed summary:', tables.map((t) => `${counts[t]} ${t}`).join(', ') + '.');

if (shortfall.length > 0) {
  console.error(`\nThese tables hold fewer than ${MINIMUM_ROWS} rows: ${shortfall.join(', ')}.`);
  db.close();
  process.exit(1);
}

db.close();
