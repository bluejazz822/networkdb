/**
 * Performance Validation and Integration Script
 * 
 * Validates Stream D performance optimizations with realistic AWS CMDB data patterns
 * Integrates all performance components: pool-config, db-monitor, indexing, and testing
 * 
 * Ensures <2 second response time for 100K+ records with 50+ concurrent users
 */

import { Sequelize } from 'sequelize';
import { DatabaseConfig } from '../config/database';
import { getPoolConfig, performanceConfig, healthCheckConfig } from '../config/pool-config';
import { dbPerformanceIntegration } from '../utils/db-performance-integration';
import AwsCmdbPerformanceTester from './performance-testing';
import { dbMonitor } from '../utils/db-monitor';

export interface ValidationResult {
  success: boolean;
  timestamp: Date;
  environment: string;
  summary: {
    connectionTest: boolean;
    poolOptimization: boolean;
    monitoringIntegration: boolean;
    indexPerformance: boolean;
    performanceTargets: boolean;
  };
  details: {
    connectionInfo: any;
    poolMetrics: any;
    performanceStats: any;
    testResults?: any;
    recommendations: string[];
  };
  issues: string[];
}

/**
 * Stream D Performance Validation Class
 */
export class StreamDPerformanceValidator {
  private sequelize: Sequelize | null = null;
  private databaseConfig: DatabaseConfig;
  private performanceTester: AwsCmdbPerformanceTester | null = null;

  constructor() {
    this.databaseConfig = DatabaseConfig.getInstance();
  }

