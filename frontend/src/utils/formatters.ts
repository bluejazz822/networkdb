import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

dayjs.extend(relativeTime)
dayjs.extend(utc)

// Date formatting utilities
export const formatters = {
  // Format date for display
  formatDate: (date: string | Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
    return dayjs(date).format(format)
  },

  // Format date relative to now (e.g., "2 hours ago")
  formatRelativeTime: (date: string | Date): string => {
    return dayjs(date).fromNow()
  },

  // Format date for ISO string
  formatISOString: (date: string | Date): string => {
    return dayjs(date).toISOString()
  },

  // Format UTC date
  formatUTCDate: (date: string | Date, format: string = 'YYYY-MM-DD HH:mm:ss UTC'): string => {
    return dayjs(date).utc().format(format)
  },

  // Format file size
  formatFileSize: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  },

  // Format numbers with thousands separator
  formatNumber: (num: number): string => {
    return new Intl.NumberFormat().format(num)
  },

  // Format percentage
  formatPercentage: (value: number, decimals: number = 1): string => {
    return `${value.toFixed(decimals)}%`
  },

  // Format currency (if needed for cost tracking)
  formatCurrency: (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  },

  // Format network status
  formatStatus: (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  },

  // Format device type
  formatDeviceType: (type: string): string => {
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  },

  // Format CIDR block for display
  formatCIDR: (cidr: string): string => {
    return cidr.toLowerCase()
  },

  // Format ASN (Autonomous System Number)
  formatASN: (asn: number): string => {
    return `AS${asn}`
  },

  // Truncate text with ellipsis
  truncateText: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  },

  // Format array as comma-separated string
  formatArray: (arr: string[], separator: string = ', '): string => {
    return arr.join(separator)
  },

  // Format boolean as Yes/No
  formatBoolean: (value: boolean): string => {
    return value ? 'Yes' : 'No'
  },
}

export default formatters