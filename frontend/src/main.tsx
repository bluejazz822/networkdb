import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App'
import { cmdbTheme } from '@styles/theme'
import { QueryProvider } from '@/contexts/QueryProvider'
import '@styles/global.css'

// Configure Ant Design locale
import dayjs from 'dayjs'
import 'dayjs/locale/en'
dayjs.locale('en')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryProvider>
      <ConfigProvider theme={cmdbTheme}>
        <App />
      </ConfigProvider>
    </QueryProvider>
  </React.StrictMode>,
)