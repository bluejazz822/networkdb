/**
 * Impact Analyzer
 * Advanced algorithms for impact analysis and cascade effect prediction
 */

import { ResourceRelationship, ResourceType, CloudProvider, RelationshipType } from '../../models/ResourceRelationship';
import { RelationshipPath, PathType } from '../../models/RelationshipPath';
import { DependencyGraph, DependencyNode, DependencyEdge, DependencyTracker } from './DependencyTracker';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

export interface ImpactScenario {
  scenarioId: string;
  scenarioType: 'resource_failure' | 'resource_change' | 'security_breach' | 'performance_degradation';
  affectedResource: {
    resourceType: ResourceType;
    resourceId: string;
    provider: CloudProvider;
  };
  impactPropagation: ImpactPropagationResult;
  mitigationStrategies: MitigationStrategy[];
  riskAssessment: RiskAssessment;
}

export interface ImpactPropagationResult {
  immediateImpacts: ImpactedResource[];
  cascadingImpacts: Array<{
    wave: number;
    resources: ImpactedResource[];
    propagationTime: number; // estimated seconds
  }>;
  finalState: {
    totalAffectedResources: number;
    affectedProviders: CloudProvider[];
    criticalServicesImpacted: number;
    estimatedRecoveryTime: number; // estimated seconds
  };
  propagationPaths: RelationshipPath[];
}

export interface ImpactedResource {
  resourceType: ResourceType;
  resourceId: string;
  provider: CloudProvider;
  impactSeverity: 'critical' | 'high' | 'medium' | 'low';
  impactType: 'service_disruption' | 'performance_degradation' | 'security_compromise' | 'data_loss_risk';
  confidenceScore: number;
  timeToImpact: number; // estimated seconds
  impactDuration: number; // estimated seconds
  pathFromSource: string[];
  mitigationOptions: string[];
}

export interface MitigationStrategy {
  strategyId: string;
  strategyType: 'preventive' | 'responsive' | 'recovery';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  estimatedCost: 'low' | 'medium' | 'high';
  effectivenessScore: number; // 0-100
  prerequisites: string[];
  steps: string[];
  metrics: string[];
}

export interface RiskAssessment {
  overallRiskScore: number; // 0-100
  riskFactors: Array<{
    factor: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    contribution: number; // percentage of overall risk
    description: string;
  }>;
  businessImpact: {
    serviceAvailability: number; // percentage
    performanceImpact: number; // percentage
    securityPosture: number; // percentage
    complianceRisk: number; // percentage
  };
  timeToRecovery: {
    best_case: number; // seconds
    worst_case: number; // seconds
    most_likely: number; // seconds
  };
}

export class ImpactAnalyzer {
  private dependencyTracker: DependencyTracker;

  constructor() {
    this.dependencyTracker = new DependencyTracker();
  }

  /**
   * Analyze impact of resource failure
   */
  async analyzeResourceFailure(
    resourceType: ResourceType,
    resourceId: string,
    provider: CloudProvider,
    options: {
      includeSecondaryEffects?: boolean;
      maxPropagationDepth?: number;
      confidenceThreshold?: number;
      timeHorizon?: number; // seconds
    } = {}
  ): Promise<ImpactScenario> {
    const scenarioId = `scenario_${uuidv4()}`;
    const graph = await this.dependencyTracker.buildDependencyGraph();

    const resourceIdentifier = `${provider}:${resourceType}:${resourceId}`;
    const sourceNode = graph.nodes.get(resourceIdentifier);

    if (!sourceNode) {
      throw new Error(`Resource not found in dependency graph: ${resourceIdentifier}`);
    }

    // Perform impact propagation analysis
    const impactPropagation = await this.simulateImpactPropagation(
      sourceNode,
      graph,
      'resource_failure',
      options
    );

    // Generate mitigation strategies
    const mitigationStrategies = this.generateMitigationStrategies(
      'resource_failure',
      sourceNode,
      impactPropagation,
      graph
    );

    // Assess overall risk
    const riskAssessment = this.assessScenarioRisk(
      'resource_failure',
      sourceNode,
      impactPropagation,
      graph
    );

    return {
      scenarioId,
      scenarioType: 'resource_failure',
      affectedResource: {
        resourceType,
        resourceId,
        provider
      },
      impactPropagation,
      mitigationStrategies,
      riskAssessment
    };
  }

