#!/usr/bin/env python3
"""
Network Ping Check Template

@author System
@version 1.0.0

This script performs ping connectivity checks to a list of network hosts.
Useful for network monitoring and basic connectivity validation.

@param hosts string Comma-separated list of hostnames or IP addresses to ping
@param count int Number of ping packets to send (optional, default: 4)
@param timeout int Timeout in seconds for each ping (optional, default: 5)
"""

import os
import sys
import json
import subprocess
import time
from typing import List, Dict, Any

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
    elif param_type == list:
        if isinstance(value, str):
            return [item.strip() for item in value.split(',') if item.strip()]
    
    return value

def ping_host(host: str, count: int = 4, timeout: int = 5) -> Dict[str, Any]:
    """
    Ping a single host and return results
    
    Args:
        host: Hostname or IP address to ping
        count: Number of ping packets
        timeout: Timeout in seconds
        
    Returns:
        Dictionary with ping results
    """
    result = {
        'host': host,
        'success': False,
        'packets_sent': 0,
        'packets_received': 0,
        'packet_loss_percent': 100,
        'min_time': None,
        'avg_time': None,
        'max_time': None,
        'error': None
    }
    
    try:
        # Build ping command based on OS
        if os.name == 'nt':  # Windows
            cmd = ['ping', '-n', str(count), '-w', str(timeout * 1000), host]
        else:  # Unix/Linux
            cmd = ['ping', '-c', str(count), '-W', str(timeout), host]
        
        # Execute ping
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout * count + 10  # Give extra time for the command
        )
        
        if process.returncode == 0:
            result['success'] = True
            output = process.stdout
            
            # Parse output (simplified parsing)
            lines = output.split('\n')
            
            for line in lines:
                line = line.strip()
                
                # Look for packet statistics
                if 'packets transmitted' in line or 'Packets: Sent' in line:
                    if os.name == 'nt':  # Windows format
                        # Example: "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)"
                        if 'Sent' in line and 'Received' in line:
                            parts = line.split(',')
                            for part in parts:
                                part = part.strip()
                                if 'Sent' in part:
                                    result['packets_sent'] = int(part.split('=')[1].strip())
                                elif 'Received' in part:
                                    result['packets_received'] = int(part.split('=')[1].strip())
                                elif 'loss' in part and '(' in part:
                                    loss_str = part.split('(')[1].split('%')[0]
                                    result['packet_loss_percent'] = float(loss_str)
                    else:  # Unix format
                        # Example: "4 packets transmitted, 4 received, 0% packet loss"
                        parts = line.split(',')
                        if len(parts) >= 3:
                            result['packets_sent'] = int(parts[0].split()[0])
                            result['packets_received'] = int(parts[1].split()[0])
                            loss_part = parts[2].strip()
                            result['packet_loss_percent'] = float(loss_part.split('%')[0])
                
                # Look for timing statistics
                elif 'min/avg/max' in line or 'Minimum/Maximum/Average' in line:
                    if os.name == 'nt':  # Windows format
                        # Example: "Minimum = 1ms, Maximum = 2ms, Average = 1ms"
                        parts = line.split(',')
                        for part in parts:
                            part = part.strip()
                            if 'Minimum' in part:
                                result['min_time'] = float(part.split('=')[1].replace('ms', '').strip())
                            elif 'Maximum' in part:
                                result['max_time'] = float(part.split('=')[1].replace('ms', '').strip())
                            elif 'Average' in part:
                                result['avg_time'] = float(part.split('=')[1].replace('ms', '').strip())
                    else:  # Unix format
                        # Example: "rtt min/avg/max/mdev = 1.234/2.345/3.456/0.567 ms"
                        if '=' in line:
                            times_part = line.split('=')[1].strip()
                            times = times_part.split('/')[0:3]  # min/avg/max
                            if len(times) >= 3:
                                result['min_time'] = float(times[0])
                                result['avg_time'] = float(times[1])
                                result['max_time'] = float(times[2])
        else:
            result['error'] = process.stderr or f"Ping failed with return code {process.returncode}"
            
    except subprocess.TimeoutExpired:
        result['error'] = f"Ping timeout after {timeout * count + 10} seconds"
    except Exception as e:
        result['error'] = str(e)
    
    return result

