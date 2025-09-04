/**
 * Performance Testing Utilities for AWS Network CMDB
 * 
 * Provides comprehensive performance testing for 100K+ records with realistic AWS data patterns
 * Tests indexing strategies and query optimization for VPCs, Subnets, Transit Gateways, etc.
 * 
 * Target: <2 second response time for complex queries
 */

import { Sequelize } from 'sequelize';
import { dbMonitor, performanceUtils } from '../utils/db-monitor';
import { dbPerformanceIntegration } from '../utils/db-performance-integration';
import { performanceConfig } from '../config/pool-config';

export interface PerformanceTestResult {
  testName: string;
  query: string;
  executionTime: number;
  rowsReturned: number;
  indexesUsed: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passed: boolean;
  recommendations: string[];
}

export interface PerformanceTestSuite {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  averageResponseTime: number;
  results: PerformanceTestResult[];
  summary: {
    excellent: number; // A grade
    good: number;      // B grade
    acceptable: number; // C grade
    poor: number;      // D grade
    failing: number;   // F grade
  };
}

/**
 * AWS CMDB Performance Testing Class
 */
export class AwsCmdbPerformanceTester {
  private sequelize: Sequelize;
  private testData: {
    sampleAccountIds: string[];
    sampleRegions: string[];
    sampleVpcIds: string[];
    sampleEnvironments: string[];
  };

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.testData = {
      sampleAccountIds: ['123456789012', '234567890123', '345678901234'],
      sampleRegions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
      sampleVpcIds: ['vpc-12345678901234567', 'vpc-23456789012345678', 'vpc-34567890123456789'],
      sampleEnvironments: ['production', 'staging', 'development', 'test']
    };
  }

  /**
   * Run comprehensive performance test suite
   */
  public async runPerformanceTestSuite(): Promise<PerformanceTestSuite> {
    console.log('Starting AWS CMDB Performance Test Suite...');
    
    const results: PerformanceTestResult[] = [];
    
    // AWS ID Lookup Tests (Highest Priority)
    results.push(...await this.testAwsIdLookups());
    
    // Account/Region Filtering Tests
    results.push(...await this.testAccountRegionFiltering());
    
    // Relationship Join Tests
    results.push(...await this.testRelationshipJoins());
    
    // Temporal Query Tests
    results.push(...await this.testTemporalQueries());
    
    // Dashboard Query Tests
    results.push(...await this.testDashboardQueries());
    
    // Search and Aggregation Tests
    results.push(...await this.testSearchAndAggregation());
    
    // Complex Multi-table Tests
    results.push(...await this.testComplexQueries());
    
    return this.compileSuiteResults('AWS CMDB Performance Suite', results);
  }

  /**
   * Test AWS ID lookups - most critical performance area
   */
  private async testAwsIdLookups(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // VPC lookup by AWS ID
    results.push(await this.runPerformanceTest(
      'VPC Lookup by AWS ID',
      `SELECT id, awsVpcId, name, cidrBlock, region, state, environment 
       FROM vpcs WHERE awsVpcId = '${this.testData.sampleVpcIds[0]}'`,
      50 // target <50ms for direct ID lookup
    ));
    
    // Subnet lookup by AWS ID with VPC join
    results.push(await this.runPerformanceTest(
      'Subnet Lookup with VPC Join',
      `SELECT s.awsSubnetId, s.cidrBlock, s.availabilityZone, v.name as vpcName 
       FROM subnets s 
       JOIN vpcs v ON s.vpcId = v.id 
       WHERE s.awsSubnetId = 'subnet-12345678901234567'`,
      100 // target <100ms for lookup with join
    ));
    
    // Multiple resource lookup (batch)
    results.push(await this.runPerformanceTest(
      'Batch AWS Resource Lookup',
      `SELECT awsVpcId, name, region FROM vpcs 
       WHERE awsVpcId IN (${this.testData.sampleVpcIds.map(id => `'${id}'`).join(', ')})`,
      150 // target <150ms for batch lookup
    ));
    
    return results;
  }

  /**
   * Test account and region filtering - multi-tenant queries
   */
  private async testAccountRegionFiltering(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // Single account filtering
    results.push(await this.runPerformanceTest(
      'Single Account VPC Filtering',
      `SELECT COUNT(*) as vpc_count FROM vpcs 
       WHERE awsAccountId = '${this.testData.sampleAccountIds[0]}'`,
      200
    ));
    
    // Account + Region combination
    results.push(await this.runPerformanceTest(
      'Account-Region VPC Filtering',
      `SELECT awsVpcId, name, cidrBlock FROM vpcs 
       WHERE awsAccountId = '${this.testData.sampleAccountIds[0]}' 
       AND region = '${this.testData.sampleRegions[0]}'`,
      300
    ));
    
    // Multi-region query across accounts
    results.push(await this.runPerformanceTest(
      'Multi-Region Cross-Account Query',
      `SELECT region, COUNT(*) as resource_count 
       FROM vpcs 
       WHERE region IN ('${this.testData.sampleRegions.slice(0, 2).join("', '")}') 
       GROUP BY region`,
      500
    ));
    
    return results;
  }

  /**
   * Test relationship joins - topology queries
   */
  private async testRelationshipJoins(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // VPC with subnet count
    results.push(await this.runPerformanceTest(
      'VPC with Subnet Count',
      `SELECT v.awsVpcId, v.name, COUNT(s.id) as subnet_count 
       FROM vpcs v 
       LEFT JOIN subnets s ON v.id = s.vpcId 
       WHERE v.awsAccountId = '${this.testData.sampleAccountIds[0]}' 
       GROUP BY v.id, v.awsVpcId, v.name`,
      800
    ));
    
    // Complex multi-table topology query
    results.push(await this.runPerformanceTest(
      'Complex Topology Query',
      `SELECT 
         v.awsVpcId, v.name as vpc_name,
         COUNT(DISTINCT s.id) as subnet_count,
         COUNT(DISTINCT tga.id) as tgw_attachment_count
       FROM vpcs v
       LEFT JOIN subnets s ON v.id = s.vpcId
       LEFT JOIN transit_gateway_attachments tga ON v.id = tga.vpcId
       WHERE v.region = '${this.testData.sampleRegions[0]}'
       GROUP BY v.id, v.awsVpcId, v.name`,
      1200
    ));
    
    return results;
  }

  /**
   * Test temporal queries - sync and monitoring
   */
  private async testTemporalQueries(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // Recent sync queries
    results.push(await this.runPerformanceTest(
      'Recently Synced Resources',
      `SELECT awsVpcId, name, lastSyncAt 
       FROM vpcs 
       WHERE lastSyncAt >= DATE_SUB(NOW(), INTERVAL 1 HOUR) 
       ORDER BY lastSyncAt DESC`,
      400
    ));
    
    // Stale resource detection
    results.push(await this.runPerformanceTest(
      'Stale Resource Detection',
      `SELECT COUNT(*) as stale_count, region 
       FROM vpcs 
       WHERE lastSyncAt < DATE_SUB(NOW(), INTERVAL 24 HOUR) 
       GROUP BY region`,
      600
    ));
    
    return results;
  }

  /**
   * Test dashboard queries - aggregations and summaries
   */
  private async testDashboardQueries(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // Environment summary dashboard
    results.push(await this.runPerformanceTest(
      'Environment Resource Summary',
      `SELECT 
         environment,
         COUNT(*) as total_vpcs,
         SUM(CASE WHEN state = 'available' THEN 1 ELSE 0 END) as active_vpcs,
         COUNT(DISTINCT region) as regions
       FROM vpcs 
       WHERE environment IS NOT NULL 
       GROUP BY environment`,
      800
    ));
    
    // Regional capacity dashboard
    results.push(await this.runPerformanceTest(
      'Regional Capacity Dashboard',
      `SELECT 
         v.region,
         COUNT(v.id) as vpc_count,
         COUNT(s.id) as subnet_count,
         AVG(s.availableIpAddressCount) as avg_available_ips
       FROM vpcs v
       LEFT JOIN subnets s ON v.id = s.vpcId
       GROUP BY v.region
       ORDER BY vpc_count DESC`,
      1000
    ));
    
    return results;
  }

  /**
   * Test search and aggregation queries
   */
  private async testSearchAndAggregation(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // CIDR block overlap detection
    results.push(await this.runPerformanceTest(
      'CIDR Block Search',
      `SELECT awsVpcId, name, cidrBlock 
       FROM vpcs 
       WHERE cidrBlock LIKE '10.%' 
       ORDER BY cidrBlock`,
      700
    ));
    
    // Resource tagging analysis
    results.push(await this.runPerformanceTest(
      'Tagged Resource Analysis',
      `SELECT 
         COUNT(*) as total_resources,
         SUM(CASE WHEN tags IS NOT NULL THEN 1 ELSE 0 END) as tagged_resources
       FROM vpcs`,
      300
    ));
    
    return results;
  }

  /**
   * Test complex multi-table queries
   */
  private async testComplexQueries(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    // Comprehensive resource inventory
    results.push(await this.runPerformanceTest(
      'Comprehensive Resource Inventory',
      `SELECT 
         v.awsAccountId,
         v.region,
         v.environment,
         COUNT(DISTINCT v.id) as vpc_count,
         COUNT(DISTINCT s.id) as subnet_count,
         COUNT(DISTINCT tg.id) as transit_gateway_count
       FROM vpcs v
       LEFT JOIN subnets s ON v.id = s.vpcId
       LEFT JOIN transit_gateways tg ON v.region = tg.region AND v.awsAccountId = tg.awsAccountId
       GROUP BY v.awsAccountId, v.region, v.environment
       ORDER BY v.awsAccountId, v.region`,
      2000 // Complex query target
    ));
    
    return results;
  }

  /**
   * Execute a single performance test
   */
  private async runPerformanceTest(
    testName: string,
    query: string,
    targetTimeMs: number
  ): Promise<PerformanceTestResult> {
    console.log(`Running test: ${testName}`);
    
    const queryId = performanceUtils.generateQueryId();
    dbMonitor.startQueryMonitoring(queryId, query);
    
    const startTime = Date.now();
    let rowsReturned = 0;
    let indexesUsed: string[] = [];
    
    try {
      // Execute the query with EXPLAIN for index analysis
      const explainResult = await this.sequelize.query(`EXPLAIN ${query}`, {
        type: 'SELECT'
      });
      
      // Extract index information
      indexesUsed = this.extractIndexInfo(explainResult as any[]);
      
      // Execute actual query
      const result = await this.sequelize.query(query, {
        type: 'SELECT'
      });
      
      rowsReturned = Array.isArray(result) ? result.length : 1;
      
    } catch (error) {
      console.error(`Test failed: ${testName}`, error);
    }
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    // End monitoring
    dbMonitor.endQueryMonitoring(queryId, rowsReturned);
    
    const grade = performanceUtils.getPerformanceGrade(executionTime);
    const passed = executionTime <= targetTimeMs;
    
    return {
      testName,
      query,
      executionTime,
      rowsReturned,
      indexesUsed,
      grade,
      passed,
      recommendations: this.generateRecommendations(executionTime, targetTimeMs, indexesUsed, query)
    };
  }

  /**
   * Extract index usage information from EXPLAIN result
   */
  private extractIndexInfo(explainResult: any[]): string[] {
    const indexes: string[] = [];
    
    for (const row of explainResult) {
      if (row.key && row.key !== 'NULL') {
        indexes.push(row.key);
      }
      if (row.possible_keys) {
        const possibleKeys = row.possible_keys.split(',');
        indexes.push(...possibleKeys.filter((key: string) => !indexes.includes(key)));
      }
    }
    
    return indexes.filter(index => index && index !== 'NULL');
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    executionTime: number,
    targetTime: number,
    indexesUsed: string[],
    query: string
  ): string[] {
    const recommendations: string[] = [];
    
    if (executionTime > targetTime * 2) {
      recommendations.push('Critical performance issue - consider major query optimization');
    } else if (executionTime > targetTime) {
      recommendations.push('Performance target missed - review indexing strategy');
    }
    
    if (indexesUsed.length === 0) {
      recommendations.push('No indexes used - add appropriate indexes for query columns');
    }
    
    if (query.includes('LEFT JOIN') && executionTime > 1000) {
      recommendations.push('Complex join detected - ensure foreign key indexes exist');
    }
    
    if (query.includes('LIKE') && executionTime > 500) {
      recommendations.push('LIKE query detected - consider full-text search or prefix optimization');
    }
    
    if (query.includes('GROUP BY') && executionTime > 800) {
      recommendations.push('Aggregation query - ensure indexed columns in GROUP BY clause');
    }
    
    return recommendations;
  }

  /**
   * Compile suite results
   */
  private compileSuiteResults(suiteName: string, results: PerformanceTestResult[]): PerformanceTestSuite {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const averageResponseTime = results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;
    
    const gradeCounts = {
      excellent: results.filter(r => r.grade === 'A').length,
      good: results.filter(r => r.grade === 'B').length,
      acceptable: results.filter(r => r.grade === 'C').length,
      poor: results.filter(r => r.grade === 'D').length,
      failing: results.filter(r => r.grade === 'F').length
    };
    
    return {
      suiteName,
      totalTests,
      passedTests,
      averageResponseTime,
      results,
      summary: gradeCounts
    };
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(suiteResult: PerformanceTestSuite): string {
    const { suiteName, totalTests, passedTests, averageResponseTime, summary, results } = suiteResult;
    const passRate = (passedTests / totalTests * 100).toFixed(1);
    
    let report = `
# ${suiteName} - Performance Test Report

## Summary
- **Total Tests**: ${totalTests}
- **Passed**: ${passedTests} (${passRate}%)
- **Average Response Time**: ${averageResponseTime.toFixed(2)}ms

## Grade Distribution
- A (Excellent): ${summary.excellent} tests
- B (Good): ${summary.good} tests  
- C (Acceptable): ${summary.acceptable} tests
- D (Poor): ${summary.poor} tests
- F (Failing): ${summary.failing} tests

## Detailed Results
`;

    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      report += `
### ${status} ${result.testName}
- **Execution Time**: ${result.executionTime}ms (Grade: ${result.grade})
- **Rows Returned**: ${result.rowsReturned}
- **Indexes Used**: ${result.indexesUsed.join(', ') || 'None'}
- **Recommendations**: 
  ${result.recommendations.map(rec => `  - ${rec}`).join('\n')}
`;
    });

    return report;
  }
}

export default AwsCmdbPerformanceTester;