/**
 * Services Export Module
 * Central export point for all service layer classes
 */

// Base Service
export { BaseService } from './BaseService';
export type { ServiceResponse, ServiceError, PaginatedResponse, QueryOptions } from './BaseService';

// Network Resource Services
export { VpcService } from './VpcService';
export type { VpcCreateData, VpcUpdateData, VpcQueryFilters } from './VpcService';

export { TransitGatewayService } from './TransitGatewayService';
export type { TransitGatewayCreateData, TransitGatewayUpdateData, TransitGatewayQueryFilters } from './TransitGatewayService';

export { CustomerGatewayService } from './CustomerGatewayService';
export type { CustomerGatewayCreateData, CustomerGatewayUpdateData, CustomerGatewayQueryFilters } from './CustomerGatewayService';

export { VpcEndpointService } from './VpcEndpointService';
export type { VpcEndpointCreateData, VpcEndpointUpdateData, VpcEndpointQueryFilters } from './VpcEndpointService';

// Service Factory
import { VpcService } from './VpcService';
import { TransitGatewayService } from './TransitGatewayService';
import { CustomerGatewayService } from './CustomerGatewayService';
import { VpcEndpointService } from './VpcEndpointService';
import { VpcRepository, TransitGatewayRepository, CustomerGatewayRepository, VpcEndpointRepository } from '../repositories';

export class ServiceFactory {
  private static vpcService: VpcService;
  private static transitGatewayService: TransitGatewayService;
  private static customerGatewayService: CustomerGatewayService;
  private static vpcEndpointService: VpcEndpointService;

  static getVpcService(): VpcService {
    if (!this.vpcService) {
      const repository = new VpcRepository();
      this.vpcService = new VpcService(repository);
    }
    return this.vpcService;
  }

  static getTransitGatewayService(): TransitGatewayService {
    if (!this.transitGatewayService) {
      const repository = new TransitGatewayRepository();
      this.transitGatewayService = new TransitGatewayService(repository);
    }
    return this.transitGatewayService;
  }

  static getCustomerGatewayService(): CustomerGatewayService {
    if (!this.customerGatewayService) {
      const repository = new CustomerGatewayRepository();
      this.customerGatewayService = new CustomerGatewayService(repository);
    }
    return this.customerGatewayService;
  }

  static getVpcEndpointService(): VpcEndpointService {
    if (!this.vpcEndpointService) {
      const repository = new VpcEndpointRepository();
      this.vpcEndpointService = new VpcEndpointService(repository);
    }
    return this.vpcEndpointService;
  }

  /**
   * Reset all services (useful for testing)
   */
  static resetServices(): void {
    this.vpcService = null;
    this.transitGatewayService = null;
    this.customerGatewayService = null;
    this.vpcEndpointService = null;
  }
}