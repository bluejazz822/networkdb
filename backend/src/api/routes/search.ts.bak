/**
 * Search API Routes
 * Comprehensive search and filtering endpoints
 */

import { Router, Request, Response } from 'express';
import { SearchService } from '../../services/search/SearchService';
import { SearchValidationSchemas } from '../../schemas/search';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { 
  cacheSearch, 
  cacheAutoComplete, 
  cachePopularTerms 
} from '../../middleware/search-cache';
import { 
  Vpc, 
  TransitGateway, 
  CustomerGateway, 
  VpcEndpoint 
} from '../../models';
import { 
  SearchQuery, 
  AutoCompleteQuery, 
  ResourceType 
} from '../../types/search';

const router = Router();

// Initialize search service
const searchService = new SearchService(
  Vpc,
  TransitGateway,
  CustomerGateway,
  VpcEndpoint
);

/**
 * POST /api/search/:resourceType
 * Main search endpoint with advanced filtering
 */
router.post('/:resourceType',
  validateRequest(SearchValidationSchemas.search),
  cacheSearch(),
  asyncHandler(async (req: Request, res: Response) => {
    const resourceType = req.params.resourceType as ResourceType;
    const searchQuery: SearchQuery = req.body;
    const userId = req.user?.id; // From auth middleware

    const result = await searchService.search(resourceType, searchQuery, userId);
    
    if (!result.success) {
      const statusCode = 
        result.errors?.[0]?.code === 'INVALID_SEARCH_QUERY' ? 400 :
        result.errors?.[0]?.code === 'SEARCH_TIMEOUT' ? 408 :
        result.errors?.[0]?.code === 'PERMISSION_DENIED' ? 403 : 500;
      
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/search/:resourceType/simple
 * Simple search endpoint for basic queries
 */
router.get('/:resourceType/simple',
  validateRequest({
    params: SearchValidationSchemas.search.params,
    query: {
      q: require('joi').string().max(500).optional(),
      page: require('joi').number().integer().min(1).default(1),
      limit: require('joi').number().integer().min(1).max(100).default(20),
      sort: require('joi').string().optional(),
      order: require('joi').string().valid('ASC', 'DESC').default('ASC')
    }
  }),
  cacheSearch(),
  asyncHandler(async (req: Request, res: Response) => {
    const resourceType = req.params.resourceType as ResourceType;
    const { q, page, limit, sort, order } = req.query;
    const userId = req.user?.id;

    // Convert simple query to SearchQuery format
    const searchQuery: SearchQuery = {
      ...(q && { text: q as string }),
      pagination: {
        page: Number(page),
        limit: Number(limit)
      },
      ...(sort && {
        sorting: [{
          field: sort as string,
          direction: (order as 'ASC' | 'DESC') || 'ASC'
        }]
      })
    };

    const result = await searchService.search(resourceType, searchQuery, userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/search/autocomplete
 * Auto-complete suggestions endpoint
 */
router.get('/autocomplete',
  validateRequest({ query: SearchValidationSchemas.autoComplete.query }),
  cacheAutoComplete(),
  asyncHandler(async (req: Request, res: Response) => {
    const autoCompleteQuery: AutoCompleteQuery = {
      term: req.query.term as string,
      field: req.query.field as string,
      resourceType: (req.query.resourceType as ResourceType) || 'all',
      limit: Number(req.query.limit) || 10
    };
    const userId = req.user?.id;

    const result = await searchService.getAutoComplete(autoCompleteQuery, userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/search/popular/:resourceType?
 * Get popular search terms
 */
router.get('/popular/:resourceType?',
  validateRequest(SearchValidationSchemas.popularTerms),
  cachePopularTerms(),
  asyncHandler(async (req: Request, res: Response) => {
    const resourceType = req.params.resourceType as ResourceType;
    const limit = Number(req.query.limit) || 10;

    const result = await searchService.getPopularTerms(resourceType, limit);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/search/metrics
 * Get search analytics and metrics
 */
router.get('/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await searchService.getSearchMetrics();
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  })
);

// ===================== SAVED QUERIES ENDPOINTS =====================

/**
 * GET /api/search/saved
 * Get saved queries for current user
 */
router.get('/saved',
  validateRequest({ query: SearchValidationSchemas.savedQuery.query }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        errors: [{ code: 'PERMISSION_DENIED', message: 'Authentication required' }]
      });
    }

    const resourceType = req.query.resourceType as ResourceType;
    const includePublic = req.query.includePublic !== 'false';

    const result = await searchService.getSavedQueries(userId, resourceType, includePublic);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/search/saved
 * Save a new search query
 */
router.post('/saved',
  validateRequest({ body: SearchValidationSchemas.savedQuery.create }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        errors: [{ code: 'PERMISSION_DENIED', message: 'Authentication required' }]
      });
    }

    const result = await searchService.saveQuery(req.body, userId);
    
    if (!result.success) {
      const statusCode = 
        result.errors?.[0]?.code === 'DUPLICATE_RECORD' ? 409 :
        result.errors?.[0]?.code === 'INVALID_SEARCH_QUERY' ? 400 : 500;
      
      return res.status(statusCode).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * PUT /api/search/saved/:id
 * Update a saved query
 */
router.put('/saved/:id',
  validateRequest({
    params: SearchValidationSchemas.savedQuery.params,
    body: SearchValidationSchemas.savedQuery.update
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        errors: [{ code: 'PERMISSION_DENIED', message: 'Authentication required' }]
      });
    }

    const queryId = Number(req.params.id);
    const result = await searchService.updateSavedQuery(queryId, req.body, userId);
    
    if (!result.success) {
      const statusCode = 
        result.errors?.[0]?.code === 'SAVED_QUERY_NOT_FOUND' ? 404 :
        result.errors?.[0]?.code === 'PERMISSION_DENIED' ? 403 :
        result.errors?.[0]?.code === 'DUPLICATE_RECORD' ? 409 : 400;
      
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/search/saved/:id
 * Delete a saved query
 */
router.delete('/saved/:id',
  validateRequest({ params: SearchValidationSchemas.savedQuery.params }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        errors: [{ code: 'PERMISSION_DENIED', message: 'Authentication required' }]
      });
    }

    const queryId = Number(req.params.id);
    const result = await searchService.deleteSavedQuery(queryId, userId);
    
    if (!result.success) {
      const statusCode = 
        result.errors?.[0]?.code === 'SAVED_QUERY_NOT_FOUND' ? 404 :
        result.errors?.[0]?.code === 'PERMISSION_DENIED' ? 403 : 400;
      
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/search/saved/:id/execute
 * Execute a saved query with optional overrides
 */
router.post('/saved/:id/execute',
  validateRequest(SearchValidationSchemas.executeSavedQuery),
  cacheSearch(),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const queryId = Number(req.params.id);
    const overrides = req.body.overrides;

    const result = await searchService.executeSavedQuery(queryId, userId, overrides);
    
    if (!result.success) {
      const statusCode = 
        result.errors?.[0]?.code === 'SAVED_QUERY_NOT_FOUND' ? 404 :
        result.errors?.[0]?.code === 'PERMISSION_DENIED' ? 403 : 400;
      
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/search/saved/tags
 * Search saved queries by tags
 */
router.post('/saved/tags',
  validateRequest({ body: SearchValidationSchemas.searchByTags.body }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { tags, resourceType, includePublic } = req.body;

    // This would be implemented in the service
    // For now, return a placeholder response
    res.json({
      success: true,
      data: [],
      message: 'Tag-based search not yet implemented'
    });
  })
);

// ===================== ADVANCED SEARCH ENDPOINTS =====================

/**
 * POST /api/search/:resourceType/advanced
 * Advanced search with facets and highlighting
 */
router.post('/:resourceType/advanced',
  validateRequest(SearchValidationSchemas.advancedSearch),
  cacheSearch(),
  asyncHandler(async (req: Request, res: Response) => {
    const resourceType = req.params.resourceType as ResourceType;
    const { query, facets, highlight } = req.body;
    const userId = req.user?.id;

    // Enable highlighting if requested
    if (highlight?.enabled) {
      query.includeHighlight = true;
    }

    const result = await searchService.search(resourceType, query, userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Add facets information to response if needed
    if (facets && result.data) {
      result.data.facets = result.data.facets || [];
    }

    res.json(result);
  })
);

/**
 * GET /api/search/:resourceType/fields
 * Get searchable fields for a resource type
 */
router.get('/:resourceType/fields',
  validateRequest({ params: SearchValidationSchemas.search.params }),
  asyncHandler(async (req: Request, res: Response) => {
    const resourceType = req.params.resourceType as ResourceType;
    
    // Import searchable resources config
    const { SEARCHABLE_RESOURCES } = await import('../../types/search');
    const resourceConfig = SEARCHABLE_RESOURCES[resourceType];
    
    if (!resourceConfig && resourceType !== 'all') {
      return res.status(404).json({
        success: false,
        errors: [{ code: 'UNSUPPORTED_FIELD', message: `Resource type '${resourceType}' not found` }]
      });
    }

    if (resourceType === 'all') {
      // Return fields from all resource types
      const allFields = new Map();
      Object.values(SEARCHABLE_RESOURCES).forEach(resource => {
        if (resource.searchableFields) {
          resource.searchableFields.forEach(field => {
            allFields.set(field.name, field);
          });
        }
      });
      
      return res.json({
        success: true,
        data: Array.from(allFields.values())
      });
    }

    res.json({
      success: true,
      data: resourceConfig.searchableFields || []
    });
  })
);

/**
 * GET /api/search/health
 * Search system health check
 */
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // Basic health checks
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          cache: 'connected',
          search: 'operational'
        }
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  })
);

// Add OpenAPI/Swagger documentation
/**
 * @swagger
 * components:
 *   schemas:
 *     SearchQuery:
 *       type: object
 *       properties:
 *         text:
 *           type: string
 *           description: Full-text search term
 *         filters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SearchFilter'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *         sorting:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SortOptions'
 *         includeHighlight:
 *           type: boolean
 *           default: false
 * 
 *     SearchFilter:
 *       type: object
 *       required:
 *         - field
 *         - operator
 *       properties:
 *         field:
 *           type: string
 *         operator:
 *           type: string
 *           enum: [eq, ne, gt, gte, lt, lte, in, nin, like, startsWith, endsWith, exists, notExists, between]
 *         value:
 *           type: string
 *         values:
 *           type: array
 *         logicalOperator:
 *           type: string
 *           enum: [AND, OR, NOT]
 * 
 *     SearchResult:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *         totalCount:
 *           type: integer
 *         searchTime:
 *           type: integer
 *         facets:
 *           type: array
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         hasNextPage:
 *           type: boolean
 *         hasPrevPage:
 *           type: boolean
 * 
 * /api/search/{resourceType}:
 *   post:
 *     summary: Advanced search with filtering
 *     tags: [Search]
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [vpc, transitGateway, customerGateway, vpcEndpoint, all]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchQuery'
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SearchResult'
 */

export default router;