/**
 * Customer Gateway API Routes
 * RESTful endpoints for Customer Gateway resource management
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ServiceFactory } from '../../services';
import { NetworkValidationSchemas, baseQueryParamsSchema } from '../../schemas';
import { validateRequest, asyncHandler } from '../middleware/validation';

const router = Router();
const customerGatewayService = ServiceFactory.getCustomerGatewayService();

// Parameter validation schemas
const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const cgwIdParamsSchema = Joi.object({
  cgwId: Joi.string().pattern(/^cgw-[a-f0-9]{8,17}$/).required(),
  region: Joi.string().valid(
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
  ).required()
});

const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(100).required()
});

// Query parameters schema for Customer Gateway-specific filters
const customerGatewayQuerySchema = baseQueryParamsSchema.concat(Joi.object({
  type: Joi.string().valid('ipsec.1').optional(),
  state: Joi.string().valid('pending', 'available', 'deleting', 'deleted').optional(),
  ipAddress: Joi.string().ip({ version: ['ipv4'] }).optional()
}));

/**
 * GET /api/customer-gateways
 * Get all Customer Gateways with filtering, pagination, and sorting
 */
router.get('/', 
  validateRequest({ query: customerGatewayQuerySchema }),
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
        type: req.query.type as string,
        ipAddress: req.query.ipAddress as string,
        searchTerm: req.query.search as string
      }
    };

    // Remove undefined filters
    Object.keys(queryOptions.filters).forEach(key => {
      if (queryOptions.filters[key] === undefined) {
        delete queryOptions.filters[key];
      }
    });

    const result = await customerGatewayService.findAll(queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/customer-gateways/:id
 * Get Customer Gateway by internal ID
 */
router.get('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await customerGatewayService.findById(req.params.id);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'CUSTOMER_GATEWAY_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/customer-gateways/aws/:cgwId/:region
 * Get Customer Gateway by AWS Customer Gateway ID and region
 */
router.get('/aws/:cgwId/:region',
  validateRequest({ params: cgwIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await customerGatewayService.findByCustomerGatewayId(req.params.cgwId, req.params.region);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'CUSTOMER_GATEWAY_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/customer-gateways/region/:region
 * Get Customer Gateways by region
 */
router.get('/region/:region',
  validateRequest({ 
    params: Joi.object({ region: Joi.string().required() }),
    query: customerGatewayQuerySchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptions = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC'
    };

    const result = await customerGatewayService.findByRegion(req.params.region, queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/customer-gateways
 * Create a new Customer Gateway
 */
router.post('/',
  validateRequest({ body: NetworkValidationSchemas.customerGateway.create }),
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Extract user ID from authentication middleware
    const userId = req.user?.id || 'system';
    
    const result = await customerGatewayService.create(req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'DUPLICATE_CUSTOMER_GATEWAY' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * POST /api/customer-gateways/bulk
 * Bulk create Customer Gateways
 */
router.post('/bulk',
  validateRequest({ 
    body: Joi.object({
      customerGateways: Joi.array().items(NetworkValidationSchemas.customerGateway.create).min(1).max(100).required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await customerGatewayService.bulkCreate(req.body.customerGateways, userId);
    
    res.status(result.success ? 200 : 400).json(result);
  })
);

/**
 * PUT /api/customer-gateways/:id
 * Update Customer Gateway by internal ID
 */
router.put('/:id',
  validateRequest({ 
    params: idParamsSchema,
    body: NetworkValidationSchemas.customerGateway.update 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await customerGatewayService.update(req.params.id, req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'CUSTOMER_GATEWAY_NOT_FOUND' ? 404 : 
                         result.errors?.[0]?.code === 'DUPLICATE_CUSTOMER_GATEWAY' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/customer-gateways/:id
 * Delete Customer Gateway by internal ID
 */
router.delete('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await customerGatewayService.delete(req.params.id, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'CUSTOMER_GATEWAY_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/customer-gateways/bulk
 * Bulk delete Customer Gateways
 */
router.delete('/bulk',
  validateRequest({ body: bulkDeleteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await customerGatewayService.bulkDelete(req.body.ids, userId);
    
    res.json(result);
  })
);

// Add OpenAPI documentation comments for Swagger generation
/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerGateway:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         awsCustomerGatewayId:
 *           type: string
 *           pattern: ^cgw-[a-f0-9]{8,17}$
 *         region:
 *           type: string
 *           enum: [us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-southeast-1, ap-southeast-2, ap-northeast-1]
 *         state:
 *           type: string
 *           enum: [pending, available, deleting, deleted]
 *         type:
 *           type: string
 *           enum: [ipsec.1]
 *         name:
 *           type: string
 *         ipAddress:
 *           type: string
 *           format: ipv4
 *         bgpAsn:
 *           type: integer
 *           minimum: 1
 *           maximum: 4294967294
 *         certificateArn:
 *           type: string
 *           pattern: ^arn:aws:acm:[a-z0-9-]+:\d{12}:certificate\/[a-f0-9-]{36}$
 *         deviceName:
 *           type: string
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
 * /api/customer-gateways:
 *   get:
 *     summary: Get all Customer Gateways
 *     tags: [Customer Gateways]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ipsec.1]
 *       - in: query
 *         name: ipAddress
 *         schema:
 *           type: string
 *           format: ipv4
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
 *                         $ref: '#/components/schemas/CustomerGateway'
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
 *     summary: Create a new Customer Gateway
 *     tags: [Customer Gateways]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerGateway'
 *     responses:
 *       201:
 *         description: Customer Gateway created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Customer Gateway already exists
 */

export default router;