import React from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/lib/locale/zh_CN'
import AppRouter from './router'
import './App.css'
import ConfigWrapper from './ConfigWrapper'

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <ConfigWrapper>
        <AppRouter />
      </ConfigWrapper>
    </ConfigProvider>
  )
}

export default App
