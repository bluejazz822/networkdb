/**
 * Resource Relationship Service
 * Provides comprehensive relationship mapping and graph analysis capabilities
 * Integrates with existing ReportDataService infrastructure for performance optimization
 */

import { ResourceRelationship, ResourceType, CloudProvider, RelationshipType } from '../models/ResourceRelationship';
import { RelationshipChange } from '../models/RelationshipChange';
import { RelationshipPath, PathType } from '../models/RelationshipPath';
import { ReportDataService } from './ReportDataService';
import { ReportCache } from '../cache/ReportCache';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

export interface RelationshipDiscoveryOptions {
  maxDepth?: number;
  includeInactive?: boolean;
  minConfidence?: number;
  providers?: CloudProvider[];
  resourceTypes?: ResourceType[];
}

export interface DependencyAnalysisResult {
  dependencies: ResourceRelationship[];
  dependents: ResourceRelationship[];
  criticalPaths: RelationshipPath[];
  impactRadius: number;
  riskScore: number;
  recommendations: string[];
}

export interface ImpactAnalysisOptions {
  analysisType: 'failure' | 'change' | 'security' | 'performance';
  propagationDepth?: number;
  includeSecondaryEffects?: boolean;
  confidenceThreshold?: number;
}

export interface GraphVisualizationData {
  nodes: Array<{
    id: string;
    type: ResourceType;
    provider: CloudProvider;
    label: string;
    critical: boolean;
    metadata?: any;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship: RelationshipType;
    strength: number;
    confidence: number;
    critical: boolean;
    bidirectional: boolean;
  }>;
  clusters: Array<{
    id: string;
    provider: CloudProvider;
    nodes: string[];
  }>;
  metrics: {
    totalNodes: number;
    totalEdges: number;
    crossCloudConnections: number;
    criticalPaths: number;
    averageConnectivity: number;
  };
}

export class ResourceRelationshipService {
  private reportDataService: ReportDataService;
  private cache: ReportCache;

  constructor() {
    this.reportDataService = new ReportDataService();
    this.cache = new ReportCache();
  }

  // ======================================
  // RELATIONSHIP CRUD OPERATIONS
  // ======================================

  /**
   * Create a new resource relationship
   */
  async createRelationship(
    sourceType: ResourceType,
    sourceId: string,
    sourceProvider: CloudProvider,
    targetType: ResourceType,
    targetId: string,
    targetProvider: CloudProvider,
    relationshipType: RelationshipType,
    options: {
      confidence?: number;
      strength?: number;
      isCritical?: boolean;
      discoveryMethod?: string;
      metadata?: any;
      direction?: 'unidirectional' | 'bidirectional';
    } = {}
  ): Promise<ResourceRelationship> {
    const relationshipId = `rel_${uuidv4()}`;

    // Check for existing relationship
    const existing = await ResourceRelationship.findOne({
      where: {
        source_resource_type: sourceType,
        source_resource_id: sourceId,
        target_resource_type: targetType,
        target_resource_id: targetId,
        relationship_type: relationshipType,
        status: 'active'
      }
    });

    if (existing) {
      // Update existing relationship
      await existing.update({
        confidence_score: options.confidence || existing.confidence_score,
        strength: options.strength || existing.strength,
        is_critical: options.isCritical !== undefined ? options.isCritical : existing.is_critical,
        relationship_metadata: { ...existing.relationship_metadata, ...options.metadata },
        last_verified: new Date()
      });

      await this.logRelationshipChange(existing.relationship_id, 'updated', 'Relationship updated', existing);
      return existing;
    }

    // Create new relationship
    const relationship = await ResourceRelationship.create({
      relationship_id: relationshipId,
      source_resource_type: sourceType,
      source_resource_id: sourceId,
      source_provider: sourceProvider,
      target_resource_type: targetType,
      target_resource_id: targetId,
      target_provider: targetProvider,
      relationship_type: relationshipType,
      relationship_direction: options.direction || 'unidirectional',
      confidence_score: options.confidence || 1.0,
      strength: options.strength || 1,
      is_critical: options.isCritical || false,
      discovery_method: (options.discoveryMethod as any) || 'api_discovery',
      relationship_metadata: options.metadata || {}
    });

    await this.logRelationshipChange(relationshipId, 'created', 'New relationship discovered', relationship);

    // Create reverse relationship if bidirectional
    if (options.direction === 'bidirectional') {
      const reverseType = relationship.getReverseRelationshipType();
      if (reverseType) {
        await this.createRelationship(
          targetType, targetId, targetProvider,
          sourceType, sourceId, sourceProvider,
          reverseType,
          { ...options, direction: 'unidirectional' }
        );
      }
    }

    // Invalidate related caches
    await this.invalidateRelationshipCaches(sourceId, targetId);

    return relationship;
  }

