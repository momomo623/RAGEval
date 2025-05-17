import React, { useEffect, useState } from 'react';
import { Table, Input, Space, Tag, Typography, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { adminService } from '../../services/admin.service';

const { Title } = Typography;

interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await adminService.getUsers();
        setUsers(data);
      } catch (error) {
        console.error('获取用户列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const columns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: User) => (
        <Space>
          {record.is_active ? (
            <Tag color="green">活跃</Tag>
          ) : (
            <Tag color="red">停用</Tag>
          )}
          {record.is_admin && (
            <Tag color="blue">管理员</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a: User, b: User) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  const filteredUsers = users.filter(
    user => 
      user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.company?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div>
      <Title level={2}>用户管理</Title>
      
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索用户名、邮箱或公司"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </div>
      
      {loading ? (
        <Spin size="large" />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  );
};

export default UserManagement;
