/**
 * Repository Integration Test
 * Tests the basic functionality of our repository pattern
 */

describe('Repository Integration', () => {
  describe('Repository Pattern', () => {
    it('should export all repository classes', () => {
      // Test that we can import our repositories
      const VpcRepository = require('../../repositories/VpcRepository').VpcRepository;
      const TransitGatewayRepository = require('../../repositories/TransitGatewayRepository').TransitGatewayRepository;
      const CustomerGatewayRepository = require('../../repositories/CustomerGatewayRepository').CustomerGatewayRepository;
      const VpcEndpointRepository = require('../../repositories/VpcEndpointRepository').VpcEndpointRepository;

      expect(VpcRepository).toBeDefined();
      expect(TransitGatewayRepository).toBeDefined();
      expect(CustomerGatewayRepository).toBeDefined();
      expect(VpcEndpointRepository).toBeDefined();
    });

    it('should instantiate repository classes', () => {
      const VpcRepository = require('../../repositories/VpcRepository').VpcRepository;
      const TransitGatewayRepository = require('../../repositories/TransitGatewayRepository').TransitGatewayRepository;
      const CustomerGatewayRepository = require('../../repositories/CustomerGatewayRepository').CustomerGatewayRepository;
      const VpcEndpointRepository = require('../../repositories/VpcEndpointRepository').VpcEndpointRepository;

      const vpcRepo = new VpcRepository();
      const tgwRepo = new TransitGatewayRepository();
      const cgwRepo = new CustomerGatewayRepository();
      const vpcEndpointRepo = new VpcEndpointRepository();

      expect(vpcRepo).toBeInstanceOf(VpcRepository);
      expect(tgwRepo).toBeInstanceOf(TransitGatewayRepository);
      expect(cgwRepo).toBeInstanceOf(CustomerGatewayRepository);
      expect(vpcEndpointRepo).toBeInstanceOf(VpcEndpointRepository);
    });

    it('should have correct AWS ID field methods', () => {
      const VpcRepository = require('../../repositories/VpcRepository').VpcRepository;
      const TransitGatewayRepository = require('../../repositories/TransitGatewayRepository').TransitGatewayRepository;
      const CustomerGatewayRepository = require('../../repositories/CustomerGatewayRepository').CustomerGatewayRepository;
      const VpcEndpointRepository = require('../../repositories/VpcEndpointRepository').VpcEndpointRepository;

      const vpcRepo = new VpcRepository();
      const tgwRepo = new TransitGatewayRepository();
      const cgwRepo = new CustomerGatewayRepository();
      const vpcEndpointRepo = new VpcEndpointRepository();

      expect((vpcRepo as any).getAwsIdField()).toBe('awsVpcId');
      expect((tgwRepo as any).getAwsIdField()).toBe('awsTransitGatewayId');
      expect((cgwRepo as any).getAwsIdField()).toBe('awsCustomerGatewayId');
      expect((vpcEndpointRepo as any).getAwsIdField()).toBe('awsVpcEndpointId');
    });

    it('should export all models', () => {
      const models = require('../../models');

      expect(models.Vpc).toBeDefined();
      expect(models.TransitGateway).toBeDefined();
      expect(models.CustomerGateway).toBeDefined();
      expect(models.VpcEndpoint).toBeDefined();
    });

    it('should export repository interfaces', () => {
      const interfaces = require('../../repositories/interfaces');

      expect(interfaces.IBaseRepository).toBeDefined();
      expect(interfaces.INetworkResourceRepository).toBeDefined();
      expect(interfaces.PaginatedResult).toBeDefined();
      expect(interfaces.QueryOptions).toBeDefined();
    });
  });

  describe('Base Repository Methods', () => {
    it('should have common CRUD methods available', () => {
      const VpcRepository = require('../../repositories/VpcRepository').VpcRepository;
      const vpcRepo = new VpcRepository();

      // Check that all base methods are available
      expect(vpcRepo.findById).toBeDefined();
      expect(vpcRepo.findOne).toBeDefined();
      expect(vpcRepo.findAll).toBeDefined();
      expect(vpcRepo.findWithPagination).toBeDefined();
      expect(vpcRepo.findBy).toBeDefined();
      expect(vpcRepo.count).toBeDefined();
      expect(vpcRepo.exists).toBeDefined();
      expect(vpcRepo.create).toBeDefined();
      expect(vpcRepo.bulkCreate).toBeDefined();
      expect(vpcRepo.updateById).toBeDefined();
      expect(vpcRepo.updateBy).toBeDefined();
      expect(vpcRepo.deleteById).toBeDefined();
      expect(vpcRepo.deleteBy).toBeDefined();
      expect(vpcRepo.search).toBeDefined();
    });

    it('should have network resource specific methods', () => {
      const VpcRepository = require('../../repositories/VpcRepository').VpcRepository;
      const vpcRepo = new VpcRepository();

      // Check network resource specific methods
      expect(vpcRepo.findByAwsId).toBeDefined();
      expect(vpcRepo.findByAccount).toBeDefined();
      expect(vpcRepo.findByRegion).toBeDefined();
      expect(vpcRepo.findByAccountAndRegion).toBeDefined();
      expect(vpcRepo.findByEnvironment).toBeDefined();
      expect(vpcRepo.findByProject).toBeDefined();
      expect(vpcRepo.findStale).toBeDefined();
      expect(vpcRepo.updateSyncInfo).toBeDefined();
    });
  });
});