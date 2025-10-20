const mysql = require('mysql2/promise');

async function listInfoTables() {
  const connection = await mysql.createConnection({
    host: '172.16.30.62',
    port: 44060,
    user: 'root',
    password: 'Gq34Ko90#110',
    database: 'mydatabase'
  });

  try {
    // Get all tables ending with 'info'
    const [tables] = await connection.query("SHOW TABLES LIKE '%info'");

    console.log('Tables ending with "info":');
    console.log('='.repeat(50));

    if (tables.length === 0) {
      console.log('No tables found ending with "info"');
      return;
    }

    // Print table names
    tables.forEach((row, index) => {
      const tableName = Object.values(row)[0];
      console.log(`${index + 1}. ${tableName}`);
    });

    console.log('='.repeat(50));
    console.log(`Total: ${tables.length} tables found`);

  } finally {
    await connection.end();
  }
}

listInfoTables().catch(console.error);
