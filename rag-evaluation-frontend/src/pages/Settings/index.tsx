import React, { useState } from 'react';
import { Menu, Layout, Typography } from 'antd';
import { LockOutlined, ApiOutlined, LogoutOutlined } from '@ant-design/icons';
import ProviderPanel from './ProviderPanel';
import PasswordPanel from './PasswordPanel';
import { useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: 'provider', icon: <ApiOutlined />, label: '模型供应商' },
  { key: 'password', icon: <LockOutlined />, label: '密码' },
  { key: 'logout', icon: <LogoutOutlined />, label: '登出' },
];

const siderStyle: React.CSSProperties = {
  background: '#fff',
  borderRight: '1px solid #f0f0f0',
  minHeight: '60vh',
  paddingTop: 32,
};

const contentStyle: React.CSSProperties = {
  background: '#fff',
  minHeight: 360,
  borderRadius: 8,
  boxShadow: '0 2px 8px #f0f1f2',
  padding: '32px 40px',
  margin: '32px 0 32px 32px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
};

const Settings: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('provider');
  const navigate = useNavigate();

  const handleMenuClick = (e: any) => {
    if (e.key === 'logout') {
      localStorage.clear();
      navigate('/login');
    } else {
      setSelectedKey(e.key);
    }
  };

  return (
    <Layout style={{ minHeight: '80vh', background: '#f5f6fa' }}>
      <Sider width={220} style={siderStyle} breakpoint="lg" collapsedWidth="0">
        <Title level={4} style={{ marginLeft: 24, marginBottom: 32, color: '#222' }}>设置</Title>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ height: '100%', borderRight: 0, fontSize: 16 }}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        <Content style={contentStyle}>
          {selectedKey === 'provider' && <ProviderPanel />}
          {selectedKey === 'password' && <PasswordPanel />}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Settings; 