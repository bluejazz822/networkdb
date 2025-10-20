const mysql = require('mysql2/promise');

async function findRealData() {
  const connection = await mysql.createConnection({
    host: '172.16.30.62',
    port: 44060,
    user: 'root',
    password: 'Gq34Ko90#110',
    database: 'mydatabase'
  });

  try {
    // Check for any tables that might have older data (real production data)
    console.log('=== LOOKING FOR OLDER/REAL DATA ===');

    // Check all tables for data older than today
    const [tables] = await connection.execute("SHOW TABLES");

    for (const row of tables) {
      const tableName = Object.values(row)[0];

      // Skip our known sample data tables that we just created
      if (tableName.includes('vpc') || tableName === 'SequelizeMeta' || tableName === 'enum_resource_status') {
        try {
          // Look for data older than today
          const [oldData] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM ${tableName}
            WHERE created_time < '2025-09-25' OR created_time IS NULL
          `);

          if (oldData[0].count > 0) {
            console.log(`\n*** FOUND OLDER DATA IN: ${tableName} ***`);
            console.log(`Records older than today: ${oldData[0].count}`);

            // Get sample of this older data
            const [sample] = await connection.execute(`
              SELECT * FROM ${tableName}
              WHERE created_time < '2025-09-25' OR created_time IS NULL
              LIMIT 3
            `);

            sample.forEach((record, i) => {
              console.log(`Old Record ${i + 1}:`, record);
            });
          }
        } catch (error) {
          console.log(`Could not check ${tableName} for older data:`, error.message);
        }
      }
    }

    // Check for any other databases
    console.log('\n=== CHECKING OTHER DATABASES ===');
    const [databases] = await connection.execute('SHOW DATABASES');
    console.log('Available databases:');
    databases.forEach(db => {
      const dbName = Object.values(db)[0];
      console.log(`- ${dbName}`);
    });

    // Check if there are any production-style table names we might have missed
    console.log('\n=== CHECKING FOR DIFFERENT TABLE PATTERNS ===');
    const [allTables] = await connection.execute(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'mydatabase'
      AND (TABLE_NAME LIKE '%network%'
           OR TABLE_NAME LIKE '%cloud%'
           OR TABLE_NAME LIKE '%resource%'
           OR TABLE_NAME LIKE '%aws%'
           OR TABLE_NAME LIKE '%azure%'
           OR TABLE_NAME LIKE '%aliyun%'
           OR TABLE_NAME LIKE '%huawei%'
           OR TABLE_NAME LIKE '%subnet%'
           OR TABLE_NAME LIKE '%gateway%')
    `);

    if (allTables.length > 0) {
      console.log('Found network/cloud related tables:');
      allTables.forEach(table => {
        console.log(`- ${table.TABLE_NAME}`);
      });
    } else {
      console.log('No other network/cloud related tables found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

findRealData().catch(console.error);