/**
 * Dashboard Component Performance Testing
 * Tests for DataSyncPage and related components performance with large datasets
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DataSyncPage from '../DataSyncPage';
import WorkflowStatusGrid from '../WorkflowStatusGrid';
import WorkflowMetrics from '../WorkflowMetrics';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Performance testing utilities
const measureRenderTime = async (component: React.ReactElement): Promise<number> => {
  const startTime = performance.now();
  await act(async () => {
    render(component);
  });
  return performance.now() - startTime;
};

const measureUpdateTime = async (updateFn: () => Promise<void>): Promise<number> => {
  const startTime = performance.now();
  await act(async () => {
    await updateFn();
  });
  return performance.now() - startTime;
};

// Mock data generators for performance testing
const generateLargeWorkflowDataset = (count: number) => ({
  totalWorkflows: count,
  activeWorkflows: Math.floor(count * 0.75),
  inactiveWorkflows: Math.floor(count * 0.25),
  runningExecutions: Math.floor(count * 0.1),
  totalExecutionsToday: count * 3,
  successfulExecutionsToday: Math.floor(count * 2.4),
  failedExecutionsToday: Math.floor(count * 0.6),
  averageExecutionTime: 45.5,
  systemHealth: 'healthy' as const,
  lastSyncTime: new Date().toISOString(),
  recentExecutions: Array(Math.min(count * 2, 1000)).fill(null).map((_, index) => ({
    id: `exec-${index}`,
    workflowId: `workflow-${index % count}`,
    workflowName: `Test Workflow ${index % count}`,
    status: ['success', 'error', 'running'][index % 3] as 'success' | 'error' | 'running',
    startTime: new Date(Date.now() - (index * 1800000)).toISOString(),
    endTime: index % 3 !== 2 ? new Date(Date.now() - (index * 1800000) + 60000).toISOString() : null,
    duration: index % 3 !== 2 ? 60 : null,
    provider: ['aws', 'azure', 'gcp'][index % 3] as 'aws' | 'azure' | 'gcp',
    type: ['vpc', 'subnet', 'transit_gateway'][index % 3] as 'vpc' | 'subnet' | 'transit_gateway'
  })),
  workflows: Array(count).fill(null).map((_, index) => ({
    id: `workflow-${index}`,
    name: `Test Workflow ${index}`,
    type: ['vpc', 'subnet', 'transit_gateway', 'nat_gateway', 'vpn'][index % 5] as 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn',
    provider: ['aws', 'azure', 'gcp', 'ali', 'oci'][index % 5] as 'aws' | 'azure' | 'gcp' | 'ali' | 'oci',
    isActive: index % 4 !== 0,
    lastExecution: {
      id: `exec-${index}`,
      status: ['success', 'error', 'running'][index % 3] as 'success' | 'error' | 'running',
      startTime: new Date(Date.now() - (index * 3600000)).toISOString(),
      endTime: index % 3 !== 2 ? new Date(Date.now() - (index * 3600000) + 120000).toISOString() : null,
      duration: index % 3 !== 2 ? 120 : null
    },
    description: `Performance test workflow ${index} with sample description text`,
    tags: [`tag-${index % 10}`, `category-${index % 5}`, 'performance-test'],
    createdAt: new Date(Date.now() - (index * 86400000)).toISOString(),
    updatedAt: new Date().toISOString()
  }))
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard Performance Tests', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for API calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock performance.now for consistent timing
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    // Suppress console logs during performance tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===================== DATASYNC PAGE PERFORMANCE =====================

  describe('DataSyncPage Performance', () => {
    it('should render efficiently with small dataset (50 workflows)', async () => {
      const smallDataset = generateLargeWorkflowDataset(50);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: smallDataset })
      });

      const component = (
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );

      const renderTime = await measureRenderTime(component);

      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
      expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();

      console.log(`📊 Small dataset (50 workflows) render time: ${renderTime.toFixed(2)}ms`);
    });

    it('should render efficiently with medium dataset (200 workflows)', async () => {
      const mediumDataset = generateLargeWorkflowDataset(200);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mediumDataset })
      });

      const component = (
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );

      const renderTime = await measureRenderTime(component);

      expect(renderTime).toBeLessThan(4000); // Should render within 4 seconds
      expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();

      console.log(`📊 Medium dataset (200 workflows) render time: ${renderTime.toFixed(2)}ms`);
    });

    it('should render efficiently with large dataset (500 workflows)', async () => {
      const largeDataset = generateLargeWorkflowDataset(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: largeDataset })
      });

      const component = (
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );

      const renderTime = await measureRenderTime(component);

      expect(renderTime).toBeLessThan(8000); // Should render within 8 seconds
      expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();

      console.log(`📊 Large dataset (500 workflows) render time: ${renderTime.toFixed(2)}ms`);
    });

    it('should handle data updates efficiently', async () => {
      const initialDataset = generateLargeWorkflowDataset(100);
      const updatedDataset = generateLargeWorkflowDataset(120);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: initialDataset })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: updatedDataset })
        });

      const { rerender } = render(
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();
      });

      // Measure update time
      const updateTime = await measureUpdateTime(async () => {
        rerender(
          <TestWrapper>
            <DataSyncPage />
          </TestWrapper>
        );
        await waitFor(() => {
          expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();
        });
      });

      expect(updateTime).toBeLessThan(3000); // Updates should be faster than initial render
      console.log(`📊 Dataset update time: ${updateTime.toFixed(2)}ms`);
    });
  });

  // ===================== WORKFLOW STATUS GRID PERFORMANCE =====================

  describe('WorkflowStatusGrid Performance', () => {
    it('should render workflow grid efficiently with large dataset', async () => {
      const largeDataset = generateLargeWorkflowDataset(300);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: largeDataset })
      });

      const component = (
        <TestWrapper>
          <WorkflowStatusGrid
            title="Performance Test Grid"
            autoRefresh={false}
            refreshInterval={30000}
            onCreateWorkflow={vi.fn()}
          />
        </TestWrapper>
      );

      const renderTime = await measureRenderTime(component);

      expect(renderTime).toBeLessThan(5000); // Should render within 5 seconds
      expect(screen.getByText('Performance Test Grid')).toBeInTheDocument();

      console.log(`📊 WorkflowStatusGrid (300 workflows) render time: ${renderTime.toFixed(2)}ms`);
    });

    it('should handle grid scrolling performance', async () => {
      const scrollDataset = generateLargeWorkflowDataset(1000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: scrollDataset })
      });

      render(
        <TestWrapper>
          <WorkflowStatusGrid
            title="Scroll Test Grid"
            autoRefresh={false}
            refreshInterval={30000}
            onCreateWorkflow={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Scroll Test Grid')).toBeInTheDocument();
      });

      // Test scroll performance by finding scrollable container
      const scrollContainer = screen.getByRole('table').closest('.ant-table-body');

      if (scrollContainer) {
        const scrollStartTime = performance.now();

        await act(async () => {
          // Simulate scrolling
          scrollContainer.scrollTop = 500;
          scrollContainer.dispatchEvent(new Event('scroll'));
        });

        const scrollTime = performance.now() - scrollStartTime;
        expect(scrollTime).toBeLessThan(100); // Scrolling should be very fast
        console.log(`📊 Grid scroll time: ${scrollTime.toFixed(2)}ms`);
      }
    });

    it('should handle grid filtering performance', async () => {
      const filterDataset = generateLargeWorkflowDataset(400);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: filterDataset })
      });

      render(
        <TestWrapper>
          <WorkflowStatusGrid
            title="Filter Test Grid"
            autoRefresh={false}
            refreshInterval={30000}
            onCreateWorkflow={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Filter Test Grid')).toBeInTheDocument();
      });

      // Measure time for potential filtering operations
      const filterStartTime = performance.now();

      // Look for filter controls and interact with them
      const filterControls = screen.queryAllByRole('button');
      const providerFilter = filterControls.find(btn =>
        btn.textContent?.includes('Provider') || btn.getAttribute('data-testid')?.includes('filter')
      );

      if (providerFilter) {
        await act(async () => {
          providerFilter.click();
        });
      }

      const filterTime = performance.now() - filterStartTime;
      expect(filterTime).toBeLessThan(500); // Filtering should be very fast
      console.log(`📊 Grid filtering time: ${filterTime.toFixed(2)}ms`);
    });
  });

  // ===================== WORKFLOW METRICS PERFORMANCE =====================

  describe('WorkflowMetrics Performance', () => {
    it('should render metrics efficiently with various dataset sizes', async () => {
      const testSizes = [50, 100, 200, 500];
      const renderTimes: number[] = [];

      for (const size of testSizes) {
        const dataset = generateLargeWorkflowDataset(size);

        const component = (
          <TestWrapper>
            <WorkflowMetrics
              totalWorkflows={dataset.totalWorkflows}
              activeWorkflows={dataset.activeWorkflows}
              successfulExecutions={dataset.successfulExecutionsToday}
              failedExecutions={dataset.failedExecutionsToday}
              lastSyncTime={dataset.lastSyncTime}
              loading={false}
            />
          </TestWrapper>
        );

        const renderTime = await measureRenderTime(component);
        renderTimes.push(renderTime);

        expect(renderTime).toBeLessThan(1000); // Metrics should render very quickly
        console.log(`📊 WorkflowMetrics (${size} workflows) render time: ${renderTime.toFixed(2)}ms`);
      }

      // Verify that render time scales reasonably
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      expect(avgRenderTime).toBeLessThan(500); // Average should be under 500ms
    });

    it('should handle rapid metric updates efficiently', async () => {
      const baseDataset = generateLargeWorkflowDataset(200);

      const { rerender } = render(
        <TestWrapper>
          <WorkflowMetrics
            totalWorkflows={baseDataset.totalWorkflows}
            activeWorkflows={baseDataset.activeWorkflows}
            successfulExecutions={baseDataset.successfulExecutionsToday}
            failedExecutions={baseDataset.failedExecutionsToday}
            lastSyncTime={baseDataset.lastSyncTime}
            loading={false}
          />
        </TestWrapper>
      );

      const updateTimes: number[] = [];

      // Simulate rapid updates (like real-time metrics)
      for (let i = 0; i < 10; i++) {
        const updatedDataset = generateLargeWorkflowDataset(200 + i * 5);

        const updateTime = await measureUpdateTime(async () => {
          rerender(
            <TestWrapper>
              <WorkflowMetrics
                totalWorkflows={updatedDataset.totalWorkflows}
                activeWorkflows={updatedDataset.activeWorkflows}
                successfulExecutions={updatedDataset.successfulExecutionsToday}
                failedExecutions={updatedDataset.failedExecutionsToday}
                lastSyncTime={updatedDataset.lastSyncTime}
                loading={false}
              />
            </TestWrapper>
          );
        });

        updateTimes.push(updateTime);
      }

      const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(100); // Updates should be very fast
      console.log(`📊 Average metric update time: ${avgUpdateTime.toFixed(2)}ms`);
    });
  });

  // ===================== MEMORY PERFORMANCE TESTS =====================

  describe('Memory Performance', () => {
    it('should not cause memory leaks with repeated renders', async () => {
      const dataset = generateLargeWorkflowDataset(100);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: dataset })
      });

      let memoryBefore: any;
      let memoryAfter: any;

      // Check if performance.memory is available (Chrome)
      if ('memory' in performance) {
        memoryBefore = (performance as any).memory.usedJSHeapSize;
      }

      // Render and unmount multiple times
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(
          <TestWrapper>
            <DataSyncPage />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();
        });

        unmount();
      }

      // Force garbage collection if available
      if ('gc' in global) {
        (global as any).gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if ('memory' in performance) {
        memoryAfter = (performance as any).memory.usedJSHeapSize;
        const memoryIncrease = memoryAfter - memoryBefore;
        console.log(`📊 Memory increase after 20 render cycles: ${memoryIncrease} bytes`);

        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      }
    });

    it('should handle DOM node cleanup efficiently', async () => {
      const largeDataset = generateLargeWorkflowDataset(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: largeDataset })
      });

      const { unmount } = render(
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument();
      });

      const nodeCountBefore = document.querySelectorAll('*').length;

      unmount();

      const nodeCountAfter = document.querySelectorAll('*').length;
      const nodesRemoved = nodeCountBefore - nodeCountAfter;

      expect(nodesRemoved).toBeGreaterThan(0); // Should remove DOM nodes
      console.log(`📊 DOM nodes cleaned up: ${nodesRemoved}`);
    });
  });

  // ===================== CONCURRENT OPERATIONS PERFORMANCE =====================

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple concurrent dashboard renders', async () => {
      const dataset = generateLargeWorkflowDataset(200);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: dataset })
      });

      const concurrentRenders = 5;
      const renderPromises = Array(concurrentRenders).fill(null).map(() =>
        measureRenderTime(
          <TestWrapper>
            <DataSyncPage />
          </TestWrapper>
        )
      );

      const startTime = performance.now();
      const renderTimes = await Promise.all(renderPromises);
      const totalTime = performance.now() - startTime;

      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      expect(avgRenderTime).toBeLessThan(5000); // Each render should complete reasonably fast
      expect(totalTime).toBeLessThan(15000); // Total concurrent time should be reasonable

      console.log(`📊 ${concurrentRenders} concurrent renders: ${totalTime.toFixed(2)}ms total, ${avgRenderTime.toFixed(2)}ms average`);
    });

    it('should handle mixed component operations concurrently', async () => {
      const dataset = generateLargeWorkflowDataset(150);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: dataset })
      });

      const operations = [
        () => measureRenderTime(
          <TestWrapper>
            <DataSyncPage />
          </TestWrapper>
        ),
        () => measureRenderTime(
          <TestWrapper>
            <WorkflowStatusGrid
              title="Concurrent Test Grid"
              autoRefresh={false}
              refreshInterval={30000}
              onCreateWorkflow={vi.fn()}
            />
          </TestWrapper>
        ),
        () => measureRenderTime(
          <TestWrapper>
            <WorkflowMetrics
              totalWorkflows={dataset.totalWorkflows}
              activeWorkflows={dataset.activeWorkflows}
              successfulExecutions={dataset.successfulExecutionsToday}
              failedExecutions={dataset.failedExecutionsToday}
              lastSyncTime={dataset.lastSyncTime}
              loading={false}
            />
          </TestWrapper>
        )
      ];

      const startTime = performance.now();
      const operationTimes = await Promise.all(operations.map(op => op()));
      const totalTime = performance.now() - startTime;

      operationTimes.forEach((time, index) => {
        expect(time).toBeLessThan(8000); // Each operation should complete reasonably fast
        console.log(`📊 Concurrent operation ${index + 1}: ${time.toFixed(2)}ms`);
      });

      expect(totalTime).toBeLessThan(20000); // Total concurrent time should be reasonable
      console.log(`📊 Mixed concurrent operations total: ${totalTime.toFixed(2)}ms`);
    });
  });

  // ===================== PERFORMANCE BENCHMARKS =====================

  describe('Performance Benchmarks and SLA Validation', () => {
    it('should meet defined performance SLAs for dashboard components', async () => {
      // Define performance SLAs for dashboard components
      const SLAs = {
        smallDatasetRender: 2000, // 2 seconds for small datasets (< 100 workflows)
        mediumDatasetRender: 4000, // 4 seconds for medium datasets (100-300 workflows)
        largeDatasetRender: 8000, // 8 seconds for large datasets (300-500 workflows)
        metricsRender: 1000, // 1 second for metrics component
        dataUpdate: 3000, // 3 seconds for data updates
        componentUnmount: 500 // 500ms for component cleanup
      };

      // Test small dataset SLA
      const smallDataset = generateLargeWorkflowDataset(75);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: smallDataset })
      });

      let renderTime = await measureRenderTime(
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );
      expect(renderTime).toBeLessThan(SLAs.smallDatasetRender);
      console.log(`✅ Small dataset SLA: ${renderTime.toFixed(2)}ms < ${SLAs.smallDatasetRender}ms`);

      // Test metrics component SLA
      renderTime = await measureRenderTime(
        <TestWrapper>
          <WorkflowMetrics
            totalWorkflows={smallDataset.totalWorkflows}
            activeWorkflows={smallDataset.activeWorkflows}
            successfulExecutions={smallDataset.successfulExecutionsToday}
            failedExecutions={smallDataset.failedExecutionsToday}
            lastSyncTime={smallDataset.lastSyncTime}
            loading={false}
          />
        </TestWrapper>
      );
      expect(renderTime).toBeLessThan(SLAs.metricsRender);
      console.log(`✅ Metrics component SLA: ${renderTime.toFixed(2)}ms < ${SLAs.metricsRender}ms`);

      // Test medium dataset SLA
      const mediumDataset = generateLargeWorkflowDataset(200);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mediumDataset })
      });

      renderTime = await measureRenderTime(
        <TestWrapper>
          <DataSyncPage />
        </TestWrapper>
      );
      expect(renderTime).toBeLessThan(SLAs.mediumDatasetRender);
      console.log(`✅ Medium dataset SLA: ${renderTime.toFixed(2)}ms < ${SLAs.mediumDatasetRender}ms`);
    });

    it('should establish performance baselines for all components', async () => {
      const baselines = {
        dataSyncPageSmall: 0,
        dataSyncPageMedium: 0,
        dataSyncPageLarge: 0,
        workflowStatusGrid: 0,
        workflowMetrics: 0,
        dataUpdate: 0
      };

      // DataSyncPage with small dataset baseline
      const smallDataset = generateLargeWorkflowDataset(50);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: smallDataset })
      });
      baselines.dataSyncPageSmall = await measureRenderTime(
        <TestWrapper><DataSyncPage /></TestWrapper>
      );

      // DataSyncPage with medium dataset baseline
      const mediumDataset = generateLargeWorkflowDataset(200);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mediumDataset })
      });
      baselines.dataSyncPageMedium = await measureRenderTime(
        <TestWrapper><DataSyncPage /></TestWrapper>
      );

      // WorkflowStatusGrid baseline
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mediumDataset })
      });
      baselines.workflowStatusGrid = await measureRenderTime(
        <TestWrapper>
          <WorkflowStatusGrid
            title="Baseline Test"
            autoRefresh={false}
            refreshInterval={30000}
            onCreateWorkflow={vi.fn()}
          />
        </TestWrapper>
      );

      // WorkflowMetrics baseline
      baselines.workflowMetrics = await measureRenderTime(
        <TestWrapper>
          <WorkflowMetrics
            totalWorkflows={mediumDataset.totalWorkflows}
            activeWorkflows={mediumDataset.activeWorkflows}
            successfulExecutions={mediumDataset.successfulExecutionsToday}
            failedExecutions={mediumDataset.failedExecutionsToday}
            lastSyncTime={mediumDataset.lastSyncTime}
            loading={false}
          />
        </TestWrapper>
      );

      console.log('📊 Dashboard Performance Baselines:');
      Object.entries(baselines).forEach(([component, time]) => {
        console.log(`   ${component}: ${time.toFixed(2)}ms`);
      });

      // Verify baselines are reasonable
      expect(baselines.dataSyncPageSmall).toBeLessThan(3000);
      expect(baselines.dataSyncPageMedium).toBeLessThan(6000);
      expect(baselines.workflowStatusGrid).toBeLessThan(5000);
      expect(baselines.workflowMetrics).toBeLessThan(1000);
    });
  });
});