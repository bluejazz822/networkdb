import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import MinimalApp from './MinimalApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider>
      <MinimalApp />
    </ConfigProvider>
  </React.StrictMode>,
)