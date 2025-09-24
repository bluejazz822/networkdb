/**
 * Resource Relationship API Routes
 * RESTful endpoints for relationship mapping, dependency analysis, and impact assessment
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ResourceRelationshipService } from '../../services/ResourceRelationshipService';
import { DependencyTracker } from '../../graph/algorithms/DependencyTracker';
import { ImpactAnalyzer } from '../../graph/algorithms/ImpactAnalyzer';
import { ResourceRelationship, ResourceType, CloudProvider, RelationshipType } from '../../models/ResourceRelationship';
import { RelationshipPath } from '../../models/RelationshipPath';
import { Op } from 'sequelize';

const router = Router();
const relationshipService = new ResourceRelationshipService();
const dependencyTracker = new DependencyTracker();
const impactAnalyzer = new ImpactAnalyzer();

// Validation middleware
const validateRequest = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: errors.array()
      }
    });
  }
  next();
};

// ======================================
// RELATIONSHIP MANAGEMENT ENDPOINTS
// ======================================

/**
 * GET /api/resource-relationships
 * List resource relationships with filtering
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('source_type').optional().isString(),
  query('source_id').optional().isString(),
  query('target_type').optional().isString(),
  query('target_id').optional().isString(),
  query('relationship_type').optional().isString(),
  query('provider').optional().isString(),
  query('critical_only').optional().isBoolean().toBoolean(),
  query('min_confidence').optional().isFloat({ min: 0, max: 1 }),
  query('min_strength').optional().isInt({ min: 1, max: 10 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      source_type,
      source_id,
      target_type,
      target_id,
      relationship_type,
      provider,
      critical_only,
      min_confidence,
      min_strength
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: any = { status: 'active' };

    // Apply filters
    if (source_type) {
      whereClause.source_resource_type = source_type;
    }

    if (source_id) {
      whereClause.source_resource_id = source_id;
    }

    if (target_type) {
      whereClause.target_resource_type = target_type;
    }

    if (target_id) {
      whereClause.target_resource_id = target_id;
    }

    if (relationship_type) {
      whereClause.relationship_type = relationship_type;
    }

    if (provider) {
      whereClause[Op.or] = [
        { source_provider: provider },
        { target_provider: provider }
      ];
    }

    if (critical_only) {
      whereClause.is_critical = true;
    }

    if (min_confidence) {
      whereClause.confidence_score = { [Op.gte]: min_confidence };
    }

    if (min_strength) {
      whereClause.strength = { [Op.gte]: min_strength };
    }

    const { rows: relationships, count: total } = await ResourceRelationship.findAndCountAll({
      where: whereClause,
      order: [['strength', 'DESC'], ['confidence_score', 'DESC']],
      limit: Number(limit),
      offset
    });

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        relationships,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch relationships',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/resource-relationships
 * Create a new resource relationship
 */
