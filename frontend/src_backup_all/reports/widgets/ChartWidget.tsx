/**
 * Chart Widget Component
 * Interactive charts using Ant Design Plots and ECharts
 */

import React, { useMemo } from 'react';
import { Empty, Typography } from 'antd';
import { Column, Pie, Line, Area, Bar } from '@ant-design/plots';
import ReactECharts from 'echarts-for-react';
import { ChartConfiguration } from '../../../types/reports';

const { Text } = Typography;

interface ChartWidgetProps {
  configuration: ChartConfiguration;
  data: any;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  configuration,
  data
}) => {
  const chartData = useMemo(() => {
    if (!data?.aggregation?.data) {
      return [];
    }

    // Transform data for chart consumption
    return data.aggregation.data.map((item: any) => ({
      category: item.group || item.name || 'Unknown',
      value: parseInt(item.value) || 0,
      ...item
    }));
  }, [data]);

  const getChartColors = () => {
    return configuration.colors || [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#fa8c16', '#13c2c2', '#eb2f96', '#a0d911', '#2f54eb'
    ];
  };

  const renderColumnChart = () => {
    const config = {
      data: chartData,
      xField: 'category',
      yField: 'value',
      color: getChartColors(),
      columnStyle: {
        radius: [4, 4, 0, 0],
      },
      label: {
        position: 'top' as const,
      },
      meta: {
        category: { alias: configuration.groupBy || 'Category' },
        value: { alias: configuration.title }
      },
      ...configuration.options
    };

    return <Column {...config} />;
  };

  const renderBarChart = () => {
    const config = {
      data: chartData,
      xField: 'value',
      yField: 'category',
      color: getChartColors(),
      barStyle: {
        radius: [0, 4, 4, 0],
      },
      label: {
        position: 'right' as const,
      },
      meta: {
        category: { alias: configuration.groupBy || 'Category' },
        value: { alias: configuration.title }
      },
      ...configuration.options
    };

    return <Bar {...config} />;
  };

  const renderPieChart = () => {
    const config = {
      data: chartData,
      angleField: 'value',
      colorField: 'category',
      radius: 0.8,
      label: {
        type: 'outer' as const,
        content: '{name}: {percentage}',
      },
      color: getChartColors(),
      interactions: [
        { type: 'pie-legend-active' },
        { type: 'element-active' }
      ],
      ...configuration.options
    };

    return <Pie {...config} />;
  };

  const renderLineChart = () => {
    const config = {
      data: chartData,
      xField: 'category',
      yField: 'value',
      color: getChartColors()[0],
      point: {
        size: 4,
        shape: 'circle',
      },
      smooth: true,
      meta: {
        category: { alias: configuration.groupBy || 'Category' },
        value: { alias: configuration.title }
      },
      ...configuration.options
    };

    return <Line {...config} />;
  };

  const renderAreaChart = () => {
    const config = {
      data: chartData,
      xField: 'category',
      yField: 'value',
      color: getChartColors()[0],
      smooth: true,
      areaStyle: {
        fillOpacity: 0.3,
      },
      meta: {
        category: { alias: configuration.groupBy || 'Category' },
        value: { alias: configuration.title }
      },
      ...configuration.options
    };

    return <Area {...config} />;
  };

  const renderGaugeChart = () => {
    const value = chartData.length > 0 ? chartData[0].value : 0;
    const maxValue = Math.max(100, ...chartData.map(d => d.value));

    const option = {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: maxValue,
          splitNumber: 8,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.25, '#FF6E76'],
                [0.5, '#FDDD60'],
                [0.75, '#58D9F9'],
                [1, '#7CFFB2']
              ]
            }
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 20,
            offsetCenter: [0, '-60%'],
            itemStyle: {
              color: 'auto'
            }
          },
          axisTick: {
            length: 12,
            lineStyle: {
              color: 'auto',
              width: 2
            }
          },
          splitLine: {
            length: 20,
            lineStyle: {
              color: 'auto',
              width: 5
            }
          },
          axisLabel: {
            color: '#464646',
            fontSize: 20
          },
          title: {
            offsetCenter: [0, '-20%'],
            fontSize: 20
          },
          detail: {
            fontSize: 30,
            offsetCenter: [0, '-35%'],
            valueAnimation: true,
            formatter: function (value: number) {
              return Math.round(value);
            },
            color: 'auto'
          },
          data: [
            {
              value: value,
              name: configuration.title
            }
          ]
        }
      ]
    };

    return (
      <ReactECharts 
        option={option} 
        style={{ height: '200px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    );
  };

  const renderDonutChart = () => {
    const config = {
      data: chartData,
      angleField: 'value',
      colorField: 'category',
      radius: 0.8,
      innerRadius: 0.6,
      label: {
        type: 'inner' as const,
        offset: '-30%',
        content: '{value}',
        style: {
          fontSize: 14,
          textAlign: 'center' as const,
        },
      },
      color: getChartColors(),
      statistic: {
        title: false,
        content: {
          style: {
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          content: `Total\n${chartData.reduce((sum, item) => sum + item.value, 0)}`,
        },
      },
      ...configuration.options
    };

    return <Pie {...config} />;
  };

  const renderScatterChart = () => {
    const option = {
      xAxis: {
        type: 'category',
        data: chartData.map(d => d.category)
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          data: chartData.map(d => d.value),
          type: 'scatter',
          symbolSize: 10,
          itemStyle: {
            color: getChartColors()[0]
          }
        }
      ],
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}'
      }
    };

    return (
      <ReactECharts 
        option={option} 
        style={{ height: '200px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    );
  };

  const renderHeatmapChart = () => {
    // Transform data for heatmap
    const heatmapData = chartData.map((item, index) => [
      index % 7, // x
      Math.floor(index / 7), // y
      item.value // value
    ]);

    const option = {
      tooltip: {
        position: 'top'
      },
      grid: {
        height: '50%',
        top: '10%'
      },
      xAxis: {
        type: 'category',
        data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        splitArea: {
          show: true
        }
      },
      yAxis: {
        type: 'category',
        data: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        splitArea: {
          show: true
        }
      },
      visualMap: {
        min: 0,
        max: Math.max(...chartData.map(d => d.value)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '15%',
        inRange: {
          color: getChartColors()
        }
      },
      series: [
        {
          name: configuration.title,
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    return (
      <ReactECharts 
        option={option} 
        style={{ height: '200px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    );
  };

  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return <Empty description="No data available" />;
    }

    try {
      switch (configuration.type) {
        case 'bar':
          return renderBarChart();
        case 'line':
          return renderLineChart();
        case 'pie':
          return renderPieChart();
        case 'donut':
          return renderDonutChart();
        case 'gauge':
          return renderGaugeChart();
        case 'area':
          return renderAreaChart();
        case 'scatter':
          return renderScatterChart();
        case 'heatmap':
          return renderHeatmapChart();
        default:
          return renderColumnChart();
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <Empty 
          description={
            <Text type="secondary">
              Error rendering {configuration.type} chart
            </Text>
          } 
        />
      );
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {configuration.description && (
        <Text 
          type="secondary" 
          style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}
        >
          {configuration.description}
        </Text>
      )}
      
      <div style={{ height: 'calc(100% - 20px)' }}>
        {renderChart()}
      </div>

      {data?.executionTime && (
        <Text 
          type="secondary" 
          style={{ fontSize: '10px', display: 'block', textAlign: 'right', marginTop: 8 }}
        >
          Query time: {data.executionTime}ms
        </Text>
      )}
    </div>
  );
};