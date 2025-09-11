import { useState, useEffect } from 'react'
import { Table } from 'antd'

export default function SimpleVPCTest() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        console.log('Fetching VPC data...')
        const response = await fetch('/api/vpcs')
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const result = await response.json()
        console.log('VPC data received:', result)
        
        if (result.success && result.data) {
          setData(result.data.slice(0, 10)) // Show only first 10 records
          setError(null)
        } else {
          throw new Error('Invalid data format')
        }
      } catch (err) {
        console.error('VPC fetch error:', err)
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const columns = [
    {
      title: 'VPC ID',
      dataIndex: 'VpcId',
      key: 'VpcId',
    },
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'Name',
    },
    {
      title: 'Region',
      dataIndex: 'Region',
      key: 'Region',
    },
    {
      title: 'CIDR Block',
      dataIndex: 'CidrBlock',
      key: 'CidrBlock',
    }
  ]

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Simple VPC Test</h2>
      <p>Loading: {loading ? 'Yes' : 'No'}</p>
      <p>Data count: {data.length}</p>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="VpcId"
        loading={loading}
        pagination={{ pageSize: 5 }}
      />
    </div>
  )
}