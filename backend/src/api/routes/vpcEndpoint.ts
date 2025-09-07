/**
 * VPC Endpoint API Routes
 * RESTful endpoints for VPC Endpoint resource management
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ServiceFactory } from '../../services';
import { NetworkValidationSchemas, baseQueryParamsSchema } from '../../schemas';
import { validateRequest, asyncHandler } from '../middleware/validation';

const router: Router = Router();
const vpcEndpointService = ServiceFactory.getVpcEndpointService();

// Parameter validation schemas
const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const vpceIdParamsSchema = Joi.object({
  vpceId: Joi.string().pattern(/^vpce-[a-f0-9]{8,17}$/).required(),
  region: Joi.string().valid(
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
  ).required()
});

const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(100).required()
});

// Query parameters schema for VPC Endpoint-specific filters
const vpcEndpointQuerySchema = baseQueryParamsSchema.concat(Joi.object({
  vpcId: Joi.string().pattern(/^vpc-[a-f0-9]{8,17}$/).optional(),
  type: Joi.string().valid('Gateway', 'Interface', 'GatewayLoadBalancer').optional(),
  state: Joi.string().valid('pending', 'available', 'deleting', 'deleted', 'rejected', 'failed').optional(),
  serviceName: Joi.string().optional()
}));

/**
 * GET /api/vpc-endpoints
 * Get all VPC Endpoints with filtering, pagination, and sorting
 */
router.get('/', 
  validateRequest({ query: vpcEndpointQuerySchema }),
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
        vpcId: req.query.vpcId as string,
        type: req.query.type as string,
        serviceName: req.query.serviceName as string,
        searchTerm: req.query.search as string
      }
    };

    // Remove undefined filters
    Object.keys(queryOptions.filters).forEach(key => {
      if (queryOptions.filters[key] === undefined) {
        delete queryOptions.filters[key];
      }
    });

    const result = await vpcEndpointService.findAll(queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpc-endpoints/:id
 * Get VPC Endpoint by internal ID
 */
router.get('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await vpcEndpointService.findById(req.params.id);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_ENDPOINT_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpc-endpoints/aws/:vpceId/:region
 * Get VPC Endpoint by AWS VPC Endpoint ID and region
 */
router.get('/aws/:vpceId/:region',
  validateRequest({ params: vpceIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await vpcEndpointService.findByVpcEndpointId(req.params.vpceId, req.params.region);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_ENDPOINT_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpc-endpoints/region/:region
 * Get VPC Endpoints by region
 */
router.get('/region/:region',
  validateRequest({ 
    params: Joi.object({ region: Joi.string().required() }),
    query: vpcEndpointQuerySchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptions = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC'
    };

    const result = await vpcEndpointService.findByRegion(req.params.region, queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpc-endpoints/vpc/:vpcId/:region
 * Get VPC Endpoints by VPC ID and region
 */
router.get('/vpc/:vpcId/:region',
  validateRequest({ 
    params: Joi.object({
      vpcId: Joi.string().pattern(/^vpc-[a-f0-9]{8,17}$/).required(),
      region: Joi.string().required()
    }),
    query: vpcEndpointQuerySchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptions = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC'
    };

    const result = await vpcEndpointService.findByVpc(req.params.vpcId, req.params.region, queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/vpc-endpoints
 * Create a new VPC Endpoint
 */
router.post('/',
  validateRequest({ body: NetworkValidationSchemas.vpcEndpoint.create }),
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Extract user ID from authentication middleware
    const userId = req.user?.id || 'system';
    
    const result = await vpcEndpointService.create(req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'DUPLICATE_VPC_ENDPOINT' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * POST /api/vpc-endpoints/bulk
 * Bulk create VPC Endpoints
 */
router.post('/bulk',
  validateRequest({ 
    body: Joi.object({
      vpcEndpoints: Joi.array().items(NetworkValidationSchemas.vpcEndpoint.create).min(1).max(100).required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcEndpointService.bulkCreate(req.body.vpcEndpoints, userId);
    
    res.status(result.success ? 200 : 400).json(result);
  })
);

/**
 * PUT /api/vpc-endpoints/:id
 * Update VPC Endpoint by internal ID
 */
router.put('/:id',
  validateRequest({ 
    params: idParamsSchema,
    body: NetworkValidationSchemas.vpcEndpoint.update 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcEndpointService.update(req.params.id, req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_ENDPOINT_NOT_FOUND' ? 404 : 
                         result.errors?.[0]?.code === 'DUPLICATE_VPC_ENDPOINT' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/vpc-endpoints/:id
 * Delete VPC Endpoint by internal ID
 */
router.delete('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcEndpointService.delete(req.params.id, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_ENDPOINT_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/vpc-endpoints/bulk
 * Bulk delete VPC Endpoints
 */
router.delete('/bulk',
  validateRequest({ body: bulkDeleteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcEndpointService.bulkDelete(req.body.ids, userId);
    
    res.json(result);
  })
);

// Add OpenAPI documentation comments for Swagger generation
/**
 * @swagger
 * components:
 *   schemas:
 *     VpcEndpoint:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         awsVpcEndpointId:
 *           type: string
 *           pattern: ^vpce-[a-f0-9]{8,17}$
 *         vpcId:
 *           type: string
 *           pattern: ^vpc-[a-f0-9]{8,17}$
 *         region:
 *           type: string
 *           enum: [us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-southeast-1, ap-southeast-2, ap-northeast-1]
 *         state:
 *           type: string
 *           enum: [pending, available, deleting, deleted, rejected, failed]
 *         type:
 *           type: string
 *           enum: [Gateway, Interface, GatewayLoadBalancer]
 *         serviceName:
 *           type: string
 *           pattern: ^com\.amazonaws(\.vpce)?(\.[a-z0-9-]+)*\.[a-z0-9-]+$
 *         name:
 *           type: string
 *         routeTableIds:
 *           type: array
 *           items:
 *             type: string
 *             pattern: ^rtb-[a-f0-9]{8,17}$
 *         subnetIds:
 *           type: array
 *           items:
 *             type: string
 *             pattern: ^subnet-[a-f0-9]{8,17}$
 *         securityGroupIds:
 *           type: array
 *           items:
 *             type: string
 *             pattern: ^sg-[a-f0-9]{8,17}$
 *         privateDnsEnabled:
 *           type: boolean
 *         requesterManaged:
 *           type: boolean
 *         dnsEntries:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               dnsName:
 *                 type: string
 *               hostedZoneId:
 *                 type: string
 *         networkInterfaceIds:
 *           type: array
 *           items:
 *             type: string
 *             pattern: ^eni-[a-f0-9]{8,17}$
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
 * /api/vpc-endpoints:
 *   get:
 *     summary: Get all VPC Endpoints
 *     tags: [VPC Endpoints]
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
 *           enum: [Gateway, Interface, GatewayLoadBalancer]
 *       - in: query
 *         name: vpcId
 *         schema:
 *           type: string
 *           pattern: ^vpc-[a-f0-9]{8,17}$
 *       - in: query
 *         name: serviceName
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
 *                         $ref: '#/components/schemas/VpcEndpoint'
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
 *     summary: Create a new VPC Endpoint
 *     tags: [VPC Endpoints]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VpcEndpoint'
 *     responses:
 *       201:
 *         description: VPC Endpoint created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: VPC Endpoint already exists
 */

export default router;