import { z } from 'zod'

// Helper functions for network validation
const isValidCIDR = (cidr: string): boolean => {
  const cidrPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/
  return cidrPattern.test(cidr)
}

const isValidIPAddress = (ip: string): boolean => {
  const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipPattern.test(ip)
}

// Network Device Schema
export const networkDeviceSchema = z.object({
  name: z.string()
    .min(1, 'Device name is required')
    .max(100, 'Device name must be less than 100 characters'),
  
  type: z.enum(['router', 'switch', 'firewall', 'load-balancer'], {
    required_error: 'Device type is required',
  }),
  
  ipAddress: z.string()
    .refine(isValidIPAddress, 'Please enter a valid IP address'),
  
  status: z.enum(['active', 'inactive', 'maintenance'], {
    required_error: 'Status is required',
  }),
  
  location: z.string()
    .min(1, 'Location is required')
    .max(200, 'Location must be less than 200 characters'),
})

// VPC Schema
export const vpcSchema = z.object({
  name: z.string()
    .min(1, 'VPC name is required')
    .max(100, 'VPC name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'VPC name can only contain letters, numbers, hyphens, and underscores'),
  
  cidr: z.string()
    .refine(isValidCIDR, 'Please enter a valid CIDR block (e.g., 10.0.0.0/16)'),
  
  region: z.string()
    .min(1, 'Region is required'),
  
  status: z.enum(['available', 'pending', 'deleted'], {
    required_error: 'Status is required',
  }),
})

// Subnet Schema
export const subnetSchema = z.object({
  name: z.string()
    .min(1, 'Subnet name is required')
    .max(100, 'Subnet name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Subnet name can only contain letters, numbers, hyphens, and underscores'),
  
  vpcId: z.string()
    .min(1, 'VPC selection is required'),
  
  cidr: z.string()
    .refine(isValidCIDR, 'Please enter a valid CIDR block (e.g., 10.0.1.0/24)'),
  
  availabilityZone: z.string()
    .min(1, 'Availability Zone is required'),
  
  type: z.enum(['public', 'private'], {
    required_error: 'Subnet type is required',
  }),
  
  status: z.enum(['available', 'pending', 'deleted'], {
    required_error: 'Status is required',
  }),
})

// Transit Gateway Schema
export const transitGatewaySchema = z.object({
  name: z.string()
    .min(1, 'Transit Gateway name is required')
    .max(100, 'Transit Gateway name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Transit Gateway name can only contain letters, numbers, hyphens, and underscores'),
  
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  
  amazonSideAsn: z.number()
    .min(64512, 'ASN must be at least 64512')
    .max(65534, 'ASN must not exceed 65534')
    .default(64512),
  
  status: z.enum(['available', 'pending', 'modifying', 'deleting', 'deleted'], {
    required_error: 'Status is required',
  }),
})

// Type inference from schemas
export type NetworkDeviceFormData = z.infer<typeof networkDeviceSchema>
export type VPCFormData = z.infer<typeof vpcSchema>
export type SubnetFormData = z.infer<typeof subnetSchema>
export type TransitGatewayFormData = z.infer<typeof transitGatewaySchema>