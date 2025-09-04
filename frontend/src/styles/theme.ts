import type { ThemeConfig } from 'antd';
import { blue, green, orange, red, purple } from '@ant-design/colors';

// Network CMDB Custom Theme Configuration
export const cmdbTheme: ThemeConfig = {
  token: {
    // Primary colors - Network/Tech focused
    colorPrimary: blue[6], // #1890ff - Professional blue for primary actions
    colorSuccess: green[6], // #52c41a - Green for success states (online devices)
    colorWarning: orange[6], // #faad14 - Orange for warnings (maintenance)
    colorError: red[6], // #f5222d - Red for errors (offline devices)
    colorInfo: purple[6], // #722ed1 - Purple for informational states
    
    // Background and surface colors
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f5f7fa', // Light gray-blue for main layout
    colorBgSpotlight: '#fafbfc',
    
    // Border and divider colors
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
    
    // Text colors
    colorText: '#262626',
    colorTextSecondary: '#8c8c8c',
    colorTextTertiary: '#bfbfbf',
    colorTextQuaternary: '#f0f0f0',
    
    // Spacing and sizing
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeHeading1: 38,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 16,
    
    // Component specific tokens
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
  },
  components: {
    // Layout components
    Layout: {
      headerBg: '#001529', // Dark blue header for professional look
      headerColor: '#ffffff',
      siderBg: '#001529',
      bodyBg: '#f5f7fa',
    },
    
    // Menu styling for navigation
    Menu: {
      darkItemBg: '#001529',
      darkItemColor: '#ffffff',
      darkItemHoverBg: blue[7],
      darkItemSelectedBg: blue[6],
      darkSubMenuItemBg: '#000c17',
    },
    
    // Table styling for network data
    Table: {
      headerBg: '#fafafa',
      headerColor: '#262626',
      rowHoverBg: blue[0], // Light blue on hover
      borderColor: '#f0f0f0',
    },
    
    // Card styling for dashboard widgets
    Card: {
      headerBg: '#fafafa',
      boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    },
    
    // Badge styling for status indicators
    Badge: {
      dotSize: 8,
    },
    
    // Tag styling for categorization
    Tag: {
      defaultBg: '#f5f5f5',
      defaultColor: '#262626',
    },
    
    // Button customizations
    Button: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
    },
    
    // Form components
    Input: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
    },
    
    Select: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
    },
  },
  algorithm: undefined, // Use default algorithm
};

// Status color mappings for network elements
export const statusColors = {
  online: green[6],
  offline: red[6],
  maintenance: orange[6],
  unknown: '#8c8c8c',
  
  available: green[6],
  pending: orange[6],
  deleted: red[6],
  
  active: green[6],
  inactive: '#8c8c8c',
};

// Network device type color mappings
export const deviceTypeColors = {
  router: blue[6],
  switch: purple[6],
  firewall: red[6],
  'load-balancer': orange[6],
};