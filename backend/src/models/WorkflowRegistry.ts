import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export interface WorkflowRegistryAttributes {
  id: number;
  workflow_id: string;
  workflow_name: string;
  workflow_type: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn';
  provider: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowRegistryCreationAttributes 
  extends Optional<WorkflowRegistryAttributes, 'id' | 'is_active' | 'created_at' | 'updated_at'> {}

export class WorkflowRegistry extends Model<WorkflowRegistryAttributes, WorkflowRegistryCreationAttributes> 
  implements WorkflowRegistryAttributes {
  public id!: number;
  public workflow_id!: string;
  public workflow_name!: string;
  public workflow_type!: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn';
  public provider!: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others';
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;
}

WorkflowRegistry.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    workflow_id: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false
    },
    workflow_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    workflow_type: {
      type: DataTypes.ENUM('vpc', 'subnet', 'transit_gateway', 'nat_gateway', 'vpn'),
      allowNull: false
    },
    provider: {
      type: DataTypes.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others'),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'WorkflowRegistry',
    tableName: 'workflow_registry',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);