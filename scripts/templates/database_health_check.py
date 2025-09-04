#!/usr/bin/env python3
"""
Database Health Check Template

@author System
@version 1.0.0

This script performs comprehensive database health checks including connectivity,
performance metrics, table statistics, and query execution times.

@param db_type string Database type (mysql, postgresql, sqlite) 
@param host string Database host (optional, default: localhost)
@param port int Database port (optional, default: varies by db_type)
@param database string Database name
@param username string Database username (optional)
@param password string Database password (optional)
@param timeout int Connection timeout in seconds (optional, default: 30)
"""

import os
import sys
import json
import time
import traceback
from typing import Dict, Any, List, Optional

def get_parameter(name: str, default: Any = None, param_type: type = str) -> Any:
    """Get parameter from environment variable with type conversion"""
    env_name = f"PARAM_{name.upper()}"
    value = os.environ.get(env_name, default)
    
    if value is None:
        return None
        
    if param_type == int:
        try:
            return int(value)
        except ValueError:
            return default
    elif param_type == bool:
        return str(value).lower() in ('true', '1', 'yes', 'on')
    
    return value

def create_database_connection(db_type: str, host: str, port: int, database: str, 
                             username: Optional[str] = None, password: Optional[str] = None, 
                             timeout: int = 30):
    """Create database connection based on type"""
    
    if db_type.lower() == 'mysql':
        try:
            import pymysql
            return pymysql.connect(
                host=host,
                port=port,
                database=database,
                user=username,
                password=password,
                connect_timeout=timeout,
                charset='utf8mb4'
            )
        except ImportError:
            raise Exception("pymysql package not available")
    
    elif db_type.lower() == 'postgresql':
        try:
            import psycopg2
            return psycopg2.connect(
                host=host,
                port=port,
                database=database,
                user=username,
                password=password,
                connect_timeout=timeout
            )
        except ImportError:
            raise Exception("psycopg2 package not available")
    
    elif db_type.lower() == 'sqlite':
        try:
            import sqlite3
            return sqlite3.connect(database, timeout=timeout)
        except Exception as e:
            raise Exception(f"SQLite connection failed: {e}")
    
    else:
        raise Exception(f"Unsupported database type: {db_type}")

def test_basic_connectivity(connection, db_type: str) -> Dict[str, Any]:
    """Test basic database connectivity"""
    result = {
        'test': 'basic_connectivity',
        'success': False,
        'response_time_ms': None,
        'error': None,
        'details': {}
    }
    
    try:
        start_time = time.time()
        cursor = connection.cursor()
        
        # Simple query based on database type
        if db_type.lower() == 'mysql':
            cursor.execute("SELECT 1 as test_value")
            cursor.execute("SELECT VERSION() as version")
            version_result = cursor.fetchone()
            result['details']['version'] = version_result[0] if version_result else 'Unknown'
        elif db_type.lower() == 'postgresql':
            cursor.execute("SELECT 1 as test_value")
            cursor.execute("SELECT version() as version")
            version_result = cursor.fetchone()
            result['details']['version'] = version_result[0] if version_result else 'Unknown'
        elif db_type.lower() == 'sqlite':
            cursor.execute("SELECT 1 as test_value")
            cursor.execute("SELECT sqlite_version() as version")
            version_result = cursor.fetchone()
            result['details']['version'] = f"SQLite {version_result[0]}" if version_result else 'Unknown'
        
        test_result = cursor.fetchone()
        cursor.close()
        
        end_time = time.time()
        result['response_time_ms'] = (end_time - start_time) * 1000
        result['success'] = test_result[0] == 1
        
    except Exception as e:
        result['error'] = str(e)
    
    return result

