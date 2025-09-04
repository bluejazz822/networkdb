/**
 * Query Builder Utilities
 * Export all query building functionality
 */

export { SearchQueryBuilder } from './SearchQueryBuilder';

// Helper functions
export const createQueryBuilder = (resourceType: import('../../types/search').ResourceType) => {
  return new SearchQueryBuilder(resourceType);
};