  /**
   * Discover relationships for a specific resource
   */
  async discoverResourceRelationships(
    resourceType: ResourceType,
    resourceId: string,
    provider: CloudProvider,
    options: RelationshipDiscoveryOptions = {}
  ): Promise<ResourceRelationship[]> {
    const cacheKey = `relationships:${provider}:${resourceType}:${resourceId}`;

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const relationships: ResourceRelationship[] = [];

    // Use existing ReportDataService to get resource data
    const resourceData = await this.reportDataService.getResourcesByType(resourceType, {
      provider_filter: [provider],
      resource_ids: [resourceId]
    });

    if (!resourceData.success || !resourceData.data?.resources?.length) {
      return relationships;
    }

    const resource = resourceData.data.resources[0];

    // Discover relationships based on resource type and configuration
    switch (resourceType) {
      case 'vpc':
        relationships.push(...await this.discoverVPCRelationships(resource));
        break;
      case 'subnet':
        relationships.push(...await this.discoverSubnetRelationships(resource));
        break;
      case 'transit_gateway':
        relationships.push(...await this.discoverTransitGatewayRelationships(resource));
        break;
      case 'transit_gateway_attachment':
        relationships.push(...await this.discoverTransitGatewayAttachmentRelationships(resource));
        break;
      default:
        // Generic relationship discovery
        relationships.push(...await this.discoverGenericRelationships(resource));
    }

    // Filter relationships based on options
    const filteredRelationships = this.filterRelationships(relationships, options);

    // Cache the results
    await this.cache.set(cacheKey, filteredRelationships, 300); // 5 minutes TTL

    return filteredRelationships;
  }

  // ======================================
  // DEPENDENCY ANALYSIS
  // ======================================

