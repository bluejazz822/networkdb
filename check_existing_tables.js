const mysql = require('mysql2/promise');

async function checkExistingTables() {
  const connection = await mysql.createConnection({
    host: '172.16.30.62',
    port: 44060,
    user: 'root',
    password: 'Gq34Ko90#110',
    database: 'mydatabase'
  });

  console.log('Connected to production database');

  try {
    // Check what tables exist
    const [tables] = await connection.execute("SHOW TABLES");
    console.log('\n=== ALL TABLES IN DATABASE ===');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(tableName);
    });

    // Check for VPC-related tables specifically
    console.log('\n=== VPC-RELATED TABLES ===');
    const [vpcTables] = await connection.execute("SHOW TABLES LIKE '%vpc%'");
    vpcTables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(tableName);
    });

    // Check data in any existing VPC tables
    for (const row of vpcTables) {
      const tableName = Object.values(row)[0];
      try {
        const [data] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const [sample] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 3`);
        console.log(`\n=== TABLE: ${tableName} ===`);
        console.log(`Record count: ${data[0].count}`);
        if (sample.length > 0) {
          console.log('Sample columns:', Object.keys(sample[0]));
          console.log('Sample data:');
          sample.forEach((record, i) => {
            console.log(`Row ${i + 1}:`, record);
          });
        }
      } catch (error) {
        console.log(`Error checking table ${tableName}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
    console.log('\nDatabase connection closed');
  }
}

checkExistingTables().catch(console.error);