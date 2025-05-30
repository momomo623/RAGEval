import React, { useEffect, useState } from 'react';
import { 
  Layout, Typography, Form, Input, Switch, Select, Button, Card, 
  Radio, Space, message, Divider, Tag, Tooltip
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { CreateDatasetRequest } from '../../../types/dataset';
import { datasetService } from '../../../services/dataset.service';
import styles from './CreateDataset.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateDatasetPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [importOption, setImportOption] = useState('empty');
  const [tags, setTags] = useState<string[]>([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (values: any) => {

    setLoading(true);
    try {
      const datasetData: CreateDatasetRequest = {
        name: values.name,
        description: values.description,
        is_public: values.is_public,
        tags,
        dataset_metadata: {
          created_method: importOption
        }
      };

      const result = await datasetService.createDataset(datasetData);
      
      message.success('数据集创建成功');
      
      // 如果选择了导入方式，则跳转到导入页面
      if (importOption !== 'empty') {
        navigate(`/datasets/${result.id}/import`);
      } else {
        navigate(`/datasets/${result.id}`);
      }
    } catch (error) {
      console.error('创建数据集失败:', error);
      message.error('创建数据集失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (removedTag: string) => {
    const newTags = tags.filter(tag => tag !== removedTag);
    setTags(newTags);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    if (inputValue && !tags.includes(inputValue)) {
      setTags([...tags, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  const showInput = () => {
    setInputVisible(true);
  };

  return (
    <Layout.Content className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/datasets')}
        >
          返回
        </Button>
        <Title level={2}>创建数据集</Title>
        <Text type="secondary">
          填写基本信息，创建一个新的问答数据集
        </Text>
      </div>

      <Card className={styles.formCard}>
        <Form 
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            is_public: false
          }}
        >
          <div className={styles.section}>
            <Title level={4}>基本信息</Title>
            <Text type="secondary">请填写数据集的基本信息</Text>

            <Form.Item
              name="name"
              label="数据集名称"
              rules={[{ required: true, message: '请输入数据集名称' }]}
              className={styles.formItem}
            >
              <Input placeholder="给数据集起一个名字" maxLength={100} />
            </Form.Item>

            <Form.Item
              name="description"
              label="数据集描述"
              className={styles.formItem}
            >
              <TextArea 
                rows={4} 
                placeholder="简单描述这个数据集的内容和用途" 
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              label="标签"
              className={styles.formItem}
            >
              <div className={styles.tagContainer}>
                {tags.map((tag, index) => {
                  return (
                    <Tag
                      className={styles.tag}
                      key={tag}
                      closable
                      onClose={() => handleClose(tag)}
                    >
                      {tag}
                    </Tag>
                  );
                })}
                {inputVisible ? (
                  <Input
                    type="text"
                    size="small"
                    className={styles.tagInput}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputConfirm}
                    onPressEnter={handleInputConfirm}
                    autoFocus
                  />
                ) : (
                  <Tag className={styles.tagAddBtn} onClick={showInput}>
                    <PlusOutlined /> 添加标签
                  </Tag>
                )}
              </div>
              <Text type="secondary">添加标签可以帮助更好地分类和查找数据集</Text>
            </Form.Item>


            <Form.Item
              name="is_public"
              label="公开性"
              valuePropName="checked"
              className={styles.formItem}
            >
              <Switch checkedChildren="公开" unCheckedChildren="私有" />
            </Form.Item>
            <div className={styles.formItemHint}>
              <Text type="secondary">公开的数据集可以被其他用户查看和使用</Text>
            </div>
          </div>

          <Divider />


          <div className={styles.formActions}>
            <Button onClick={() => navigate('/datasets')}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>创建数据集</Button>
          </div>
        </Form>
      </Card>
    </Layout.Content>
  );
};

export default CreateDatasetPage; 