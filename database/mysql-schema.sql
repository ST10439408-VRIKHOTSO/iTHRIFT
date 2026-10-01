-- =============================================================================
-- iTHRIFT Clothes: MySQL 8.x production schema
-- =============================================================================
-- This is the production-equivalent of the SQLite schema the prototype
-- actually runs on (see server/init-db.js). It is kept here for traceability
-- back to the System Design document, which specifies MySQL as the data
-- tier. The table shapes, keys and Third Normal Form structure are
-- identical; only SQLite-specific syntax (AUTOINCREMENT, CHECK placement)
-- is adjusted for MySQL. Note: SQLite treats the word ORDER as reserved,
-- so the prototype names the table `Orders`, and this MySQL schema keeps the
-- same name for consistency between the two.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS ithrift_clothes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ithrift_clothes;

CREATE TABLE Brand (
  BrandID    INT AUTO_INCREMENT PRIMARY KEY,
  Name       VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE Category (
  CategoryID INT AUTO_INCREMENT PRIMARY KEY,
  Name       VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE Product (
  ProductID      INT AUTO_INCREMENT PRIMARY KEY,
  Name           VARCHAR(120) NOT NULL,
  Description    TEXT NOT NULL,
  BrandID        INT NOT NULL,
  CategoryID     INT NOT NULL,
  Size           VARCHAR(20) NOT NULL,
  ConditionGrade ENUM('Excellent','Very Good','Good','Fair') NOT NULL,
  Price          DECIMAL(10,2) NOT NULL CHECK (Price >= 0),
  OriginalPrice  DECIMAL(10,2) NULL,  -- set when the item is on sale; must be above Price
  StockQty       INT NOT NULL DEFAULT 0 CHECK (StockQty >= 0),
  ImageFile      VARCHAR(255),
  CreatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (BrandID) REFERENCES Brand(BrandID),
  FOREIGN KEY (CategoryID) REFERENCES Category(CategoryID),
  CHECK (OriginalPrice IS NULL OR OriginalPrice > Price),
  INDEX idx_product_brand (BrandID),
  INDEX idx_product_category (CategoryID)
) ENGINE=InnoDB;

-- PasswordHash/PasswordSalt are nullable because a customer who signs in
-- through single sign-on never chooses a password on this system; their
-- identity is proved by the provider instead. AuthProvider records which
-- of the two routes an account uses, and ProviderSubject holds the
-- provider's own immutable user id ("sub" in the Google ID token), which
-- is the correct key to match on, because an email address can be reassigned.
-- Sizes per product and the stock held in each. Product.StockQty is the sum.
CREATE TABLE ProductSize (
  ProductSizeID INT AUTO_INCREMENT PRIMARY KEY,
  ProductID     INT NOT NULL,
  Size          VARCHAR(20) NOT NULL,
  StockQty      INT NOT NULL DEFAULT 0 CHECK (StockQty >= 0),
  UNIQUE KEY uq_product_size (ProductID, Size),
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
) ENGINE=InnoDB;

CREATE TABLE Customer (
  CustomerID      INT AUTO_INCREMENT PRIMARY KEY,
  FirstName       VARCHAR(60) NOT NULL,
  LastName        VARCHAR(60) NOT NULL,
  Email           VARCHAR(120) NOT NULL UNIQUE,
  PasswordHash    CHAR(128),
  PasswordSalt    CHAR(32),
  AuthProvider    ENUM('password','google') NOT NULL DEFAULT 'password',
  ProviderSubject VARCHAR(255) UNIQUE,
  Phone           VARCHAR(30),
  AddressLine     VARCHAR(150),
  City            VARCHAR(60),
  PostalCode      VARCHAR(10),
  Status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  CreatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- A password account must carry a hash; an SSO account must carry a subject.
  CONSTRAINT chk_customer_credentials CHECK (
    (AuthProvider = 'password' AND PasswordHash IS NOT NULL AND PasswordSalt IS NOT NULL)
    OR
    (AuthProvider = 'google' AND ProviderSubject IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE Admin (
  AdminID      INT AUTO_INCREMENT PRIMARY KEY,
  Username     VARCHAR(60) NOT NULL UNIQUE,
  PasswordHash CHAR(128) NOT NULL,
  PasswordSalt CHAR(32) NOT NULL,
  FullName     VARCHAR(120) NOT NULL,
  Role         ENUM('admin','staff') NOT NULL,
  CreatedAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Cart (
  CartID     INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID INT NOT NULL UNIQUE,
  CreatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)
) ENGINE=InnoDB;

CREATE TABLE CartItem (
  CartItemID INT AUTO_INCREMENT PRIMARY KEY,
  CartID     INT NOT NULL,
  ProductID  INT NOT NULL,
  Size       VARCHAR(20),
  Quantity   INT NOT NULL CHECK (Quantity > 0),
  UNIQUE KEY uq_cart_product_size (CartID, ProductID, Size),
  FOREIGN KEY (CartID) REFERENCES Cart(CartID),
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
  INDEX idx_cartitem_cart (CartID)
) ENGINE=InnoDB;

CREATE TABLE Orders (
  OrderID     INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID  INT NOT NULL,
  Status      ENUM('Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Processing',
  Subtotal       DECIMAL(10,2) NOT NULL DEFAULT 0,
  DiscountAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
  DeliveryFee    DECIMAL(10,2) NOT NULL DEFAULT 0,
  DeliveryMethod ENUM('standard','express','collection') NOT NULL DEFAULT 'standard',
  PromoCode      VARCHAR(30),
  DeliveryAddress VARCHAR(255),
  DeliveryInstructions VARCHAR(200),
  TotalAmount DECIMAL(10,2) NOT NULL CHECK (TotalAmount >= 0),
  CourierRef  VARCHAR(40),
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)
) ENGINE=InnoDB;

CREATE TABLE OrderItem (
  OrderItemID INT AUTO_INCREMENT PRIMARY KEY,
  OrderID     INT NOT NULL,
  ProductID   INT NOT NULL,
  Size        VARCHAR(20),
  Quantity    INT NOT NULL CHECK (Quantity > 0),
  UnitPrice   DECIMAL(10,2) NOT NULL CHECK (UnitPrice >= 0),
  FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
  INDEX idx_orderitem_order (OrderID)
) ENGINE=InnoDB;

CREATE TABLE Payment (
  PaymentID INT AUTO_INCREMENT PRIMARY KEY,
  OrderID   INT NOT NULL UNIQUE,
  Method    ENUM('payfast','card','eft') NOT NULL,
  Status    ENUM('pending','paid','refunded') NOT NULL,
  Amount    DECIMAL(10,2) NOT NULL CHECK (Amount >= 0),
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (OrderID) REFERENCES Orders(OrderID)
) ENGINE=InnoDB;

CREATE TABLE Review (
  ReviewID   INT AUTO_INCREMENT PRIMARY KEY,
  ProductID  INT NOT NULL,
  CustomerID INT NOT NULL,
  Rating     TINYINT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
  Comment    TEXT,
  CreatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
  FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID),
  INDEX idx_review_product (ProductID)
) ENGINE=InnoDB;

CREATE TABLE Address (
  AddressID  INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID INT NOT NULL,
  Label      VARCHAR(30) NOT NULL DEFAULT 'Home',
  Recipient  VARCHAR(100) NOT NULL,
  Phone      VARCHAR(20),
  Line1      VARCHAR(150) NOT NULL,
  Suburb     VARCHAR(80),
  City       VARCHAR(80) NOT NULL,
  PostalCode CHAR(4) NOT NULL,
  IsDefault  TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID) ON DELETE CASCADE,
  INDEX idx_address_customer (CustomerID)
) ENGINE=InnoDB;

CREATE TABLE WishlistItem (
  WishlistItemID INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID     INT NOT NULL,
  ProductID      INT NOT NULL,
  CreatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (CustomerID, ProductID),
  FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID) ON DELETE CASCADE,
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE PromoCode (
  PromoCodeID   INT AUTO_INCREMENT PRIMARY KEY,
  Code          VARCHAR(30) NOT NULL UNIQUE,
  Description   VARCHAR(150) NOT NULL,
  DiscountType  ENUM('percent','fixed') NOT NULL,
  DiscountValue DECIMAL(10,2) NOT NULL CHECK (DiscountValue > 0),
  MinSpend      DECIMAL(10,2) NOT NULL DEFAULT 0,
  Active        TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE ReturnRequest (
  ReturnID     INT AUTO_INCREMENT PRIMARY KEY,
  OrderItemID  INT NOT NULL UNIQUE,  -- one return per order line
  CustomerID   INT NOT NULL,
  Reason       VARCHAR(40) NOT NULL,
  Comment      VARCHAR(300),
  Status       ENUM('Requested','Approved','Rejected','Refunded') NOT NULL DEFAULT 'Requested',
  RefundAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
  CreatedAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (OrderItemID) REFERENCES OrderItem(OrderItemID),
  FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)
) ENGINE=InnoDB;
