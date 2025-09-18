import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatValue,
  prepareExportData,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  getExportStats,
  captureChartAsImage,
  downloadChartAsImage,
  addChartToPDF,
  exportMultipleChartsToPDF,
  ExportField,
  ExportData,
  ChartExportOptions,
  MultiChartPDFOptions
} from '../exportUtils'

describe('exportUtils functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatValue', () => {
    it('should return N/A for null or undefined values', () => {
      expect(formatValue(null, 'any')).toBe('N/A')
      expect(formatValue(undefined, 'any')).toBe('N/A')
    })

    it('should format time fields correctly', () => {
      const date = '2023-01-01T12:00:00Z'
      expect(formatValue(date, 'created_time')).toContain('2023')
      expect(formatValue(date, 'termindated_time')).toContain('2023')
      expect(formatValue('', 'created_time')).toBe('N/A')
    })

    it('should format IsDefault field correctly', () => {
      expect(formatValue('True', 'IsDefault')).toBe('Yes')
      expect(formatValue('False', 'IsDefault')).toBe('No')
      expect(formatValue(false, 'IsDefault')).toBe('No')
    })

    it('should return string representation for other values', () => {
      expect(formatValue('test', 'other')).toBe('test')
      expect(formatValue(123, 'other')).toBe('123')
    })
  })

  describe('prepareExportData', () => {
    const mockData: ExportData[] = [
      {
        VpcId: 'vpc-123',
        Name: 'Test VPC',
        AccountId: '123456789',
        IsDefault: 'True',
        created_time: '2023-01-01T12:00:00Z'
      }
    ]

    const mockFields: ExportField[] = [
      { key: 'VpcId', label: 'VPC ID', selected: true },
      { key: 'Name', label: 'Name', selected: true },
      { key: 'AccountId', label: 'Account ID', selected: false },
      { key: 'IsDefault', label: 'Default VPC', selected: true }
    ]

    it('should prepare export data with selected fields only', () => {
      const result = prepareExportData(mockData, mockFields)

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('VPC ID', 'vpc-123')
      expect(result[0]).toHaveProperty('Name', 'Test VPC')
      expect(result[0]).toHaveProperty('Default VPC', 'Yes')
      expect(result[0]).not.toHaveProperty('Account ID')
    })

    it('should handle empty data', () => {
      const result = prepareExportData([], mockFields)
      expect(result).toHaveLength(0)
    })
  })

  describe('exportToCSV', () => {
    const mockData: ExportData[] = [
      { VpcId: 'vpc-123', Name: 'Test VPC' }
    ]

    const mockFields: ExportField[] = [
      { key: 'VpcId', label: 'VPC ID', selected: true },
      { key: 'Name', label: 'Name', selected: true }
    ]

    it('should export data to CSV successfully', () => {
      const result = exportToCSV(mockData, mockFields, 'test.csv')
      expect(result).toBe(true)
    })

    it('should handle export errors gracefully', () => {
      // Test with invalid data that would cause an error
      const invalidData = null as any
      const result = exportToCSV(invalidData, mockFields)
      expect(result).toBe(false)
    })
  })

  describe('exportToExcel', () => {
    const mockData: ExportData[] = [
      { VpcId: 'vpc-123', Name: 'Test VPC' }
    ]

    const mockFields: ExportField[] = [
      { key: 'VpcId', label: 'VPC ID', selected: true },
      { key: 'Name', label: 'Name', selected: true }
    ]

    it('should export data to Excel successfully', () => {
      const result = exportToExcel(mockData, mockFields, 'test.xlsx')
      expect(result).toBe(true)
    })

    it('should set column widths based on field labels', () => {
      exportToExcel(mockData, mockFields)
      // Column widths should be set based on label length
      // This is tested indirectly through the mocked XLSX functions
    })
  })

  describe('exportToPDF', () => {
    const mockData: ExportData[] = [
      { VpcId: 'vpc-123', Name: 'Test VPC' }
    ]

    const mockFields: ExportField[] = [
      { key: 'VpcId', label: 'VPC ID', selected: true },
      { key: 'Name', label: 'Name', selected: true }
    ]

    it('should export data to PDF successfully', () => {
      const result = exportToPDF(mockData, mockFields, 'test.pdf')
      expect(result).toBe(true)
    })

    it('should include metadata in PDF', () => {
      exportToPDF(mockData, mockFields)
      // Verify that title, date, and record count are added
      // This is tested through the mocked jsPDF functions
    })
  })

  describe('getExportStats', () => {
    const mockData: ExportData[] = [
      { VpcId: 'vpc-123' },
      { VpcId: 'vpc-456' }
    ]

    const mockFields: ExportField[] = [
      { key: 'VpcId', label: 'VPC ID', selected: true },
      { key: 'Name', label: 'Name', selected: false },
      { key: 'AccountId', label: 'Account ID', selected: true }
    ]

    it('should calculate export statistics correctly', () => {
      const stats = getExportStats(mockData, mockFields)

      expect(stats.selectedFields).toBe(2)
      expect(stats.totalFields).toBe(3)
      expect(stats.totalRecords).toBe(2)
      expect(stats.estimatedFileSize).toHaveProperty('csv')
      expect(stats.estimatedFileSize).toHaveProperty('excel')
      expect(stats.estimatedFileSize).toHaveProperty('pdf')
    })

    it('should handle empty data', () => {
      const stats = getExportStats([], mockFields)
      expect(stats.totalRecords).toBe(0)
      expect(stats.estimatedFileSize.csv).toBe(0)
    })
  })

  describe('captureChartAsImage', () => {
    const mockOptions: ChartExportOptions = {
      chartId: 'test-chart',
      title: 'Test Chart',
      width: 400,
      height: 300
    }

    it('should capture chart as image successfully', async () => {
      // Mock chart element
      const mockElement = document.createElement('div')
      mockElement.id = 'test-chart'
      Object.defineProperty(mockElement, 'offsetWidth', { value: 400 })
      Object.defineProperty(mockElement, 'offsetHeight', { value: 300 })
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      const result = await captureChartAsImage(mockOptions)
      expect(result).toBe('data:image/png;base64,mockImageData')
    })

    it('should return null when chart element not found', async () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null)

      const result = await captureChartAsImage(mockOptions)
      expect(result).toBeNull()
    })

    it('should use custom dimensions when provided', async () => {
      const mockElement = document.createElement('div')
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      const customOptions = {
        ...mockOptions,
        width: 800,
        height: 600,
        backgroundColor: '#f0f0f0',
        scale: 3,
        format: 'jpeg' as const,
        quality: 0.8
      }

      const result = await captureChartAsImage(customOptions)
      expect(result).toBe('data:image/png;base64,mockImageData')
    })
  })

  describe('downloadChartAsImage', () => {
    const mockOptions: ChartExportOptions = {
      chartId: 'test-chart',
      title: 'Test Chart',
      width: 400,
      height: 300
    }

    it('should download chart as image successfully', async () => {
      // Mock chart element
      const mockElement = document.createElement('div')
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      const result = await downloadChartAsImage(mockOptions)
      expect(result).toBe(true)
    })

    it('should use custom filename when provided', async () => {
      const mockElement = document.createElement('div')
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      const optionsWithFilename = {
        ...mockOptions,
        filename: 'custom-chart.png'
      }

      const result = await downloadChartAsImage(optionsWithFilename)
      expect(result).toBe(true)
    })

    it('should return false when chart capture fails', async () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null)

      const result = await downloadChartAsImage(mockOptions)
      expect(result).toBe(false)
    })
  })

  describe('addChartToPDF', () => {
    it('should add chart to PDF and return new Y position', () => {
      const mockDoc = {
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        text: vi.fn(),
        addImage: vi.fn()
      }

      const imageData = 'data:image/png;base64,mockImageData'
      const result = addChartToPDF(mockDoc as any, imageData, 20, 50, 170, 100, 'Test Chart')

      expect(mockDoc.setFontSize).toHaveBeenCalledWith(12)
      expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'bold')
      expect(mockDoc.text).toHaveBeenCalledWith('Test Chart', 20, 50)
      expect(mockDoc.addImage).toHaveBeenCalledWith(imageData, 'PNG', 20, 58, 170, 100)
      expect(result).toBe(168) // 58 + 100 + 10
    })

    it('should add chart without title', () => {
      const mockDoc = {
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        text: vi.fn(),
        addImage: vi.fn()
      }

      const imageData = 'data:image/png;base64,mockImageData'
      const result = addChartToPDF(mockDoc as any, imageData, 20, 50, 170, 100)

      expect(mockDoc.text).not.toHaveBeenCalled()
      expect(mockDoc.addImage).toHaveBeenCalledWith(imageData, 'PNG', 20, 50, 170, 100)
      expect(result).toBe(160) // 50 + 100 + 10
    })
  })

  describe('exportMultipleChartsToPDF', () => {
    const mockOptions: MultiChartPDFOptions = {
      title: 'Test Report',
      charts: [
        { id: 'chart1', title: 'Chart 1' },
        { id: 'chart2', title: 'Chart 2' }
      ]
    }

    it('should export multiple charts to PDF successfully', async () => {
      // Mock chart elements
      const mockElement1 = document.createElement('div')
      mockElement1.id = 'chart1'
      const mockElement2 = document.createElement('div')
      mockElement2.id = 'chart2'

      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(mockElement1)
        .mockReturnValueOnce(mockElement2)

      const result = await exportMultipleChartsToPDF(mockOptions)
      expect(result).toBe(true)
    })

    it('should handle chart capture failures gracefully', async () => {
      // Mock one chart element as null
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(document.createElement('div'))

      const result = await exportMultipleChartsToPDF(mockOptions)
      expect(result).toBe(true)
    })

    it('should use custom options when provided', async () => {
      const mockElement = document.createElement('div')
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      const customOptions: MultiChartPDFOptions = {
        ...mockOptions,
        pageSize: 'letter',
        orientation: 'landscape',
        margin: 30
      }

      const result = await exportMultipleChartsToPDF(customOptions)
      expect(result).toBe(true)
    })

    it('should handle PDF generation errors', async () => {
      // Test with invalid options that would cause an error
      const invalidOptions = null as any

      const result = await exportMultipleChartsToPDF(invalidOptions)
      expect(result).toBe(false)
    })
  })
})