def get_database_statistics(connection, db_type: str, database: str) -> Dict[str, Any]:
    """Get database statistics"""
    result = {
        'test': 'database_statistics',
        'success': False,
        'response_time_ms': None,
        'error': None,
        'details': {}
    }
    
    try:
        start_time = time.time()
        cursor = connection.cursor()
        
        if db_type.lower() == 'mysql':
            # Get table count
            cursor.execute(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '{database}'")
            table_count = cursor.fetchone()[0]
            
            # Get database size
            cursor.execute(f"""
                SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                FROM information_schema.tables 
                WHERE table_schema = '{database}'
            """)
            size_result = cursor.fetchone()
            size_mb = size_result[0] if size_result[0] else 0
            
            # Get connection count
            cursor.execute("SHOW STATUS LIKE 'Threads_connected'")
            connections_result = cursor.fetchone()
            active_connections = int(connections_result[1]) if connections_result else 0
            
            result['details'] = {
                'table_count': table_count,
                'size_mb': float(size_mb),
                'active_connections': active_connections
            }
        
        elif db_type.lower() == 'postgresql':
            # Get table count
            cursor.execute(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_catalog = '{database}' AND table_schema = 'public'")
            table_count = cursor.fetchone()[0]
            
            # Get database size
            cursor.execute(f"SELECT pg_size_pretty(pg_database_size('{database}')) as size")
            size_result = cursor.fetchone()
            
            # Get connection count
            cursor.execute(f"SELECT numbackends FROM pg_stat_database WHERE datname = '{database}'")
            connections_result = cursor.fetchone()
            active_connections = connections_result[0] if connections_result else 0
            
            result['details'] = {
                'table_count': table_count,
                'size_pretty': size_result[0] if size_result else 'Unknown',
                'active_connections': active_connections
            }
        
        elif db_type.lower() == 'sqlite':
            # Get table count
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            
            # Get database size (file size)
            try:
                import os
                file_size = os.path.getsize(database)
                size_mb = file_size / (1024 * 1024)
            except:
                size_mb = 0
            
            result['details'] = {
                'table_count': table_count,
                'size_mb': round(size_mb, 2),
                'file_path': database
            }
        
        cursor.close()
        end_time = time.time()
        result['response_time_ms'] = (end_time - start_time) * 1000
        result['success'] = True
        
    except Exception as e:
        result['error'] = str(e)
    
    return result

def test_query_performance(connection, db_type: str) -> Dict[str, Any]:
    """Test query performance with various operations"""
    result = {
        'test': 'query_performance',
        'success': False,
        'response_time_ms': None,
        'error': None,
        'details': {}
    }
    
    try:
        cursor = connection.cursor()
        performance_tests = []
        
        # Test 1: Simple SELECT
        start_time = time.time()
        if db_type.lower() == 'mysql':
            cursor.execute("SELECT BENCHMARK(10000, MD5('test'))")
        elif db_type.lower() == 'postgresql':
            cursor.execute("SELECT MD5('test') FROM generate_series(1, 1000)")
        else:  # SQLite
            cursor.execute("SELECT 'test' FROM (SELECT 0 UNION SELECT 1 UNION SELECT 2)")
        
        cursor.fetchall()
        end_time = time.time()
        performance_tests.append({
            'test': 'computation_test',
            'duration_ms': (end_time - start_time) * 1000
        })
        
        # Test 2: Current timestamp (multiple times)
        start_time = time.time()
        for _ in range(100):
            if db_type.lower() == 'mysql':
                cursor.execute("SELECT NOW()")
            elif db_type.lower() == 'postgresql':
                cursor.execute("SELECT NOW()")
            else:  # SQLite
                cursor.execute("SELECT datetime('now')")
            cursor.fetchone()
        end_time = time.time()
        performance_tests.append({
            'test': '100_timestamp_queries',
            'duration_ms': (end_time - start_time) * 1000
        })
        
        cursor.close()
        
        result['details']['performance_tests'] = performance_tests
        result['response_time_ms'] = sum(test['duration_ms'] for test in performance_tests)
        result['success'] = True
        
    except Exception as e:
        result['error'] = str(e)
    
    return result

def get_table_health(connection, db_type: str, database: str) -> Dict[str, Any]:
    """Get health information for database tables"""
    result = {
        'test': 'table_health',
        'success': False,
        'response_time_ms': None,
        'error': None,
        'details': {}
    }
    
    try:
        start_time = time.time()
        cursor = connection.cursor()
        tables_info = []
        
        if db_type.lower() == 'mysql':
            cursor.execute(f"""
                SELECT 
                    table_name,
                    table_rows,
                    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
                    ROUND((data_length / 1024 / 1024), 2) AS data_size_mb,
                    ROUND((index_length / 1024 / 1024), 2) AS index_size_mb
                FROM information_schema.tables 
                WHERE table_schema = '{database}' 
                    AND table_type = 'BASE TABLE'
                ORDER BY (data_length + index_length) DESC
                LIMIT 20
            """)
        elif db_type.lower() == 'postgresql':
            cursor.execute(f"""
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins,
                    n_tup_upd,
                    n_tup_del,
                    n_live_tup,
                    n_dead_tup
                FROM pg_stat_user_tables
                ORDER BY n_live_tup DESC
                LIMIT 20
            """)
        else:  # SQLite
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            
        rows = cursor.fetchall()
        
        for row in rows:
            if db_type.lower() == 'mysql':
                tables_info.append({
                    'table_name': row[0],
                    'estimated_rows': row[1] or 0,
                    'total_size_mb': float(row[2] or 0),
                    'data_size_mb': float(row[3] or 0),
                    'index_size_mb': float(row[4] or 0)
                })
            elif db_type.lower() == 'postgresql':
                tables_info.append({
                    'schema': row[0],
                    'table_name': row[1],
                    'inserts': row[2],
                    'updates': row[3],
                    'deletes': row[4],
                    'live_tuples': row[5],
                    'dead_tuples': row[6]
                })
            else:  # SQLite
                table_name = row[0]
                # Get row count for each table
                cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                row_count = cursor.fetchone()[0]
                tables_info.append({
                    'table_name': table_name,
                    'row_count': row_count
                })
        
        cursor.close()
        end_time = time.time()
        
        result['details']['tables'] = tables_info
        result['details']['table_count'] = len(tables_info)
        result['response_time_ms'] = (end_time - start_time) * 1000
        result['success'] = True
        
    except Exception as e:
        result['error'] = str(e)
    
    return result

def main():
    """Main execution function"""
    
    print("Starting Database Health Check...")
    print(f"Script execution started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get parameters
    db_type = get_parameter('db_type', 'mysql')
    host = get_parameter('host', 'localhost')
    port = get_parameter('port', 3306 if db_type.lower() == 'mysql' else 5432 if db_type.lower() == 'postgresql' else None, int)
    database = get_parameter('database')
    username = get_parameter('username')
    password = get_parameter('password')
    timeout = get_parameter('timeout', 30, int)
    
    if not database:
        print("ERROR: Database name is required")
        sys.exit(1)
    
    # Set default ports
    if port is None:
        if db_type.lower() == 'mysql':
            port = 3306
        elif db_type.lower() == 'postgresql':
            port = 5432
    
    print(f"Parameters:")
    print(f"  Database Type: {db_type}")
    print(f"  Host: {host}")
    print(f"  Port: {port}")
    print(f"  Database: {database}")
    print(f"  Username: {username or 'Not specified'}")
    print(f"  Timeout: {timeout} seconds")
    print()
    
    connection = None
    all_results = []
    overall_success = True
    
    try:
        # Establish connection
        print("Establishing database connection...")
        connection = create_database_connection(db_type, host, port, database, username, password, timeout)
        print("✓ Connection established successfully")
        print()
        
        # Run health checks
        tests = [
            ("Basic Connectivity", lambda: test_basic_connectivity(connection, db_type)),
            ("Database Statistics", lambda: get_database_statistics(connection, db_type, database)),
            ("Query Performance", lambda: test_query_performance(connection, db_type)),
            ("Table Health", lambda: get_table_health(connection, db_type, database))
        ]
        
        for test_name, test_func in tests:
            print(f"Running {test_name}...")
            try:
                result = test_func()
                all_results.append(result)
                
                if result['success']:
                    print(f"  ✓ SUCCESS - {result['response_time_ms']:.2f}ms")
                    if result['details']:
                        for key, value in result['details'].items():
                            if isinstance(value, (int, float)):
                                print(f"    {key}: {value}")
                            elif isinstance(value, str) and len(value) < 100:
                                print(f"    {key}: {value}")
                else:
                    print(f"  ✗ FAILED - {result.get('error', 'Unknown error')}")
                    overall_success = False
                    
            except Exception as e:
                print(f"  ✗ ERROR - {str(e)}")
                all_results.append({
                    'test': test_name.lower().replace(' ', '_'),
                    'success': False,
                    'error': str(e)
                })
                overall_success = False
            print()
    
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        overall_success = False
        all_results.append({
            'test': 'connection',
            'success': False,
            'error': str(e)
        })
    
    finally:
        if connection:
            try:
                connection.close()
                print("Connection closed successfully")
            except:
                pass
    
    # Summary
    print("="*60)
    print("DATABASE HEALTH CHECK SUMMARY")
    print("="*60)
    successful_tests = sum(1 for result in all_results if result.get('success', False))
    total_tests = len(all_results)
    
    print(f"Total tests run: {total_tests}")
    print(f"Successful tests: {successful_tests}")
    print(f"Failed tests: {total_tests - successful_tests}")
    print(f"Overall success rate: {(successful_tests/max(total_tests, 1))*100:.1f}%")
    print()
    
    # Save results
    output_dir = os.environ.get('SCRIPT_OUTPUT_DIR', '/app/output')
    output_file = os.path.join(output_dir, 'db_health_results.json')
    
    try:
        output_data = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'parameters': {
                'db_type': db_type,
                'host': host,
                'port': port,
                'database': database,
                'timeout': timeout
            },
            'overall_success': overall_success,
            'summary': {
                'total_tests': total_tests,
                'successful_tests': successful_tests,
                'failed_tests': total_tests - successful_tests,
                'success_rate': (successful_tests/max(total_tests, 1))*100
            },
            'test_results': all_results
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"Results saved to: {output_file}")
        
    except Exception as e:
        print(f"WARNING: Failed to save results file: {e}")
    
    # Exit with appropriate code
    if overall_success:
        print("\n✓ All database health checks passed!")
        sys.exit(0)
    else:
        print("\n✗ Some database health checks failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()