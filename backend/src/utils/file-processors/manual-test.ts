/**
 * Manual test script to verify file processors work correctly
 * This can be run to test the implementation before running formal tests
 */

import { 
  createFileProcessorFactory,
  FileFormat,
  defaultNetworkDeviceFields,
  generateTemplate,
  processFileBuffer
} from './index';

async function testFileProcessors() {
  console.log('🚀 Testing Network CMDB File Processors...\n');

  // Test CSV processor
  console.log('📄 Testing CSV Processor...');
  try {
    const csvTemplate = await generateTemplate(FileFormat.CSV);
    console.log('✅ CSV template generated:', csvTemplate.toString().substring(0, 100) + '...');

    const csvData = 'hostname,ipAddress,deviceType\nswitch01,192.168.1.1,switch\nrouter01,192.168.1.2,router';
    const csvBuffer = Buffer.from(csvData, 'utf8');
    const csvMetadata = {
      filename: 'test.csv',
      originalName: 'test.csv',
      size: csvBuffer.length,
      mimetype: 'text/csv',
      encoding: 'utf8' as BufferEncoding,
      uploadedAt: new Date()
    };

    const csvResult = await processFileBuffer(csvBuffer, csvMetadata);
    console.log('✅ CSV processed:', csvResult.success, 'Records:', csvResult.validRecords);
  } catch (error) {
    console.error('❌ CSV test failed:', error);
  }

  // Test JSON processor
  console.log('\n📋 Testing JSON Processor...');
  try {
    const jsonTemplate = await generateTemplate(FileFormat.JSON);
    console.log('✅ JSON template generated:', JSON.parse(jsonTemplate.toString())[0]?.hostname);

    const jsonData = JSON.stringify([
      { hostname: 'firewall01', ipAddress: '192.168.1.10', deviceType: 'firewall' },
      { hostname: 'server01', ipAddress: '192.168.1.20', deviceType: 'server' }
    ]);
    const jsonBuffer = Buffer.from(jsonData, 'utf8');
    const jsonMetadata = {
      filename: 'test.json',
      originalName: 'test.json',
      size: jsonBuffer.length,
      mimetype: 'application/json',
      encoding: 'utf8' as BufferEncoding,
      uploadedAt: new Date()
    };

    const jsonResult = await processFileBuffer(jsonBuffer, jsonMetadata);
    console.log('✅ JSON processed:', jsonResult.success, 'Records:', jsonResult.validRecords);
  } catch (error) {
    console.error('❌ JSON test failed:', error);
  }

  // Test Factory
  console.log('\n🏭 Testing Factory...');
  try {
    const factory = createFileProcessorFactory();
    console.log('✅ Factory created');
    console.log('✅ Available processors:', 
      factory.getProcessor(FileFormat.CSV) ? 'CSV' : '',
      factory.getProcessor(FileFormat.EXCEL) ? 'Excel' : '',
      factory.getProcessor(FileFormat.JSON) ? 'JSON' : ''
    );

    const stats = factory.getGlobalProcessingStats();
    console.log('✅ Global stats available:', stats.size, 'processors tracked');
  } catch (error) {
    console.error('❌ Factory test failed:', error);
  }

  console.log('\n✨ File processor tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testFileProcessors().catch(console.error);
}

export { testFileProcessors };