/**
 * Dependency Tracker
 * Advanced algorithms for tracking and analyzing resource dependencies across clouds
 */

import { ResourceRelationship, ResourceType, CloudProvider, RelationshipType } from '../../models/ResourceRelationship';
import { RelationshipPath, PathType } from '../../models/RelationshipPath';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, DependencyEdge>;
  roots: Set<string>; // Resources with no dependencies
  leaves: Set<string>; // Resources with no dependents
}

export interface DependencyNode {
  id: string;
  resourceType: ResourceType;
  provider: CloudProvider;
  dependencies: Set<string>; // Outgoing edges (what this depends on)
  dependents: Set<string>; // Incoming edges (what depends on this)
  level: number; // Depth level in dependency hierarchy
  critical: boolean;
  metadata?: any;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: RelationshipType;
  strength: number;
  confidence: number;
  critical: boolean;
}

export interface CyclicDependency {
  cycle: string[];
  strength: number;
  confidence: number;
  critical: boolean;
  breakSuggestions: Array<{
    edge: string;
    reason: string;
    impact: 'low' | 'medium' | 'high';
  }>;
}

export interface DependencyMetrics {
  totalNodes: number;
  totalEdges: number;
  crossCloudEdges: number;
  maxDepth: number;
  averageDepth: number;
  cyclicDependencies: number;
  criticalPaths: number;
  isolatedNodes: number;
  topologicalComplexity: number;
}

export class DependencyTracker {

  /**
   * Build a complete dependency graph from relationships
   */
  async buildDependencyGraph(
    relationships?: ResourceRelationship[],
    includeInactive: boolean = false
  ): Promise<DependencyGraph> {
    if (!relationships) {
      const whereClause: any = {};
      if (!includeInactive) {
        whereClause.status = 'active';
      }

      relationships = await ResourceRelationship.findAll({
        where: whereClause,
        order: [['strength', 'DESC']]
      });
    }

    const nodes = new Map<string, DependencyNode>();
    const edges = new Map<string, DependencyEdge>();

    // Create nodes and edges
    for (const rel of relationships) {
      const sourceId = rel.getSourceIdentifier();
      const targetId = rel.getTargetIdentifier();

      // Create source node if not exists
      if (!nodes.has(sourceId)) {
        nodes.set(sourceId, {
          id: sourceId,
          resourceType: rel.source_resource_type,
          provider: rel.source_provider,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          level: 0,
          critical: false
        });
      }

      // Create target node if not exists
      if (!nodes.has(targetId)) {
        nodes.set(targetId, {
          id: targetId,
          resourceType: rel.target_resource_type,
          provider: rel.target_provider,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          level: 0,
          critical: false
        });
      }

      // Create edge
      const edge: DependencyEdge = {
        id: rel.relationship_id,
        source: sourceId,
        target: targetId,
        relationshipType: rel.relationship_type,
        strength: rel.strength,
        confidence: rel.confidence_score,
        critical: rel.is_critical
      };

      edges.set(edge.id, edge);

      // Update node connections
      const sourceNode = nodes.get(sourceId)!;
      const targetNode = nodes.get(targetId)!;

      sourceNode.dependencies.add(targetId);
      targetNode.dependents.add(sourceId);

      // Mark critical nodes
      if (rel.is_critical) {
        sourceNode.critical = true;
        targetNode.critical = true;
      }
    }

    // Calculate dependency levels using topological sort
    this.calculateDependencyLevels(nodes, edges);

    // Find roots and leaves
    const roots = new Set<string>();
    const leaves = new Set<string>();

    for (const [nodeId, node] of nodes) {
      if (node.dependencies.size === 0) {
        roots.add(nodeId);
      }
      if (node.dependents.size === 0) {
        leaves.add(nodeId);
      }
    }

    return { nodes, edges, roots, leaves };
  }