  /**
   * Analyze impact of resource configuration changes
   */
  async analyzeResourceChange(
    resourceType: ResourceType,
    resourceId: string,
    provider: CloudProvider,
    changeType: 'configuration' | 'scaling' | 'migration' | 'replacement',
    options: {
      changeDetails?: any;
      rollbackPlan?: boolean;
      graduatedRollout?: boolean;
    } = {}
  ): Promise<ImpactScenario> {
    const scenarioId = `scenario_${uuidv4()}`;
    const graph = await this.dependencyTracker.buildDependencyGraph();

    const resourceIdentifier = `${provider}:${resourceType}:${resourceId}`;
    const sourceNode = graph.nodes.get(resourceIdentifier);

    if (!sourceNode) {
      throw new Error(`Resource not found in dependency graph: ${resourceIdentifier}`);
    }

    // Perform change impact analysis
    const impactPropagation = await this.simulateImpactPropagation(
      sourceNode,
      graph,
      'resource_change',
      {
        includeSecondaryEffects: true,
        maxPropagationDepth: 5,
        confidenceThreshold: 0.5
      }
    );

    // Generate change-specific mitigation strategies
    const mitigationStrategies = this.generateChangeMitigationStrategies(
      changeType,
      sourceNode,
      impactPropagation,
      options,
      graph
    );

    // Assess change risk
    const riskAssessment = this.assessScenarioRisk(
      'resource_change',
      sourceNode,
      impactPropagation,
      graph
    );

    return {
      scenarioId,
      scenarioType: 'resource_change',
      affectedResource: {
        resourceType,
        resourceId,
        provider
      },
      impactPropagation,
      mitigationStrategies,
      riskAssessment
    };
  }

  /**
   * Analyze security breach impact propagation
   */
  async analyzeSecurityBreach(
    resourceType: ResourceType,
    resourceId: string,
    provider: CloudProvider,
    breachType: 'unauthorized_access' | 'data_exfiltration' | 'lateral_movement' | 'privilege_escalation',
    options: {
      attackVector?: string;
      timeToDetection?: number;
      containmentEffectiveness?: number;
    } = {}
  ): Promise<ImpactScenario> {
    const scenarioId = `scenario_${uuidv4()}`;
    const graph = await this.dependencyTracker.buildDependencyGraph();

    const resourceIdentifier = `${provider}:${resourceType}:${resourceId}`;
    const sourceNode = graph.nodes.get(resourceIdentifier);

    if (!sourceNode) {
      throw new Error(`Resource not found in dependency graph: ${resourceIdentifier}`);
    }

    // Security breach propagation follows different patterns
    const impactPropagation = await this.simulateSecurityPropagation(
      sourceNode,
      graph,
      breachType,
      options
    );

    // Generate security-specific mitigation strategies
    const mitigationStrategies = this.generateSecurityMitigationStrategies(
      breachType,
      sourceNode,
      impactPropagation,
      options,
      graph
    );

    // Assess security risk
    const riskAssessment = this.assessSecurityRisk(
      breachType,
      sourceNode,
      impactPropagation,
      options,
      graph
    );

    return {
      scenarioId,
      scenarioType: 'security_breach',
      affectedResource: {
        resourceType,
        resourceId,
        provider
      },
      impactPropagation,
      mitigationStrategies,
      riskAssessment
    };
  }

