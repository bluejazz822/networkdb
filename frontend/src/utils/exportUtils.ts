import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'

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
    autoTable(doc, {
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