  /**
   * Analyze dependencies for a specific resource
   */
  async analyzeDependencies(
    resourceType: ResourceType,
    resourceId: string,
    options: RelationshipDiscoveryOptions = {}
  ): Promise<DependencyAnalysisResult> {
    const cacheKey = `dependencies:${resourceType}:${resourceId}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get direct dependencies (what this resource depends on)
    const dependencies = await ResourceRelationship.findResourceDependencies(
      resourceType,
      resourceId,
      'outgoing'
    );

    // Get dependents (what depends on this resource)
    const dependents = await ResourceRelationship.findResourceDependencies(
      resourceType,
      resourceId,
      'incoming'
    );

    // Find critical paths involving this resource
    const criticalPaths = await RelationshipPath.findAll({
      where: {
        [Op.or]: [
          { source_resource_id: resourceId },
          { target_resource_id: resourceId }
        ],
        is_critical_path: true,
        [Op.or]: [
          { expires_at: null },
          { expires_at: { [Op.gt]: new Date() } }
        ]
      }
    });

    // Calculate impact radius (maximum depth of dependency chain)
    const impactRadius = await this.calculateImpactRadius(resourceType, resourceId, options.maxDepth || 5);

    // Calculate risk score based on dependencies and criticality
    const riskScore = this.calculateRiskScore(dependencies, dependents, criticalPaths);

    // Generate recommendations
    const recommendations = this.generateDependencyRecommendations(dependencies, dependents, criticalPaths, riskScore);

    const result: DependencyAnalysisResult = {
      dependencies,
      dependents,
      criticalPaths,
      impactRadius,
      riskScore,
      recommendations
    };

    // Cache the results
    await this.cache.set(cacheKey, result, 600); // 10 minutes TTL

    return result;
  }

  /**
   * Perform impact analysis for resource changes
   */
  async performImpactAnalysis(
    resourceType: ResourceType,
    resourceId: string,
    options: ImpactAnalysisOptions
  ): Promise<{
    impactedResources: Array<{
      resourceType: ResourceType;
      resourceId: string;
      provider: CloudProvider;
      impactLevel: 'high' | 'medium' | 'low';
      impactReason: string;
      pathToImpact: string[];
    }>;
    cascadingEffects: RelationshipPath[];
    riskAssessment: {
      overallRisk: 'high' | 'medium' | 'low';
      criticalDependencies: number;
      affectedProviders: CloudProvider[];
      mitigationStrategies: string[];
    };
  }> {
    const cacheKey = `impact:${options.analysisType}:${resourceType}:${resourceId}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const maxDepth = options.propagationDepth || 3;
    const minConfidence = options.confidenceThreshold || 0.7;

    // Find all paths that could be impacted
    const impactPaths = await RelationshipPath.findPathsFrom(resourceId, 'impact', maxDepth);
    const dependencyPaths = await RelationshipPath.findPathsFrom(resourceId, 'dependency', maxDepth);

    const allPaths = [...impactPaths, ...dependencyPaths].filter(path =>
      path.path_confidence >= minConfidence
    );

    // Analyze impacted resources
    const impactedResources = await this.analyzeImpactedResources(allPaths, options);

    // Find cascading effects
    const cascadingEffects = allPaths.filter(path =>
      path.path_depth > 1 && path.path_strength >= 5
    );

    // Assess overall risk
    const riskAssessment = this.assessImpactRisk(impactedResources, cascadingEffects, options);

    const result = {
      impactedResources,
      cascadingEffects,
      riskAssessment
    };

    // Cache the results
    await this.cache.set(cacheKey, result, 300); // 5 minutes TTL

    return result;
  }

  // ======================================
  // GRAPH VISUALIZATION
  // ======================================