  /**
   * Compare multiple impact scenarios
   */
  async compareScenarios(scenarios: ImpactScenario[]): Promise<{
    riskRanking: Array<{
      scenarioId: string;
      rank: number;
      riskScore: number;
      keyRiskFactors: string[];
    }>;
    commonVulnerabilities: Array<{
      resourceType: ResourceType;
      resourceId: string;
      provider: CloudProvider;
      vulnerabilityCount: number;
      averageImpactSeverity: number;
    }>;
    mitigationPriorities: Array<{
      strategy: string;
      applicableScenarios: string[];
      priorityScore: number;
      implementation: 'immediate' | 'short_term' | 'long_term';
    }>;
  }> {
    // Rank scenarios by risk score
    const riskRanking = scenarios
      .map((scenario, index) => ({
        scenarioId: scenario.scenarioId,
        rank: index + 1,
        riskScore: scenario.riskAssessment.overallRiskScore,
        keyRiskFactors: scenario.riskAssessment.riskFactors
          .filter(factor => factor.severity === 'critical' || factor.severity === 'high')
          .map(factor => factor.factor)
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // Find common vulnerabilities
    const resourceImpactCount = new Map<string, {
      resourceType: ResourceType;
      resourceId: string;
      provider: CloudProvider;
      impactCount: number;
      totalSeverity: number;
    }>();

    for (const scenario of scenarios) {
      for (const impact of scenario.impactPropagation.immediateImpacts) {
        const key = `${impact.provider}:${impact.resourceType}:${impact.resourceId}`;

        if (!resourceImpactCount.has(key)) {
          resourceImpactCount.set(key, {
            resourceType: impact.resourceType,
            resourceId: impact.resourceId,
            provider: impact.provider,
            impactCount: 0,
            totalSeverity: 0
          });
        }

        const entry = resourceImpactCount.get(key)!;
        entry.impactCount++;
        entry.totalSeverity += this.severityToNumber(impact.impactSeverity);
      }
    }

    const commonVulnerabilities = Array.from(resourceImpactCount.values())
      .filter(entry => entry.impactCount > 1)
      .map(entry => ({
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        provider: entry.provider,
        vulnerabilityCount: entry.impactCount,
        averageImpactSeverity: entry.totalSeverity / entry.impactCount
      }))
      .sort((a, b) => b.vulnerabilityCount - a.vulnerabilityCount);

    // Analyze mitigation priorities
    const mitigationMap = new Map<string, {
      strategy: string;
      applicableScenarios: string[];
      totalPriority: number;
      count: number;
    }>();

    for (const scenario of scenarios) {
      for (const mitigation of scenario.mitigationStrategies) {
        if (!mitigationMap.has(mitigation.title)) {
          mitigationMap.set(mitigation.title, {
            strategy: mitigation.title,
            applicableScenarios: [],
            totalPriority: 0,
            count: 0
          });
        }

        const entry = mitigationMap.get(mitigation.title)!;
        entry.applicableScenarios.push(scenario.scenarioId);
        entry.totalPriority += this.priorityToNumber(mitigation.priority);
        entry.count++;
      }
    }

    const mitigationPriorities = Array.from(mitigationMap.values())
      .map(entry => ({
        strategy: entry.strategy,
        applicableScenarios: entry.applicableScenarios,
        priorityScore: (entry.totalPriority / entry.count) * entry.applicableScenarios.length,
        implementation: this.determineImplementationTimeframe(entry.totalPriority / entry.count)
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      riskRanking,
      commonVulnerabilities,
      mitigationPriorities
    };
  }

  // ======================================
  // PRIVATE HELPER METHODS
  // ======================================

  private async simulateImpactPropagation(
    sourceNode: DependencyNode,
    graph: DependencyGraph,
    scenarioType: string,
    options: any
  ): Promise<ImpactPropagationResult> {
    const maxDepth = options.maxPropagationDepth || 5;
    const confidenceThreshold = options.confidenceThreshold || 0.7;

    const waves: Array<{
      wave: number;
      resources: ImpactedResource[];
      propagationTime: number;
    }> = [];

    const visitedNodes = new Set<string>();
    const immediateImpacts: ImpactedResource[] = [];
    const propagationPaths: RelationshipPath[] = [];

    // Start with immediate impacts (dependents of the source)
    const immediateTargets = Array.from(sourceNode.dependents);

    for (const targetId of immediateTargets) {
      const targetNode = graph.nodes.get(targetId);
      if (!targetNode) continue;

      const impactedResource = this.createImpactedResource(
        targetNode,
        sourceNode.id,
        0, // immediate impact
        scenarioType,
        1.0, // high confidence for immediate impacts
        graph
      );

      immediateImpacts.push(impactedResource);
      visitedNodes.add(targetId);
    }

    // Simulate cascading impacts
    let currentWave = immediateTargets;
    let waveNumber = 1;

    while (currentWave.length > 0 && waveNumber <= maxDepth) {
      const nextWave: string[] = [];
      const waveImpacts: ImpactedResource[] = [];

      for (const nodeId of currentWave) {
        const node = graph.nodes.get(nodeId);
        if (!node) continue;

        // Find dependents of this node
        for (const dependentId of node.dependents) {
          if (visitedNodes.has(dependentId)) continue;

          const dependentNode = graph.nodes.get(dependentId);
          if (!dependentNode) continue;

          // Calculate impact probability based on relationship strength and confidence
          const relationship = this.findRelationshipBetween(nodeId, dependentId, graph);
          if (!relationship || relationship.confidence < confidenceThreshold) continue;

          const impactedResource = this.createImpactedResource(
            dependentNode,
            sourceNode.id,
            waveNumber,
            scenarioType,
            relationship.confidence * Math.pow(0.8, waveNumber), // degrading confidence
            graph
          );

          waveImpacts.push(impactedResource);
          nextWave.push(dependentId);
          visitedNodes.add(dependentId);

          // Create propagation path
          const pathId = `path_${uuidv4()}`;
          const path = new RelationshipPath({
            path_id: pathId,
            source_resource_id: this.extractResourceId(sourceNode.id),
            target_resource_id: this.extractResourceId(dependentId),
            path_type: 'impact',
            path_depth: waveNumber + 1,
            path_relationships: [relationship.id],
            path_confidence: relationship.confidence,
            path_strength: relationship.strength,
            is_critical_path: relationship.critical,
            computed_at: new Date()
          });

          propagationPaths.push(path);
        }
      }

      if (waveImpacts.length > 0) {
        waves.push({
          wave: waveNumber,
          resources: waveImpacts,
          propagationTime: this.estimatePropagationTime(waveNumber, scenarioType)
        });
      }

      currentWave = nextWave;
      waveNumber++;
    }

    // Calculate final state
    const allImpactedResources = [
      ...immediateImpacts,
      ...waves.flatMap(wave => wave.resources)
    ];

    const affectedProviders = [...new Set(allImpactedResources.map(r => r.provider))];
    const criticalServicesImpacted = allImpactedResources.filter(r =>
      r.impactSeverity === 'critical'
    ).length;

    const estimatedRecoveryTime = this.estimateRecoveryTime(
      allImpactedResources,
      scenarioType
    );

    return {
      immediateImpacts,
      cascadingImpacts: waves,
      finalState: {
        totalAffectedResources: allImpactedResources.length,
        affectedProviders,
        criticalServicesImpacted,
        estimatedRecoveryTime
      },
      propagationPaths
    };
  }

  private async simulateSecurityPropagation(
    sourceNode: DependencyNode,
    graph: DependencyGraph,
    breachType: string,
    options: any
  ): Promise<ImpactPropagationResult> {
    // Security propagation follows trust relationships and access patterns
    // This is a simplified simulation - real implementation would consider
    // network topology, access controls, and security boundaries

    return this.simulateImpactPropagation(sourceNode, graph, 'security_breach', {
      maxPropagationDepth: 3, // Security breaches typically have limited propagation depth
      confidenceThreshold: 0.8, // Higher confidence threshold for security impacts
      ...options
    });
  }

  private createImpactedResource(
    targetNode: DependencyNode,
    sourceId: string,
    waveNumber: number,
    scenarioType: string,
    confidence: number,
    graph: DependencyGraph
  ): ImpactedResource {
    const severity = this.calculateImpactSeverity(targetNode, waveNumber, scenarioType, graph);
    const impactType = this.determineImpactType(targetNode, scenarioType);
    const timeToImpact = this.estimateTimeToImpact(waveNumber, scenarioType);
    const impactDuration = this.estimateImpactDuration(severity, scenarioType);

    return {
      resourceType: targetNode.resourceType,
      resourceId: this.extractResourceId(targetNode.id),
      provider: targetNode.provider,
      impactSeverity: severity,
      impactType,
      confidenceScore: confidence,
      timeToImpact,
      impactDuration,
      pathFromSource: [sourceId, targetNode.id], // Simplified path
      mitigationOptions: this.generateMitigationOptions(targetNode, scenarioType)
    };
  }

  private calculateImpactSeverity(
    node: DependencyNode,
    waveNumber: number,
    scenarioType: string,
    graph: DependencyGraph
  ): 'critical' | 'high' | 'medium' | 'low' {
    let severityScore = 0;

    // Critical nodes have higher base severity
    if (node.critical) severityScore += 3;

    // Nodes with many dependents have higher severity
    if (node.dependents.size > 10) severityScore += 2;
    else if (node.dependents.size > 5) severityScore += 1;

    // Earlier waves have higher severity
    severityScore += Math.max(0, 3 - waveNumber);

    // Scenario-specific adjustments
    if (scenarioType === 'security_breach' && node.resourceType === 'vpc') {
      severityScore += 2; // VPCs are critical for security
    }

    if (severityScore >= 6) return 'critical';
    if (severityScore >= 4) return 'high';
    if (severityScore >= 2) return 'medium';
    return 'low';
  }

  private determineImpactType(
    node: DependencyNode,
    scenarioType: string
  ): 'service_disruption' | 'performance_degradation' | 'security_compromise' | 'data_loss_risk' {
    switch (scenarioType) {
      case 'resource_failure':
        return 'service_disruption';
      case 'resource_change':
        return 'performance_degradation';
      case 'security_breach':
        return 'security_compromise';
      default:
        return 'service_disruption';
    }
  }

  private estimateTimeToImpact(waveNumber: number, scenarioType: string): number {
    // Base time in seconds
    const baseTime = scenarioType === 'security_breach' ? 300 : 60; // 5 min for security, 1 min for others
    return baseTime * waveNumber;
  }

  private estimateImpactDuration(
    severity: 'critical' | 'high' | 'medium' | 'low',
    scenarioType: string
  ): number {
    const baseDuration = {
      'critical': 7200, // 2 hours
      'high': 3600,     // 1 hour
      'medium': 1800,   // 30 minutes
      'low': 900        // 15 minutes
    }[severity];

    // Security breaches typically have longer impact duration
    const multiplier = scenarioType === 'security_breach' ? 2 : 1;

    return baseDuration * multiplier;
  }

  private estimatePropagationTime(waveNumber: number, scenarioType: string): number {
    // Time for impact to propagate to this wave
    const baseTime = scenarioType === 'security_breach' ? 600 : 120; // 10 min for security, 2 min for others
    return baseTime * waveNumber;
  }

  private estimateRecoveryTime(
    impactedResources: ImpactedResource[],
    scenarioType: string
  ): number {
    if (impactedResources.length === 0) return 0;

    const maxDuration = Math.max(...impactedResources.map(r => r.impactDuration));
    const criticalCount = impactedResources.filter(r => r.impactSeverity === 'critical').length;

    // Recovery time is influenced by the worst impact and number of critical resources
    const recoveryMultiplier = 1 + (criticalCount * 0.5);

    return Math.round(maxDuration * recoveryMultiplier);
  }

  private generateMitigationOptions(
    node: DependencyNode,
    scenarioType: string
  ): string[] {
    const options = [];

    switch (scenarioType) {
      case 'resource_failure':
        options.push('Implement failover mechanisms');
        options.push('Set up health checks and monitoring');
        if (node.critical) {
          options.push('Deploy redundant instances');
        }
        break;

      case 'security_breach':
        options.push('Isolate affected resources');
        options.push('Review access controls');
        options.push('Enable additional logging');
        break;

      default:
        options.push('Monitor resource status');
        options.push('Prepare rollback procedures');
    }

    return options;
  }

  private generateMitigationStrategies(
    scenarioType: string,
    sourceNode: DependencyNode,
    impactPropagation: ImpactPropagationResult,
    graph: DependencyGraph
  ): MitigationStrategy[] {
    // This would generate comprehensive mitigation strategies
    // Simplified implementation for now
    return [
      {
        strategyId: `strategy_${uuidv4()}`,
        strategyType: 'preventive',
        priority: 'high',
        title: 'Implement High Availability',
        description: 'Deploy redundant resources to prevent single points of failure',
        implementationComplexity: 'medium',
        estimatedCost: 'medium',
        effectivenessScore: 85,
        prerequisites: ['Architecture review', 'Capacity planning'],
        steps: ['Design redundant architecture', 'Deploy backup resources', 'Configure failover'],
        metrics: ['RTO', 'RPO', 'Availability percentage']
      }
    ];
  }

  private generateChangeMitigationStrategies(
    changeType: string,
    sourceNode: DependencyNode,
    impactPropagation: ImpactPropagationResult,
    options: any,
    graph: DependencyGraph
  ): MitigationStrategy[] {
    // Generate change-specific strategies
    return this.generateMitigationStrategies('resource_change', sourceNode, impactPropagation, graph);
  }

  private generateSecurityMitigationStrategies(
    breachType: string,
    sourceNode: DependencyNode,
    impactPropagation: ImpactPropagationResult,
    options: any,
    graph: DependencyGraph
  ): MitigationStrategy[] {
    // Generate security-specific strategies
    return this.generateMitigationStrategies('security_breach', sourceNode, impactPropagation, graph);
  }

  private assessScenarioRisk(
    scenarioType: string,
    sourceNode: DependencyNode,
    impactPropagation: ImpactPropagationResult,
    graph: DependencyGraph
  ): RiskAssessment {
    // Simplified risk assessment
    const criticalImpacts = impactPropagation.immediateImpacts.filter(i => i.impactSeverity === 'critical').length;
    const totalImpacts = impactPropagation.finalState.totalAffectedResources;

    const riskScore = Math.min(100, (criticalImpacts * 20) + (totalImpacts * 2));

    return {
      overallRiskScore: riskScore,
      riskFactors: [
        {
          factor: 'Resource Dependencies',
          severity: criticalImpacts > 0 ? 'critical' : 'medium',
          contribution: 60,
          description: `${totalImpacts} resources potentially affected`
        }
      ],
      businessImpact: {
        serviceAvailability: Math.max(0, 100 - riskScore),
        performanceImpact: riskScore * 0.8,
        securityPosture: scenarioType === 'security_breach' ? riskScore : riskScore * 0.3,
        complianceRisk: riskScore * 0.4
      },
      timeToRecovery: {
        best_case: impactPropagation.finalState.estimatedRecoveryTime * 0.5,
        worst_case: impactPropagation.finalState.estimatedRecoveryTime * 2,
        most_likely: impactPropagation.finalState.estimatedRecoveryTime
      }
    };
  }

  private assessSecurityRisk(
    breachType: string,
    sourceNode: DependencyNode,
    impactPropagation: ImpactPropagationResult,
    options: any,
    graph: DependencyGraph
  ): RiskAssessment {
    // Enhanced risk assessment for security scenarios
    return this.assessScenarioRisk('security_breach', sourceNode, impactPropagation, graph);
  }

  private findRelationshipBetween(
    sourceId: string,
    targetId: string,
    graph: DependencyGraph
  ): DependencyEdge | null {
    for (const edge of graph.edges.values()) {
      if (edge.source === sourceId && edge.target === targetId) {
        return edge;
      }
    }
    return null;
  }

  private severityToNumber(severity: 'critical' | 'high' | 'medium' | 'low'): number {
    return { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 }[severity];
  }

  private priorityToNumber(priority: 'high' | 'medium' | 'low'): number {
    return { 'high': 3, 'medium': 2, 'low': 1 }[priority];
  }

  private determineImplementationTimeframe(priorityScore: number): 'immediate' | 'short_term' | 'long_term' {
    if (priorityScore >= 2.5) return 'immediate';
    if (priorityScore >= 1.5) return 'short_term';
    return 'long_term';
  }

  private extractResourceId(nodeId: string): string {
    const parts = nodeId.split(':');
    return parts.length >= 3 ? parts[2] : nodeId;
  }
}

export default ImpactAnalyzer;