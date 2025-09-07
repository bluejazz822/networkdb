import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Button,
  Select,
  Switch,
  Drawer,
  Typography,
  Tag,
  Divider,
  Tooltip,
  Alert,
  Spin,
  message
} from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  ReloadOutlined,
  SettingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FilterOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import * as d3 from 'd3';
import { useNetworkManagement } from '../../hooks/useNetworkManagement';
import {
  getResourceTypeColor,
  getResourceDisplayName,
  getResourceStatus,
  getHealthStatusColor
} from '../../utils/network-helpers';
import type { NetworkTopology, TopologyNode, TopologyEdge, ResourceHealth } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface NetworkTopologyViewProps {
  selectedRegions?: string[];
  selectedResourceTypes?: string[];
  onNodeClick?: (node: TopologyNode) => void;
  onEdgeClick?: (edge: TopologyEdge) => void;
  height?: number;
}

export const NetworkTopologyView: React.FC<NetworkTopologyViewProps> = ({
  selectedRegions = [],
  selectedResourceTypes = [],
  onNodeClick,
  onEdgeClick,
  height = 600
}) => {
  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showHealthStatus, setShowHealthStatus] = useState(true);
  const [groupByRegion, setGroupByRegion] = useState(false);
  const [layoutType, setLayoutType] = useState<'force' | 'hierarchical' | 'circular'>('force');
  const [healthData, setHealthData] = useState<Record<string, ResourceHealth>>({});

  // Network management hook
  const { loadNetworkTopology, loadHealthData } = useNetworkManagement({ 
    resourceType: 'vpc', 
    autoLoad: false 
  });

  // D3 simulation ref
  const simulationRef = useRef<d3.Simulation<TopologyNode, TopologyEdge> | null>(null);

  // Load topology data
  const loadTopologyData = useCallback(async () => {
    setLoading(true);
    try {
      const topologyData = await loadNetworkTopology();
      if (topologyData) {
        setTopology(topologyData);
        
        // Load health data for all nodes
        const nodeIds = topologyData.nodes.map(node => node.id);
        // Note: In a real implementation, you'd call the health API
        // const health = await loadHealthData(nodeIds);
        // setHealthData(health);
      }
    } catch (error) {
      console.error('Failed to load topology:', error);
      message.error('Failed to load network topology');
    } finally {
      setLoading(false);
    }
  }, [loadNetworkTopology]);

  // Filter nodes and edges based on selections
  const getFilteredData = useCallback(() => {
    if (!topology) return { nodes: [], edges: [] };

    let filteredNodes = topology.nodes;
    let filteredEdges = topology.edges;

    // Filter by regions
    if (selectedRegions.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        selectedRegions.includes(node.properties.region)
      );
    }

    // Filter by resource types
    if (selectedResourceTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        selectedResourceTypes.includes(node.type)
      );
    }

    // Filter edges to only include those with both nodes present
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    filteredEdges = filteredEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [topology, selectedRegions, selectedResourceTypes]);

  // Initialize D3 visualization
  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || !topology) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    // Clear existing content
    svg.selectAll('*').remove();

    // Get container dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const svgHeight = height;

    // Update SVG dimensions
    svg.attr('width', width).attr('height', svgHeight);

    // Get filtered data
    const { nodes, edges } = getFilteredData();
    
    if (nodes.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', svgHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#999')
        .text('No resources to display');
      return;
    }

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom as any);

    // Create main group
    const g = svg.append('g');

    // Create simulation based on layout type
    let simulation: d3.Simulation<TopologyNode, TopologyEdge>;

    if (layoutType === 'force') {
      simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(edges as any).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, svgHeight / 2))
        .force('collision', d3.forceCollide().radius(30));
    } else if (layoutType === 'circular') {
      const radius = Math.min(width, svgHeight) / 3;
      const angleStep = (2 * Math.PI) / nodes.length;
      
      nodes.forEach((node, i) => {
        node.position = {
          x: width / 2 + radius * Math.cos(i * angleStep),
          y: svgHeight / 2 + radius * Math.sin(i * angleStep)
        };
      });
      
      simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(edges as any).id((d: any) => d.id).distance(100))
        .alphaTarget(0);
    } else {
      // Hierarchical layout - simplified version
      simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(edges as any).id((d: any) => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY().y((d: any) => {
          const levels = { 'vpc': 1, 'transit-gateway': 2, 'customer-gateway': 3, 'vpc-endpoint': 4 };
          return (levels[d.type as keyof typeof levels] || 1) * svgHeight / 5;
        }).strength(0.8));
    }

    simulationRef.current = simulation;

    // Create edges
    const links = g.selectAll('.link')
      .data(edges)
      .enter()
      .append('line')
      .classed('link', true)
      .attr('stroke', (d) => {
        const statusColors = {
          'active': '#52c41a',
          'inactive': '#f5222d',
          'pending': '#faad14'
        };
        return statusColors[d.status as keyof typeof statusColors] || '#d9d9d9';
      })
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) => d.status === 'pending' ? '5,5' : 'none')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        onEdgeClick?.(d);
      });

    // Create nodes
    const nodeGroups = g.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .classed('node', true)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
        onNodeClick?.(d);
      })
      .call(d3.drag<SVGGElement, TopologyNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any
      );

    // Add node circles
    const nodeSize = 20;
    nodeGroups.append('circle')
      .attr('r', nodeSize)
      .attr('fill', (d) => {
        if (showHealthStatus && healthData[d.id]) {
          return getHealthStatusColor(healthData[d.id].status);
        }
        return getResourceTypeColor(d.type);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);

    // Add health status indicators
    if (showHealthStatus) {
      nodeGroups.append('circle')
        .attr('r', 6)
        .attr('cx', 15)
        .attr('cy', -15)
        .attr('fill', (d) => {
          const health = healthData[d.id];
          if (health) {
            return getHealthStatusColor(health.status);
          }
          return 'transparent';
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('display', (d) => healthData[d.id] ? 'block' : 'none');
    }

    // Add resource type icons (simplified as text)
    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text((d) => {
        const icons = {
          'vpc': 'V',
          'transit-gateway': 'T',
          'customer-gateway': 'C',
          'vpc-endpoint': 'E'
        };
        return icons[d.type as keyof typeof icons] || '?';
      });

    // Add labels
    if (showLabels) {
      nodeGroups.append('text')
        .attr('dx', nodeSize + 5)
        .attr('dy', '0.3em')
        .attr('fill', '#333')
        .attr('font-size', '12px')
        .text((d) => d.label);
    }

    // Add tooltips
    nodeGroups.append('title')
      .text((d) => {
        const health = healthData[d.id];
        return [
          `Name: ${d.label}`,
          `Type: ${d.type}`,
          `Region: ${d.properties.region}`,
          `Status: ${d.properties.state}`,
          health ? `Health: ${health.status}` : ''
        ].filter(Boolean).join('\\n');
      });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroups
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [topology, getFilteredData, layoutType, showLabels, showHealthStatus, healthData, height, onNodeClick, onEdgeClick]);

  // Handle zoom controls
  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom();

    if (direction === 'in') {
      svg.transition().call(zoom.scaleBy as any, 1.5);
    } else if (direction === 'out') {
      svg.transition().call(zoom.scaleBy as any, 0.67);
    } else {
      svg.transition().call(zoom.transform as any, d3.zoomIdentity);
    }
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Export visualization
  const exportVisualization = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const link = document.createElement('a');
      link.download = 'network-topology.png';
      link.href = canvas.toDataURL();
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // Initialize on mount and when dependencies change
  useEffect(() => {
    loadTopologyData();
  }, [loadTopologyData]);

  useEffect(() => {
    initializeVisualization();
  }, [initializeVisualization]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Controls */}
      <Card size=\"small\" style={{ marginBottom: '8px' }}>
        <Row justify=\"space-between\" align=\"middle\">
          <Col>
            <Space>
              <Text strong>Network Topology</Text>
              {topology && (
                <Text type=\"secondary\">
                  {getFilteredData().nodes.length} resources, {getFilteredData().edges.length} connections
                </Text>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Select
                value={layoutType}
                onChange={setLayoutType}
                style={{ width: 120 }}
                size=\"small\"
              >
                <Option value=\"force\">Force Layout</Option>
                <Option value=\"hierarchical\">Hierarchical</Option>
                <Option value=\"circular\">Circular</Option>
              </Select>
              <Button size=\"small\" icon={<ZoomInOutlined />} onClick={() => handleZoom('in')} />
              <Button size=\"small\" icon={<ZoomOutOutlined />} onClick={() => handleZoom('out')} />
              <Button size=\"small\" icon={<ExpandOutlined />} onClick={() => handleZoom('reset')} />
              <Button size=\"small\" icon={<ReloadOutlined />} onClick={loadTopologyData} loading={loading} />
              <Button size=\"small\" icon={<DownloadOutlined />} onClick={exportVisualization} />
              <Button size=\"small\" icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)} />
              <Button
                size=\"small\"
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={toggleFullscreen}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Visualization Container */}
      <Card style={{ position: 'relative', minHeight: height }}>
        {loading && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}>
            <Spin size=\"large\" />
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Text>Loading network topology...</Text>
            </div>
          </div>
        )}
        
        <svg ref={svgRef} style={{ width: '100%', height: height, cursor: 'grab' }} />
        
        {/* Zoom level indicator */}
        <div style={{ 
          position: 'absolute', 
          bottom: '16px', 
          left: '16px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Zoom: {Math.round(zoomLevel * 100)}%
        </div>
      </Card>

      {/* Settings Drawer */}
      <Drawer
        title=\"Topology Settings\"
        placement=\"right\"
        width={300}
        open={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      >
        <Space direction=\"vertical\" style={{ width: '100%' }}>
          <div>
            <Text strong>Display Options</Text>
            <div style={{ marginTop: '8px' }}>
              <Space direction=\"vertical\">
                <Switch
                  checked={showLabels}
                  onChange={setShowLabels}
                  checkedChildren=\"Labels On\"
                  unCheckedChildren=\"Labels Off\"
                />
                <Switch
                  checked={showHealthStatus}
                  onChange={setShowHealthStatus}
                  checkedChildren=\"Health On\"
                  unCheckedChildren=\"Health Off\"
                />
                <Switch
                  checked={groupByRegion}
                  onChange={setGroupByRegion}
                  checkedChildren=\"Group By Region\"
                  unCheckedChildren=\"No Grouping\"
                />
              </Space>
            </div>
          </div>

          <Divider />

          <div>
            <Text strong>Layout Settings</Text>
            <div style={{ marginTop: '8px' }}>
              <Select
                value={layoutType}
                onChange={setLayoutType}
                style={{ width: '100%' }}
              >
                <Option value=\"force\">Force-Directed Layout</Option>
                <Option value=\"hierarchical\">Hierarchical Layout</Option>
                <Option value=\"circular\">Circular Layout</Option>
              </Select>
            </div>
          </div>

          <Divider />

          <div>
            <Text strong>Legend</Text>
            <div style={{ marginTop: '8px' }}>
              <Space direction=\"vertical\" size={4}>
                <div>
                  <Tag color={getResourceTypeColor('vpc')}>VPC</Tag>
                  <Text type=\"secondary\">Virtual Private Cloud</Text>
                </div>
                <div>
                  <Tag color={getResourceTypeColor('transit-gateway')}>TGW</Tag>
                  <Text type=\"secondary\">Transit Gateway</Text>
                </div>
                <div>
                  <Tag color={getResourceTypeColor('customer-gateway')}>CGW</Tag>
                  <Text type=\"secondary\">Customer Gateway</Text>
                </div>
                <div>
                  <Tag color={getResourceTypeColor('vpc-endpoint')}>VPE</Tag>
                  <Text type=\"secondary\">VPC Endpoint</Text>
                </div>
              </Space>
            </div>
          </div>
        </Space>
      </Drawer>

      {/* Selected Node Info */}
      {selectedNode && (
        <Card
          size=\"small\"
          title={`Resource: ${selectedNode.label}`}
          extra={<Button size=\"small\" onClick={() => setSelectedNode(null)}>×</Button>}
          style={{
            position: 'absolute',
            top: '60px',
            right: '16px',
            width: '300px',
            zIndex: 10
          }}
        >
          <Space direction=\"vertical\" size={4}>
            <div>
              <Text strong>Type:</Text> <Tag color={getResourceTypeColor(selectedNode.type)}>{selectedNode.type}</Tag>
            </div>
            <div>
              <Text strong>Region:</Text> {selectedNode.properties.region}
            </div>
            <div>
              <Text strong>Status:</Text> 
              <Tag color={getResourceStatus({ state: selectedNode.properties.state } as any).color}>
                {selectedNode.properties.state}
              </Tag>
            </div>
            {healthData[selectedNode.id] && (
              <div>
                <Text strong>Health:</Text> 
                <Tag color={getHealthStatusColor(healthData[selectedNode.id].status)}>
                  {healthData[selectedNode.id].status}
                </Tag>
              </div>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};