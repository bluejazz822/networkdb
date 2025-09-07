/**
 * Table Widget Component
 * Displays tabular data with sorting, filtering, and pagination
 */

import React, { useState, useMemo } from 'react';
import { Table, Input, Button, Space, Tag } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { TableConfiguration } from '../../../types/reports';
import dayjs from 'dayjs';

interface TableWidgetProps {
  configuration: TableConfiguration;
  data: any;
}

export const TableWidget: React.FC<TableWidgetProps> = ({
  configuration,
  data
}) => {
  const [searchText, setSearchText] = useState('');
  const [filteredInfo, setFilteredInfo] = useState<Record<string, string[] | null>>({});
  const [sortedInfo, setSortedInfo] = useState<any>({});

  const tableData = useMemo(() => {
    if (!data?.results && !data?.data) {
      return [];
    }

    const rawData = data.results || data.data || [];
    
    // Add key for table rows
    return rawData.map((item: any, index: number) => ({
      ...item,
      key: item.id || index
    }));
  }, [data]);

  const formatCellValue = (value: any, column: any) => {
    if (value === null || value === undefined) {
      return '-';
    }

    switch (column.type) {
      case 'date':
        return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'status':
        const statusColor = getStatusColor(value);
        return <Tag color={statusColor}>{String(value).toUpperCase()}</Tag>;
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      default:
        return String(value);
    }
  };

  const getStatusColor = (status: any) => {
    const statusStr = String(status).toLowerCase();
    switch (statusStr) {
      case 'active':
      case 'available':
      case 'healthy':
      case 'success':
        return 'green';
      case 'pending':
      case 'warning':
        return 'orange';
      case 'inactive':
      case 'error':
      case 'failed':
      case 'critical':
        return 'red';
      default:
        return 'blue';
    }
  };

  const getColumnSearchProps = (dataIndex: string, column: any) => {
    if (!column.filterable) return {};

    return {
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder={`Search ${column.title}`}
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
            style={{ marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button
              onClick={() => handleReset(clearFilters, dataIndex)}
              size="small"
              style={{ width: 90 }}
            >
              Reset
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <FilterOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value: string, record: any) =>
        record[dataIndex]
          ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
          : false,
      filteredValue: filteredInfo[dataIndex] || null
    };
  };

  const handleSearch = (selectedKeys: string[], confirm: () => void, dataIndex: string) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setFilteredInfo({
      ...filteredInfo,
      [dataIndex]: selectedKeys
    });
  };

  const handleReset = (clearFilters: () => void, dataIndex: string) => {
    clearFilters();
    setSearchText('');
    setFilteredInfo({
      ...filteredInfo,
      [dataIndex]: null
    });
  };

  const columns = useMemo(() => {
    return configuration.columns.map(column => ({
      title: column.title,
      dataIndex: column.field,
      key: column.field,
      width: column.width,
      sorter: column.sortable ? (a: any, b: any) => {
        const aVal = a[column.field];
        const bVal = b[column.field];
        
        if (column.type === 'number') {
          return (aVal || 0) - (bVal || 0);
        }
        
        if (column.type === 'date') {
          return dayjs(aVal).valueOf() - dayjs(bVal).valueOf();
        }
        
        return String(aVal || '').localeCompare(String(bVal || ''));
      } : false,
      sortOrder: sortedInfo.columnKey === column.field ? sortedInfo.order : null,
      render: (value: any) => formatCellValue(value, column),
      ...getColumnSearchProps(column.field, column),
      ellipsis: true
    }));
  }, [configuration.columns, filteredInfo, sortedInfo]);

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setFilteredInfo(filters);
    setSortedInfo(sorter);
  };

  const paginationConfig = configuration.pagination ? {
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} of ${total} items`,
    pageSizeOptions: ['10', '20', '50', '100']
  } : false;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={paginationConfig}
        onChange={handleTableChange}
        size="small"
        scroll={{ 
          x: 'max-content',
          y: configuration.pagination ? 'calc(100% - 64px)' : '100%'
        }}
        loading={!data}
        locale={{
          emptyText: 'No data available'
        }}
      />
      
      {data?.totalCount && (
        <div style={{ 
          textAlign: 'right', 
          marginTop: 8, 
          fontSize: '12px',
          color: '#8c8c8c'
        }}>
          Total records: {data.totalCount.toLocaleString()}
          {data.executionTime && ` • Query time: ${data.executionTime}ms`}
        </div>
      )}
    </div>
  );
};