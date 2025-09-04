/**
 * VPC API Routes
 * RESTful endpoints for VPC resource management
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ServiceFactory } from '../../services';
import { NetworkValidationSchemas, baseQueryParamsSchema } from '../../schemas';
import { validateRequest, asyncHandler } from '../middleware/validation';

const router = Router();
const vpcService = ServiceFactory.getVpcService();

// Parameter validation schemas
const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const vpcIdParamsSchema = Joi.object({
  vpcId: Joi.string().pattern(/^vpc-[a-f0-9]{8,17}$/).required(),
  region: Joi.string().valid(
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
  ).required()
});

const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(100).required()
});

// Query parameters schema for VPC-specific filters
const vpcQuerySchema = baseQueryParamsSchema.concat(Joi.object({
  cidrBlock: Joi.string().optional(),
  vpcId: Joi.string().pattern(/^vpc-[a-f0-9]{8,17}$/).optional()
}));

/**
 * GET /api/vpcs
 * Get all VPCs with filtering, pagination, and sorting
 */
router.get('/', 
  validateRequest({ query: vpcQuerySchema }),
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
        cidrBlock: req.query.cidrBlock as string,
        searchTerm: req.query.search as string
      }
    };

    // Remove undefined filters
    Object.keys(queryOptions.filters).forEach(key => {
      if (queryOptions.filters[key] === undefined) {
        delete queryOptions.filters[key];
      }
    });

    const result = await vpcService.findAll(queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpcs/:id
 * Get VPC by internal ID
 */
router.get('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await vpcService.findById(req.params.id);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpcs/aws/:vpcId/:region
 * Get VPC by AWS VPC ID and region
 */
router.get('/aws/:vpcId/:region',
  validateRequest({ params: vpcIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await vpcService.findByVpcId(req.params.vpcId, req.params.region);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/vpcs/region/:region
 * Get VPCs by region
 */
router.get('/region/:region',
  validateRequest({ 
    params: Joi.object({ region: Joi.string().required() }),
    query: vpcQuerySchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptions = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC'
    };

    const result = await vpcService.findByRegion(req.params.region, queryOptions);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/vpcs
 * Create a new VPC
 */
router.post('/',
  validateRequest({ body: NetworkValidationSchemas.vpc.create }),
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Extract user ID from authentication middleware
    const userId = req.user?.id || 'system';
    
    const result = await vpcService.create(req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'DUPLICATE_VPC' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * POST /api/vpcs/bulk
 * Bulk create VPCs
 */
router.post('/bulk',
  validateRequest({ 
    body: Joi.object({
      vpcs: Joi.array().items(NetworkValidationSchemas.vpc.create).min(1).max(100).required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcService.bulkCreate(req.body.vpcs, userId);
    
    res.status(result.success ? 200 : 400).json(result);
  })
);

/**
 * PUT /api/vpcs/:id
 * Update VPC by internal ID
 */
router.put('/:id',
  validateRequest({ 
    params: idParamsSchema,
    body: NetworkValidationSchemas.vpc.update 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcService.update(req.params.id, req.body, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_NOT_FOUND' ? 404 : 
                         result.errors?.[0]?.code === 'DUPLICATE_VPC' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/vpcs/:id
 * Delete VPC by internal ID
 */
router.delete('/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcService.delete(req.params.id, userId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'VPC_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

/**
 * DELETE /api/vpcs/bulk
 * Bulk delete VPCs
 */
router.delete('/bulk',
  validateRequest({ body: bulkDeleteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || 'system';
    
    const result = await vpcService.bulkDelete(req.body.ids, userId);
    
    res.json(result);
  })
);

// Add OpenAPI documentation comments for Swagger generation
/**
 * @swagger
 * components:
 *   schemas:
 *     VPC:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         vpcId:
 *           type: string
 *           pattern: ^vpc-[a-f0-9]{8,17}$
 *         region:
 *           type: string
 *           enum: [us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-southeast-1, ap-southeast-2, ap-northeast-1]
 *         cidrBlock:
 *           type: string
 *         state:
 *           type: string
 *           enum: [pending, available, active, inactive, deleting, deleted, failed]
 *         name:
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
 * /api/vpcs:
 *   get:
 *     summary: Get all VPCs
 *     tags: [VPCs]
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
 *                         $ref: '#/components/schemas/VPC'
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
 *     summary: Create a new VPC
 *     tags: [VPCs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VPC'
 *     responses:
 *       201:
 *         description: VPC created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: VPC already exists
 */

export default router;