/**
 * VPC Repository Unit Tests
 */

import { VpcRepository } from '../../../repositories/VpcRepository';
import Vpc from '../../../models/Vpc';

// Mock the Vpc model
jest.mock('../../../models/Vpc');

describe('VpcRepository', () => {
  let vpcRepository: VpcRepository;
  let mockVpcModel: jest.Mocked<typeof Vpc>;

  beforeEach(() => {
    vpcRepository = new VpcRepository();
    mockVpcModel = Vpc as jest.Mocked<typeof Vpc>;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with Vpc model', () => {
      expect(vpcRepository).toBeInstanceOf(VpcRepository);
    });
  });

  describe('getAwsIdField', () => {
    it('should return the correct AWS ID field name', () => {
      const field = (vpcRepository as any).getAwsIdField();
      expect(field).toBe('awsVpcId');
    });
  });

  describe('findByAwsId', () => {
    it('should find VPC by AWS ID', async () => {
      const mockVpc = { id: 'test-id', awsVpcId: 'vpc-123456789' };
      mockVpcModel.findOne.mockResolvedValue(mockVpc as any);

      const result = await vpcRepository.findByAwsId('vpc-123456789');

      expect(mockVpcModel.findOne).toHaveBeenCalledWith({
        where: { awsVpcId: 'vpc-123456789' }
      });
      expect(result).toBe(mockVpc);
    });

    it('should return null if VPC not found', async () => {
      mockVpcModel.findOne.mockResolvedValue(null);

      const result = await vpcRepository.findByAwsId('vpc-nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockVpcModel.findOne.mockRejectedValue(error);

      await expect(vpcRepository.findByAwsId('vpc-123456789')).rejects.toThrow(
        'Failed to find Vpc by AWS ID vpc-123456789: Database error'
      );
    });
  });

  describe('findDefaultVpcs', () => {
    it('should find default VPCs', async () => {
      const mockResult = {
        count: 1,
        rows: [{ id: 'test-id', isDefault: true }]
      };
      mockVpcModel.findAndCountAll.mockResolvedValue(mockResult as any);

      const result = await vpcRepository.findDefaultVpcs();

      expect(result.data).toBe(mockResult.rows);
      expect(result.pagination.total).toBe(mockResult.count);
    });
  });

  describe('findByCidrBlock', () => {
    it('should find VPCs by CIDR block', async () => {
      const mockResult = {
        count: 1,
        rows: [{ id: 'test-id', cidrBlock: '10.0.0.0/16' }]
      };
      mockVpcModel.findAndCountAll.mockResolvedValue(mockResult as any);

      const result = await vpcRepository.findByCidrBlock('10.0.0.0/16');

      expect(result.data).toBe(mockResult.rows);
      expect(result.pagination.total).toBe(mockResult.count);
    });
  });

  describe('count', () => {
    it('should count VPCs', async () => {
      mockVpcModel.count.mockResolvedValue(5);

      const result = await vpcRepository.count();

      expect(result).toBe(5);
      expect(mockVpcModel.count).toHaveBeenCalledWith({});
    });

    it('should count VPCs with where clause', async () => {
      mockVpcModel.count.mockResolvedValue(2);

      const result = await vpcRepository.count({ isDefault: true });

      expect(result).toBe(2);
      expect(mockVpcModel.count).toHaveBeenCalledWith({
        where: { isDefault: true }
      });
    });
  });

  describe('create', () => {
    it('should create a new VPC', async () => {
      const createInput = {
        awsVpcId: 'vpc-123456789',
        awsAccountId: '123456789012',
        region: 'us-east-1',
        regionId: 'uuid-region',
        statusId: 'uuid-status',
        cidrBlock: '10.0.0.0/16',
        state: 'available'
      };
      const mockCreatedVpc = { id: 'new-vpc-id', ...createInput };
      
      mockVpcModel.create.mockResolvedValue(mockCreatedVpc as any);

      const result = await vpcRepository.create(createInput);

      expect(mockVpcModel.create).toHaveBeenCalledWith(createInput);
      expect(result).toBe(mockCreatedVpc);
    });

    it('should handle creation errors', async () => {
      const createInput = {
        awsVpcId: 'vpc-123456789',
        awsAccountId: '123456789012',
        region: 'us-east-1',
        regionId: 'uuid-region',
        statusId: 'uuid-status',
        cidrBlock: '10.0.0.0/16',
        state: 'available'
      };
      const error = new Error('Validation error');
      mockVpcModel.create.mockRejectedValue(error);

      await expect(vpcRepository.create(createInput)).rejects.toThrow(
        'Failed to create Vpc: Validation error'
      );
    });
  });

  describe('buildSearchWhere', () => {
    it('should build search where clause correctly', () => {
      const searchWhere = (vpcRepository as any).buildSearchWhere('test', {});
      
      expect(searchWhere).toHaveProperty('$or');
      expect(searchWhere.$or).toBeInstanceOf(Array);
      expect(searchWhere.$or.length).toBeGreaterThan(0);
    });
  });
});