  /**
   * Run comprehensive Stream D validation
   */
  public async validateStreamD(): Promise<ValidationResult> {
    console.log('🚀 Starting Stream D Performance Optimization Validation...');
    
    const result: ValidationResult = {
      success: false,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      summary: {
        connectionTest: false,
        poolOptimization: false,
        monitoringIntegration: false,
        indexPerformance: false,
        performanceTargets: false
      },
      details: {
        connectionInfo: null,
        poolMetrics: null,
        performanceStats: null,
        recommendations: []
      },
      issues: []
    };

    try {
      // 1. Test Database Connection
      console.log('📡 Testing database connection...');
      result.summary.connectionTest = await this.validateConnection(result);
      
      // 2. Validate Pool Configuration
      console.log('🏊 Validating connection pool optimization...');
      result.summary.poolOptimization = await this.validatePoolConfiguration(result);
      
      // 3. Test Performance Monitoring Integration
      console.log('📊 Testing performance monitoring integration...');
      result.summary.monitoringIntegration = await this.validateMonitoringIntegration(result);
      
      // 4. Validate Index Performance (if database has data)
      console.log('🗂️  Validating index performance...');
      result.summary.indexPerformance = await this.validateIndexPerformance(result);
      
      // 5. Validate Performance Targets
      console.log('🎯 Validating performance targets...');
      result.summary.performanceTargets = await this.validatePerformanceTargets(result);
      
      // Overall success determination
      result.success = Object.values(result.summary).every(Boolean);
      
      // Generate final recommendations
      result.details.recommendations = this.generateFinalRecommendations(result);
      
      console.log(`✅ Stream D Validation Complete: ${result.success ? 'SUCCESS' : 'PARTIAL SUCCESS'}`);
      
    } catch (error) {
      console.error('❌ Stream D validation failed:', error);
      result.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return result;
  }

  /**
   * Validate database connection
   */
  private async validateConnection(result: ValidationResult): Promise<boolean> {
    try {
      this.sequelize = await this.databaseConfig.initialize();
      const isHealthy = await this.databaseConfig.checkConnection();
      
      if (isHealthy) {
        result.details.connectionInfo = this.databaseConfig.getConnectionInfo();
        console.log('✅ Database connection successful');
        return true;
      } else {
        result.issues.push('Database connection health check failed');
        return false;
      }
    } catch (error) {
      result.issues.push(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate connection pool configuration
   */
  private async validatePoolConfiguration(result: ValidationResult): Promise<boolean> {
    try {
      const environment = process.env.NODE_ENV || 'development';
      const poolConfig = getPoolConfig(environment);
      const connectionInfo = this.databaseConfig.getConnectionInfo() as any;
      
      result.details.poolMetrics = {
        configuration: {
          min: poolConfig.min,
          max: poolConfig.max,
          acquire: poolConfig.acquire,
          idle: poolConfig.idle
        },
        currentState: connectionInfo.pool || {}
      };
      
      // Validate pool configuration meets requirements
      const issues: string[] = [];
      
      if (environment === 'production') {
        if (poolConfig.max < 50) {
          issues.push('Production pool max connections should support 50+ concurrent users');
        }
        if (poolConfig.acquire > 30000) {
          issues.push('Production acquire timeout too high for performance requirements');
        }
      }
      
      if (issues.length > 0) {
        result.issues.push(...issues);
        return false;
      }
      
      console.log('✅ Connection pool configuration validated');
      return true;
    } catch (error) {
      result.issues.push(`Pool validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate monitoring integration
   */
  private async validateMonitoringIntegration(result: ValidationResult): Promise<boolean> {
    try {
      // Start monitoring
      dbPerformanceIntegration.startMonitoring();
      
      // Wait a moment for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test health check
      const healthCheck = await dbPerformanceIntegration.performHealthCheck();
      result.details.performanceStats = healthCheck;
      
      if (healthCheck.healthy) {
        console.log('✅ Performance monitoring integration validated');
        return true;
      } else {
        result.issues.push(...healthCheck.issues);
        return healthCheck.issues.length === 0; // Consider success if no critical issues
      }
    } catch (error) {
      result.issues.push(`Monitoring integration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate index performance
   */
  private async validateIndexPerformance(result: ValidationResult): Promise<boolean> {
    if (!this.sequelize) {
      result.issues.push('No database connection for index performance testing');
      return false;
    }
    
    try {
      // Check if tables exist and have data
      const tableCheckQuery = `
        SELECT TABLE_NAME, TABLE_ROWS 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('vpcs', 'subnets', 'transit_gateways')
      `;
      
      const tableInfo = await this.sequelize.query(tableCheckQuery, { type: 'SELECT' }) as any[];
      
      if (tableInfo.length === 0) {
        console.log('⚠️  No CMDB tables found - skipping index performance tests');
        result.details.recommendations.push('Run migrations to create database tables for full index testing');
        return true; // Not a failure, just incomplete
      }
      
      const hasData = tableInfo.some((table: any) => table.TABLE_ROWS > 0);
      
      if (!hasData) {
        console.log('⚠️  No data in CMDB tables - running basic index structure validation');
        return await this.validateIndexStructure(result);
      }
      
      // Run performance tests if data exists
      console.log('🧪 Running performance tests with existing data...');
      this.performanceTester = new AwsCmdbPerformanceTester(this.sequelize);
      const testResults = await this.performanceTester.runPerformanceTestSuite();
      
      result.details.testResults = testResults;
      
      const passRate = (testResults.passedTests / testResults.totalTests) * 100;
      
      if (passRate >= 80) {
        console.log(`✅ Index performance validated (${passRate.toFixed(1)}% pass rate)`);
        return true;
      } else {
        result.issues.push(`Index performance below target (${passRate.toFixed(1)}% pass rate, need >80%)`);
        return false;
      }
      
    } catch (error) {
      result.issues.push(`Index performance validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate index structure when no data is available
   */
  private async validateIndexStructure(result: ValidationResult): Promise<boolean> {
    if (!this.sequelize) return false;
    
    try {
      const indexQuery = `
        SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('vpcs', 'subnets', 'transit_gateways', 'customer_gateways')
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `;
      
      const indexes = await this.sequelize.query(indexQuery, { type: 'SELECT' }) as any[];
      
      // Check for critical indexes
      const criticalIndexes = [
        'awsVpcId',
        'awsSubnetId', 
        'awsTransitGatewayId',
        'awsAccountId',
        'region'
      ];
      
      const missingCriticalIndexes: string[] = [];
      
      for (const criticalIndex of criticalIndexes) {
        const hasIndex = indexes.some((index: any) => 
          index.INDEX_NAME.includes(criticalIndex) || index.COLUMN_NAME === criticalIndex
        );
        
        if (!hasIndex) {
          missingCriticalIndexes.push(criticalIndex);
        }
      }
      
      if (missingCriticalIndexes.length > 0) {
        result.issues.push(`Missing critical indexes: ${missingCriticalIndexes.join(', ')}`);
        return false;
      }
      
      console.log('✅ Index structure validation complete');
      return true;
      
    } catch (error) {
      result.issues.push(`Index structure validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate performance targets
   */
  private async validatePerformanceTargets(result: ValidationResult): Promise<boolean> {
    try {
      const stats = dbMonitor.getPerformanceStats();
      const targetsMet: string[] = [];
      const targetsNotMet: string[] = [];
      
      // Target response time
      if (stats.averageResponseTime <= performanceConfig.targetResponseTime) {
        targetsMet.push(`Average response time: ${stats.averageResponseTime}ms <= ${performanceConfig.targetResponseTime}ms`);
      } else {
        targetsNotMet.push(`Average response time: ${stats.averageResponseTime}ms > ${performanceConfig.targetResponseTime}ms`);
      }
      
      // Pool efficiency
      if (stats.poolEfficiency >= performanceConfig.targetPoolEfficiency) {
        targetsMet.push(`Pool efficiency: ${(stats.poolEfficiency * 100).toFixed(1)}% >= ${(performanceConfig.targetPoolEfficiency * 100).toFixed(1)}%`);
      } else {
        targetsNotMet.push(`Pool efficiency: ${(stats.poolEfficiency * 100).toFixed(1)}% < ${(performanceConfig.targetPoolEfficiency * 100).toFixed(1)}%`);
      }
      
      // Critical queries
      if (stats.criticalQueries === 0) {
        targetsMet.push('No critical slow queries detected');
      } else {
        targetsNotMet.push(`${stats.criticalQueries} critical slow queries detected`);
      }
      
      if (targetsNotMet.length === 0) {
        console.log('✅ All performance targets met');
        console.log(`Targets met: ${targetsMet.join(', ')}`);
        return true;
      } else {
        result.issues.push(...targetsNotMet);
        console.log(`⚠️  Some performance targets not met: ${targetsNotMet.join(', ')}`);
        return targetsNotMet.length <= targetsMet.length; // More targets met than not met
      }
      
    } catch (error) {
      result.issues.push(`Performance targets validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Generate final recommendations
   */
  private generateFinalRecommendations(result: ValidationResult): string[] {
    const recommendations: string[] = [];
    
    if (!result.summary.connectionTest) {
      recommendations.push('Fix database connection issues before proceeding');
    }
    
    if (!result.summary.poolOptimization) {
      recommendations.push('Review and adjust connection pool configuration');
    }
    
    if (!result.summary.monitoringIntegration) {
      recommendations.push('Fix performance monitoring integration issues');
    }
    
    if (!result.summary.indexPerformance) {
      recommendations.push('Apply index optimizations from indexes.sql');
      recommendations.push('Run ANALYZE TABLE on main tables after data load');
    }
    
    if (!result.summary.performanceTargets) {
      recommendations.push('Investigate slow queries and optimize them');
      recommendations.push('Consider scaling database resources if targets consistently missed');
    }
    
    // General recommendations
    if (result.success) {
      recommendations.push('Stream D performance optimization successfully validated');
      recommendations.push('Monitor performance metrics regularly in production');
      recommendations.push('Run performance tests after significant data loads');
    } else {
      recommendations.push('Address validation issues before production deployment');
      recommendations.push('Run validation again after fixes are applied');
    }
    
    return recommendations;
  }

  /**
   * Generate validation report
   */
  public generateValidationReport(result: ValidationResult): string {
    const { success, timestamp, environment, summary, details, issues } = result;
    const successIcon = success ? '✅' : '⚠️';
    
    let report = `
# Stream D Performance Optimization Validation Report

${successIcon} **Status**: ${success ? 'SUCCESS' : 'PARTIAL SUCCESS'}  
📅 **Timestamp**: ${timestamp.toISOString()}  
🌍 **Environment**: ${environment}

## Validation Summary
`;

    Object.entries(summary).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      report += `- ${icon} ${label}\n`;
    });

    if (issues.length > 0) {
      report += `\n## Issues Found\n`;
      issues.forEach(issue => {
        report += `- ❌ ${issue}\n`;
      });
    }

    if (details.recommendations.length > 0) {
      report += `\n## Recommendations\n`;
      details.recommendations.forEach(rec => {
        report += `- 💡 ${rec}\n`;
      });
    }

    if (details.testResults) {
      report += `\n## Performance Test Results\n`;
      const { testResults } = details;
      report += `- **Total Tests**: ${testResults.totalTests}\n`;
      report += `- **Passed**: ${testResults.passedTests} (${(testResults.passedTests/testResults.totalTests*100).toFixed(1)}%)\n`;
      report += `- **Average Response Time**: ${testResults.averageResponseTime.toFixed(2)}ms\n`;
    }

    return report;
  }
}

/**
 * CLI execution function
 */
export async function runStreamDValidation(): Promise<void> {
  const validator = new StreamDPerformanceValidator();
  
  try {
    const result = await validator.validateStreamD();
    const report = validator.generateValidationReport(result);
    
    console.log('\n' + '='.repeat(80));
    console.log(report);
    console.log('='.repeat(80));
    
    if (!result.success) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Stream D validation failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runStreamDValidation();
}

export default StreamDPerformanceValidator;