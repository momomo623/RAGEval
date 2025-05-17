import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Spin } from 'antd';
import { 
  HomeOutlined, 
  DatabaseOutlined, 
  SettingOutlined, 
  UserOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import styles from './MainLayout.module.css';

const { Header, Content, Footer } = Layout;

interface UserInfo {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
}

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const currentPath = location.pathname;

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const user = await authService.getCurrentUser();
        setUserInfo(user);
      } catch (error) {
        console.error('获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: '1',
      label: '个人设置',
      onClick: () => navigate('/user/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: '2',
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 导航菜单项
  const menuItems = [
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: '项目',
      onClick: () => navigate('/dashboard')
    },
    {
      key: '/datasets',
      icon: <DatabaseOutlined />,
      label: '数据集',
      onClick: () => navigate('/datasets')
    },
    // 管理员菜单项（仅对管理员显示）
    ...(userInfo?.is_admin ? [
      {
        key: '/admin',
        icon: <CrownOutlined />,
        label: '管理员',
        children: [
          {
            key: '/admin',
            label: '仪表盘',
            onClick: () => navigate('/admin')
          },
          {
            key: '/admin/users',
            label: '用户管理',
            onClick: () => navigate('/admin/users')
          },
          {
            key: '/admin/datasets',
            label: '所有数据集',
            onClick: () => navigate('/admin/datasets')
          },
          {
            key: '/admin/projects',
            label: '所有项目',
            onClick: () => navigate('/admin/projects')
          }
        ]
      }
    ] : [])
  ];

  // 显示用户名 - 如果有name则显示name，否则显示email，如果都没有就显示"用户"
  const displayName = userInfo ? (userInfo.name || userInfo.email || '用户') : '用户';

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoAndNav}>
            <div className={styles.logo} onClick={() => navigate('/dashboard')}>
              RAG评测系统
            </div>
            <Menu 
              mode="horizontal" 
              selectedKeys={[currentPath.startsWith('/datasets') ? '/datasets' : 
                            currentPath.startsWith('/admin') ? '/admin' : currentPath]}
              className={styles.mainMenu}
              items={menuItems}
            />
          </div>
          <div className={styles.rightContent}>
            <Button 
              type="text"
              icon={<SettingOutlined />}
              className={styles.notificationBtn}
              onClick={() => navigate('/user/settings')}
              title="系统设置"
            />
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <div className={styles.userInfo}>
                {loading ? (
                  <Spin size="small" />
                ) : (
                  <>
                    <Avatar 
                      icon={<UserOutlined />} 
                      className={styles.avatar}
                    />
                    <span className={styles.userName}>{displayName}</span>
                  </>
                )}
              </div>
            </Dropdown>
          </div>
        </div>
      </Header>
      <Content className={styles.content}>
        <div className={styles.contentContainer}>
          {children}
        </div>
      </Content>
      <Footer className={styles.footer}>
        RAG评测系统 ©{new Date().getFullYear()} 版权所有
      </Footer>
    </Layout>
  );
};

export default MainLayout;
