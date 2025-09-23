/**
 * FileManager Unit Tests
 * Tests for file lifecycle management, cleanup patterns, and resource management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileManager } from '../../../utils/FileManager';
import { FileManagerError } from '../../../types/export';

describe('FileManager', () => {
  let fileManager: FileManager;
  let testTempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testTempDir = path.join(process.cwd(), 'test-temp', `test-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);

    fileManager = new FileManager({
      tempDir: testTempDir,
      maxFileSize: 1024 * 1024, // 1MB
      maxTotalSize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 60 * 1000, // 1 minute for testing
      cleanupInterval: 30 * 1000, // 30 seconds
      compressionEnabled: false,
      allowedExtensions: ['.txt', '.csv', '.json', '.xlsx', '.pdf']
    });

    // Wait for initialization
    await new Promise(resolve => {
      fileManager.once('initialized', resolve);
    });
  });

  afterEach(async () => {
    // Cleanup file manager and test directory
    if (fileManager) {
      await fileManager.shutdown();
    }

    // Remove test temp directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  describe('File Creation', () => {
    it('should create a temporary file successfully', async () => {
      const content = Buffer.from('Test file content', 'utf8');
      const fileInfo = await fileManager.createTempFile(content, '.txt', {
        fileName: 'test-file.txt',
        metadata: { testKey: 'testValue' }
      });

      expect(fileInfo).toBeDefined();
      expect(fileInfo.fileName).toBe('test-file.txt');
      expect(fileInfo.fileSize).toBe(content.length);
      expect(fileInfo.isTemporary).toBe(true);
      expect(fileInfo.metadata?.testKey).toBe('testValue');
      expect(fileInfo.expiresAt).toBeDefined();

      // Verify file exists on disk
      const fileExists = await fs.access(fileInfo.filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should create a persistent file successfully', async () => {
      const content = Buffer.from('Persistent file content', 'utf8');
      const fileInfo = await fileManager.createPersistentFile(content, 'persistent-file.txt');

      expect(fileInfo).toBeDefined();
      expect(fileInfo.fileName).toBe('persistent-file.txt');
      expect(fileInfo.fileSize).toBe(content.length);
      expect(fileInfo.isTemporary).toBe(false);
      expect(fileInfo.expiresAt).toBeUndefined();

      // Verify file exists on disk
      const fileExists = await fs.access(fileInfo.filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should reject files with invalid extensions', async () => {
      const content = Buffer.from('Test content', 'utf8');

      await expect(fileManager.createTempFile(content, '.exe')).rejects.toThrow(FileManagerError);
      await expect(fileManager.createTempFile(content, '.exe')).rejects.toMatchObject({
        code: 'INVALID_EXTENSION'
      });
    });

    it('should reject files that are too large', async () => {
      const largeContent = Buffer.alloc(2 * 1024 * 1024, 'x'); // 2MB, larger than 1MB limit

      await expect(fileManager.createTempFile(largeContent, '.txt')).rejects.toThrow(FileManagerError);
      await expect(fileManager.createTempFile(largeContent, '.txt')).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE'
      });
    });
  });

  describe('File Operations', () => {
    let testFileInfo: any;

    beforeEach(async () => {
      const content = Buffer.from('Test file for operations', 'utf8');
      testFileInfo = await fileManager.createTempFile(content, '.txt', {
        fileName: 'operations-test.txt'
      });
    });

    it('should read file content correctly', async () => {
      const content = await fileManager.readFile(testFileInfo.filePath);
      expect(content.toString('utf8')).toBe('Test file for operations');
    });

    it('should get file info correctly', () => {
      const fileInfo = fileManager.getFileInfo(testFileInfo.filePath);
      expect(fileInfo).toBeDefined();
      expect(fileInfo?.fileName).toBe('operations-test.txt');
      expect(fileInfo?.fileSize).toBe(24); // "Test file for operations" is 24 bytes
    });

    it('should delete file successfully', async () => {
      const deleted = await fileManager.deleteFile(testFileInfo.filePath);
      expect(deleted).toBe(true);

      // Verify file is removed from tracking
      const fileInfo = fileManager.getFileInfo(testFileInfo.filePath);
      expect(fileInfo).toBeNull();

      // Verify file is removed from disk
      const fileExists = await fs.access(testFileInfo.filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should handle reading expired files', async () => {
      // Create a file with very short TTL
      const content = Buffer.from('Expiring content', 'utf8');
      const fileInfo = await fileManager.createTempFile(content, '.txt', {
        fileName: 'expiring-file.txt',
        ttl: 1 // 1ms TTL
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(fileManager.readFile(fileInfo.filePath)).rejects.toThrow(FileManagerError);
      await expect(fileManager.readFile(fileInfo.filePath)).rejects.toMatchObject({
        code: 'FILE_EXPIRED'
      });
    });
  });

  describe('File Listing and Filtering', () => {
    beforeEach(async () => {
      // Create test files
      await fileManager.createTempFile(Buffer.from('temp1', 'utf8'), '.txt', { fileName: 'temp1.txt' });
      await fileManager.createTempFile(Buffer.from('temp2', 'utf8'), '.txt', {
        fileName: 'temp2.txt',
        ttl: 1 // Will expire quickly
      });
      await fileManager.createPersistentFile(Buffer.from('persistent', 'utf8'), 'persistent1.txt');

      // Wait for one file to expire
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should list all files', () => {
      const files = fileManager.listFiles();
      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by temporary status', () => {
      const tempFiles = fileManager.listFiles({ isTemporary: true });
      const persistentFiles = fileManager.listFiles({ isTemporary: false });

      expect(tempFiles.length).toBeGreaterThanOrEqual(2);
      expect(persistentFiles.length).toBeGreaterThanOrEqual(1);

      tempFiles.forEach(file => expect(file.isTemporary).toBe(true));
      persistentFiles.forEach(file => expect(file.isTemporary).toBe(false));
    });

    it('should filter by expiration status', () => {
      const expiredFiles = fileManager.listFiles({ expired: true });
      const activeFiles = fileManager.listFiles({ expired: false });

      expect(expiredFiles.length).toBeGreaterThanOrEqual(1);
      expect(activeFiles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      // Create several test files
      await fileManager.createTempFile(Buffer.from('content1', 'utf8'), '.txt', { fileName: 'file1.txt' });
      await fileManager.createTempFile(Buffer.from('content2', 'utf8'), '.txt', { fileName: 'file2.txt' });
      await fileManager.createPersistentFile(Buffer.from('persistent', 'utf8'), 'persistent.txt');
    });

    it('should track resource usage correctly', () => {
      const usage = fileManager.getResourceUsage();

      expect(usage.totalFiles).toBeGreaterThanOrEqual(3);
      expect(usage.totalSize).toBeGreaterThan(0);
      expect(usage.temporaryFiles).toBeGreaterThanOrEqual(2);
      expect(usage.temporarySize).toBeGreaterThan(0);
    });

    it('should cleanup expired files', async () => {
      // Create files with short TTL
      await fileManager.createTempFile(Buffer.from('expiring1', 'utf8'), '.txt', {
        fileName: 'expiring1.txt',
        ttl: 1
      });
      await fileManager.createTempFile(Buffer.from('expiring2', 'utf8'), '.txt', {
        fileName: 'expiring2.txt',
        ttl: 1
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const usageBefore = fileManager.getResourceUsage();
      const cleanupResult = await fileManager.cleanupFiles('age-based');

      expect(cleanupResult.filesDeleted).toBeGreaterThanOrEqual(2);
      expect(cleanupResult.bytesFreed).toBeGreaterThan(0);
      expect(cleanupResult.errors).toEqual([]);

      const usageAfter = fileManager.getResourceUsage();
      expect(usageAfter.totalFiles).toBeLessThan(usageBefore.totalFiles);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Try to read non-existent file
      await expect(fileManager.readFile('/non/existent/path')).rejects.toThrow(FileManagerError);
      await expect(fileManager.readFile('/non/existent/path')).rejects.toMatchObject({
        code: 'READ_ERROR'
      });
    });

    it('should handle deletion of non-existent files', async () => {
      // Should not throw when deleting non-existent file
      const result = await fileManager.deleteFile('/non/existent/path');
      expect(result).toBe(true);
    });
  });

  describe('Events', () => {
    it('should emit file creation events', async () => {
      const eventPromise = new Promise(resolve => {
        fileManager.once('file:created', resolve);
      });

      const content = Buffer.from('Event test', 'utf8');
      await fileManager.createTempFile(content, '.txt', { fileName: 'event-test.txt' });

      const eventData = await eventPromise;
      expect(eventData).toBeDefined();
      expect((eventData as any).fileInfo.fileName).toBe('event-test.txt');
    });

    it('should emit file deletion events', async () => {
      // Create a file first
      const content = Buffer.from('Delete test', 'utf8');
      const fileInfo = await fileManager.createTempFile(content, '.txt', { fileName: 'delete-test.txt' });

      const eventPromise = new Promise(resolve => {
        fileManager.once('file:deleted', resolve);
      });

      await fileManager.deleteFile(fileInfo.filePath);

      const eventData = await eventPromise;
      expect(eventData).toBeDefined();
      expect((eventData as any).filePath).toBe(fileInfo.filePath);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      // Create some temporary files
      await fileManager.createTempFile(Buffer.from('temp1', 'utf8'), '.txt', { fileName: 'shutdown1.txt' });
      await fileManager.createTempFile(Buffer.from('temp2', 'utf8'), '.txt', { fileName: 'shutdown2.txt' });

      const shutdownPromise = new Promise(resolve => {
        fileManager.once('shutdown', resolve);
      });

      await fileManager.shutdown();
      await shutdownPromise;

      // Should not be able to perform operations after shutdown
      await expect(fileManager.createTempFile(Buffer.from('test', 'utf8'), '.txt')).rejects.toThrow();
    });
  });
});