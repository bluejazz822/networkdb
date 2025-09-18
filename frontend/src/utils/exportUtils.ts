import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import Papa from 'papaparse'
import html2canvas from 'html2canvas'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export interface ExportField {
  key: string
  label: string
  selected: boolean
}

export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  { key: 'VpcId', label: 'VPC ID', selected: true },
  { key: 'Name', label: 'Name', selected: true },
  { key: 'AccountId', label: 'Account ID', selected: true },
  { key: 'Region', label: 'Region', selected: true },
  { key: 'CidrBlock', label: 'CIDR Block', selected: true },
  { key: 'ENV Name', label: 'Environment', selected: true },
  { key: 'status', label: 'Status', selected: true },
  { key: 'IsDefault', label: 'Default VPC', selected: false },
  { key: 'Tenant', label: 'Tenant', selected: false },
  { key: 'Site', label: 'Site', selected: false },
  { key: 'created_time', label: 'Created Time', selected: false },
  { key: 'termindated_time', label: 'Terminated Time', selected: false }
]

export interface ExportData {
  [key: string]: any
}

export const formatValue = (value: any, key: string): string => {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  
  if (key === 'created_time' || key === 'termindated_time') {
    return value ? new Date(value).toLocaleString() : 'N/A'
  }
  
  if (key === 'IsDefault') {
    return value === 'True' ? 'Yes' : 'No'
  }
  
  return String(value)
}

export const prepareExportData = (
  data: ExportData[],
  selectedFields: ExportField[]
): ExportData[] => {
  const fieldsToExport = selectedFields.filter(field => field.selected)
  
  return data.map(item => {
    const exportItem: ExportData = {}
    fieldsToExport.forEach(field => {
      exportItem[field.label] = formatValue(item[field.key], field.key)
    })
    return exportItem
  })
}

export const exportToCSV = (
  data: ExportData[],
  selectedFields: ExportField[],
  filename: string = 'vpc_export.csv'
) => {
  try {
    const exportData = prepareExportData(data, selectedFields)
    const csv = Papa.unparse(exportData)
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    return true
  } catch (error) {
    console.error('CSV export error:', error)
    return false
  }
}

export const exportToExcel = (
  data: ExportData[],
  selectedFields: ExportField[],
  filename: string = 'vpc_export.xlsx'
) => {
  try {
    const exportData = prepareExportData(data, selectedFields)
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    
    // Set column widths
    const colWidths = selectedFields
      .filter(field => field.selected)
      .map(field => ({ wpx: Math.max(field.label.length * 10, 100) }))
    
    worksheet['!cols'] = colWidths
    
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'VPC Data')
    
    XLSX.writeFile(workbook, filename)
    return true
  } catch (error) {
    console.error('Excel export error:', error)
    return false
  }
}

export const exportToPDF = (
  data: ExportData[],
  selectedFields: ExportField[],
  filename: string = 'vpc_export.pdf'
) => {
  try {
    const exportData = prepareExportData(data, selectedFields)
    const doc = new jsPDF('l', 'mm', 'a4') // landscape orientation
    
    // Add title
    doc.setFontSize(16)
    doc.text('VPC Export Report', 14, 15)
    
    // Add export info
    doc.setFontSize(10)
    doc.text(`Export Date: ${new Date().toLocaleString()}`, 14, 25)
    doc.text(`Total Records: ${exportData.length}`, 14, 30)
    
    // Prepare table data
    const selectedFieldLabels = selectedFields
      .filter(field => field.selected)
      .map(field => field.label)
    
    const tableRows = exportData.map(item => 
      selectedFieldLabels.map(label => item[label] || 'N/A')
    )
    
    // Add table
    doc.autoTable({
      head: [selectedFieldLabels],
      body: tableRows,
      startY: 35,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255
      },
      columnStyles: {},
      margin: { top: 35, left: 14, right: 14 }
    })
    
    doc.save(filename)
    return true
  } catch (error) {
    console.error('PDF export error:', error)
    return false
  }
}