router.post('/', [
  body('source_resource_type').isString().notEmpty(),
  body('source_resource_id').isString().notEmpty(),
  body('source_provider').isString().notEmpty(),
  body('target_resource_type').isString().notEmpty(),
  body('target_resource_id').isString().notEmpty(),
  body('target_provider').isString().notEmpty(),
  body('relationship_type').isString().notEmpty(),
  body('confidence_score').optional().isFloat({ min: 0, max: 1 }),
  body('strength').optional().isInt({ min: 1, max: 10 }),
  body('is_critical').optional().isBoolean(),
  body('direction').optional().isIn(['unidirectional', 'bidirectional']),
  body('discovery_method').optional().isString(),
  body('metadata').optional().isObject()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      source_resource_type,
      source_resource_id,
      source_provider,
      target_resource_type,
      target_resource_id,
      target_provider,
      relationship_type,
      confidence_score,
      strength,
      is_critical,
      direction,
      discovery_method,
      metadata
    } = req.body;

    const relationship = await relationshipService.createRelationship(
      source_resource_type as ResourceType,
      source_resource_id,
      source_provider as CloudProvider,
      target_resource_type as ResourceType,
      target_resource_id,
      target_provider as CloudProvider,
      relationship_type as RelationshipType,
      {
        confidence: confidence_score,
        strength,
        isCritical: is_critical,
        direction,
        discoveryMethod: discovery_method,
        metadata
      }
    );

    res.status(201).json({
      success: true,
      data: { relationship }
    });

  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create relationship',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/resource-relationships/:resourceType/:resourceId/dependencies
 * Get dependencies for a specific resource
 */
router.get('/:resourceType/:resourceId/dependencies', [
  param('resourceType').isString().notEmpty(),
  param('resourceId').isString().notEmpty(),
  query('direction').optional().isIn(['incoming', 'outgoing', 'both']),
  query('max_depth').optional().isInt({ min: 1, max: 10 }).toInt()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { direction = 'both', max_depth } = req.query;

    const dependencyAnalysis = await relationshipService.analyzeDependencies(
      resourceType as ResourceType,
      resourceId,
      {
        maxDepth: max_depth ? Number(max_depth) : undefined
      }
    );

    res.json({
      success: true,
      data: dependencyAnalysis
    });

  } catch (error) {
    console.error('Error analyzing dependencies:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: 'Failed to analyze dependencies',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/resource-relationships/:resourceType/:resourceId/discover
 * Discover relationships for a specific resource
 */
router.post('/:resourceType/:resourceId/discover', [
  param('resourceType').isString().notEmpty(),
  param('resourceId').isString().notEmpty(),
  body('provider').isString().notEmpty(),
  body('max_depth').optional().isInt({ min: 1, max: 5 }),
  body('include_inactive').optional().isBoolean(),
  body('min_confidence').optional().isFloat({ min: 0, max: 1 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { provider, max_depth, include_inactive, min_confidence } = req.body;

    const relationships = await relationshipService.discoverResourceRelationships(
      resourceType as ResourceType,
      resourceId,
      provider as CloudProvider,
      {
        maxDepth: max_depth,
        includeInactive: include_inactive,
        minConfidence: min_confidence
      }
    );

    res.json({
      success: true,
      data: { relationships }
    });

  } catch (error) {
    console.error('Error discovering relationships:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DISCOVERY_ERROR',
        message: 'Failed to discover relationships',
        details: error.message
      }
    });
  }
});

// ======================================
// DEPENDENCY ANALYSIS ENDPOINTS
// ======================================

/**
 * GET /api/resource-relationships/graph/dependency-metrics
 * Get dependency graph metrics
 */
router.get('/graph/dependency-metrics', async (req: Request, res: Response) => {
  try {
    const graph = await dependencyTracker.buildDependencyGraph();
    const metrics = dependencyTracker.calculateDependencyMetrics(graph);

    // Add cycle detection
    const cycles = await dependencyTracker.detectCyclicDependencies(graph);
    metrics.cyclicDependencies = cycles.length;

    res.json({
      success: true,
      data: { metrics, cycles }
    });

  } catch (error) {
    console.error('Error calculating dependency metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: 'Failed to calculate dependency metrics',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/resource-relationships/graph/critical-paths
 * Find critical dependency paths
 */
router.get('/graph/critical-paths', [
  query('max_depth').optional().isInt({ min: 1, max: 10 }).toInt()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { max_depth = 5 } = req.query;

    const criticalPaths = await dependencyTracker.findCriticalPaths(undefined, Number(max_depth));

    res.json({
      success: true,
      data: { criticalPaths }
    });

  } catch (error) {
    console.error('Error finding critical paths:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: 'Failed to find critical paths',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/resource-relationships/graph/cross-cloud-analysis
 * Analyze cross-cloud dependencies
 */
router.get('/graph/cross-cloud-analysis', async (req: Request, res: Response) => {
  try {
    const analysis = await dependencyTracker.analyzeCrossCloudDependencies();

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Error analyzing cross-cloud dependencies:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: 'Failed to analyze cross-cloud dependencies',
        details: error.message
      }
    });
  }
});

// ======================================
// IMPACT ANALYSIS ENDPOINTS
// ======================================

/**
 * POST /api/resource-relationships/impact/analyze-failure
 * Analyze impact of resource failure
 */
router.post('/impact/analyze-failure', [
  body('resource_type').isString().notEmpty(),
  body('resource_id').isString().notEmpty(),
  body('provider').isString().notEmpty(),
  body('include_secondary_effects').optional().isBoolean(),
  body('max_propagation_depth').optional().isInt({ min: 1, max: 10 }),
  body('confidence_threshold').optional().isFloat({ min: 0, max: 1 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      resource_type,
      resource_id,
      provider,
      include_secondary_effects,
      max_propagation_depth,
      confidence_threshold
    } = req.body;

    const impactScenario = await impactAnalyzer.analyzeResourceFailure(
      resource_type as ResourceType,
      resource_id,
      provider as CloudProvider,
      {
        includeSecondaryEffects: include_secondary_effects,
        maxPropagationDepth: max_propagation_depth,
        confidenceThreshold: confidence_threshold
      }
    );

    res.json({
      success: true,
      data: { impactScenario }
    });

  } catch (error) {
    console.error('Error analyzing failure impact:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPACT_ANALYSIS_ERROR',
        message: 'Failed to analyze failure impact',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/resource-relationships/impact/analyze-change
 * Analyze impact of resource changes
 */
router.post('/impact/analyze-change', [
  body('resource_type').isString().notEmpty(),
  body('resource_id').isString().notEmpty(),
  body('provider').isString().notEmpty(),
  body('change_type').isIn(['configuration', 'scaling', 'migration', 'replacement']),
  body('change_details').optional().isObject(),
  body('rollback_plan').optional().isBoolean(),
  body('graduated_rollout').optional().isBoolean()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      resource_type,
      resource_id,
      provider,
      change_type,
      change_details,
      rollback_plan,
      graduated_rollout
    } = req.body;

    const impactScenario = await impactAnalyzer.analyzeResourceChange(
      resource_type as ResourceType,
      resource_id,
      provider as CloudProvider,
      change_type,
      {
        changeDetails: change_details,
        rollbackPlan: rollback_plan,
        graduatedRollout: graduated_rollout
      }
    );

    res.json({
      success: true,
      data: { impactScenario }
    });

  } catch (error) {
    console.error('Error analyzing change impact:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPACT_ANALYSIS_ERROR',
        message: 'Failed to analyze change impact',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/resource-relationships/impact/analyze-security
 * Analyze security breach impact
 */
router.post('/impact/analyze-security', [
  body('resource_type').isString().notEmpty(),
  body('resource_id').isString().notEmpty(),
  body('provider').isString().notEmpty(),
  body('breach_type').isIn(['unauthorized_access', 'data_exfiltration', 'lateral_movement', 'privilege_escalation']),
  body('attack_vector').optional().isString(),
  body('time_to_detection').optional().isInt({ min: 0 }),
  body('containment_effectiveness').optional().isFloat({ min: 0, max: 1 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      resource_type,
      resource_id,
      provider,
      breach_type,
      attack_vector,
      time_to_detection,
      containment_effectiveness
    } = req.body;

    const impactScenario = await impactAnalyzer.analyzeSecurityBreach(
      resource_type as ResourceType,
      resource_id,
      provider as CloudProvider,
      breach_type,
      {
        attackVector: attack_vector,
        timeToDetection: time_to_detection,
        containmentEffectiveness: containment_effectiveness
      }
    );

    res.json({
      success: true,
      data: { impactScenario }
    });

  } catch (error) {
    console.error('Error analyzing security impact:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPACT_ANALYSIS_ERROR',
        message: 'Failed to analyze security impact',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/resource-relationships/impact/compare-scenarios
 * Compare multiple impact scenarios
 */
router.post('/impact/compare-scenarios', [
  body('scenarios').isArray({ min: 2 }),
  body('scenarios.*').isObject()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { scenarios } = req.body;

    const comparison = await impactAnalyzer.compareScenarios(scenarios);

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Error comparing scenarios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'COMPARISON_ERROR',
        message: 'Failed to compare scenarios',
        details: error.message
      }
    });
  }
});

// ======================================
// VISUALIZATION ENDPOINTS
// ======================================

/**
 * GET /api/resource-relationships/visualization/graph
 * Generate graph visualization data
 */
router.get('/visualization/graph', [
  query('providers').optional().isString(),
  query('resource_types').optional().isString(),
  query('resource_ids').optional().isString(),
  query('relationship_types').optional().isString(),
  query('min_strength').optional().isInt({ min: 1, max: 10 }),
  query('min_confidence').optional().isFloat({ min: 0, max: 1 }),
  query('critical_only').optional().isBoolean().toBoolean()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      providers,
      resource_types,
      resource_ids,
      relationship_types,
      min_strength,
      min_confidence,
      critical_only
    } = req.query;

    // Parse comma-separated values
    const resourceFilters: any = {};
    const relationshipFilters: any = {};

    if (providers) {
      resourceFilters.providers = (providers as string).split(',') as CloudProvider[];
    }

    if (resource_types) {
      resourceFilters.resourceTypes = (resource_types as string).split(',') as ResourceType[];
    }

    if (resource_ids) {
      resourceFilters.resourceIds = (resource_ids as string).split(',');
    }

    if (relationship_types) {
      relationshipFilters.relationshipTypes = (relationship_types as string).split(',') as RelationshipType[];
    }

    if (min_strength) {
      relationshipFilters.minStrength = Number(min_strength);
    }

    if (min_confidence) {
      relationshipFilters.minConfidence = Number(min_confidence);
    }

    if (critical_only) {
      relationshipFilters.includeCriticalOnly = true;
    }

    const visualizationData = await relationshipService.generateVisualizationData(
      resourceFilters,
      relationshipFilters
    );

    res.json({
      success: true,
      data: visualizationData
    });

  } catch (error) {
    console.error('Error generating visualization data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VISUALIZATION_ERROR',
        message: 'Failed to generate visualization data',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/resource-relationships/analytics/dashboard
 * Get relationship analytics dashboard data
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    // Get basic relationship counts
    const totalRelationships = await ResourceRelationship.count({ where: { status: 'active' } });
    const criticalRelationships = await ResourceRelationship.count({
      where: { status: 'active', is_critical: true }
    });
    const crossCloudRelationships = await ResourceRelationship.count({
      where: {
        status: 'active',
        [Op.ne]: [
          { source_provider: { [Op.col]: 'target_provider' } }
        ]
      }
    });

    // Get relationship breakdown by type
    const relationshipsByType = await ResourceRelationship.findAll({
      attributes: [
        'relationship_type',
        [require('sequelize').fn('COUNT', '*'), 'count']
      ],
      where: { status: 'active' },
      group: ['relationship_type'],
      raw: true
    });

    // Get provider distribution
    const providerDistribution = await ResourceRelationship.findAll({
      attributes: [
        'source_provider',
        [require('sequelize').fn('COUNT', '*'), 'count']
      ],
      where: { status: 'active' },
      group: ['source_provider'],
      raw: true
    });

    // Get recent relationship changes
    const recentPaths = await RelationshipPath.count({
      where: {
        computed_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalRelationships,
          criticalRelationships,
          crossCloudRelationships,
          recentPaths
        },
        breakdown: {
          byType: relationshipsByType,
          byProvider: providerDistribution
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching relationship analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to fetch relationship analytics',
        details: error.message
      }
    });
  }
});

export default router;