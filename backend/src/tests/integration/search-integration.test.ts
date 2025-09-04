/**
 * Search Integration Tests
 * Comprehensive tests for the search API functionality
 */

import request from 'supertest';
import app from '../../index';
import { sequelize, Vpc, TransitGateway, SavedQuery } from '../../models';
import { SearchService } from '../../services/search/SearchService';
import { SearchRepository } from '../../repositories/search/SearchRepository';
import { SavedQueryRepository } from '../../repositories/search/SavedQueryRepository';
import { SearchQuery, ResourceType } from '../../types/search';

describe('Search Integration Tests', () => {
  let testUserId: string;
  let testVpcId: number;
  let testTransitGatewayId: number;
  let testSavedQueryId: number;

  beforeAll(async () => {
    // Initialize test database
    await sequelize.sync({ force: true });
    testUserId = 'test-user-123';
  });

  beforeEach(async () => {
    // Create test data
    const vpc = await Vpc.create({
      vpcId: 'vpc-12345678',
      region: 'us-east-1',
      name: 'Test VPC',
      cidrBlock: '10.0.0.0/16',
      state: 'available',
      environment: 'test',
      owner: 'test-owner',
      awsAccountId: '123456789012',
      tags: { Environment: 'test', Project: 'network-cmdb' }
    });
    testVpcId = vpc.id;

    const tgw = await TransitGateway.create({
      transitGatewayId: 'tgw-12345678',
      region: 'us-east-1',
      name: 'Test Transit Gateway',
      state: 'available',
      environment: 'test',
      owner: 'test-owner',
      awsAccountId: '123456789012',
      tags: { Environment: 'test', Project: 'network-cmdb' }
    });
    testTransitGatewayId = tgw.id;
  });

  afterEach(async () => {
    // Clean up test data
    await SavedQuery.destroy({ where: {}, force: true });
    await Vpc.destroy({ where: {}, force: true });
    await TransitGateway.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Basic Search Functionality', () => {
    test('should perform simple text search across VPCs', async () => {
      const searchQuery: SearchQuery = {
        text: 'Test VPC',
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].name).toBe('Test VPC');
      expect(response.body.data.totalCount).toBe(1);
    });

    test('should perform search across all resource types', async () => {
      const searchQuery: SearchQuery = {
        text: 'test',
        pagination: { page: 1, limit: 20 }
      };

      const response = await request(app)
        .post('/api/search/all')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.length).toBeGreaterThanOrEqual(2); // VPC + TGW
    });

    test('should handle empty search results gracefully', async () => {
      const searchQuery: SearchQuery = {
        text: 'nonexistent-resource',
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(0);
      expect(response.body.data.totalCount).toBe(0);
    });
  });

  describe('Advanced Filtering', () => {
    test('should filter VPCs by region', async () => {
      const searchQuery: SearchQuery = {
        filters: [{
          field: 'region',
          operator: 'eq',
          value: 'us-east-1'
        }],
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].region).toBe('us-east-1');
    });

    test('should filter with multiple conditions (AND)', async () => {
      const searchQuery: SearchQuery = {
        filters: [
          {
            field: 'region',
            operator: 'eq',
            value: 'us-east-1'
          },
          {
            field: 'state',
            operator: 'eq',
            value: 'available'
          }
        ],
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].region).toBe('us-east-1');
      expect(response.body.data.data[0].state).toBe('available');
    });

    test('should filter with IN operator', async () => {
      const searchQuery: SearchQuery = {
        filters: [{
          field: 'region',
          operator: 'in',
          values: ['us-east-1', 'us-west-2']
        }],
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
    });

    test('should filter with LIKE operator', async () => {
      const searchQuery: SearchQuery = {
        filters: [{
          field: 'name',
          operator: 'like',
          value: 'Test'
        }],
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].name).toContain('Test');
    });
  });

  describe('Sorting and Pagination', () => {
    test('should sort results by name ascending', async () => {
      // Create additional VPC for sorting test
      await Vpc.create({
        vpcId: 'vpc-87654321',
        region: 'us-east-1',
        name: 'Another VPC',
        cidrBlock: '10.1.0.0/16',
        state: 'available',
        environment: 'test',
        owner: 'test-owner',
        awsAccountId: '123456789012',
        tags: {}
      });

      const searchQuery: SearchQuery = {
        sorting: [{
          field: 'name',
          direction: 'ASC'
        }],
        pagination: { page: 1, limit: 10 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.data[0].name).toBe('Another VPC');
      expect(response.body.data.data[1].name).toBe('Test VPC');
    });

    test('should handle pagination correctly', async () => {
      // Create additional VPCs for pagination test
      for (let i = 0; i < 5; i++) {
        await Vpc.create({
          vpcId: `vpc-pagination${i}`,
          region: 'us-east-1',
          name: `Pagination VPC ${i}`,
          cidrBlock: `10.${i}.0.0/16`,
          state: 'available',
          environment: 'test',
          owner: 'test-owner',
          awsAccountId: '123456789012',
          tags: {}
        });
      }

      const searchQuery: SearchQuery = {
        pagination: { page: 2, limit: 3 }
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(3);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(3);
      expect(response.body.data.hasNextPage).toBe(false);
      expect(response.body.data.hasPrevPage).toBe(true);
    });
  });

  describe('Auto-Complete Functionality', () => {
    test('should provide auto-complete suggestions', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({
          term: 'Test',
          resourceType: 'vpc',
          field: 'name',
          limit: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    test('should handle short terms gracefully', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({
          term: 'T',
          resourceType: 'vpc',
          limit: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
    });
  });

  describe('Saved Queries', () => {
    test('should save a search query', async () => {
      const savedQueryData = {
        name: 'Test Saved Query',
        description: 'A test saved query',
        query: {
          text: 'Test VPC',
          filters: [{
            field: 'region',
            operator: 'eq',
            value: 'us-east-1'
          }]
        },
        resourceType: 'vpc' as ResourceType,
        isPublic: false,
        tags: ['test', 'vpc']
      };

      const response = await request(app)
        .post('/api/search/saved')
        .set('user', JSON.stringify({ id: testUserId })) // Mock auth
        .send(savedQueryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Saved Query');
      expect(response.body.data.userId).toBe(testUserId);
      testSavedQueryId = response.body.data.id;
    });

    test('should get saved queries for user', async () => {
      // First create a saved query
      const savedQuery = await SavedQuery.create({
        name: 'User Query',
        description: 'Test query',
        query: { text: 'test' },
        userId: testUserId,
        resourceType: 'vpc',
        isPublic: false,
        tags: ['test']
      });

      const response = await request(app)
        .get('/api/search/saved')
        .set('user', JSON.stringify({ id: testUserId }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('User Query');
    });

    test('should execute a saved query', async () => {
      // Create a saved query
      const savedQuery = await SavedQuery.create({
        name: 'Executable Query',
        description: 'Test executable query',
        query: {
          text: 'Test VPC',
          pagination: { page: 1, limit: 10 }
        },
        userId: testUserId,
        resourceType: 'vpc',
        isPublic: false,
        tags: []
      });

      const response = await request(app)
        .post(`/api/search/saved/${savedQuery.id}/execute`)
        .set('user', JSON.stringify({ id: testUserId }))
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].name).toBe('Test VPC');
    });

    test('should update a saved query', async () => {
      const savedQuery = await SavedQuery.create({
        name: 'Original Query',
        description: 'Original description',
        query: { text: 'original' },
        userId: testUserId,
        resourceType: 'vpc',
        isPublic: false,
        tags: []
      });

      const updateData = {
        name: 'Updated Query',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/search/saved/${savedQuery.id}`)
        .set('user', JSON.stringify({ id: testUserId }))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Query');
      expect(response.body.data.description).toBe('Updated description');
    });

    test('should delete a saved query', async () => {
      const savedQuery = await SavedQuery.create({
        name: 'Query to Delete',
        query: { text: 'delete me' },
        userId: testUserId,
        resourceType: 'vpc',
        isPublic: false,
        tags: []
      });

      const response = await request(app)
        .delete(`/api/search/saved/${savedQuery.id}`)
        .set('user', JSON.stringify({ id: testUserId }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBe(true);

      // Verify it's deleted
      const deletedQuery = await SavedQuery.findByPk(savedQuery.id);
      expect(deletedQuery).toBeNull();
    });
  });

  describe('Popular Terms and Metrics', () => {
    test('should get popular search terms', async () => {
      const response = await request(app)
        .get('/api/search/popular/vpc')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    test('should get search metrics', async () => {
      const response = await request(app)
        .get('/api/search/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queryCount).toBeDefined();
      expect(response.body.data.averageResponseTime).toBeDefined();
      expect(response.body.data.popularFields).toBeDefined();
    });
  });

  describe('Simple Search Endpoint', () => {
    test('should perform simple GET search', async () => {
      const response = await request(app)
        .get('/api/search/vpc/simple')
        .query({
          q: 'Test VPC',
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].name).toBe('Test VPC');
    });
  });

  describe('Advanced Search Features', () => {
    test('should get searchable fields for resource type', async () => {
      const response = await request(app)
        .get('/api/search/vpc/fields')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Check that common VPC fields are present
      const fieldNames = response.body.data.map((field: any) => field.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('vpcId');
      expect(fieldNames).toContain('region');
    });

    test('should perform advanced search with facets', async () => {
      const searchQuery = {
        query: {
          text: 'Test',
          pagination: { page: 1, limit: 10 }
        },
        facets: ['region', 'state'],
        highlight: {
          enabled: true,
          fields: ['name']
        }
      };

      const response = await request(app)
        .post('/api/search/vpc/advanced')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.facets).toBeDefined();
    });
  });

  describe('Health Check', () => {
    test('should return search system health', async () => {
      const response = await request(app)
        .get('/api/search/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid resource type', async () => {
      const searchQuery: SearchQuery = {
        text: 'test'
      };

      const response = await request(app)
        .post('/api/search/invalid-type')
        .send(searchQuery)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should validate required fields in search query', async () => {
      const response = await request(app)
        .post('/api/search/vpc')
        .send({}) // Empty query
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle invalid filter operators', async () => {
      const searchQuery: SearchQuery = {
        filters: [{
          field: 'region',
          operator: 'invalid-operator' as any,
          value: 'us-east-1'
        }]
      };

      const response = await request(app)
        .post('/api/search/vpc')
        .send(searchQuery)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should handle permission denied for saved queries', async () => {
      const savedQuery = await SavedQuery.create({
        name: 'Private Query',
        query: { text: 'private' },
        userId: 'other-user',
        resourceType: 'vpc',
        isPublic: false,
        tags: []
      });

      const response = await request(app)
        .put(`/api/search/saved/${savedQuery.id}`)
        .set('user', JSON.stringify({ id: testUserId }))
        .send({ name: 'Hacked' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].code).toBe('PERMISSION_DENIED');
    });
  });
});

describe('Search Service Unit Tests', () => {
  let searchService: SearchService;
  let searchRepository: SearchRepository;
  let savedQueryRepository: SavedQueryRepository;

  beforeEach(() => {
    searchService = new SearchService(Vpc, TransitGateway, {} as any, {} as any);
    searchRepository = new SearchRepository(Vpc, TransitGateway, {} as any, {} as any);
    savedQueryRepository = new SavedQueryRepository();
  });

  test('should validate search queries', () => {
    const validQuery: SearchQuery = {
      text: 'test',
      filters: [{
        field: 'region',
        operator: 'eq',
        value: 'us-east-1'
      }]
    };

    const errors = searchRepository.validateSearchQuery('vpc', validQuery);
    expect(errors).toHaveLength(0);
  });

  test('should detect invalid fields in filters', () => {
    const invalidQuery: SearchQuery = {
      filters: [{
        field: 'invalidField',
        operator: 'eq',
        value: 'test'
      }]
    };

    const errors = searchRepository.validateSearchQuery('vpc', invalidQuery);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('invalidField');
  });

  test('should suggest database indexes for optimization', () => {
    const indexes = searchRepository.getSuggestedIndexes('vpc');
    expect(indexes.length).toBeGreaterThan(0);
    expect(indexes.some(index => index.includes('CREATE INDEX'))).toBe(true);
  });
});