export const getExportStats = (data: ExportData[], selectedFields: ExportField[]) => {
  const selectedCount = selectedFields.filter(field => field.selected).length
  const totalRecords = data.length

  return {
    selectedFields: selectedCount,
    totalFields: selectedFields.length,
    totalRecords,
    estimatedFileSize: {
      csv: Math.round((totalRecords * selectedCount * 20) / 1024), // KB estimate
      excel: Math.round((totalRecords * selectedCount * 25) / 1024), // KB estimate
      pdf: Math.round((totalRecords * selectedCount * 30) / 1024) // KB estimate
    }
  }
}

// Chart export utilities
export interface ChartExportOptions {
  chartId: string
  title?: string
  width?: number
  height?: number
  backgroundColor?: string
  scale?: number
  format?: 'png' | 'jpeg'
  quality?: number
}

export const captureChartAsImage = async (options: ChartExportOptions): Promise<string | null> => {
  try {
    const chartElement = document.getElementById(options.chartId)
    if (!chartElement) {
      console.error(`Chart element with ID ${options.chartId} not found`)
      return null
    }

    const canvas = await html2canvas(chartElement, {
      width: options.width || chartElement.offsetWidth,
      height: options.height || chartElement.offsetHeight,
      backgroundColor: options.backgroundColor || '#ffffff',
      scale: options.scale || 2,
      useCORS: true,
      allowTaint: true,
      removeContainer: false
    })

    return canvas.toDataURL(`image/${options.format || 'png'}`, options.quality || 0.95)
  } catch (error) {
    console.error('Chart capture error:', error)
    return null
  }
}

export const downloadChartAsImage = async (options: ChartExportOptions & { filename?: string }): Promise<boolean> => {
  try {
    const imageData = await captureChartAsImage(options)
    if (!imageData) {
      return false
    }

    const link = document.createElement('a')
    link.download = options.filename || `chart_${options.chartId}_${new Date().toISOString().slice(0, 10)}.${options.format || 'png'}`
    link.href = imageData

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    return true
  } catch (error) {
    console.error('Chart download error:', error)
    return false
  }
}

export const addChartToPDF = (
  doc: jsPDF,
  imageData: string,
  x: number,
  y: number,
  width: number,
  height: number,
  title?: string
): number => {
  try {
    let currentY = y

    // Add title if provided
    if (title) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(title, x, currentY)
      currentY += 8
    }

    // Add image
    doc.addImage(imageData, 'PNG', x, currentY, width, height)
    currentY += height + 10

    return currentY
  } catch (error) {
    console.error('Add chart to PDF error:', error)
    return y
  }
}

export interface MultiChartPDFOptions {
  title: string
  charts: {
    id: string
    title: string
    width?: number
    height?: number
  }[]
  pageSize?: 'a4' | 'letter'
  orientation?: 'portrait' | 'landscape'
  margin?: number
}

export const exportMultipleChartsToPDF = async (options: MultiChartPDFOptions): Promise<boolean> => {
  try {
    const doc = new jsPDF(
      options.orientation || 'portrait',
      'mm',
      options.pageSize || 'a4'
    )

    const margin = options.margin || 20
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - (margin * 2)
    const contentHeight = pageHeight - (margin * 2)

    let currentY = margin

    // Add main title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(options.title, margin, currentY)
    currentY += 15

    // Add generation info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, currentY)
    currentY += 10

    for (const chart of options.charts) {
      const chartWidth = chart.width || contentWidth
      const chartHeight = chart.height || (chartWidth * 0.6) // Default aspect ratio

      // Check if we need a new page
      if (currentY + chartHeight + 20 > pageHeight - margin) {
        doc.addPage()
        currentY = margin
      }

      // Capture chart
      const imageData = await captureChartAsImage({
        chartId: chart.id,
        width: chartWidth * 3, // Higher resolution for PDF
        height: chartHeight * 3,
        scale: 1
      })

      if (imageData) {
        currentY = addChartToPDF(
          doc,
          imageData,
          margin,
          currentY,
          chartWidth,
          chartHeight,
          chart.title
        )
      } else {
        // Add placeholder if chart capture failed
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.text(`Failed to capture chart: ${chart.title}`, margin, currentY)
        currentY += 15
      }
    }

    const filename = `charts_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(filename)

    return true
  } catch (error) {
    console.error('Multiple charts PDF export error:', error)
    return false
  }
}