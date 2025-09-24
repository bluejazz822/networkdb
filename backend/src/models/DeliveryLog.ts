import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface DeliveryLogAttributes {
  id: number;
  log_id: string;
  execution_id: string;
  delivery_method: 'email' | 'file_storage' | 'api_endpoint' | 'webhook';
  recipient: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempt_count: number;
  delivered_at?: Date;
  error_message?: string;
  delivery_metadata?: {
    file_path?: string;
    file_size?: number;
    email_message_id?: string;
    http_status?: number;
    response_body?: string;
    retry_after?: Date;
  };
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryLogCreationAttributes
  extends Optional<DeliveryLogAttributes, 'id' | 'attempt_count' | 'created_at' | 'updated_at'> {}

export class DeliveryLog extends Model<DeliveryLogAttributes, DeliveryLogCreationAttributes> implements DeliveryLogAttributes {
  public id!: number;
  public log_id!: string;
  public execution_id!: string;
  public delivery_method!: 'email' | 'file_storage' | 'api_endpoint' | 'webhook';
  public recipient!: string;
  public status!: 'pending' | 'delivered' | 'failed' | 'retrying';
  public attempt_count!: number;
  public delivered_at?: Date;
  public error_message?: string;
  public delivery_metadata?: {
    file_path?: string;
    file_size?: number;
    email_message_id?: string;
    http_status?: number;
    response_body?: string;
    retry_after?: Date;
  };
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public readonly schedule_execution?: any; // To avoid circular import

  // Instance methods
  public async markAsDelivered(metadata?: any): Promise<void> {
    this.status = 'delivered';
    this.delivered_at = new Date();
    if (metadata) {
      this.delivery_metadata = { ...this.delivery_metadata, ...metadata };
    }
    await this.save();
  }

  public async markAsFailed(errorMessage: string): Promise<void> {
    this.status = 'failed';
    this.error_message = errorMessage;
    await this.save();
  }

  public async markAsRetrying(retryAfter?: Date): Promise<void> {
    this.status = 'retrying';
    this.attempt_count += 1;
    if (retryAfter) {
      this.delivery_metadata = {
        ...this.delivery_metadata,
        retry_after: retryAfter
      };
    }
    await this.save();
  }

  public async incrementAttempt(): Promise<void> {
    this.attempt_count += 1;
    await this.save();
  }

  public getDeliveryDuration(): number | null {
    if (this.delivered_at) {
      return this.delivered_at.getTime() - this.created_at.getTime();
    }
    return null;
  }

  public isDelivered(): boolean {
    return this.status === 'delivered';
  }

  public isFailed(): boolean {
    return this.status === 'failed';
  }

  public canRetry(maxAttempts: number): boolean {
    return this.status === 'failed' && this.attempt_count < maxAttempts;
  }

  public shouldRetryAfter(): boolean {
    if (!this.delivery_metadata?.retry_after) {
      return true;
    }
    return new Date() >= this.delivery_metadata.retry_after;
  }

  public getRecipientDisplay(): string {
    switch (this.delivery_method) {
      case 'email':
        return this.recipient;
      case 'file_storage':
        return `File: ${this.recipient}`;
      case 'api_endpoint':
      case 'webhook':
        return `URL: ${this.recipient}`;
      default:
        return this.recipient;
    }
  }
}

DeliveryLog.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  log_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  execution_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  delivery_method: {
    type: DataTypes.ENUM('email', 'file_storage', 'api_endpoint', 'webhook'),
    allowNull: false
  },
  recipient: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'delivered', 'failed', 'retrying'),
    allowNull: false,
    defaultValue: 'pending'
  },
  attempt_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  delivery_metadata: {
    type: DataTypes.JSON,
    allowNull: true
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
}, {
  sequelize,
  modelName: 'DeliveryLog',
  tableName: 'delivery_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['log_id'], unique: true },
    { fields: ['execution_id'] },
    { fields: ['status'] },
    { fields: ['delivery_method'] },
    { fields: ['created_at'] }
  ]
});

export default DeliveryLog;