def main():
    """Main execution function"""
    
    print("Starting Network Ping Check...")
    print(f"Script execution started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get parameters
    hosts_param = get_parameter('hosts', '')
    count = get_parameter('count', 4, int)
    timeout = get_parameter('timeout', 5, int)
    
    if not hosts_param:
        print("ERROR: No hosts specified. Please provide hosts parameter.")
        sys.exit(1)
    
    # Parse hosts list
    hosts = [host.strip() for host in hosts_param.split(',') if host.strip()]
    
    if not hosts:
        print("ERROR: No valid hosts found in the hosts parameter.")
        sys.exit(1)
    
    print(f"Parameters:")
    print(f"  Hosts: {hosts}")
    print(f"  Count: {count}")
    print(f"  Timeout: {timeout} seconds")
    print()
    
    # Results storage
    results = []
    total_hosts = len(hosts)
    successful_hosts = 0
    
    # Ping each host
    for i, host in enumerate(hosts, 1):
        print(f"Pinging host {i}/{total_hosts}: {host}")
        
        result = ping_host(host, count, timeout)
        results.append(result)
        
        if result['success']:
            successful_hosts += 1
            print(f"  ✓ SUCCESS - {result['packets_received']}/{result['packets_sent']} packets received")
            if result['avg_time']:
                print(f"    Average response time: {result['avg_time']:.2f}ms")
        else:
            print(f"  ✗ FAILED - {result['error'] or 'Unknown error'}")
            if result['packet_loss_percent'] < 100:
                print(f"    Partial success: {result['packets_received']}/{result['packets_sent']} packets received")
        print()
    
    # Summary
    print("="*60)
    print("PING CHECK SUMMARY")
    print("="*60)
    print(f"Total hosts checked: {total_hosts}")
    print(f"Successful hosts: {successful_hosts}")
    print(f"Failed hosts: {total_hosts - successful_hosts}")
    print(f"Success rate: {(successful_hosts/total_hosts)*100:.1f}%")
    print()
    
    # Detailed results
    print("DETAILED RESULTS:")
    print("-" * 60)
    for result in results:
        status = "SUCCESS" if result['success'] else "FAILED"
        print(f"{result['host']:30} | {status:7} | Loss: {result['packet_loss_percent']:5.1f}%", end="")
        if result['avg_time']:
            print(f" | Avg: {result['avg_time']:6.2f}ms")
        else:
            print()
    
    # Save results to output file
    output_dir = os.environ.get('SCRIPT_OUTPUT_DIR', '/app/output')
    output_file = os.path.join(output_dir, 'ping_results.json')
    
    try:
        output_data = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'parameters': {
                'hosts': hosts,
                'count': count,
                'timeout': timeout
            },
            'summary': {
                'total_hosts': total_hosts,
                'successful_hosts': successful_hosts,
                'failed_hosts': total_hosts - successful_hosts,
                'success_rate': (successful_hosts/total_hosts)*100
            },
            'results': results
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"\nResults saved to: {output_file}")
        
    except Exception as e:
        print(f"WARNING: Failed to save results file: {e}")
    
    # Exit with appropriate code
    if successful_hosts == total_hosts:
        print("\n✓ All hosts are reachable!")
        sys.exit(0)
    elif successful_hosts > 0:
        print(f"\n⚠ Partial success: {total_hosts - successful_hosts} hosts unreachable")
        sys.exit(1)
    else:
        print("\n✗ All hosts are unreachable!")
        sys.exit(2)

if __name__ == "__main__":
    main()