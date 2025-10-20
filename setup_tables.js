const mysql = require('mysql2/promise');
const fs = require('fs');

async function setupTables() {
  const connection = await mysql.createConnection({
    host: '172.16.30.62',
    port: 44060,
    user: 'root',
    password: 'Gq34Ko90#110',
    database: 'mydatabase'
  });

  console.log('Connected to database');

  try {
    // Read and execute the SQL file
    const sql = fs.readFileSync('./create_vpc_tables.sql', 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      try {
        await connection.execute(statement);
        console.log('Executed statement successfully');
      } catch (error) {
        console.log('Statement error (likely table exists):', error.message);
      }
    }

    // Insert sample data
    console.log('Inserting sample data...');

    // AWS sample data
    await connection.execute(`
      INSERT INTO vpc_info (AccountId, Region, VpcId, CidrBlock, IsDefault, Name, \`ENV Name\`, Tenant, \`ENV Type\`, status, created_time) VALUES
      ('123456789012', 'us-east-1', 'vpc-12345678901234567', '10.0.0.0/16', 'false', 'Production VPC', 'prod-env', 'TeamA', 'Production', 'available', NOW()),
      ('123456789012', 'us-west-2', 'vpc-abcdefghijk123456', '172.16.0.0/16', 'false', 'Development VPC', 'dev-env', 'TeamB', 'Development', 'available', NOW())
      ON DUPLICATE KEY UPDATE id=id
    `);

    // Aliyun sample data
    await connection.execute(`
      INSERT INTO ali_vpc_info (Region, VpcId, CidrBlock, IsDefault, Name, \`ENV Name\`, Tenant, \`ENV Type\`, status, created_time) VALUES
      ('cn-hangzhou', 'vpc-bp1234567890abcdef', '192.168.0.0/16', 'false', 'Ali Production VPC', 'ali-prod', 'AliTeam', 'Production', 'Available', NOW()),
      ('cn-beijing', 'vpc-bp0987654321fedcba', '10.1.0.0/16', 'false', 'Ali Dev VPC', 'ali-dev', 'AliTeam', 'Development', 'Available', NOW())
      ON DUPLICATE KEY UPDATE id=id
    `);

    // Azure sample data
    await connection.execute(`
      INSERT INTO azure_vpc_info (Region, VpcId, CidrBlock, IsDefault, Name, \`ENV Name\`, Tenant, \`ENV Type\`, status, created_time) VALUES
      ('eastus', 'azure-vnet-prod-001', '10.2.0.0/16', 'false', 'Azure Production VNet', 'azure-prod', 'AzureTeam', 'Production', 'Succeeded', NOW()),
      ('westus', 'azure-vnet-dev-001', '172.17.0.0/16', 'false', 'Azure Dev VNet', 'azure-dev', 'AzureTeam', 'Development', 'Succeeded', NOW())
      ON DUPLICATE KEY UPDATE id=id
    `);

    // Huawei sample data
    await connection.execute(`
      INSERT INTO hwc_vpc_info (Region, VpcId, CidrBlock, IsDefault, Name, \`ENV Name\`, Tenant, \`ENV Type\`, status, created_time) VALUES
      ('cn-north-1', 'hwc-vpc-001-prod', '10.3.0.0/16', 'false', 'Huawei Production VPC', 'hwc-prod', 'HuaweiTeam', 'Production', 'OK', NOW()),
      ('cn-east-2', 'hwc-vpc-002-dev', '192.168.1.0/24', 'false', 'Huawei Dev VPC', 'hwc-dev', 'HuaweiTeam', 'Development', 'OK', NOW())
      ON DUPLICATE KEY UPDATE id=id
    `);

    // OCI sample data
    await connection.execute(`
      INSERT INTO oci_vpc_info (Region, VpcId, CidrBlock, IsDefault, Name, \`ENV Name\`, Tenant, \`ENV Type\`, status, created_time) VALUES
      ('us-ashburn-1', 'ocid1.vcn.oc1.iad.aaaaaaaaa', '10.4.0.0/16', 'false', 'OCI Production VCN', 'oci-prod', 'OCITeam', 'Production', 'AVAILABLE', NOW()),
      ('us-phoenix-1', 'ocid1.vcn.oc1.phx.bbbbbbbbb', '172.18.0.0/16', 'false', 'OCI Dev VCN', 'oci-dev', 'OCITeam', 'Development', 'AVAILABLE', NOW())
      ON DUPLICATE KEY UPDATE id=id
    `);

    // Others sample data
    await connection.execute(`
      INSERT INTO other_vpc_info (Region, VpcId, CidrBlock, IsDefault, Name, \`ENV Name\`, Tenant, \`ENV Type\`, status, created_time) VALUES
      ('global', 'other-vpc-001', '10.5.0.0/16', 'false', 'Custom Cloud VPC', 'custom-prod', 'CustomTeam', 'Production', 'active', NOW()),
      ('global', 'other-vpc-002', '172.19.0.0/16', 'false', 'Private Cloud VPC', 'private-env', 'PrivateTeam', 'Development', 'active', NOW())
      ON DUPLICATE KEY UPDATE id=id
    `);

    console.log('Sample data inserted successfully');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
    console.log('Database connection closed');
  }
}

setupTables().catch(console.error);