-- Create simple VPC tables that match server expectations
-- Based on the schema returned by the API

-- AWS VPC table
CREATE TABLE IF NOT EXISTS vpc_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  AccountId VARCHAR(255),
  Region VARCHAR(255),
  VpcId VARCHAR(255) NOT NULL,
  CidrBlock VARCHAR(255),
  IsDefault VARCHAR(255),
  Name VARCHAR(255),
  `ENV Name` VARCHAR(255),
  Tenant VARCHAR(255),
  `ENV Type` VARCHAR(255),
  status VARCHAR(255),
  created_time DATETIME,
  termindated_time DATETIME,
  INDEX idx_vpc_id (VpcId),
  INDEX idx_account_region (AccountId, Region)
);

-- Aliyun VPC table
CREATE TABLE IF NOT EXISTS ali_vpc_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  Region VARCHAR(255),
  VpcId VARCHAR(255) NOT NULL,
  CidrBlock VARCHAR(255),
  IsDefault VARCHAR(255),
  Name VARCHAR(255),
  `ENV Name` VARCHAR(255),
  Tenant VARCHAR(255),
  `ENV Type` VARCHAR(255),
  status VARCHAR(255),
  created_time DATETIME,
  termindated_time DATETIME,
  INDEX idx_vpc_id (VpcId),
  INDEX idx_region (Region)
);

-- Azure VPC table
CREATE TABLE IF NOT EXISTS azure_vpc_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  Region VARCHAR(255),
  VpcId VARCHAR(255) NOT NULL,
  CidrBlock VARCHAR(255),
  IsDefault VARCHAR(255),
  Name VARCHAR(255),
  `ENV Name` VARCHAR(255),
  Tenant VARCHAR(255),
  `ENV Type` VARCHAR(255),
  status VARCHAR(255),
  created_time DATETIME,
  termindated_time DATETIME,
  INDEX idx_vpc_id (VpcId),
  INDEX idx_region (Region)
);

-- Huawei Cloud VPC table
CREATE TABLE IF NOT EXISTS hwc_vpc_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  Region VARCHAR(255),
  VpcId VARCHAR(255) NOT NULL,
  CidrBlock VARCHAR(255),
  IsDefault VARCHAR(255),
  Name VARCHAR(255),
  `ENV Name` VARCHAR(255),
  Tenant VARCHAR(255),
  `ENV Type` VARCHAR(255),
  status VARCHAR(255),
  created_time DATETIME,
  termindated_time DATETIME,
  INDEX idx_vpc_id (VpcId),
  INDEX idx_region (Region)
);

-- Oracle Cloud (OCI) VPC table
CREATE TABLE IF NOT EXISTS oci_vpc_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  Region VARCHAR(255),
  VpcId VARCHAR(255) NOT NULL,
  CidrBlock VARCHAR(255),
  IsDefault VARCHAR(255),
  Name VARCHAR(255),
  `ENV Name` VARCHAR(255),
  Tenant VARCHAR(255),
  `ENV Type` VARCHAR(255),
  status VARCHAR(255),
  created_time DATETIME,
  termindated_time DATETIME,
  INDEX idx_vpc_id (VpcId),
  INDEX idx_region (Region)
);

-- Other providers VPC table
CREATE TABLE IF NOT EXISTS other_vpc_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  Region VARCHAR(255),
  VpcId VARCHAR(255) NOT NULL,
  CidrBlock VARCHAR(255),
  IsDefault VARCHAR(255),
  Name VARCHAR(255),
  `ENV Name` VARCHAR(255),
  Tenant VARCHAR(255),
  `ENV Type` VARCHAR(255),
  status VARCHAR(255),
  created_time DATETIME,
  termindated_time DATETIME,
  INDEX idx_vpc_id (VpcId),
  INDEX idx_region (Region)
);