  /**
   * Detect cyclic dependencies in the graph
   */
  async detectCyclicDependencies(graph?: DependencyGraph): Promise<CyclicDependency[]> {
    if (!graph) {
      graph = await this.buildDependencyGraph();
    }

    const cycles: CyclicDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        this.detectCyclesFromNode(
          nodeId,
          graph,
          visited,
          recursionStack,
          path,
          cycles
        );
      }
    }

    // Analyze each cycle and provide break suggestions
    for (const cycle of cycles) {
      cycle.breakSuggestions = this.generateCycleBreakSuggestions(cycle, graph);
    }

    return cycles;
  }

  /**
   * Find critical dependency paths
   */
  async findCriticalPaths(
    graph?: DependencyGraph,
    maxDepth: number = 10
  ): Promise<RelationshipPath[]> {
    if (!graph) {
      graph = await this.buildDependencyGraph();
    }

    const criticalPaths: RelationshipPath[] = [];

    // Find paths between critical nodes
    const criticalNodes = Array.from(graph.nodes.entries())
      .filter(([_, node]) => node.critical)
      .map(([id, _]) => id);

    for (let i = 0; i < criticalNodes.length; i++) {
      for (let j = i + 1; j < criticalNodes.length; j++) {
        const paths = this.findPathsBetweenNodes(
          criticalNodes[i],
          criticalNodes[j],
          graph,
          maxDepth
        );

        for (const path of paths) {
          // Create RelationshipPath object
          const relationshipPath = new RelationshipPath({
            path_id: `path_${uuidv4()}`,
            source_resource_id: this.extractResourceId(criticalNodes[i]),
            target_resource_id: this.extractResourceId(criticalNodes[j]),
            path_type: 'dependency',
            path_depth: path.length,
            path_relationships: path,
            path_confidence: this.calculatePathConfidence(path, graph),
            path_strength: this.calculatePathStrength(path, graph),
            is_critical_path: true,
            computed_at: new Date(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          });

          criticalPaths.push(relationshipPath);
        }
      }
    }

    return criticalPaths;
  }

  /**
   * Compute cross-cloud dependency analysis
   */
  async analyzeCrossCloudDependencies(graph?: DependencyGraph): Promise<{
    crossCloudConnections: Array<{
      sourceProvider: CloudProvider;
      targetProvider: CloudProvider;
      connectionCount: number;
      averageStrength: number;
      criticalConnections: number;
      relationshipTypes: RelationshipType[];
    }>;
    providerDependencyMatrix: Map<CloudProvider, Map<CloudProvider, number>>;
    isolatedProviders: CloudProvider[];
    providerRiskScores: Map<CloudProvider, number>;
  }> {
    if (!graph) {
      graph = await this.buildDependencyGraph();
    }

    const crossCloudConnections = new Map<string, {
      sourceProvider: CloudProvider;
      targetProvider: CloudProvider;
      connectionCount: number;
      totalStrength: number;
      criticalConnections: number;
      relationshipTypes: Set<RelationshipType>;
    }>();

    const providerDependencyMatrix = new Map<CloudProvider, Map<CloudProvider, number>>();

    // Analyze each edge for cross-cloud connections
    for (const edge of graph.edges.values()) {
      const sourceNode = graph.nodes.get(edge.source)!;
      const targetNode = graph.nodes.get(edge.target)!;

      if (sourceNode.provider !== targetNode.provider) {
        const key = `${sourceNode.provider}->${targetNode.provider}`;

        if (!crossCloudConnections.has(key)) {
          crossCloudConnections.set(key, {
            sourceProvider: sourceNode.provider,
            targetProvider: targetNode.provider,
            connectionCount: 0,
            totalStrength: 0,
            criticalConnections: 0,
            relationshipTypes: new Set<RelationshipType>()
          });
        }

        const connection = crossCloudConnections.get(key)!;
        connection.connectionCount++;
        connection.totalStrength += edge.strength;
        connection.relationshipTypes.add(edge.relationshipType);

        if (edge.critical) {
          connection.criticalConnections++;
        }

        // Update dependency matrix
        if (!providerDependencyMatrix.has(sourceNode.provider)) {
          providerDependencyMatrix.set(sourceNode.provider, new Map<CloudProvider, number>());
        }
        const sourceMatrix = providerDependencyMatrix.get(sourceNode.provider)!;
        sourceMatrix.set(targetNode.provider, (sourceMatrix.get(targetNode.provider) || 0) + 1);
      }
    }

    // Convert to final format
    const crossCloudConnectionsArray = Array.from(crossCloudConnections.values()).map(conn => ({
      sourceProvider: conn.sourceProvider,
      targetProvider: conn.targetProvider,
      connectionCount: conn.connectionCount,
      averageStrength: conn.totalStrength / conn.connectionCount,
      criticalConnections: conn.criticalConnections,
      relationshipTypes: Array.from(conn.relationshipTypes)
    }));

    // Find isolated providers
    const allProviders = new Set<CloudProvider>();
    for (const node of graph.nodes.values()) {
      allProviders.add(node.provider);
    }

    const connectedProviders = new Set<CloudProvider>();
    for (const conn of crossCloudConnectionsArray) {
      connectedProviders.add(conn.sourceProvider);
      connectedProviders.add(conn.targetProvider);
    }

    const isolatedProviders = Array.from(allProviders).filter(
      provider => !connectedProviders.has(provider)
    );

    // Calculate provider risk scores
    const providerRiskScores = this.calculateProviderRiskScores(graph, crossCloudConnectionsArray);

    return {
      crossCloudConnections: crossCloudConnectionsArray,
      providerDependencyMatrix,
      isolatedProviders,
      providerRiskScores
    };
  }

  /**
   * Calculate dependency metrics for the graph
   */
  calculateDependencyMetrics(graph: DependencyGraph): DependencyMetrics {
    const nodes = Array.from(graph.nodes.values());
    const edges = Array.from(graph.edges.values());

    const crossCloudEdges = edges.filter(edge => {
      const sourceNode = graph.nodes.get(edge.source)!;
      const targetNode = graph.nodes.get(edge.target)!;
      return sourceNode.provider !== targetNode.provider;
    });

    const maxDepth = nodes.length > 0 ? Math.max(...nodes.map(n => n.level)) : 0;
    const averageDepth = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.level, 0) / nodes.length : 0;

    // Count isolated nodes (nodes with no connections)
    const isolatedNodes = nodes.filter(n =>
      n.dependencies.size === 0 && n.dependents.size === 0
    ).length;

    // Calculate topological complexity (edges per node ratio)
    const topologicalComplexity = nodes.length > 0 ? edges.length / nodes.length : 0;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      crossCloudEdges: crossCloudEdges.length,
      maxDepth,
      averageDepth,
      cyclicDependencies: 0, // This would be set by the cyclic dependency detection
      criticalPaths: edges.filter(e => e.critical).length,
      isolatedNodes,
      topologicalComplexity
    };
  }

  // ======================================
  // PRIVATE HELPER METHODS
  // ======================================

  private calculateDependencyLevels(
    nodes: Map<string, DependencyNode>,
    edges: Map<string, DependencyEdge>
  ): void {
    const visited = new Set<string>();
    const temp = new Set<string>();

    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    const inDegree = new Map<string, number>();

    // Initialize in-degree count
    for (const nodeId of nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const edge of edges.values()) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Find all nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
        nodes.get(nodeId)!.level = 0;
      }
    }

    // Process queue
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodes.get(currentId)!;

      // Check all dependencies of current node
      for (const depId of currentNode.dependencies) {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);

        if (newDegree === 0) {
          const depNode = nodes.get(depId)!;
          depNode.level = Math.max(depNode.level, currentNode.level + 1);
          queue.push(depId);
        }
      }
    }
  }

  private detectCyclesFromNode(
    nodeId: string,
    graph: DependencyGraph,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: CyclicDependency[]
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId)!;

    for (const depId of node.dependencies) {
      if (!visited.has(depId)) {
        this.detectCyclesFromNode(depId, graph, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(depId)) {
        // Found a cycle
        const cycleStart = path.indexOf(depId);
        const cycle = path.slice(cycleStart);
        cycle.push(depId); // Complete the cycle

        // Calculate cycle properties
        const cycleStrength = this.calculateCycleStrength(cycle, graph);
        const cycleConfidence = this.calculateCycleConfidence(cycle, graph);
        const isCritical = this.isCycleCritical(cycle, graph);

        cycles.push({
          cycle,
          strength: cycleStrength,
          confidence: cycleConfidence,
          critical: isCritical,
          breakSuggestions: [] // Will be filled later
        });
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
  }

  private findPathsBetweenNodes(
    sourceId: string,
    targetId: string,
    graph: DependencyGraph,
    maxDepth: number
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, currentPath: string[], depth: number) => {
      if (depth > maxDepth) return;
      if (currentId === targetId) {
        paths.push([...currentPath]);
        return;
      }

      visited.add(currentId);
      const node = graph.nodes.get(currentId)!;

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          // Find the edge ID for this dependency
          for (const edge of graph.edges.values()) {
            if (edge.source === currentId && edge.target === depId) {
              currentPath.push(edge.id);
              dfs(depId, currentPath, depth + 1);
              currentPath.pop();
              break;
            }
          }
        }
      }

      visited.delete(currentId);
    };

    dfs(sourceId, [], 0);
    return paths;
  }

  private calculatePathConfidence(path: string[], graph: DependencyGraph): number {
    if (path.length === 0) return 1.0;

    let totalConfidence = 1.0;
    for (const edgeId of path) {
      const edge = graph.edges.get(edgeId);
      if (edge) {
        totalConfidence *= edge.confidence;
      }
    }

    return totalConfidence;
  }

  private calculatePathStrength(path: string[], graph: DependencyGraph): number {
    if (path.length === 0) return 0;

    let totalStrength = 0;
    for (const edgeId of path) {
      const edge = graph.edges.get(edgeId);
      if (edge) {
        totalStrength += edge.strength;
      }
    }

    return Math.round(totalStrength / path.length);
  }

  private calculateCycleStrength(cycle: string[], graph: DependencyGraph): number {
    let totalStrength = 0;
    let edgeCount = 0;

    for (let i = 0; i < cycle.length - 1; i++) {
      const sourceId = cycle[i];
      const targetId = cycle[i + 1];

      for (const edge of graph.edges.values()) {
        if (edge.source === sourceId && edge.target === targetId) {
          totalStrength += edge.strength;
          edgeCount++;
          break;
        }
      }
    }

    return edgeCount > 0 ? totalStrength / edgeCount : 0;
  }

  private calculateCycleConfidence(cycle: string[], graph: DependencyGraph): number {
    let totalConfidence = 1.0;

    for (let i = 0; i < cycle.length - 1; i++) {
      const sourceId = cycle[i];
      const targetId = cycle[i + 1];

      for (const edge of graph.edges.values()) {
        if (edge.source === sourceId && edge.target === targetId) {
          totalConfidence *= edge.confidence;
          break;
        }
      }
    }

    return totalConfidence;
  }

  private isCycleCritical(cycle: string[], graph: DependencyGraph): boolean {
    for (let i = 0; i < cycle.length - 1; i++) {
      const sourceId = cycle[i];
      const targetId = cycle[i + 1];

      for (const edge of graph.edges.values()) {
        if (edge.source === sourceId && edge.target === targetId && edge.critical) {
          return true;
        }
      }
    }

    return false;
  }

  private generateCycleBreakSuggestions(
    cycle: CyclicDependency,
    graph: DependencyGraph
  ): Array<{
    edge: string;
    reason: string;
    impact: 'low' | 'medium' | 'high';
  }> {
    const suggestions = [];

    for (let i = 0; i < cycle.cycle.length - 1; i++) {
      const sourceId = cycle.cycle[i];
      const targetId = cycle.cycle[i + 1];

      for (const edge of graph.edges.values()) {
        if (edge.source === sourceId && edge.target === targetId) {
          let impact: 'low' | 'medium' | 'high' = 'low';
          let reason = '';

          if (edge.critical) {
            impact = 'high';
            reason = 'Critical dependency - breaking this edge may cause service disruption';
          } else if (edge.strength >= 7) {
            impact = 'medium';
            reason = 'Strong dependency - may require significant refactoring';
          } else {
            impact = 'low';
            reason = 'Weak dependency - safe to break with minimal impact';
          }

          suggestions.push({
            edge: edge.id,
            reason,
            impact
          });
          break;
        }
      }
    }

    // Sort by impact (low impact first)
    suggestions.sort((a, b) => {
      const impactOrder = { 'low': 0, 'medium': 1, 'high': 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });

    return suggestions;
  }

  private calculateProviderRiskScores(
    graph: DependencyGraph,
    crossCloudConnections: Array<{
      sourceProvider: CloudProvider;
      targetProvider: CloudProvider;
      connectionCount: number;
      averageStrength: number;
      criticalConnections: number;
    }>
  ): Map<CloudProvider, number> {
    const riskScores = new Map<CloudProvider, number>();

    // Initialize scores
    const allProviders = new Set<CloudProvider>();
    for (const node of graph.nodes.values()) {
      allProviders.add(node.provider);
      riskScores.set(node.provider, 0);
    }

    // Calculate risk based on cross-cloud dependencies
    for (const conn of crossCloudConnections) {
      const sourceRisk = riskScores.get(conn.sourceProvider) || 0;
      const targetRisk = riskScores.get(conn.targetProvider) || 0;

      // Increase risk based on connection count and strength
      const connectionRisk = conn.connectionCount * conn.averageStrength * 0.1;
      const criticalRisk = conn.criticalConnections * 5;

      riskScores.set(conn.sourceProvider, sourceRisk + connectionRisk + criticalRisk);
      riskScores.set(conn.targetProvider, targetRisk + connectionRisk + criticalRisk);
    }

    // Normalize scores to 0-100 scale
    const maxScore = Math.max(...Array.from(riskScores.values()));
    if (maxScore > 0) {
      for (const [provider, score] of riskScores) {
        riskScores.set(provider, Math.min(100, (score / maxScore) * 100));
      }
    }

    return riskScores;
  }

  private extractResourceId(nodeId: string): string {
    // Extract resource ID from node identifier (format: provider:type:id)
    const parts = nodeId.split(':');
    return parts.length >= 3 ? parts[2] : nodeId;
  }
}

export default DependencyTracker;