import { DataTypes, Model, Optional, Association, BelongsToGetAssociationMixin } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * Script parameter data types
 */
export enum ScriptParameterType {
  STRING = 'STRING',
  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
  EMAIL = 'EMAIL',
  URL = 'URL',
  PASSWORD = 'PASSWORD',
  TEXT = 'TEXT',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
  FILE = 'FILE',
  DATE = 'DATE',
  DATETIME = 'DATETIME'
}

/**
 * ScriptParameter attributes interface
 */
export interface ScriptParameterAttributes {
  id: string;
  scriptId: string;
  name: string;
  displayName: string;
  description?: string;
  type: ScriptParameterType;
  isRequired: boolean;
  isSecret: boolean;
  defaultValue?: any;
  allowedValues?: any[];
  validationRegex?: string;
  validationRules?: Record<string, any>;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
  helpText?: string;
  group?: string;
  order: number;
  dependsOn?: string;
  showWhen?: Record<string, any>;
  isAdvanced: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ScriptParameter creation attributes (optional fields during creation)
 */
export interface ScriptParameterCreationAttributes extends Optional<ScriptParameterAttributes,
  'id' | 'isRequired' | 'isSecret' | 'defaultValue' | 'allowedValues' | 'validationRegex' |
  'validationRules' | 'minLength' | 'maxLength' | 'minValue' | 'maxValue' | 'placeholder' |
  'helpText' | 'group' | 'order' | 'dependsOn' | 'showWhen' | 'isAdvanced' | 'metadata' |
  'createdAt' | 'updatedAt'
> {}

/**
 * ScriptParameter model class
 */
export class ScriptParameter extends Model<ScriptParameterAttributes, ScriptParameterCreationAttributes>
  implements ScriptParameterAttributes {
  public id!: string;
  public scriptId!: string;
  public name!: string;
  public displayName!: string;
  public description?: string;
  public type!: ScriptParameterType;
  public isRequired!: boolean;
  public isSecret!: boolean;
  public defaultValue?: any;
  public allowedValues?: any[];
  public validationRegex?: string;
  public validationRules?: Record<string, any>;
  public minLength?: number;
  public maxLength?: number;
  public minValue?: number;
  public maxValue?: number;
  public placeholder?: string;
  public helpText?: string;
  public group?: string;
  public order!: number;
  public dependsOn?: string;
  public showWhen?: Record<string, any>;
  public isAdvanced!: boolean;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association mixins
  public getScript!: BelongsToGetAssociationMixin<any>;
  public getDependency!: BelongsToGetAssociationMixin<ScriptParameter>;

  // Associations
  public static associations: {
    script: Association<ScriptParameter, any>;
    dependency: Association<ScriptParameter, ScriptParameter>;
  };

  /**
   * Get parameter's effective default value
   */
  public get effectiveDefaultValue(): any {
    if (this.defaultValue !== undefined && this.defaultValue !== null) {
      return this.defaultValue;
    }

    // Provide type-specific defaults
    switch (this.type) {
      case ScriptParameterType.BOOLEAN:
        return false;
      case ScriptParameterType.INTEGER:
        return this.minValue || 0;
      case ScriptParameterType.FLOAT:
        return this.minValue || 0.0;
      case ScriptParameterType.STRING:
      case ScriptParameterType.EMAIL:
      case ScriptParameterType.URL:
      case ScriptParameterType.PASSWORD:
      case ScriptParameterType.TEXT:
        return '';
      case ScriptParameterType.JSON:
        return {};
      case ScriptParameterType.SELECT:
        return this.allowedValues?.[0] || null;
      case ScriptParameterType.MULTISELECT:
        return [];
      case ScriptParameterType.FILE:
        return null;
      case ScriptParameterType.DATE:
      case ScriptParameterType.DATETIME:
        return null;
      default:
        return null;
    }
  }

  /**
   * Validate parameter value against constraints
   */
  public validateValue(value: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if required parameter is provided
    if (this.isRequired && (value === null || value === undefined || value === '')) {
      errors.push(`Parameter '${this.displayName}' is required`);
      return { isValid: false, errors };
    }

    // If not required and no value provided, it's valid
    if (!this.isRequired && (value === null || value === undefined || value === '')) {
      return { isValid: true, errors: [] };
    }

    // Type-specific validation
    switch (this.type) {
      case ScriptParameterType.STRING:
      case ScriptParameterType.EMAIL:
      case ScriptParameterType.URL:
      case ScriptParameterType.PASSWORD:
      case ScriptParameterType.TEXT:
        if (typeof value !== 'string') {
          errors.push(`Parameter '${this.displayName}' must be a string`);
          break;
        }
        if (this.minLength !== undefined && value.length < this.minLength) {
          errors.push(`Parameter '${this.displayName}' must be at least ${this.minLength} characters`);
        }
        if (this.maxLength !== undefined && value.length > this.maxLength) {
          errors.push(`Parameter '${this.displayName}' must not exceed ${this.maxLength} characters`);
        }
        if (this.validationRegex) {
          const regex = new RegExp(this.validationRegex);
          if (!regex.test(value)) {
            errors.push(`Parameter '${this.displayName}' format is invalid`);
          }
        }
        if (this.type === ScriptParameterType.EMAIL) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push(`Parameter '${this.displayName}' must be a valid email address`);
          }
        }
        if (this.type === ScriptParameterType.URL) {
          try {
            new URL(value);
          } catch {
            errors.push(`Parameter '${this.displayName}' must be a valid URL`);
          }
        }
        break;

      case ScriptParameterType.INTEGER:
        const intValue = parseInt(value);
        if (isNaN(intValue) || intValue.toString() !== value.toString()) {
          errors.push(`Parameter '${this.displayName}' must be an integer`);
          break;
        }
        if (this.minValue !== undefined && intValue < this.minValue) {
          errors.push(`Parameter '${this.displayName}' must be at least ${this.minValue}`);
        }
        if (this.maxValue !== undefined && intValue > this.maxValue) {
          errors.push(`Parameter '${this.displayName}' must not exceed ${this.maxValue}`);
        }
        break;

      case ScriptParameterType.FLOAT:
        const floatValue = parseFloat(value);
        if (isNaN(floatValue)) {
          errors.push(`Parameter '${this.displayName}' must be a number`);
          break;
        }
        if (this.minValue !== undefined && floatValue < this.minValue) {
          errors.push(`Parameter '${this.displayName}' must be at least ${this.minValue}`);
        }
        if (this.maxValue !== undefined && floatValue > this.maxValue) {
          errors.push(`Parameter '${this.displayName}' must not exceed ${this.maxValue}`);
        }
        break;

      case ScriptParameterType.BOOLEAN:
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`Parameter '${this.displayName}' must be a boolean (true/false)`);
        }
        break;

      case ScriptParameterType.JSON:
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
          } catch {
            errors.push(`Parameter '${this.displayName}' must be valid JSON`);
          }
        } else if (typeof value !== 'object' || value === null) {
          errors.push(`Parameter '${this.displayName}' must be a JSON object`);
        }
        break;

      case ScriptParameterType.SELECT:
        if (this.allowedValues && !this.allowedValues.includes(value)) {
          errors.push(`Parameter '${this.displayName}' must be one of: ${this.allowedValues.join(', ')}`);
        }
        break;

      case ScriptParameterType.MULTISELECT:
        if (!Array.isArray(value)) {
          errors.push(`Parameter '${this.displayName}' must be an array`);
          break;
        }
        if (this.allowedValues) {
          const invalidValues = value.filter(v => !this.allowedValues!.includes(v));
          if (invalidValues.length > 0) {
            errors.push(`Parameter '${this.displayName}' contains invalid values: ${invalidValues.join(', ')}`);
          }
        }
        break;

      case ScriptParameterType.DATE:
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          errors.push(`Parameter '${this.displayName}' must be a valid date`);
        }
        break;

      case ScriptParameterType.DATETIME:
        const datetimeValue = new Date(value);
        if (isNaN(datetimeValue.getTime())) {
          errors.push(`Parameter '${this.displayName}' must be a valid datetime`);
        }
        break;

      case ScriptParameterType.FILE:
        if (typeof value !== 'string' || !value.trim()) {
          errors.push(`Parameter '${this.displayName}' must be a valid file path`);
        }
        break;
    }

    // Apply custom validation rules
    if (this.validationRules) {
      for (const [rule, ruleValue] of Object.entries(this.validationRules)) {
        const ruleResult = this.applyValidationRule(rule, ruleValue, value);
        if (!ruleResult.isValid) {
          errors.push(...ruleResult.errors);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Apply custom validation rule
   */
  private applyValidationRule(rule: string, ruleValue: any, value: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (rule) {
      case 'contains':
        if (typeof value === 'string' && !value.includes(ruleValue)) {
          errors.push(`Parameter '${this.displayName}' must contain '${ruleValue}'`);
        }
        break;

      case 'notContains':
        if (typeof value === 'string' && value.includes(ruleValue)) {
          errors.push(`Parameter '${this.displayName}' must not contain '${ruleValue}'`);
        }
        break;

      case 'startsWith':
        if (typeof value === 'string' && !value.startsWith(ruleValue)) {
          errors.push(`Parameter '${this.displayName}' must start with '${ruleValue}'`);
        }
        break;

      case 'endsWith':
        if (typeof value === 'string' && !value.endsWith(ruleValue)) {
          errors.push(`Parameter '${this.displayName}' must end with '${ruleValue}'`);
        }
        break;

      case 'arrayLength':
        if (Array.isArray(value) && value.length !== ruleValue) {
          errors.push(`Parameter '${this.displayName}' must have exactly ${ruleValue} items`);
        }
        break;

      case 'arrayMinLength':
        if (Array.isArray(value) && value.length < ruleValue) {
          errors.push(`Parameter '${this.displayName}' must have at least ${ruleValue} items`);
        }
        break;

      case 'arrayMaxLength':
        if (Array.isArray(value) && value.length > ruleValue) {
          errors.push(`Parameter '${this.displayName}' must have at most ${ruleValue} items`);
        }
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Convert value to appropriate type
   */
  public convertValue(value: any): any {
    if (value === null || value === undefined) {
      return this.effectiveDefaultValue;
    }

    switch (this.type) {
      case ScriptParameterType.STRING:
      case ScriptParameterType.EMAIL:
      case ScriptParameterType.URL:
      case ScriptParameterType.PASSWORD:
      case ScriptParameterType.TEXT:
        return String(value);

      case ScriptParameterType.INTEGER:
        return parseInt(value);

      case ScriptParameterType.FLOAT:
        return parseFloat(value);

      case ScriptParameterType.BOOLEAN:
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return Boolean(value);

      case ScriptParameterType.JSON:
        if (typeof value === 'string') return JSON.parse(value);
        return value;

      case ScriptParameterType.SELECT:
        return value;

      case ScriptParameterType.MULTISELECT:
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') return [value];
        return [];

      case ScriptParameterType.FILE:
        return String(value);

      case ScriptParameterType.DATE:
      case ScriptParameterType.DATETIME:
        return new Date(value);

      default:
        return value;
    }
  }

  /**
   * Check if parameter should be visible given current values
   */
  public isVisible(parameterValues: Record<string, any>): boolean {
    if (!this.showWhen || !this.dependsOn) {
      return true;
    }

    const dependencyValue = parameterValues[this.dependsOn];
    
    for (const [condition, expectedValue] of Object.entries(this.showWhen)) {
      switch (condition) {
        case 'equals':
          return dependencyValue === expectedValue;
        case 'notEquals':
          return dependencyValue !== expectedValue;
        case 'in':
          return Array.isArray(expectedValue) && expectedValue.includes(dependencyValue);
        case 'notIn':
          return Array.isArray(expectedValue) && !expectedValue.includes(dependencyValue);
        case 'truthy':
          return Boolean(dependencyValue);
        case 'falsy':
          return !Boolean(dependencyValue);
      }
    }

    return true;
  }

  /**
   * Get parameter form schema for UI generation
   */
  public getFormSchema(): Record<string, any> {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      type: this.type,
      isRequired: this.isRequired,
      isSecret: this.isSecret,
      defaultValue: this.effectiveDefaultValue,
      allowedValues: this.allowedValues,
      placeholder: this.placeholder,
      helpText: this.helpText,
      group: this.group,
      order: this.order,
      dependsOn: this.dependsOn,
      showWhen: this.showWhen,
      isAdvanced: this.isAdvanced,
      validation: {
        minLength: this.minLength,
        maxLength: this.maxLength,
        minValue: this.minValue,
        maxValue: this.maxValue,
        regex: this.validationRegex,
        rules: this.validationRules
      }
    };
  }

  /**
   * Serialize parameter for JSON (exclude sensitive defaults if secret)
   */
  public toJSON(): any {
    const values = super.toJSON();
    
    // Hide default values for secret parameters in API responses
    if (this.isSecret && values.defaultValue) {
      values.defaultValue = '***HIDDEN***';
    }
    
    return values;
  }
}

// Initialize the ScriptParameter model
ScriptParameter.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  scriptId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Reference to the script this parameter belongs to'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Parameter name cannot be empty'
      },
      len: {
        args: [1, 100],
        msg: 'Parameter name must be between 1 and 100 characters'
      },
      is: {
        args: /^[a-zA-Z0-9_]+$/,
        msg: 'Parameter name can only contain letters, numbers, and underscores'
      }
    },
    comment: 'Parameter identifier name (used in script)'
  },
  displayName: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Display name cannot be empty'
      },
      len: {
        args: [1, 150],
        msg: 'Display name must be between 1 and 150 characters'
      }
    },
    comment: 'Human-readable parameter name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Parameter description and usage instructions'
  },
  type: {
    type: DataTypes.ENUM(...Object.values(ScriptParameterType)),
    allowNull: false,
    comment: 'Parameter data type'
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether parameter is required for script execution'
  },
  isSecret: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether parameter contains sensitive data'
  },
  defaultValue: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Default value for the parameter'
  },
  allowedValues: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of allowed values for SELECT/MULTISELECT types'
  },
  validationRegex: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Regular expression for value validation'
  },
  validationRules: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional validation rules'
  },
  minLength: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: {
        args: [0],
        msg: 'Min length cannot be negative'
      }
    },
    comment: 'Minimum string length'
  },
  maxLength: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: {
        args: [0],
        msg: 'Max length cannot be negative'
      }
    },
    comment: 'Maximum string length'
  },
  minValue: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Minimum numeric value'
  },
  maxValue: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Maximum numeric value'
  },
  placeholder: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Placeholder text for UI input fields'
  },
  helpText: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Help text to guide users'
  },
  group: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Parameter group for UI organization'
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Display order within the script parameters'
  },
  dependsOn: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Name of parameter this depends on for conditional display'
  },
  showWhen: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Conditions for when to show this parameter'
  },
  isAdvanced: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether this is an advanced parameter (hidden by default)'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional parameter metadata'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  tableName: 'script_parameters',
  modelName: 'ScriptParameter',
  timestamps: true,
  indexes: [
    {
      fields: ['scriptId'],
      name: 'idx_script_parameters_script_id'
    },
    {
      fields: ['scriptId', 'name'],
      unique: true,
      name: 'idx_script_parameters_script_name_unique'
    },
    {
      fields: ['type'],
      name: 'idx_script_parameters_type'
    },
    {
      fields: ['isRequired'],
      name: 'idx_script_parameters_is_required'
    },
    {
      fields: ['isSecret'],
      name: 'idx_script_parameters_is_secret'
    },
    {
      fields: ['group'],
      name: 'idx_script_parameters_group'
    },
    {
      fields: ['order'],
      name: 'idx_script_parameters_order'
    },
    {
      fields: ['dependsOn'],
      name: 'idx_script_parameters_depends_on'
    },
    {
      fields: ['isAdvanced'],
      name: 'idx_script_parameters_is_advanced'
    },
    {
      fields: ['scriptId', 'order'],
      name: 'idx_script_parameters_script_order'
    },
    {
      fields: ['createdAt'],
      name: 'idx_script_parameters_created_at'
    },
    {
      fields: ['updatedAt'],
      name: 'idx_script_parameters_updated_at'
    }
  ],
  hooks: {
    beforeValidate: (parameter: ScriptParameter) => {
      // Ensure minValue <= maxValue
      if (parameter.minValue !== null && parameter.maxValue !== null && 
          parameter.minValue > parameter.maxValue) {
        throw new Error('minValue cannot be greater than maxValue');
      }
      
      // Ensure minLength <= maxLength
      if (parameter.minLength !== null && parameter.maxLength !== null && 
          parameter.minLength > parameter.maxLength) {
        throw new Error('minLength cannot be greater than maxLength');
      }
    }
  },
  scopes: {
    required: {
      where: {
        isRequired: true
      }
    },
    secret: {
      where: {
        isSecret: true
      }
    },
    advanced: {
      where: {
        isAdvanced: true
      }
    },
    basic: {
      where: {
        isAdvanced: false
      }
    },
    byScript: (scriptId: string) => ({
      where: {
        scriptId: scriptId
      },
      order: [['order', 'ASC']]
    }),
    byType: (type: ScriptParameterType) => ({
      where: {
        type: type
      }
    }),
    byGroup: (group: string) => ({
      where: {
        group: group
      },
      order: [['order', 'ASC']]
    }),
    ordered: {
      order: [['order', 'ASC'], ['name', 'ASC']]
    }
  }
});

export default ScriptParameter;