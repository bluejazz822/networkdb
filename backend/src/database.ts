/**
 * Database Connection Module
 * 
 * Centralized database connection and configuration
 */

import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('🔍 Database connection config:')
console.log('- Host:', process.env.DB_HOST || 'localhost')
console.log('- Port:', parseInt(process.env.DB_PORT || '3306'))
console.log('- Database:', process.env.DB_NAME || 'mydatabase')
console.log('- Username:', process.env.DB_USER || 'root')
console.log('- Password:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET')

export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'mydatabase',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    connectTimeout: 10000,
  },
  pool: {
    max: 1,
    min: 1,
    acquire: 30000,
    idle: 10000
  }
})

/**
 * Test database connection
 */
export async function connectToDatabase() {
  try {
    await sequelize.authenticate()
    console.log('✅ Database connection established successfully.')
    return true
  } catch (err: any) {
    console.error('❌ Unable to connect to database:', err.message)
    console.log('🔄 Continuing with mock data fallback...')
    return false
  }
}