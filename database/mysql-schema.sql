-- =============================================================================
-- iTHRIFT Clothes - MySQL 8.x production schema
-- =============================================================================
-- This is the production-equivalent of the SQLite schema the prototype
-- actually runs on (see server/init-db.js). It is kept here for traceability
-- back to the System Design document, which specifies MySQL as the data
-- tier. The table shapes, keys and Third Normal Form structure are
-- identical; only SQLite-specific syntax (AUTOINCREMENT, CHECK placement)
-- is adjusted for MySQL. Note: SQLite treats the word ORDER as reserved,
-- so the prototype names the table `Orders` - this MySQL schema keeps the
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
  StockQty       INT NOT NULL DEFAULT 0 CHECK (StockQty >= 0),
  ImageFile      VARCHAR(255),
  CreatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (BrandID) REFERENCES Brand(BrandID),
  FOREIGN KEY (CategoryID) REFERENCES Category(CategoryID),
  INDEX idx_product_brand (BrandID),
  INDEX idx_product_category (CategoryID)
) ENGINE=InnoDB;

CREATE TABLE Customer (
  CustomerID   INT AUTO_INCREMENT PRIMARY KEY,
  FirstName    VARCHAR(60) NOT NULL,
  LastName     VARCHAR(60) NOT NULL,
  Email        VARCHAR(120) NOT NULL UNIQUE,
  PasswordHash CHAR(128) NOT NULL,
  PasswordSalt CHAR(32) NOT NULL,
  Phone        VARCHAR(30),
  AddressLine  VARCHAR(150),
  City         VARCHAR(60),
  PostalCode   VARCHAR(10),
  Status       ENUM('active','suspended') NOT NULL DEFAULT 'active',
  CreatedAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  Quantity   INT NOT NULL CHECK (Quantity > 0),
  UNIQUE KEY uq_cart_product (CartID, ProductID),
  FOREIGN KEY (CartID) REFERENCES Cart(CartID),
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
  INDEX idx_cartitem_cart (CartID)
) ENGINE=InnoDB;

CREATE TABLE Orders (
  OrderID     INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID  INT NOT NULL,
  Status      ENUM('Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Processing',
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
  Status    ENUM('pending','paid') NOT NULL,
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
