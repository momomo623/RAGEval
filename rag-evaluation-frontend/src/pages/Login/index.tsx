import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Divider, message, Card, Typography, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, GithubOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { authService } from '../../services/auth.service';

const { Title, Paragraph } = Typography;



const Login: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const success = () => {
    messageApi.open({
      type: 'loading',
      content: 'Action in progress..',
      duration: 0,
    });
    // Dismiss manually and asynchronously
    setTimeout(messageApi.destroy, 2500);
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isLogin) {
        const authResponse = await authService.login({
          email: values.email,
          password: values.password,
          remember: values.remember
        });
        
        // 确保认证信息已保存
        console.log('登录成功，令牌:', authService.getToken());
        
        // 延迟导航以确保令牌已保存
        setTimeout(() => {
          navigate('/dashboard');
        }, 100);
      } else {
        await authService.register({
          email: values.email,
          password: values.password,
          name: values.name,
          company: values.company
        });
        messageApi.success('注册成功！');
      }
    } catch (error) {
      console.error('认证失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className="desktop-login-container">
    {contextHolder}
      <div className="login-page-wrapper">
        <div className="login-banner">
          <div className="banner-content">
            <Title level={1} style={{ color: '#fff', marginBottom: 20 }}>RAG评测系统</Title>
            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>
              简单易用的RAG系统评测工具，帮助您快速评估检索增强生成系统效果
            </Paragraph>
          </div>
        </div>
        
        <div className="login-form-container">
          <Card className="login-card" bordered={false}>
            <div className="text-center mb-6">
              <Title level={3} className="text-primary">欢迎使用</Title>
              <Paragraph type="secondary">请登录您的账户</Paragraph>
            </div>
            
            <div className="tabs mb-6">
              <div className="tab-header">
                <span 
                  className={`tab-item ${isLogin ? 'active' : ''}`} 
                  onClick={() => setIsLogin(true)}
                >
                  登录
                </span>
                <span 
                  className={`tab-item ${!isLogin ? 'active' : ''}`} 
                  onClick={() => setIsLogin(false)}
                >
                  注册
                </span>
              </div>
            </div>
            
            <Form
              name="auth_form"
              initialValues={{ remember: true }}
              onFinish={onFinish}
              layout="vertical"
              size="large"
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱地址' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="邮箱地址" 
                />
              </Form.Item>
              
              {!isLogin && (
                <>
                  <Form.Item
                    name="name"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input placeholder="用户名" />
                  </Form.Item>
                  
                  <Form.Item name="company">
                    <Input placeholder="公司名称(可选)" />
                  </Form.Item>
                </>
              )}
              
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  ...(isLogin ? [] : [{ min: 1, message: '密码至少8个字符' }])
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="密码" 
                />
              </Form.Item>
              
              {isLogin && (
                <Form.Item>
                  <div className="flex-between">
                    <Form.Item name="remember" valuePropName="checked" noStyle>
                      <Checkbox>记住我</Checkbox>
                    </Form.Item>
                    <a className="login-form-forgot" href="/forgot-password">
                      忘记密码？
                    </a>
                  </div>
                </Form.Item>
              )}
              
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block 
                  loading={loading}
                >
                  {isLogin ? '登录' : '注册'}
                </Button>
              </Form.Item>
              
              <Divider plain>或者使用</Divider>
              
              <Button 
                icon={<GithubOutlined />}
                block
                onClick={() => message.info('GitHub登录功能开发中')}
              >
                GitHub账号登录
              </Button>
              
              <div className="text-center mt-4">
                <span className="toggle-form-text" onClick={toggleForm}>
                  {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
                </span>
              </div>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login; 