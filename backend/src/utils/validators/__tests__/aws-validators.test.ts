/**
 * AWS Validators Tests
 * 
 * Comprehensive tests for AWS-specific validation functions
 */

import {
  validateAwsVpcId,
  validateAwsSubnetId,
  validateAwsAccountId,
  validateAwsTransitGatewayId,
  validateAwsResourceId,
  validateCidrBlock,
  validateIpv4Address,
  validateIpv6CidrBlock,
  validateAwsRegion,
  validateAvailabilityZone
} from '../aws-validators';

import { ValidationLocation } from '../types';

describe('AWS Validators', () => {
  let mockLocation: ValidationLocation;

  beforeEach(() => {
    mockLocation = {
      row: 1,
      column: 1,
      fieldPath: 'test'
    };
  });

  describe('AWS Resource ID Validation', () => {
    describe('validateAwsVpcId', () => {
      it('should validate valid VPC IDs', () => {
        const validIds = [
          'vpc-1234567890abcdef0',
          'vpc-12345678',
          'vpc-0123456789abcdef0',
          'vpc-abcdef1234567890'
        ];

        for (const id of validIds) {
          const result = validateAwsVpcId(id, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid VPC IDs', () => {
        const invalidIds = [
          'vpc-123', // Too short
          'vpc-123456789012345678901234567890', // Too long
          'vpc-xyz123', // Invalid characters
          'subnet-1234567890abcdef0', // Wrong prefix
          'vpc-', // Missing identifier
          '', // Empty
          'vpc 1234567890abcdef0' // Contains space
        ];

        for (const id of invalidIds) {
          const result = validateAwsVpcId(id, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should warn about whitespace issues', () => {
        const result = validateAwsVpcId(' vpc-1234567890abcdef0 ', mockLocation);
        
        expect(result.isValid).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe('AWS_ID_WHITESPACE');
      });
    });

    describe('validateAwsSubnetId', () => {
      it('should validate valid subnet IDs', () => {
        const validIds = [
          'subnet-1234567890abcdef0',
          'subnet-12345678',
          'subnet-0123456789abcdef0'
        ];

        for (const id of validIds) {
          const result = validateAwsSubnetId(id, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid subnet IDs', () => {
        const invalidIds = [
          'subnet-123',
          'vpc-1234567890abcdef0',
          'subnet-xyz123',
          'invalid-subnet-id'
        ];

        for (const id of invalidIds) {
          const result = validateAwsSubnetId(id, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });

    describe('validateAwsAccountId', () => {
      it('should validate valid account IDs', () => {
        const validIds = [
          '123456789012',
          '000000000000',
          '999999999999'
        ];

        for (const id of validIds) {
          const result = validateAwsAccountId(id, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid account IDs', () => {
        const invalidIds = [
          '12345678901', // Too short
          '1234567890123', // Too long
          '12345678901a', // Contains letter
          '123-456-789012', // Contains hyphens
          ''
        ];

        for (const id of invalidIds) {
          const result = validateAwsAccountId(id, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });

    describe('validateAwsTransitGatewayId', () => {
      it('should validate valid transit gateway IDs', () => {
        const validIds = [
          'tgw-1234567890abcdef0',
          'tgw-0123456789abcdef0'
        ];

        for (const id of validIds) {
          const result = validateAwsTransitGatewayId(id, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid transit gateway IDs', () => {
        const invalidIds = [
          'tgw-123',
          'vpc-1234567890abcdef0',
          'tgw-xyz123'
        ];

        for (const id of invalidIds) {
          const result = validateAwsTransitGatewayId(id, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('CIDR Block Validation', () => {
    describe('validateCidrBlock', () => {
      it('should validate valid CIDR blocks', () => {
        const validCidrs = [
          '10.0.0.0/16',
          '192.168.1.0/24',
          '172.16.0.0/12',
          '0.0.0.0/0',
          '10.0.0.0/8',
          '192.168.0.1/32'
        ];

        for (const cidr of validCidrs) {
          const result = validateCidrBlock(cidr);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid CIDR blocks', () => {
        const invalidCidrs = [
          '10.0.0.0/33', // Invalid prefix
          '256.0.0.0/16', // Invalid IP
          '10.0.0.0/-1', // Negative prefix
          '10.0.0.0', // Missing prefix
          '10.0.0.0/16/24', // Double prefix
          'invalid-cidr',
          '10.0.0/16' // Incomplete IP
        ];

        for (const cidr of invalidCidrs) {
          const result = validateCidrBlock(cidr);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should warn about non-network addresses', () => {
        const result = validateCidrBlock('10.0.0.1/24'); // Should be 10.0.0.0/24
        
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe('INVALID_NETWORK_ADDRESS');
        expect(result.warnings[0].suggestion).toContain('10.0.0.0/24');
      });

      it('should validate private IP ranges when required', () => {
        const publicCidr = '8.8.8.0/24';
        const result = validateCidrBlock(publicCidr, { allowPrivateOnly: true });

        expect(result.isValid).toBe(false);
        expect(result.errors[0].code).toBe('PUBLIC_IP_NOT_ALLOWED');
      });

      it('should warn about prefix size constraints', () => {
        const smallPrefix = validateCidrBlock('10.0.0.0/6', { minPrefix: 8 });
        expect(smallPrefix.warnings).toContainEqual(
          expect.objectContaining({ code: 'CIDR_PREFIX_TOO_SMALL' })
        );

        const largePrefix = validateCidrBlock('10.0.0.0/32', { maxPrefix: 30 });
        expect(largePrefix.warnings).toContainEqual(
          expect.objectContaining({ code: 'CIDR_PREFIX_TOO_LARGE' })
        );
      });

      it('should detect reserved IP ranges', () => {
        const reservedRanges = [
          '127.0.0.0/8',   // Loopback
          '169.254.0.0/16', // Link-local
          '224.0.0.0/4',   // Multicast
          '240.0.0.0/4'    // Reserved
        ];

        for (const cidr of reservedRanges) {
          const result = validateCidrBlock(cidr);
          expect(result.warnings).toContainEqual(
            expect.objectContaining({ code: 'RESERVED_IP_RANGE' })
          );
        }
      });
    });
  });

  describe('IP Address Validation', () => {
    describe('validateIpv4Address', () => {
      it('should validate valid IPv4 addresses', () => {
        const validIPs = [
          '192.168.1.1',
          '10.0.0.1',
          '172.16.1.100',
          '8.8.8.8',
          '0.0.0.0',
          '255.255.255.255'
        ];

        for (const ip of validIPs) {
          const result = validateIpv4Address(ip, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid IPv4 addresses', () => {
        const invalidIPs = [
          '256.1.1.1',
          '192.168.1',
          '192.168.1.1.1',
          'not-an-ip',
          '192.168.-1.1',
          '192.168.1.256'
        ];

        for (const ip of invalidIPs) {
          const result = validateIpv4Address(ip, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should warn about special IP addresses', () => {
        const specialIPs = [
          { ip: '192.168.1.0', type: 'Network address' },
          { ip: '192.168.1.255', type: 'Potential broadcast address' },
          { ip: '192.168.1.1', type: 'Common gateway address' }
        ];

        for (const { ip } of specialIPs) {
          const result = validateIpv4Address(ip, mockLocation);
          expect(result.warnings.length).toBeGreaterThan(0);
          expect(result.warnings[0].code).toBe('SPECIAL_IP_ADDRESS');
        }
      });
    });

    describe('validateIpv6CidrBlock', () => {
      it('should validate valid IPv6 CIDR blocks', () => {
        const validCidrs = [
          '2001:db8::/32',
          'fe80::/10',
          '::1/128',
          '2001:db8:85a3::8a2e:370:7334/128'
        ];

        for (const cidr of validCidrs) {
          const result = validateIpv6CidrBlock(cidr, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid IPv6 CIDR blocks', () => {
        const invalidCidrs = [
          '2001:db8::/129', // Invalid prefix
          'invalid-ipv6/64',
          '2001:db8::', // Missing prefix
          '2001:db8::/-1' // Negative prefix
        ];

        for (const cidr of invalidCidrs) {
          const result = validateIpv6CidrBlock(cidr, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('AWS Region and Availability Zone Validation', () => {
    describe('validateAwsRegion', () => {
      it('should validate valid AWS regions', () => {
        const validRegions = [
          'us-east-1',
          'us-west-2',
          'eu-west-1',
          'ap-southeast-1',
          'ca-central-1',
          'sa-east-1'
        ];

        for (const region of validRegions) {
          const result = validateAwsRegion(region, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid region formats', () => {
        const invalidRegions = [
          'invalid-region',
          'us-east',
          'useast1',
          'us-east-1-extra',
          ''
        ];

        for (const region of invalidRegions) {
          const result = validateAwsRegion(region, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should warn about unknown regions', () => {
        const result = validateAwsRegion('xx-unknown-1', mockLocation);
        
        // Should pass format validation but warn about unknown region
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe('UNKNOWN_AWS_REGION');
      });
    });

    describe('validateAvailabilityZone', () => {
      it('should validate valid availability zones', () => {
        const validAZs = [
          'us-east-1a',
          'us-west-2b',
          'eu-west-1c',
          'ap-southeast-1d'
        ];

        for (const az of validAZs) {
          const result = validateAvailabilityZone(az, undefined, mockLocation);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should reject invalid AZ formats', () => {
        const invalidAZs = [
          'us-east-1',  // Missing letter suffix
          'us-east-1-a', // Wrong format
          'invalid-az',
          'us-east-1aa' // Double letter
        ];

        for (const az of invalidAZs) {
          const result = validateAvailabilityZone(az, undefined, mockLocation);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should validate AZ matches region', () => {
        const result = validateAvailabilityZone('us-west-2a', 'us-east-1', mockLocation);
        
        expect(result.isValid).toBe(false);
        expect(result.errors[0].code).toBe('AZ_REGION_MISMATCH');
      });

      it('should accept AZ that matches region', () => {
        const result = validateAvailabilityZone('us-west-2a', 'us-west-2', mockLocation);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Generic AWS Resource ID Validation', () => {
    it('should validate any AWS resource ID type', () => {
      const resourceTests = [
        { id: 'vpc-1234567890abcdef0', type: 'VPC_ID' },
        { id: 'subnet-1234567890abcdef0', type: 'SUBNET_ID' },
        { id: 'igw-1234567890abcdef0', type: 'INTERNET_GATEWAY_ID' },
        { id: 'rtb-1234567890abcdef0', type: 'ROUTE_TABLE_ID' }
      ];

      for (const { id, type } of resourceTests) {
        const result = validateAwsResourceId(id, type as any, `AWS ${type}`, mockLocation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should handle validation errors consistently', () => {
      const result = validateAwsResourceId(null as any, 'VPC_ID', 'AWS VPC ID', mockLocation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_AWS_RESOURCE_ID');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values', () => {
      const validators = [
        () => validateAwsVpcId(null as any),
        () => validateAwsVpcId(undefined as any),
        () => validateCidrBlock(null as any),
        () => validateCidrBlock(undefined as any),
        () => validateIpv4Address(null as any),
        () => validateIpv4Address(undefined as any)
      ];

      for (const validator of validators) {
        const result = validator();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle non-string inputs', () => {
      const nonStringInputs = [123, {}, [], true, false];

      for (const input of nonStringInputs) {
        const result = validateAwsVpcId(input as any);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should include location information in errors', () => {
      const location: ValidationLocation = {
        row: 5,
        column: 3,
        fieldPath: 'awsVpcId',
        sheet: 'Resources'
      };

      const result = validateAwsVpcId('invalid-id', location);
      
      expect(result.errors[0].location).toEqual(location);
    });
  });

  describe('Performance', () => {
    it('should complete validation quickly', () => {
      const startTime = Date.now();
      
      // Run multiple validations
      for (let i = 0; i < 1000; i++) {
        validateAwsVpcId('vpc-1234567890abcdef0');
        validateCidrBlock('10.0.0.0/16');
        validateAwsRegion('us-west-2');
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});