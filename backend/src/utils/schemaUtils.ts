/**
 * Schema Discovery Utilities
 * 
 * Provides dynamic database schema introspection and type mapping
 * for building flexible APIs that adapt to database changes
 */

import { DataTypes, QueryTypes } from 'sequelize'
import { sequelize } from '../database'

export interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  filterable: boolean
  sortable: boolean
  editable: boolean
  displayType: 'text' | 'tag' | 'badge' | 'date' | 'code'
  width?: number
}

export interface TableConfig {
  primaryKey: string
  editableFields: string[]
  hiddenFields: string[]
  filterableFields: string[]
  displayConfig: Record<string, Partial<ColumnSchema>>
}

// VPC table specific configuration
export const VPC_TABLE_CONFIG: TableConfig = {
  primaryKey: 'VpcId',
  editableFields: ['Name', 'ENV Name', 'Tenant', 'Site'],
  hiddenFields: ['termindated_time'], // Keep typo for compatibility
  filterableFields: ['Region', 'status', 'Tenant', 'ENV Type', 'IsDefault'],
  displayConfig: {
    'VpcId': { displayType: 'code', width: 180 },
    'Name': { displayType: 'text', width: 200 },
    'AccountId': { displayType: 'code', width: 150 },
    'Region': { displayType: 'tag', width: 150 },
    'CidrBlock': { displayType: 'tag', width: 140 },
    'ENV Name': { displayType: 'tag', width: 200 },
    'ENV Type': { displayType: 'tag', width: 120 },
    'status': { displayType: 'badge', width: 100 },
    'IsDefault': { displayType: 'badge', width: 120 },
    'Tenant': { displayType: 'tag', width: 120 },
    'Site': { displayType: 'tag', width: 100 },
    'created_time': { displayType: 'date', width: 180 },
    'termindated_time': { displayType: 'date', width: 180 }
  }
}

/**
 * Get table schema from database
 */
export async function getTableSchema(tableName: string): Promise<ColumnSchema[]> {
  try {
    const columns = await sequelize.query(`
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_KEY as columnKey,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        COLUMN_DEFAULT as defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = :tableName
        AND TABLE_SCHEMA = DATABASE()
      ORDER BY ORDINAL_POSITION
    `, {
      replacements: { tableName },
      type: QueryTypes.SELECT
    }) as any[]

    if (!Array.isArray(columns)) {
      throw new Error('Query result is not an array')
    }

    const config = getTableConfig(tableName)
    
    return columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable === 'YES',
      isPrimaryKey: col.columnKey === 'PRI' || col.name === config.primaryKey,
      filterable: config.filterableFields.includes(col.name) || isFilterableType(col.type),
      sortable: true,
      editable: config.editableFields.includes(col.name),
      displayType: getDisplayType(col.name, col.type, config),
      width: config.displayConfig[col.name]?.width
    })).filter(col => !config.hiddenFields.includes(col.name))

  } catch (error) {
    console.error('Error fetching table schema:', error)
    throw new Error(`Failed to fetch schema for table ${tableName}`)
  }
}

/**
 * Create dynamic Sequelize model from schema
 */
export async function createDynamicModel(tableName: string) {
  const schema = await getTableSchema(tableName)
  const attributes: any = {}
  
  schema.forEach(col => {
    attributes[col.name] = {
      type: getSequelizeType(col.type),
      allowNull: col.nullable,
      primaryKey: col.isPrimaryKey,
      ...(col.name.includes(' ') && { field: col.name }) // Handle column names with spaces
    }
  })
  
  return sequelize.define(tableName, attributes, {
    tableName,
    timestamps: false,
    freezeTableName: true
  })
}

/**
 * Map MySQL types to Sequelize types
 */
function getSequelizeType(mysqlType: string) {
  const type = mysqlType.toLowerCase()
  
  if (type.includes('varchar') || type.includes('text')) return DataTypes.STRING
  if (type.includes('int')) return DataTypes.INTEGER
  if (type.includes('decimal') || type.includes('float')) return DataTypes.DECIMAL
  if (type.includes('date') || type.includes('timestamp')) return DataTypes.DATE
  if (type.includes('boolean') || type.includes('tinyint(1)')) return DataTypes.BOOLEAN
  if (type.includes('json')) return DataTypes.JSON
  
  return DataTypes.STRING // Default fallback
}

/**
 * Determine if a column type should be filterable
 */
function isFilterableType(type: string): boolean {
  const filterableTypes = ['varchar', 'char', 'enum', 'text', 'tinyint', 'boolean']
  return filterableTypes.some(t => type.toLowerCase().includes(t))
}

/**
 * Get display type based on column name and type
 */
function getDisplayType(name: string, type: string, config: TableConfig): ColumnSchema['displayType'] {
  const configType = config.displayConfig[name]?.displayType
  if (configType) return configType
  
  // Auto-detect display type based on name patterns
  if (name.toLowerCase().includes('id')) return 'code'
  if (name.toLowerCase().includes('time') || name.toLowerCase().includes('date')) return 'date'
  if (name.toLowerCase().includes('status')) return 'badge'
  if (['Region', 'Tenant', 'ENV Name', 'ENV Type', 'Site'].includes(name)) return 'tag'
  
  return 'text'
}

/**
 * Get table-specific configuration
 */
function getTableConfig(tableName: string): TableConfig {
  // For now, only VPC table config - can be extended
  if (tableName === 'vpc_info') return VPC_TABLE_CONFIG
  
  // Default configuration for unknown tables
  return {
    primaryKey: 'id',
    editableFields: [],
    hiddenFields: [],
    filterableFields: [],
    displayConfig: {}
  }
}

/**
 * Get unique values for a column (for filter options)
 */
export async function getColumnUniqueValues(tableName: string, columnName: string): Promise<string[]> {
  try {
    const [results] = await sequelize.query(`
      SELECT DISTINCT \`${columnName}\` as value
      FROM \`${tableName}\`
      WHERE \`${columnName}\` IS NOT NULL 
        AND \`${columnName}\` != ''
      ORDER BY \`${columnName}\`
      LIMIT 100
    `, {
      type: QueryTypes.SELECT
    }) as any[]

    return results.map((r: any) => r.value).filter(Boolean)
  } catch (error) {
    console.error(`Error getting unique values for ${tableName}.${columnName}:`, error)
    return []
  }
}