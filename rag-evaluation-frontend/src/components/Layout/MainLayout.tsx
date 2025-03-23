import React, { ReactNode, useEffect, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Spin, Space } from 'antd';
import { 
  UserOutlined, DownOutlined, BellOutlined, HomeOutlined,
  DatabaseOutlined, SettingOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import styles from './MainLayout.module.css';
import ConfigButton from '../ConfigButton';

const { Header, Content } = Layout;

interface MainLayoutProps {
  children: ReactNode;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(location.pathname);

  useEffect(() => {
    // 获取用户信息
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        const user = await authService.getCurrentUser();
        setUserInfo(user);
      } catch (error) {
        console.error('获取用户信息失败:', error);
        // 如果获取用户信息失败，可能是token已过期，重定向到登录页
        if (!authService.isAuthenticated()) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [navigate]);

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

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
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => navigate('/user/settings')
    }
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
              selectedKeys={[currentPath.startsWith('/datasets') ? '/datasets' : currentPath]}
              className={styles.mainMenu}
              items={menuItems}
            />
          </div>
          <div className={styles.rightContent}>
        <ConfigButton text="" type="default" className={styles.notificationBtn} />

            {/* <Button 
              type="text"
              icon={<BellOutlined />}
              className={styles.notificationBtn}
            /> */}
            {/* <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}> */}
        {/* <ConfigButton text="" type="default" /> */}
      {/* </Space> */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <div className={styles.userInfo}>
                {loading ? (
                  <Spin size="small" />
                ) : (
                  <>
                    <Avatar 
                      icon={<UserOutlined />} 
                      src={userInfo?.avatar_url}
                    />
                    <span className={styles.userName}>{displayName}</span>
                    <DownOutlined />
                  </>
                )}
              </div>
            </Dropdown>
          </div>
        </div>
      </Header>
      <Content className={styles.content}>
        {children}
      </Content>
    </Layout>
  );
};

export default MainLayout; 