/**
 * Transit Gateway API Routes
 * RESTful endpoints for Transit Gateway resource management
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ServiceFactory } from '../../services';
import { NetworkValidationSchemas, baseQueryParamsSchema } from '../../schemas';
import { validateRequest, asyncHandler } from '../middleware/validation';

const router = Router();
const transitGatewayService = ServiceFactory.getTransitGatewayService();

// Parameter validation schemas
const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const tgwIdParamsSchema = Joi.object({
  tgwId: Joi.string().pattern(/^tgw-[a-f0-9]{8,17}$/).required(),
  region: Joi.string().valid(
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
  ).required()
});

const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(100).required()
});

// Query parameters schema for Transit Gateway-specific filters
const transitGatewayQuerySchema = baseQueryParamsSchema.concat(Joi.object({
  defaultRouteTableId: Joi.string().pattern(/^tgw-rtb-[a-f0-9]{8,17}$/).optional(),
  state: Joi.string().valid('pending', 'available', 'modifying', 'deleting', 'deleted').optional()
}));

/**
 * GET /api/transit-gateways
 * Get all Transit Gateways with filtering, pagination, and sorting
 */
router.get('/', 
  validateRequest({ query: transitGatewayQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptions = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC',
      filters: {
        region: req.query.region as string,
        state: req.query.state as string,
        environment: req.query.environment as string,
        owner: req.query.owner as string,
        defaultRouteTableId: req.query.defaultRouteTableId as string,
        searchTerm: req.query.search as string
      }
    };

    // Remove undefined filters
    Object.keys(queryOptions.filters).forEach(key => {
      if (queryOptions.filters[key] === undefined) {
        delete queryOptions.filters[key];
      }
    });

    const result = await transitGatewayService.findAll(queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/transit-gateways/:id
 * Get Transit Gateway by internal ID
 */
router.get('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await transitGatewayService.findById(req.params.id);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'TRANSIT_GATEWAY_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/transit-gateways/aws/:tgwId/:region
 * Get Transit Gateway by AWS Transit Gateway ID and region
 */
router.get('/aws/:tgwId/:region',
  validateRequest({ params: tgwIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await transitGatewayService.findByTransitGatewayId(req.params.tgwId, req.params.region);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'TRANSIT_GATEWAY_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/transit-gateways/region/:region
 * Get Transit Gateways by region
 */
router.get('/region/:region',
  validateRequest({ 
    params: Joi.object({ region: Joi.string().required() }),
    query: transitGatewayQuerySchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptions = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC'
    };

    const result = await transitGatewayService.findByRegion(req.params.region, queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/transit-gateways
 * Create a new Transit Gateway
 */
router.post('/',
  validateRequest({ body: NetworkValidationSchemas.transitGateway.create }),
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Extract user ID from authentication middleware
    const userId = req.user?.id || 'system';
    
    const result = await transitGatewayService.create(req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'DUPLICATE_TRANSIT_GATEWAY' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * POST /api/transit-gateways/bulk
 * Bulk create Transit Gateways
 */
router.post('/bulk',
  validateRequest({ 
    body: Joi.object({
      transitGateways: Joi.array().items(NetworkValidationSchemas.transitGateway.create).min(1).max(100).required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await transitGatewayService.bulkCreate(req.body.transitGateways, userId);
    
    res.status(result.success ? 200 : 400).json(result);
  })
);

/**
 * PUT /api/transit-gateways/:id
 * Update Transit Gateway by internal ID
 */
router.put('/:id',
  validateRequest({ 
    params: idParamsSchema,
    body: NetworkValidationSchemas.transitGateway.update 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await transitGatewayService.update(req.params.id, req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'TRANSIT_GATEWAY_NOT_FOUND' ? 404 : 
                         result.errors?.[0]?.code === 'DUPLICATE_TRANSIT_GATEWAY' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/transit-gateways/:id
 * Delete Transit Gateway by internal ID
 */
router.delete('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await transitGatewayService.delete(req.params.id, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'TRANSIT_GATEWAY_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/transit-gateways/bulk
 * Bulk delete Transit Gateways
 */
router.delete('/bulk',
  validateRequest({ body: bulkDeleteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await transitGatewayService.bulkDelete(req.body.ids, userId);
    
    res.json(result);
  })
);

// Add OpenAPI documentation comments for Swagger generation
/**
 * @swagger
 * components:
 *   schemas:
 *     TransitGateway:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         awsTransitGatewayId:
 *           type: string
 *           pattern: ^tgw-[a-f0-9]{8,17}$
 *         region:
 *           type: string
 *           enum: [us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-southeast-1, ap-southeast-2, ap-northeast-1]
 *         state:
 *           type: string
 *           enum: [pending, available, modifying, deleting, deleted]
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         amazonSideAsn:
 *           type: integer
 *         defaultRouteTableId:
 *           type: string
 *           pattern: ^tgw-rtb-[a-f0-9]{8,17}$
 *         defaultRouteTableAssociation:
 *           type: string
 *           enum: [enable, disable]
 *         defaultRouteTablePropagation:
 *           type: string
 *           enum: [enable, disable]
 *         dnsSupport:
 *           type: string
 *           enum: [enable, disable]
 *         multicast:
 *           type: string
 *           enum: [enable, disable]
 *         environment:
 *           type: string
 *         owner:
 *           type: string
 *         tags:
 *           type: object
 *         awsAccountId:
 *           type: string
 *           pattern: ^\d{12}$
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 * /api/transit-gateways:
 *   get:
 *     summary: Get all Transit Gateways
 *     tags: [Transit Gateways]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TransitGateway'
 *                     totalCount:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *   post:
 *     summary: Create a new Transit Gateway
 *     tags: [Transit Gateways]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitGateway'
 *     responses:
 *       201:
 *         description: Transit Gateway created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Transit Gateway already exists
 */

export default router;