  /**
   * Generate graph visualization data
   */
  async generateVisualizationData(
    resourceFilters: {
      providers?: CloudProvider[];
      resourceTypes?: ResourceType[];
      resourceIds?: string[];
    } = {},
    relationshipFilters: {
      relationshipTypes?: RelationshipType[];
      minStrength?: number;
      minConfidence?: number;
      includeCriticalOnly?: boolean;
    } = {}
  ): Promise<GraphVisualizationData> {
    const cacheKey = `visualization:${JSON.stringify(resourceFilters)}:${JSON.stringify(relationshipFilters)}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build relationship query
    const whereClause: any = { status: 'active' };

    if (relationshipFilters.relationshipTypes?.length) {
      whereClause.relationship_type = { [Op.in]: relationshipFilters.relationshipTypes };
    }

    if (relationshipFilters.minStrength) {
      whereClause.strength = { [Op.gte]: relationshipFilters.minStrength };
    }

    if (relationshipFilters.minConfidence) {
      whereClause.confidence_score = { [Op.gte]: relationshipFilters.minConfidence };
    }

    if (relationshipFilters.includeCriticalOnly) {
      whereClause.is_critical = true;
    }

    // Add resource filters
    if (resourceFilters.providers?.length || resourceFilters.resourceTypes?.length || resourceFilters.resourceIds?.length) {
      const resourceConditions = [];

      if (resourceFilters.providers?.length) {
        resourceConditions.push({
          [Op.or]: [
            { source_provider: { [Op.in]: resourceFilters.providers } },
            { target_provider: { [Op.in]: resourceFilters.providers } }
          ]
        });
      }

      if (resourceFilters.resourceTypes?.length) {
        resourceConditions.push({
          [Op.or]: [
            { source_resource_type: { [Op.in]: resourceFilters.resourceTypes } },
            { target_resource_type: { [Op.in]: resourceFilters.resourceTypes } }
          ]
        });
      }

      if (resourceFilters.resourceIds?.length) {
        resourceConditions.push({
          [Op.or]: [
            { source_resource_id: { [Op.in]: resourceFilters.resourceIds } },
            { target_resource_id: { [Op.in]: resourceFilters.resourceIds } }
          ]
        });
      }

      if (resourceConditions.length > 0) {
        whereClause[Op.and] = resourceConditions;
      }
    }

    // Get relationships
    const relationships = await ResourceRelationship.findAll({
      where: whereClause,
      limit: 1000 // Prevent overwhelming visualizations
    });

    // Extract unique resources
    const resourceMap = new Map<string, {
      id: string;
      type: ResourceType;
      provider: CloudProvider;
      critical: boolean;
    }>();

    for (const rel of relationships) {
      const sourceKey = rel.getSourceIdentifier();
      const targetKey = rel.getTargetIdentifier();

      if (!resourceMap.has(sourceKey)) {
        resourceMap.set(sourceKey, {
          id: rel.source_resource_id,
          type: rel.source_resource_type,
          provider: rel.source_provider,
          critical: false
        });
      }

      if (!resourceMap.has(targetKey)) {
        resourceMap.set(targetKey, {
          id: rel.target_resource_id,
          type: rel.target_resource_type,
          provider: rel.target_provider,
          critical: false
        });
      }

      // Mark critical resources
      if (rel.is_critical) {
        const sourceResource = resourceMap.get(sourceKey)!;
        const targetResource = resourceMap.get(targetKey)!;
        sourceResource.critical = true;
        targetResource.critical = true;
      }
    }

    // Build visualization data
    const nodes = Array.from(resourceMap.values()).map(resource => ({
      id: resource.id,
      type: resource.type,
      provider: resource.provider,
      label: `${resource.type}:${resource.id.substring(0, 8)}...`,
      critical: resource.critical
    }));

    const edges = relationships.map(rel => ({
      id: rel.relationship_id,
      source: rel.source_resource_id,
      target: rel.target_resource_id,
      relationship: rel.relationship_type,
      strength: rel.strength,
      confidence: rel.confidence_score,
      critical: rel.is_critical,
      bidirectional: rel.relationship_direction === 'bidirectional'
    }));

    // Group nodes into provider clusters
    const clusters = this.createProviderClusters(nodes);

    // Calculate metrics
    const crossCloudConnections = relationships.filter(rel => rel.isCrossCloud()).length;
    const criticalPaths = await RelationshipPath.count({
      where: { is_critical_path: true }
    });

    const metrics = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      crossCloudConnections,
      criticalPaths,
      averageConnectivity: nodes.length > 0 ? edges.length / nodes.length : 0
    };

    const visualizationData: GraphVisualizationData = {
      nodes,
      edges,
      clusters,
      metrics
    };

    // Cache the results
    await this.cache.set(cacheKey, visualizationData, 600); // 10 minutes TTL

    return visualizationData;
  }

  // ======================================
  // PRIVATE HELPER METHODS
  // ======================================

  private async discoverVPCRelationships(vpcResource: any): Promise<ResourceRelationship[]> {
    const relationships: ResourceRelationship[] = [];

    // VPC contains subnets
    if (vpcResource.subnets && Array.isArray(vpcResource.subnets)) {
      for (const subnet of vpcResource.subnets) {
        relationships.push(await this.createRelationship(
          'vpc', vpcResource.vpc_id, vpcResource.provider,
          'subnet', subnet.subnet_id, subnet.provider,
          'contains',
          { strength: 10, isCritical: true, discoveryMethod: 'api_discovery' }
        ));
      }
    }

    // VPC peering relationships
    if (vpcResource.peering_connections) {
      for (const peering of vpcResource.peering_connections) {
        relationships.push(await this.createRelationship(
          'vpc', vpcResource.vpc_id, vpcResource.provider,
          'vpc', peering.peer_vpc_id, peering.peer_provider || vpcResource.provider,
          'peers_with',
          { strength: 7, direction: 'bidirectional', discoveryMethod: 'api_discovery' }
        ));
      }
    }

    return relationships;
  }

  private async discoverSubnetRelationships(subnetResource: any): Promise<ResourceRelationship[]> {
    const relationships: ResourceRelationship[] = [];

    // Subnet depends on VPC
    if (subnetResource.vpc_id) {
      relationships.push(await this.createRelationship(
        'subnet', subnetResource.subnet_id, subnetResource.provider,
        'vpc', subnetResource.vpc_id, subnetResource.provider,
        'depends_on',
        { strength: 10, isCritical: true, discoveryMethod: 'api_discovery' }
      ));
    }

    // Subnet routes through route tables
    if (subnetResource.route_table_id) {
      relationships.push(await this.createRelationship(
        'subnet', subnetResource.subnet_id, subnetResource.provider,
        'route_table', subnetResource.route_table_id, subnetResource.provider,
        'routes_to',
        { strength: 8, discoveryMethod: 'api_discovery' }
      ));
    }

    return relationships;
  }

  private async discoverTransitGatewayRelationships(tgwResource: any): Promise<ResourceRelationship[]> {
    const relationships: ResourceRelationship[] = [];

    // Transit Gateway attachments
    if (tgwResource.attachments && Array.isArray(tgwResource.attachments)) {
      for (const attachment of tgwResource.attachments) {
        relationships.push(await this.createRelationship(
          'transit_gateway', tgwResource.transit_gateway_id, tgwResource.provider,
          'transit_gateway_attachment', attachment.attachment_id, attachment.provider,
          'contains',
          { strength: 9, isCritical: true, discoveryMethod: 'api_discovery' }
        ));
      }
    }

    return relationships;
  }

  private async discoverTransitGatewayAttachmentRelationships(attachmentResource: any): Promise<ResourceRelationship[]> {
    const relationships: ResourceRelationship[] = [];

    // Attachment connects to Transit Gateway
    if (attachmentResource.transit_gateway_id) {
      relationships.push(await this.createRelationship(
        'transit_gateway_attachment', attachmentResource.attachment_id, attachmentResource.provider,
        'transit_gateway', attachmentResource.transit_gateway_id, attachmentResource.provider,
        'attached_to',
        { strength: 9, isCritical: true, discoveryMethod: 'api_discovery' }
      ));
    }

    // Attachment connects to VPC (if VPC attachment)
    if (attachmentResource.vpc_id) {
      relationships.push(await this.createRelationship(
        'transit_gateway_attachment', attachmentResource.attachment_id, attachmentResource.provider,
        'vpc', attachmentResource.vpc_id, attachmentResource.provider,
        'connects_to',
        { strength: 8, isCritical: true, discoveryMethod: 'api_discovery' }
      ));
    }

    return relationships;
  }

  private async discoverGenericRelationships(resource: any): Promise<ResourceRelationship[]> {
    // Placeholder for generic relationship discovery logic
    // This would implement common patterns for any resource type
    return [];
  }

  private filterRelationships(
    relationships: ResourceRelationship[],
    options: RelationshipDiscoveryOptions
  ): ResourceRelationship[] {
    let filtered = relationships;

    if (options.minConfidence) {
      filtered = filtered.filter(rel => rel.confidence_score >= options.minConfidence!);
    }

    if (!options.includeInactive) {
      filtered = filtered.filter(rel => rel.status === 'active');
    }

    if (options.providers?.length) {
      filtered = filtered.filter(rel =>
        options.providers!.includes(rel.source_provider) ||
        options.providers!.includes(rel.target_provider)
      );
    }

    if (options.resourceTypes?.length) {
      filtered = filtered.filter(rel =>
        options.resourceTypes!.includes(rel.source_resource_type) ||
        options.resourceTypes!.includes(rel.target_resource_type)
      );
    }

    return filtered;
  }

  private async calculateImpactRadius(
    resourceType: ResourceType,
    resourceId: string,
    maxDepth: number
  ): Promise<number> {
    // Find the maximum depth of any dependency path from this resource
    const paths = await RelationshipPath.findPathsFrom(resourceId, 'dependency', maxDepth);
    return paths.length > 0 ? Math.max(...paths.map(p => p.path_depth)) : 0;
  }

  private calculateRiskScore(
    dependencies: ResourceRelationship[],
    dependents: ResourceRelationship[],
    criticalPaths: RelationshipPath[]
  ): number {
    let score = 0;

    // Base score from number of dependencies and dependents
    score += dependencies.length * 2; // Dependencies increase risk
    score += dependents.length * 3; // Being depended upon increases risk more

    // Critical relationships multiply risk
    const criticalDeps = dependencies.filter(dep => dep.is_critical).length;
    const criticalDependents = dependents.filter(dep => dep.is_critical).length;
    score += criticalDeps * 10;
    score += criticalDependents * 15;

    // Critical paths significantly increase risk
    score += criticalPaths.length * 20;

    // Cross-cloud relationships add complexity risk
    const crossCloudDeps = dependencies.filter(dep => dep.isCrossCloud()).length;
    score += crossCloudDeps * 5;

    // Normalize to 0-100 scale
    return Math.min(100, score);
  }

  private generateDependencyRecommendations(
    dependencies: ResourceRelationship[],
    dependents: ResourceRelationship[],
    criticalPaths: RelationshipPath[],
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push('High risk score detected - consider implementing redundancy or failover mechanisms');
    }

    if (criticalPaths.length > 0) {
      recommendations.push(`${criticalPaths.length} critical dependency paths found - ensure these components have proper monitoring and backup procedures`);
    }

    const crossCloudDeps = dependencies.filter(dep => dep.isCrossCloud());
    if (crossCloudDeps.length > 0) {
      recommendations.push(`${crossCloudDeps.length} cross-cloud dependencies detected - ensure network connectivity and latency are acceptable`);
    }

    if (dependents.length > 10) {
      recommendations.push('This resource has many dependents - consider implementing circuit breakers or graceful degradation');
    }

    if (dependencies.length > 15) {
      recommendations.push('This resource has many dependencies - consider simplifying the architecture or implementing dependency injection');
    }

    return recommendations;
  }

  private async analyzeImpactedResources(
    paths: RelationshipPath[],
    options: ImpactAnalysisOptions
  ): Promise<Array<{
    resourceType: ResourceType;
    resourceId: string;
    provider: CloudProvider;
    impactLevel: 'high' | 'medium' | 'low';
    impactReason: string;
    pathToImpact: string[];
  }>> {
    const impactedResources = [];

    for (const path of paths) {
      // Get relationship details for the path
      const relationships = await ResourceRelationship.findAll({
        where: {
          relationship_id: { [Op.in]: path.path_relationships }
        }
      });

      if (relationships.length === 0) continue;

      const lastRelationship = relationships[relationships.length - 1];

      // Determine impact level based on path characteristics
      let impactLevel: 'high' | 'medium' | 'low' = 'low';
      if (path.is_critical_path || path.path_strength >= 8) {
        impactLevel = 'high';
      } else if (path.path_strength >= 5 || path.path_confidence >= 0.8) {
        impactLevel = 'medium';
      }

      // Generate impact reason based on analysis type
      let impactReason = '';
      switch (options.analysisType) {
        case 'failure':
          impactReason = `Service disruption through ${path.path_type} dependency chain`;
          break;
        case 'change':
          impactReason = `Configuration changes may affect dependent resources`;
          break;
        case 'security':
          impactReason = `Security breach could propagate through trust relationships`;
          break;
        case 'performance':
          impactReason = `Performance degradation may impact downstream services`;
          break;
      }

      impactedResources.push({
        resourceType: lastRelationship.target_resource_type,
        resourceId: lastRelationship.target_resource_id,
        provider: lastRelationship.target_provider,
        impactLevel,
        impactReason,
        pathToImpact: path.path_relationships
      });
    }

    return impactedResources;
  }

  private assessImpactRisk(
    impactedResources: any[],
    cascadingEffects: RelationshipPath[],
    options: ImpactAnalysisOptions
  ): {
    overallRisk: 'high' | 'medium' | 'low';
    criticalDependencies: number;
    affectedProviders: CloudProvider[];
    mitigationStrategies: string[];
  } {
    const highImpactCount = impactedResources.filter(r => r.impactLevel === 'high').length;
    const totalImpacted = impactedResources.length;

    let overallRisk: 'high' | 'medium' | 'low' = 'low';
    if (highImpactCount > 5 || cascadingEffects.length > 3) {
      overallRisk = 'high';
    } else if (highImpactCount > 2 || totalImpacted > 10) {
      overallRisk = 'medium';
    }

    const criticalDependencies = cascadingEffects.filter(path => path.is_critical_path).length;
    const affectedProviders = [...new Set(impactedResources.map(r => r.provider))];

    const mitigationStrategies = [];
    if (overallRisk === 'high') {
      mitigationStrategies.push('Implement gradual rollout with canary deployments');
      mitigationStrategies.push('Prepare rollback procedures');
      mitigationStrategies.push('Monitor critical metrics during changes');
    }

    if (cascadingEffects.length > 0) {
      mitigationStrategies.push('Set up dependency health checks');
      mitigationStrategies.push('Consider implementing circuit breaker patterns');
    }

    if (affectedProviders.length > 1) {
      mitigationStrategies.push('Coordinate changes across cloud providers');
      mitigationStrategies.push('Validate cross-cloud connectivity after changes');
    }

    return {
      overallRisk,
      criticalDependencies,
      affectedProviders,
      mitigationStrategies
    };
  }

  private createProviderClusters(nodes: any[]): Array<{
    id: string;
    provider: CloudProvider;
    nodes: string[];
  }> {
    const clusters = new Map<CloudProvider, string[]>();

    for (const node of nodes) {
      if (!clusters.has(node.provider)) {
        clusters.set(node.provider, []);
      }
      clusters.get(node.provider)!.push(node.id);
    }

    return Array.from(clusters.entries()).map(([provider, nodeIds]) => ({
      id: `cluster_${provider}`,
      provider,
      nodes: nodeIds
    }));
  }

  private async logRelationshipChange(
    relationshipId: string,
    changeType: 'created' | 'updated' | 'deleted' | 'verified' | 'invalidated',
    reason: string,
    relationship?: ResourceRelationship,
    previousState?: any
  ): Promise<void> {
    const changeId = `change_${uuidv4()}`;

    await RelationshipChange.create({
      change_id: changeId,
      relationship_id: relationshipId,
      change_type: changeType,
      change_reason: reason,
      previous_state: previousState,
      new_state: relationship ? {
        relationship_type: relationship.relationship_type,
        status: relationship.status,
        is_critical: relationship.is_critical,
        strength: relationship.strength,
        confidence_score: relationship.confidence_score
      } : null,
      changed_by: 'system' // This could be passed from the calling context
    });
  }

  private async invalidateRelationshipCaches(sourceId: string, targetId: string): Promise<void> {
    // Invalidate caches related to these resources
    const cachePatterns = [
      `relationships:*:*:${sourceId}`,
      `relationships:*:*:${targetId}`,
      `dependencies:*:${sourceId}`,
      `dependencies:*:${targetId}`,
      `impact:*:*:${sourceId}`,
      `impact:*:*:${targetId}`,
      'visualization:*'
    ];

    for (const pattern of cachePatterns) {
      await this.cache.invalidatePattern(pattern);
    }
  }
}

export default ResourceRelationshipService;