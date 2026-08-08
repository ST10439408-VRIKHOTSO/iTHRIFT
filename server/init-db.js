'use strict';

/**
 * Builds the iTHRIFT Clothes database from scratch and loads sample data.
 * Run with: npm run init-db
 *
 * The schema follows the Third Normal Form entity model from the System
 * Design document (Database Design section). SQLite is used as the data
 * tier so the prototype runs with zero external services - the design
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
if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
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
  StockQty       INTEGER NOT NULL DEFAULT 0 CHECK (StockQty >= 0),
  ImageFile      TEXT,
  CreatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE Customer (
  CustomerID   INTEGER PRIMARY KEY AUTOINCREMENT,
  FirstName    TEXT NOT NULL,
  LastName     TEXT NOT NULL,
  Email        TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  PasswordSalt TEXT NOT NULL,
  Phone        TEXT,
  AddressLine  TEXT,
  City         TEXT,
  PostalCode   TEXT,
  Status       TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active','suspended')),
  CreatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
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
  Quantity   INTEGER NOT NULL CHECK (Quantity > 0),
  UNIQUE (CartID, ProductID)
);

CREATE TABLE Orders (
  OrderID     INTEGER PRIMARY KEY AUTOINCREMENT,
  CustomerID  INTEGER NOT NULL REFERENCES Customer(CustomerID),
  Status      TEXT NOT NULL DEFAULT 'Processing' CHECK (Status IN ('Processing','Shipped','Delivered','Cancelled')),
  TotalAmount NUMERIC NOT NULL CHECK (TotalAmount >= 0),
  CourierRef  TEXT,
  CreatedAt   TEXT NOT NULL DEFAULT (datetime('now')),
  UpdatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE OrderItem (
  OrderItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderID     INTEGER NOT NULL REFERENCES Orders(OrderID),
  ProductID   INTEGER NOT NULL REFERENCES Product(ProductID),
  Quantity    INTEGER NOT NULL CHECK (Quantity > 0),
  UnitPrice   NUMERIC NOT NULL CHECK (UnitPrice >= 0)
);

CREATE TABLE Payment (
  PaymentID INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderID   INTEGER NOT NULL UNIQUE REFERENCES Orders(OrderID),
  Method    TEXT NOT NULL CHECK (Method IN ('payfast','card','eft')),
  Status    TEXT NOT NULL CHECK (Status IN ('pending','paid')),
  Amount    NUMERIC NOT NULL CHECK (Amount >= 0),
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
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
CREATE INDEX idx_orderitem_order ON OrderItem(OrderID);
CREATE INDEX idx_cartitem_cart ON CartItem(CartID);
CREATE INDEX idx_review_product ON Review(ProductID);
`);

console.log('Seeding brands and categories...');

const brandNames = ['Adidas', 'Calvin Klein', 'Dickies', 'Generic', 'Guess', 'H&M', 'L.L.Bean', 'Mocome', 'Next', 'Nike', 'Puma', 'Tommy Hilfiger', 'Woolrich', 'Wrangler', 'Zara'];
const categoryNames = ['Accessories', 'Dresses', 'Footwear', 'Jeans', 'Knitwear', 'Outerwear', 'Tees', 'Trousers'];

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
  { name: 'EQT Running Shoes', brand: 'Adidas', category: 'Footwear', size: 'UK 8', condition: 'Excellent', price: 899, stock: 2, desc: 'Adidas EQT running shoe in a soft grey knit upper with the classic red trim, barely creased.', image: 'adidas_eqt.jpg' },
  { name: 'Samba OG Trainers', brand: 'Adidas', category: 'Footwear', size: 'UK 9', condition: 'Very Good', price: 1099, stock: 3, desc: 'The Samba OG in navy suede and leather, gum sole shows light honest wear.', image: 'adidas_samba.jpg' },
  { name: 'Samba Suede Trainers', brand: 'Adidas', category: 'Footwear', size: 'UK 7', condition: 'Excellent', price: 1149, stock: 2, desc: 'White and green leather Samba with the classic gum outsole, crisp and clean.', image: 'adidas_samba2.jpg' },
  { name: 'Spezial Trainers', brand: 'Adidas', category: 'Footwear', size: 'UK 8', condition: 'Good', price: 949, stock: 1, desc: 'Taupe suede Spezial trainer with pink detailing, comfortable broken-in feel.', image: 'adidas_spezial.jpg' },
  { name: 'Ultraboost Sneakers', brand: 'Adidas', category: 'Footwear', size: 'UK 9', condition: 'Excellent', price: 1399, stock: 2, desc: 'Lightweight Ultraboost runner in lilac and coral, Boost midsole still springy.', image: 'adidas_ultraboost.jpg' },
  { name: 'Air Force 1 Low', brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Very Good', price: 1199, stock: 4, desc: 'The classic all-white Air Force 1 low, cleaned up with only light creasing on the toe box.', image: 'nike_airforce1.jpg' },
  { name: 'Air Max 90', brand: 'Nike', category: 'Footwear', size: 'UK 9', condition: 'Good', price: 999, stock: 2, desc: 'Black and white Air Max 90 with visible Air unit, honest wear on the sole.', image: 'nike_airmax90.jpg' },
  { name: 'Air Max 90 White', brand: 'Nike', category: 'Footwear', size: 'UK 7', condition: 'Excellent', price: 1049, stock: 2, desc: 'All-white Air Max 90, barely worn with a crisp midsole.', image: 'nike_airmax90_2.jpg' },
  { name: 'Dunk Low', brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Very Good', price: 1099, stock: 3, desc: 'Dunk Low in a deep green and black colourway, light scuffing on the toe only.', image: 'nike_dunklow.jpg' },
  { name: 'Air Jordan 1 Low', brand: 'Nike', category: 'Footwear', size: 'UK 9', condition: 'Good', price: 1299, stock: 1, desc: 'Low-top Air Jordan 1, comfortable with general signs of wear consistent with use.', image: 'nike_jordan1.jpg' },
  { name: 'Air Jordan 1 High \'85', brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Excellent', price: 1599, stock: 1, desc: 'High-top Air Jordan 1 in green and white with gold Wings hit, almost like new.', image: 'nike_jordan1_high.jpg' },
  { name: 'Suede Basket Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 7', condition: 'Very Good', price: 749, stock: 3, desc: 'Green and white Puma Suede with the classic basket silhouette, light wear on the sole.', image: 'puma_basket.jpg' },
  { name: 'Speedcat Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 8', condition: 'Excellent', price: 799, stock: 2, desc: 'Low-profile racing-inspired Speedcat in black with white Formstripe, hardly worn.', image: 'puma_speedcat.jpg' },
  { name: 'Speedcat Navy Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 9', condition: 'Very Good', price: 779, stock: 2, desc: 'Navy Speedcat with classic Puma stripe, comfortable everyday trainer.', image: 'puma_speedcat2.jpg' },
  { name: 'Suede Classic Sneakers', brand: 'Puma', category: 'Footwear', size: 'UK 8', condition: 'Good', price: 649, stock: 5, desc: 'The timeless suede low-top, cleaned and re-laced, honest signs of wear on the toe.', image: 'puma_suede.jpg' },
  { name: '3-Stripe Trefoil Tee', brand: 'Adidas', category: 'Tees', size: 'M', condition: 'Very Good', price: 280, stock: 6, desc: 'Classic black 3-Stripe tee with the Trefoil logo, soft cotton with light wash wear.', image: 'black-adidas-3stripe-tshirt.jpg' },
  { name: 'CK96 Graphic Tee', brand: 'Calvin Klein', category: 'Tees', size: 'L', condition: 'Excellent', price: 320, stock: 4, desc: 'Black crew-neck tee with the CK96 logo print across the chest, barely worn.', image: 'ck_graphictee.jpg' },
  { name: 'Long Sleeve Tee', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Very Good', price: 220, stock: 3, desc: 'Olive green long-sleeve cotton tee, simple and versatile, light fading.', image: 'green-long-sleeve-tshirt.jpg' },
  { name: 'Oversized Tee', brand: 'Generic', category: 'Tees', size: 'L', condition: 'Good', price: 199, stock: 4, desc: 'Washed grey oversized tee with a relaxed drop-shoulder fit.', image: 'grey-oversized-tshirt.jpg' },
  { name: 'Iconic Triangle Logo Tee', brand: 'Guess', category: 'Tees', size: 'M', condition: 'Excellent', price: 299, stock: 3, desc: 'White cotton tee with the iconic Guess triangle logo print, like new.', image: 'guess_iconictee.jpg' },
  { name: 'Triangle Logo Tee Black', brand: 'Guess', category: 'Tees', size: 'L', condition: 'Very Good', price: 289, stock: 2, desc: 'Black cotton tee with the classic Guess triangle logo, light wash wear only.', image: 'guess_tshirt.jpg' },
  { name: 'Money Is The Motive Graphic Tee', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Good', price: 179, stock: 2, desc: 'Cream oversized graphic tee with bold red and black print lettering.', image: 'money-is-the-motive-graphic-tshirt.jpg' },
  { name: '5-Pack Crew Tees', brand: 'Next', category: 'Tees', size: 'M', condition: 'Very Good', price: 399, stock: 1, desc: 'Set of five plain crew-neck tees in assorted colours, sold as one bundle.', image: 'multicolor-tshirt-5pack-next.jpg' },
  { name: 'Crew Tee Multipack', brand: 'Mocome', category: 'Tees', size: 'L', condition: 'Good', price: 349, stock: 1, desc: 'Assorted multipack of relaxed-fit crew tees in brown, teal, white and stone.', image: 'multicolor-tshirt-pack-mocome.jpg' },
  { name: 'V-Neck Tee', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Excellent', price: 189, stock: 4, desc: 'Olive green v-neck tee in soft cotton, minimal wear.', image: 'olive-vneck-tshirt.jpg' },
  { name: 'Plaid Cropped Shirt', brand: 'Generic', category: 'Tees', size: 'S', condition: 'Very Good', price: 259, stock: 2, desc: 'Short-sleeve cropped plaid shirt in rust and brown check, cute boxy fit.', image: 'red-plaid-cropped-shirt.jpg' },
  { name: 'Flag Logo Tee', brand: 'Tommy Hilfiger', category: 'Tees', size: 'M', condition: 'Excellent', price: 339, stock: 5, desc: 'Cream tee with the signature Tommy flag logo on the chest, excellent condition.', image: 'tommy_flagtee.jpg' },
  { name: 'Pique Polo Shirt', brand: 'Tommy Hilfiger', category: 'Tees', size: 'L', condition: 'Very Good', price: 359, stock: 3, desc: 'Classic navy pique polo with embroidered flag logo, light wear at the collar.', image: 'tommy_polo.jpg' },
  { name: 'Cotton Pique Golfer', brand: 'Generic', category: 'Tees', size: 'L', condition: 'Excellent', price: 249, stock: 3, desc: 'Coral cotton pique golf shirt with classic two-button placket, tag still attached.', image: 'woolworths_golfer.jpg' },
  { name: 'Tommy Hilfiger Tee', brand: 'Tommy Hilfiger', category: 'Tees', size: 'M', condition: 'Excellent', price: 329, stock: 2, desc: 'Black crew tee with embroidered Tommy Hilfiger wordmark, barely worn.', image: 'woolworths_shirt.jpg' },
  { name: 'Heritage Polo Shirt', brand: 'Generic', category: 'Tees', size: 'M', condition: 'Very Good', price: 269, stock: 2, desc: 'Soft pink pique polo, classic fit with light pilling only.', image: 'pink-polo-shirt.jpg' },
  { name: 'Classic Polo Shirt', brand: 'Generic', category: 'Tees', size: 'L', condition: 'Excellent', price: 279, stock: 3, desc: 'Plain black pique polo, clean lines, like new.', image: 'black-polo-shirt.jpg' },
  { name: 'CK96 Crew Sweater', brand: 'Calvin Klein', category: 'Knitwear', size: 'M', condition: 'Excellent', price: 549, stock: 2, desc: 'Heavyweight grey crew sweater with the bold CK96 logo print, near-new.', image: 'ck_sweater.jpg' },
  { name: 'Faux-Fur Logo Jacket', brand: 'Guess', category: 'Knitwear', size: 'S', condition: 'Very Good', price: 699, stock: 1, desc: 'Black faux-fur zip-up with embroidered Guess wordmark on the hood, cosy and warm.', image: 'guess_jacket.jpg' },
  { name: 'Zip-Up Track Top', brand: 'Guess', category: 'Knitwear', size: 'M', condition: 'Good', price: 459, stock: 2, desc: 'Fitted black zip-up top with Guess script logo, light wear from regular use.', image: 'guess_zip.jpg' },
  { name: 'Mohair-Blend Jumper', brand: 'H&M', category: 'Knitwear', size: 'M', condition: 'Excellent', price: 489, stock: 2, desc: 'Camel mohair-blend jumper with a relaxed fit, soft and barely worn.', image: 'hm_knit.jpg' },
  { name: 'Turtleneck Knit Jumper', brand: 'H&M', category: 'Knitwear', size: 'L', condition: 'Very Good', price: 459, stock: 2, desc: 'Oatmeal turtleneck jumper in a chunky knit, warm and comfortable.', image: 'hm_knit2.jpg' },
  { name: 'Heritage Crest Sweatshirt', brand: 'Tommy Hilfiger', category: 'Knitwear', size: 'L', condition: 'Excellent', price: 599, stock: 2, desc: 'Cream crew sweatshirt with the Tommy Hilfiger flag crest, excellent condition.', image: 'tommy_heritage.jpg' },
  { name: 'Cable Knit Jumper', brand: 'Tommy Hilfiger', category: 'Knitwear', size: 'M', condition: 'Very Good', price: 629, stock: 1, desc: 'Navy cable-knit crew jumper with embroidered flag logo, classic preppy style.', image: 'tommy_knit.jpg' },
  { name: 'Fine Knit Jumper', brand: 'Generic', category: 'Knitwear', size: 'S', condition: 'Good', price: 379, stock: 2, desc: 'Light grey fine-knit jumper, soft and easy to layer, honest signs of wear.', image: 'woolworths_knits.jpg' },
  { name: 'V-Neck Wool Jumper', brand: 'Woolrich', category: 'Knitwear', size: 'L', condition: 'Very Good', price: 499, stock: 1, desc: 'Grey v-neck wool jumper with logo patch, warm midweight knit.', image: 'woolworths_sweater.jpg' },
  { name: 'Quilted Puffer Gilet', brand: 'Calvin Klein', category: 'Outerwear', size: 'M', condition: 'Excellent', price: 749, stock: 1, desc: 'Black quilted puffer gilet, lightweight warmth for layering, like new.', image: 'ck_gilet.jpg' },
  { name: 'Zip-Through Hoodie', brand: 'Calvin Klein', category: 'Outerwear', size: 'L', condition: 'Very Good', price: 599, stock: 2, desc: 'Black zip-up hoodie with embroidered CK logo on the chest, soft brushed fleece.', image: 'ck_zip.jpg' },
  { name: 'Tie-Waist Maxi Dress', brand: 'Generic', category: 'Dresses', size: 'M', condition: 'Excellent', price: 449, stock: 1, desc: 'Flowing beige maxi dress with a tie waist and bishop sleeves, elegant and barely worn.', image: 'woolworths_maxidress.jpg' },
  { name: 'Floral Halter Maxi Dress', brand: 'Zara', category: 'Dresses', size: 'S', condition: 'Very Good', price: 499, stock: 1, desc: 'Black and cream floral print dress with a halter neckline, statement piece.', image: 'zara_floraldress.jpg' },
  { name: 'Green Floral Slip Dress', brand: 'Zara', category: 'Dresses', size: 'S', condition: 'Excellent', price: 459, stock: 2, desc: 'Green ditsy floral slip dress with adjustable straps, light and breezy.', image: 'zara_floraldress2.jpg' },
  { name: 'Green Printed Shirt Dress', brand: 'Zara', category: 'Dresses', size: 'M', condition: 'Very Good', price: 479, stock: 1, desc: 'Button-through shirt dress in a green leaf print, short sleeves, lovely for summer.', image: 'zara_printeddress.jpg' },
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

const productIds = [];
for (const p of products) {
  const imagePath = '/images/products/' + p.image;
  const info = insertProduct.run(
    p.name, p.desc, brandIds[p.brand], categoryIds[p.category], p.size, p.condition, p.price, p.stock, imagePath
  );
  const id = Number(info.lastInsertRowid);
  productIds.push({ id, ...p, image: imagePath });
}


console.log('Seeding customers...');

const customers = [
  { first: 'Lerato', last: 'Mokoena', email: 'lerato.m@gmail.com', password: 'Password1', phone: '082 555 0101', address: '14 Jacaranda Street', city: 'Pretoria', postal: '0181' },
  { first: 'Sipho', last: 'Ndlovu', email: 'sipho.n@gmail.com', password: 'Password2', phone: '083 555 0202', address: '8 Church Street', city: 'Centurion', postal: '0157' },
  { first: 'Amahle', last: 'Dube', email: 'amahle.d@gmail.com', password: 'Password3', phone: '084 555 0303', address: '21 Brooklyn Road', city: 'Pretoria', postal: '0011' },
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

console.log('Seeding staff and administrator accounts...');

const staffAccounts = [
  { username: 'admin', password: 'Admin@123', fullName: 'Naledi Khumalo', role: 'admin' },
  { username: 'staff01', password: 'Staff@123', fullName: 'Kabelo Tau', role: 'staff' },
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
  INSERT INTO Orders (CustomerID, Status, TotalAmount, CourierRef, CreatedAt, UpdatedAt)
  VALUES (?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
`);
const insertOrderItem = db.prepare(`
  INSERT INTO OrderItem (OrderID, ProductID, Quantity, UnitPrice) VALUES (?, ?, ?, ?)
`);
const insertPayment = db.prepare(`
  INSERT INTO Payment (OrderID, Method, Status, Amount) VALUES (?, ?, ?, ?)
`);
const decrementStock = db.prepare('UPDATE Product SET StockQty = StockQty - ? WHERE ProductID = ?');

function findProduct(name) {
  const p = productIds.find((x) => x.name === name);
  if (!p) throw new Error(`Seed data error: product "${name}" not found`);
  return p;
}

function placeSeedOrder({ customerId, items, status, method, paymentStatus, daysAgo }) {
  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const offset = `-${daysAgo} days`;
  const info = insertOrder.run(customerId, status, total, status === 'Shipped' || status === 'Delivered' ? `CR-${1000 + customerId}` : null, offset, offset);
  const orderId = Number(info.lastInsertRowid);
  for (const it of items) {
    insertOrderItem.run(orderId, it.productId, it.qty, it.unitPrice);
    decrementStock.run(it.qty, it.productId);
  }
  insertPayment.run(orderId, method, paymentStatus, total);
  return orderId;
}

// Order 1: delivered, paid by card
placeSeedOrder({
  customerId: customerIds[0],
  items: [
    { productId: findProduct('Air Force 1 Low').id, qty: 1, unitPrice: findProduct('Air Force 1 Low').price },
    { productId: findProduct('Slim Chino Trousers').id, qty: 1, unitPrice: findProduct('Slim Chino Trousers').price },
  ],
  status: 'Delivered',
  method: 'card',
  paymentStatus: 'paid',
  daysAgo: 12,
});

// Order 2: shipped, paid via PayFast
placeSeedOrder({
  customerId: customerIds[1],
  items: [
    { productId: findProduct('Cable Knit Jumper').id, qty: 1, unitPrice: findProduct('Cable Knit Jumper').price },
  ],
  status: 'Shipped',
  method: 'payfast',
  paymentStatus: 'paid',
  daysAgo: 4,
});

// Order 3: processing, EFT pending
placeSeedOrder({
  customerId: customerIds[2],
  items: [
    { productId: findProduct("Air Jordan 1 High '85").id, qty: 1, unitPrice: findProduct("Air Jordan 1 High '85").price },
    { productId: findProduct('CK96 Crew Sweater').id, qty: 1, unitPrice: findProduct('CK96 Crew Sweater').price },
  ],
  status: 'Processing',
  method: 'eft',
  paymentStatus: 'pending',
  daysAgo: 1,
});

const insertReview = db.prepare(`
  INSERT INTO Review (ProductID, CustomerID, Rating, Comment) VALUES (?, ?, ?, ?)
`);
insertReview.run(findProduct('Air Force 1 Low').id, customerIds[0], 5, 'Looked exactly like the photos and arrived really well packaged. Great find!');
insertReview.run(findProduct('Slim Chino Trousers').id, customerIds[0], 4, 'Lovely fit, slightly more worn than I expected but still great value.');
insertReview.run(findProduct('Cable Knit Jumper').id, customerIds[1], 5, 'Barely worn, smells fresh, fits true to size. Will shop here again.');


console.log('Database created at', DB_PATH);
console.log('Seed summary: 15 brands, 8 categories, 63 products, 3 customers, 3 orders, 3 payments, 3 reviews, 2 staff/admin accounts.');

db.close();
