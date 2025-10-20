const mysql = require('mysql2/promise');

async function analyzeTablesSchema() {
  const connection = await mysql.createConnection({
    host: '172.16.30.62',
    port: 44060,
    user: 'root',
    password: 'Gq34Ko90#110',
    database: 'mydatabase'
  });

  try {
    const tables = [
      'lb_info', 'ali_lb_info', 'azure_lb_info', 'hwc_lb_info', 'oci_lb_info',
      'ngw_info', 'ali_ngw_info', 'azure_ngw_info', 'hwc_ngw_info', 'oci_ngw_info',
      'vpn_info', 'ali_vpn_info', 'azure_vpn_info', 'hwc_vpn_info', 'oci_vpn_info',
      'tgw_attachment_info',
      'vpc_endpoint_info'
    ];

    for (const table of tables) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`TABLE: ${table}`);
      console.log('='.repeat(70));

      try {
        const [columns] = await connection.query(`DESCRIBE ${table}`);

        if (columns.length > 0) {
          console.log('Fields:');
          columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
          });

          // Get sample row count
          const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`\nRow count: ${countResult[0].count}`);

          // Get sample data if exists
          if (countResult[0].count > 0) {
            const [sample] = await connection.query(`SELECT * FROM ${table} LIMIT 1`);
            console.log('\nSample row (first record):');
            console.log(JSON.stringify(sample[0], null, 2));
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Table does not exist or error: ${error.message}`);
      }
    }

  } finally {
    await connection.end();
  }
}

analyzeTablesSchema().catch(console.error);
