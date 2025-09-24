/**
 * Comprehensive Tests for MaterializedViewManager
 *
 * Tests materialized view creation, refresh scheduling, dependency tracking,
 * and automated refresh capabilities.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  MaterializedViewManager,
  materializedViewManager,
  initializeMaterializedViewManager,
  createMaterializedView,
  refreshMaterializedViewByName,
  refreshAllStaleViews,
  getViewDefinitions,
  getRefreshHistory,
  MaterializedViewDefinition,
  RefreshResult,
  RefreshSchedule,
} from '../../database/MaterializedViewManager';

// Mock dependencies
jest.mock('../../database/connections/ReportingConnectionPool');
jest.mock('../../utils/db-connection');
jest.mock('node-cron');

describe('MaterializedViewManager', () => {
  let manager: MaterializedViewManager;
  let mockExecuteReportQuery: jest.MockedFunction<any>;
  let mockExecuteQuery: jest.MockedFunction<any>;
  let mockCron: any;

  beforeAll(() => {
    mockExecuteReportQuery = require('../../database/connections/ReportingConnectionPool').executeReportQuery;
    mockExecuteQuery = require('../../utils/db-connection').executeQuery;
    mockCron = require('node-cron');

    // Mock cron functionality
    mockCron.validate = jest.fn().mockReturnValue(true);
    mockCron.schedule = jest.fn().mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    });

    manager = MaterializedViewManager.getInstance();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear any scheduled tasks and reset state
  });

  afterAll(async () => {
    await manager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const initSpy = jest.spyOn(manager, 'initialize');

      await manager.initialize();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      const initSpy = jest.spyOn(manager, 'initialize');

      await manager.initialize();

      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit initialization event', async () => {
      const eventSpy = jest.fn();
      manager.on('managerInitialized', eventSpy);

      await manager.initialize();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const manager = MaterializedViewManager.getInstance();

      // Mock an error during dependency graph building
      const originalBuildDependencyGraph = (manager as any).buildDependencyGraph;
      (manager as any).buildDependencyGraph = jest.fn().mockRejectedValueOnce(new Error('Dependency error'));

      await expect(manager.initialize()).rejects.toThrow('Dependency error');

      // Restore original method
      (manager as any).buildDependencyGraph = originalBuildDependencyGraph;
    });
  });

  describe('Materialized View Creation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should create a new materialized view successfully', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_test_view',
        description: 'Test materialized view',
        sourceQuery: 'SELECT provider, COUNT(*) as count FROM vpcs GROUP BY provider',
        refreshStrategy: 'full',
        refreshSchedule: '0 */6 * * *',
        dependencies: ['vpcs'],
        indexColumns: ['provider'],
        isActive: true,
      };

      // Mock validation and creation queries
      mockExecuteReportQuery.mockResolvedValueOnce([]); // Validation query
      mockExecuteQuery.mockResolvedValueOnce(undefined); // CREATE VIEW
      mockExecuteQuery.mockResolvedValueOnce(undefined); // CREATE INDEX

      // Mock view statistics
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ count: 100 }]) // Record count
        .mockResolvedValueOnce([{ size_mb: 0.5, table_rows: 100, create_time: new Date(), update_time: new Date() }]) // Size info
        .mockResolvedValueOnce([{ index_count: 1 }]); // Index count

      // Mock refresh execution
      mockExecuteQuery.mockResolvedValueOnce(undefined); // DROP VIEW
      mockExecuteQuery.mockResolvedValueOnce(undefined); // CREATE VIEW (refresh)
      mockExecuteQuery.mockResolvedValueOnce(undefined); // CREATE INDEX (refresh)

      const result = await manager.createMaterializedView(definition);

      expect(result.name).toBe(definition.name);
      expect(result.metadata.createdAt).toBeInstanceOf(Date);
      expect(result.metadata.refreshCount).toBe(1); // Should perform initial refresh

      // Verify CREATE VIEW was called
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE VIEW mv_test_view AS'),
        {},
        { type: expect.any(String) }
      );

      // Verify index creation
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX idx_mv_test_view_provider'),
        {},
        { type: expect.any(String) }
      );
    });

    it('should validate source query before creation', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_invalid',
        description: 'Invalid view',
        sourceQuery: 'INVALID SQL QUERY',
        refreshStrategy: 'full',
        dependencies: [],
        isActive: true,
      };

      mockExecuteReportQuery.mockRejectedValueOnce(new Error('SQL syntax error'));

      await expect(manager.createMaterializedView(definition))
        .rejects.toThrow('Invalid source query: SQL syntax error');
    });

    it('should schedule refresh if schedule is provided', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_scheduled',
        description: 'Scheduled view',
        sourceQuery: 'SELECT COUNT(*) FROM reports',
        refreshStrategy: 'full',
        refreshSchedule: '0 0 * * *',
        dependencies: ['reports'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]); // All queries
      mockExecuteQuery.mockResolvedValue(undefined); // All DDL operations

      await manager.createMaterializedView(definition);

      expect(mockCron.schedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function),
        expect.objectContaining({ scheduled: true, timezone: 'UTC' })
      );
    });

    it('should emit view created event', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_event_test',
        description: 'Event test view',
        sourceQuery: 'SELECT 1',
        refreshStrategy: 'full',
        dependencies: [],
        isActive: true,
      };

      const eventSpy = jest.fn();
      manager.on('viewCreated', eventSpy);

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);

      const result = await manager.createMaterializedView(definition);

      expect(eventSpy).toHaveBeenCalledWith(result);
    });

    it('should handle creation errors gracefully', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_error_test',
        description: 'Error test view',
        sourceQuery: 'SELECT COUNT(*) FROM reports',
        refreshStrategy: 'full',
        dependencies: ['reports'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValueOnce([]); // Validation passes
      mockExecuteQuery.mockRejectedValueOnce(new Error('CREATE VIEW failed'));

      await expect(manager.createMaterializedView(definition))
        .rejects.toThrow('CREATE VIEW failed');
    });
  });

  describe('View Refresh', () => {
    beforeEach(async () => {
      await manager.initialize();

      // Create a test view first
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_refresh_test',
        description: 'Refresh test view',
        sourceQuery: 'SELECT provider, COUNT(*) FROM vpcs GROUP BY provider',
        refreshStrategy: 'incremental',
        dependencies: ['vpcs'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);

      await manager.createMaterializedView(definition);
      jest.clearAllMocks();
    });

    it('should refresh view with full strategy', async () => {
      mockExecuteQuery.mockResolvedValue(undefined); // DDL operations
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ count: 150 }]) // Record count
        .mockResolvedValueOnce([{ size_mb: 0.7, table_rows: 150 }]) // Size info
        .mockResolvedValueOnce([{ index_count: 0 }]); // Index count

      const result = await manager.refreshView('mv_refresh_test', 'full');

      expect(result.success).toBe(true);
      expect(result.refreshType).toBe('full');
      expect(result.recordsProcessed).toBe(150);
      expect(result.error).toBeUndefined();

      // Verify DROP and CREATE VIEW were called for full refresh
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        'DROP VIEW IF EXISTS mv_refresh_test',
        {},
        { type: expect.any(String) }
      );
    });

    it('should handle incremental refresh strategy', async () => {
      mockExecuteQuery.mockResolvedValue(undefined);
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ count: 120 }])
        .mockResolvedValueOnce([{ size_mb: 0.6, table_rows: 120 }])
        .mockResolvedValueOnce([{ index_count: 0 }]);

      const result = await manager.refreshView('mv_refresh_test', 'incremental');

      expect(result.success).toBe(true);
      expect(result.refreshType).toBe('incremental');
      expect(result.warnings).toContain('Incremental refresh not implemented, performing full refresh');
    });

    it('should auto-determine refresh type', async () => {
      mockExecuteQuery.mockResolvedValue(undefined);
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ count: 130 }])
        .mockResolvedValueOnce([{ size_mb: 0.65, table_rows: 130 }])
        .mockResolvedValueOnce([{ index_count: 0 }]);

      const result = await manager.refreshView('mv_refresh_test', 'auto');

      expect(result.success).toBe(true);
      expect(result.refreshType).toBe('incremental'); // Based on view's refresh strategy
    });

    it('should handle refresh errors', async () => {
      mockExecuteQuery.mockRejectedValueOnce(new Error('DROP VIEW failed'));

      const result = await manager.refreshView('mv_refresh_test', 'full');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DROP VIEW failed');
    });

    it('should emit refresh events', async () => {
      const refreshSpy = jest.fn();
      const errorSpy = jest.fn();

      manager.on('viewRefreshed', refreshSpy);
      manager.on('viewRefreshError', errorSpy);

      mockExecuteQuery.mockResolvedValueOnce(undefined);
      mockExecuteReportQuery.mockResolvedValue([{ count: 100 }]);

      await manager.refreshView('mv_refresh_test');

      expect(refreshSpy).toHaveBeenCalledWith({
        viewName: 'mv_refresh_test',
        success: true,
        duration: expect.any(Number),
      });
    });

    it('should update view metadata after successful refresh', async () => {
      mockExecuteQuery.mockResolvedValue(undefined);
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ count: 200 }])
        .mockResolvedValueOnce([{ size_mb: 1.0, table_rows: 200 }])
        .mockResolvedValueOnce([{ index_count: 1 }]);

      await manager.refreshView('mv_refresh_test');

      const views = manager.getViewDefinitions();
      const refreshedView = views.find(v => v.name === 'mv_refresh_test');

      expect(refreshedView?.metadata.lastRefreshed).toBeInstanceOf(Date);
      expect(refreshedView?.metadata.recordCount).toBe(200);
      expect(refreshedView?.metadata.refreshCount).toBeGreaterThan(0);
    });

    it('should fail refresh for non-existent view', async () => {
      await expect(manager.refreshView('non_existent_view'))
        .rejects.toThrow('Materialized view not found: non_existent_view');
    });
  });

  describe('Refresh Scheduling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should schedule view refresh successfully', async () => {
      const viewName = 'mv_scheduled_test';
      const cronExpression = '0 2 * * *';

      await manager.scheduleRefresh(viewName, cronExpression, true);

      expect(mockCron.validate).toHaveBeenCalledWith(cronExpression);
      expect(mockCron.schedule).toHaveBeenCalledWith(
        cronExpression,
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );

      const schedules = manager.getRefreshSchedules();
      const schedule = schedules.find(s => s.viewName === viewName);

      expect(schedule).toEqual({
        viewName,
        cronExpression,
        enabled: true,
        nextRun: expect.any(Date),
        runCount: 0,
        errorCount: 0,
      });
    });

    it('should validate cron expressions', async () => {
      mockCron.validate.mockReturnValueOnce(false);

      await expect(manager.scheduleRefresh('test_view', 'invalid_cron'))
        .rejects.toThrow('Invalid cron expression: invalid_cron');
    });

    it('should unschedule existing refresh before creating new one', async () => {
      const viewName = 'mv_reschedule_test';
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
      };

      mockCron.schedule.mockReturnValue(mockTask);

      // Schedule first time
      await manager.scheduleRefresh(viewName, '0 1 * * *');

      // Schedule again with different cron
      await manager.scheduleRefresh(viewName, '0 2 * * *');

      expect(mockTask.stop).toHaveBeenCalled();
      expect(mockTask.destroy).toHaveBeenCalled();
      expect(mockCron.schedule).toHaveBeenCalledTimes(2);
    });

    it('should unschedule refresh correctly', async () => {
      const viewName = 'mv_unschedule_test';
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
      };

      mockCron.schedule.mockReturnValue(mockTask);

      await manager.scheduleRefresh(viewName, '0 1 * * *');
      await manager.unscheduleRefresh(viewName);

      expect(mockTask.stop).toHaveBeenCalled();
      expect(mockTask.destroy).toHaveBeenCalled();

      const schedules = manager.getRefreshSchedules();
      expect(schedules.find(s => s.viewName === viewName)).toBeUndefined();
    });

    it('should emit schedule events', async () => {
      const scheduleSpy = jest.fn();
      const unscheduleSpy = jest.fn();

      manager.on('refreshScheduled', scheduleSpy);
      manager.on('refreshUnscheduled', unscheduleSpy);

      await manager.scheduleRefresh('test_view', '0 1 * * *');
      expect(scheduleSpy).toHaveBeenCalled();

      await manager.unscheduleRefresh('test_view');
      expect(unscheduleSpy).toHaveBeenCalledWith({ viewName: 'test_view' });
    });

    it('should handle disabled schedules', async () => {
      await manager.scheduleRefresh('test_view', '0 1 * * *', false);

      // Should not create cron job for disabled schedule
      expect(mockCron.schedule).not.toHaveBeenCalled();

      const schedules = manager.getRefreshSchedules();
      const schedule = schedules.find(s => s.viewName === 'test_view');

      expect(schedule?.enabled).toBe(false);
    });
  });

  describe('Stale View Detection and Refresh', () => {
    beforeEach(async () => {
      await manager.initialize();

      // Create test views
      const views = [
        {
          name: 'mv_stale_test_1',
          description: 'Stale test view 1',
          sourceQuery: 'SELECT COUNT(*) FROM vpcs',
          refreshStrategy: 'full' as const,
          dependencies: ['vpcs'],
          isActive: true,
        },
        {
          name: 'mv_stale_test_2',
          description: 'Stale test view 2',
          sourceQuery: 'SELECT COUNT(*) FROM reports',
          refreshStrategy: 'full' as const,
          dependencies: ['reports'],
          isActive: true,
        },
      ];

      for (const view of views) {
        mockExecuteReportQuery.mockResolvedValue([]);
        mockExecuteQuery.mockResolvedValue(undefined);
        await manager.createMaterializedView(view);
      }

      jest.clearAllMocks();
    });

    it('should identify stale views correctly', async () => {
      // Mock table update times to indicate staleness
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ update_time: new Date() }]) // vpcs table updated recently
        .mockResolvedValueOnce([{ update_time: new Date(Date.now() - 86400000) }]); // reports table old

      mockExecuteQuery.mockResolvedValue(undefined);
      mockExecuteReportQuery.mockResolvedValue([{ count: 100 }]);

      const results = await manager.refreshStaleViews();

      // Should refresh the stale view (mv_stale_test_1 depends on recently updated vpcs)
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.viewName === 'mv_stale_test_1')).toBe(true);
    });

    it('should refresh views in dependency order', async () => {
      // Create a view that depends on another view
      const dependentView: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_dependent',
        description: 'Dependent view',
        sourceQuery: 'SELECT * FROM mv_stale_test_1',
        refreshStrategy: 'full',
        dependencies: ['mv_stale_test_1'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(dependentView);

      // Mock all as stale
      mockExecuteReportQuery.mockResolvedValue([{ update_time: new Date() }]);
      mockExecuteQuery.mockResolvedValue(undefined);

      const refreshOrder: string[] = [];
      const originalRefreshView = manager.refreshView.bind(manager);
      manager.refreshView = jest.fn().mockImplementation(async (viewName: string) => {
        refreshOrder.push(viewName);
        return originalRefreshView(viewName);
      });

      await manager.refreshStaleViews();

      // Dependent view should be refreshed after its dependency
      const staleTestIndex = refreshOrder.indexOf('mv_stale_test_1');
      const dependentIndex = refreshOrder.indexOf('mv_dependent');

      if (staleTestIndex !== -1 && dependentIndex !== -1) {
        expect(staleTestIndex).toBeLessThan(dependentIndex);
      }
    });

    it('should emit stale views refreshed event', async () => {
      const eventSpy = jest.fn();
      manager.on('staleViewsRefreshed', eventSpy);

      mockExecuteReportQuery.mockResolvedValue([{ update_time: new Date() }]);
      mockExecuteQuery.mockResolvedValue(undefined);

      await manager.refreshStaleViews();

      expect(eventSpy).toHaveBeenCalledWith({
        count: expect.any(Number),
        views: expect.any(Array),
      });
    });

    it('should handle errors during stale view refresh', async () => {
      mockExecuteReportQuery.mockResolvedValueOnce([{ update_time: new Date() }]);
      mockExecuteQuery.mockRejectedValueOnce(new Error('Refresh failed'));

      const results = await manager.refreshStaleViews();

      // Should continue with other views even if one fails
      expect(results).toBeDefined();
    });
  });

  describe('View Statistics and Information', () => {
    beforeEach(async () => {
      await manager.initialize();

      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_stats_test',
        description: 'Statistics test view',
        sourceQuery: 'SELECT provider, COUNT(*) FROM vpcs GROUP BY provider',
        refreshStrategy: 'full',
        dependencies: ['vpcs'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(definition);
      jest.clearAllMocks();
    });

    it('should retrieve view statistics correctly', async () => {
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ count: 500 }])
        .mockResolvedValueOnce([{
          size_mb: 2.5,
          table_rows: 500,
          create_time: new Date('2023-01-01'),
          update_time: new Date('2023-12-01'),
        }])
        .mockResolvedValueOnce([{ index_count: 3 }]);

      const stats = await manager.getViewStatistics('mv_stats_test');

      expect(stats).toEqual({
        recordCount: 500,
        sizeBytes: 2.5 * 1024 * 1024,
        indexCount: 3,
        lastUpdated: new Date('2023-12-01'),
      });
    });

    it('should handle missing statistics gracefully', async () => {
      mockExecuteReportQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const stats = await manager.getViewStatistics('mv_stats_test');

      expect(stats).toEqual({
        recordCount: 0,
        sizeBytes: 0,
        indexCount: 0,
        lastUpdated: expect.any(Date),
      });
    });

    it('should handle statistics query errors', async () => {
      mockExecuteReportQuery.mockRejectedValue(new Error('Statistics query failed'));

      const stats = await manager.getViewStatistics('mv_stats_test');

      expect(stats.recordCount).toBe(0);
    });

    it('should provide view definitions list', () => {
      const definitions = manager.getViewDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.find(d => d.name === 'mv_stats_test')).toBeDefined();
    });

    it('should provide refresh schedules list', async () => {
      await manager.scheduleRefresh('mv_stats_test', '0 1 * * *');

      const schedules = manager.getRefreshSchedules();

      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.find(s => s.viewName === 'mv_stats_test')).toBeDefined();
    });

    it('should track refresh history', async () => {
      mockExecuteQuery.mockResolvedValue(undefined);
      mockExecuteReportQuery.mockResolvedValue([{ count: 100 }]);

      await manager.refreshView('mv_stats_test');

      const history = manager.getRefreshHistory('mv_stats_test');

      expect(history).toHaveLength(1);
      expect(history[0].viewName).toBe('mv_stats_test');
      expect(history[0].success).toBe(true);
    });

    it('should filter refresh history by view name', async () => {
      // Create another view and refresh both
      const anotherView: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_another_test',
        description: 'Another test view',
        sourceQuery: 'SELECT COUNT(*) FROM reports',
        refreshStrategy: 'full',
        dependencies: ['reports'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(anotherView);

      // Refresh both views
      await manager.refreshView('mv_stats_test');
      await manager.refreshView('mv_another_test');

      const statsHistory = manager.getRefreshHistory('mv_stats_test');
      const anotherHistory = manager.getRefreshHistory('mv_another_test');
      const allHistory = manager.getRefreshHistory();

      expect(statsHistory.every(h => h.viewName === 'mv_stats_test')).toBe(true);
      expect(anotherHistory.every(h => h.viewName === 'mv_another_test')).toBe(true);
      expect(allHistory.length).toBeGreaterThan(statsHistory.length);
    });

    it('should limit refresh history', async () => {
      // Refresh multiple times
      mockExecuteQuery.mockResolvedValue(undefined);
      mockExecuteReportQuery.mockResolvedValue([{ count: 100 }]);

      for (let i = 0; i < 150; i++) {
        await manager.refreshView('mv_stats_test');
      }

      const limitedHistory = manager.getRefreshHistory('mv_stats_test', 50);
      const allHistory = manager.getRefreshHistory('mv_stats_test');

      expect(limitedHistory.length).toBe(50);
      expect(allHistory.length).toBeLessThanOrEqual(150);
    });
  });

  describe('View Lifecycle Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should drop materialized view successfully', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_drop_test',
        description: 'Drop test view',
        sourceQuery: 'SELECT COUNT(*) FROM reports',
        refreshStrategy: 'full',
        refreshSchedule: '0 1 * * *',
        dependencies: ['reports'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);

      await manager.createMaterializedView(definition);

      const eventSpy = jest.fn();
      manager.on('viewDropped', eventSpy);

      await manager.dropMaterializedView('mv_drop_test');

      // Verify DROP VIEW was called
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        'DROP VIEW IF EXISTS mv_drop_test',
        {},
        { type: expect.any(String) }
      );

      // Verify view is removed from definitions
      const definitions = manager.getViewDefinitions();
      expect(definitions.find(d => d.name === 'mv_drop_test')).toBeUndefined();

      // Verify schedule is removed
      const schedules = manager.getRefreshSchedules();
      expect(schedules.find(s => s.viewName === 'mv_drop_test')).toBeUndefined();

      expect(eventSpy).toHaveBeenCalledWith({ viewName: 'mv_drop_test' });
    });

    it('should handle drop errors gracefully', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_error_drop',
        description: 'Error drop test',
        sourceQuery: 'SELECT 1',
        refreshStrategy: 'full',
        dependencies: [],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(definition);

      mockExecuteQuery.mockRejectedValueOnce(new Error('DROP VIEW failed'));

      await expect(manager.dropMaterializedView('mv_error_drop'))
        .rejects.toThrow('DROP VIEW failed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle view creation with missing dependencies', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_missing_deps',
        description: 'Missing dependencies test',
        sourceQuery: 'SELECT * FROM non_existent_table',
        refreshStrategy: 'full',
        dependencies: ['non_existent_table'],
        isActive: true,
      };

      mockExecuteReportQuery.mockRejectedValueOnce(new Error('Table does not exist'));

      await expect(manager.createMaterializedView(definition))
        .rejects.toThrow('Invalid source query: Table does not exist');
    });

    it('should handle refresh of inactive views', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_inactive',
        description: 'Inactive view',
        sourceQuery: 'SELECT 1',
        refreshStrategy: 'full',
        dependencies: [],
        isActive: false,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(definition);

      // Should still allow manual refresh of inactive views
      const result = await manager.refreshView('mv_inactive');
      expect(result.success).toBe(true);
    });

    it('should handle cron expression validation errors', async () => {
      mockCron.validate.mockReturnValueOnce(false);

      await expect(manager.scheduleRefresh('test_view', '* * * * * *'))
        .rejects.toThrow('Invalid cron expression');
    });

    it('should handle concurrent refresh attempts', async () => {
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_concurrent',
        description: 'Concurrent test',
        sourceQuery: 'SELECT COUNT(*) FROM reports',
        refreshStrategy: 'full',
        dependencies: ['reports'],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(definition);

      // Mock slow refresh
      mockExecuteQuery.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(undefined), 1000);
        });
      });
      mockExecuteReportQuery.mockResolvedValue([{ count: 100 }]);

      // Start multiple refresh operations
      const refreshPromises = [
        manager.refreshView('mv_concurrent'),
        manager.refreshView('mv_concurrent'),
        manager.refreshView('mv_concurrent'),
      ];

      const results = await Promise.all(refreshPromises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Module Functions', () => {
    it('should work with initializeMaterializedViewManager function', async () => {
      await expect(initializeMaterializedViewManager()).resolves.not.toThrow();
    });

    it('should work with createMaterializedView function', async () => {
      await initializeMaterializedViewManager();

      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_module_test',
        description: 'Module test view',
        sourceQuery: 'SELECT 1',
        refreshStrategy: 'full',
        dependencies: [],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);

      const result = await createMaterializedView(definition);

      expect(result.name).toBe('mv_module_test');
    });

    it('should work with refreshMaterializedViewByName function', async () => {
      await initializeMaterializedViewManager();

      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_refresh_module',
        description: 'Refresh module test',
        sourceQuery: 'SELECT 1',
        refreshStrategy: 'full',
        dependencies: [],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await createMaterializedView(definition);

      const result = await refreshMaterializedViewByName('mv_refresh_module');

      expect(result.success).toBe(true);
      expect(result.viewName).toBe('mv_refresh_module');
    });

    it('should work with refreshAllStaleViews function', async () => {
      await initializeMaterializedViewManager();

      mockExecuteReportQuery.mockResolvedValue([{ update_time: new Date() }]);
      mockExecuteQuery.mockResolvedValue(undefined);

      const results = await refreshAllStaleViews();

      expect(Array.isArray(results)).toBe(true);
    });

    it('should work with getViewDefinitions function', async () => {
      await initializeMaterializedViewManager();

      const definitions = getViewDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('should work with getRefreshHistory function', async () => {
      await initializeMaterializedViewManager();

      const history = getRefreshHistory();

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown cleanly', async () => {
      await manager.initialize();

      // Create a view with schedule
      const definition: Omit<MaterializedViewDefinition, 'metadata'> = {
        name: 'mv_shutdown_test',
        description: 'Shutdown test',
        sourceQuery: 'SELECT 1',
        refreshStrategy: 'full',
        refreshSchedule: '0 1 * * *',
        dependencies: [],
        isActive: true,
      };

      mockExecuteReportQuery.mockResolvedValue([]);
      mockExecuteQuery.mockResolvedValue(undefined);
      await manager.createMaterializedView(definition);

      const shutdownSpy = jest.fn();
      manager.on('managerShutdown', shutdownSpy);

      await manager.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();

      // Verify all cron jobs are stopped
      const mockTask = mockCron.schedule.mock.results[0]?.value;
      if (mockTask) {
        expect(mockTask.stop).toHaveBeenCalled();
        expect(mockTask.destroy).toHaveBeenCalled();
      }
    });

    it('should handle shutdown errors gracefully', async () => {
      await manager.initialize();

      // Mock cron task stop error
      const mockTask = {
        stop: jest.fn().mockImplementation(() => {
          throw new Error('Stop failed');
        }),
        destroy: jest.fn(),
      };

      mockCron.schedule.mockReturnValue(mockTask);
      await manager.scheduleRefresh('test_view', '0 1 * * *');

      // Shutdown should complete despite cron errors
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });
});