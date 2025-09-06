/**
 * Search Services Exports
 * Centralized exports for search functionality
 */

export { SearchService } from './SearchService';

// Re-export search types for convenience
export * from '../../types/search';
export { SearchRepository } from '../../repositories/search/SearchRepository';
export { SavedQueryRepository } from '../../repositories/search/SavedQueryRepository';