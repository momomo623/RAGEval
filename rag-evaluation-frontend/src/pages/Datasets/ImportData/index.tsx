import React, { useState, useEffect } from 'react';
import { 
  Layout, Typography, Form, Button, Card, Radio, 
  Space, message, Divider, Upload, Input, Checkbox,
  Select, Tabs, Spin
} from 'antd';
import { 
  ArrowLeftOutlined, InboxOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { RcFile } from 'antd/lib/upload';
import { DatasetDetail, ImportDataRequest } from '../../../types/dataset';
import { datasetService } from '../../../services/dataset.service';
import styles from './ImportData.module.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

const ImportDataPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [importMethod, setImportMethod] = useState<'file' | 'text'>('file');
  const [fileList, setFileList] = useState<any[]>([]);
  const [fileType, setFileType] = useState<'excel' | 'csv'>('csv');
  const [previewText, setPreviewText] = useState<string[]>([]);
  const [includeRagAnswers, setIncludeRagAnswers] = useState(false);
  
  useEffect(() => {
    if (id) {
      fetchDatasetDetail(id);
    }
  }, [id]);
  
  const fetchDatasetDetail = async (datasetId: string) => {
    setLoading(true);
    try {
      const data = await datasetService.getDataset(datasetId);
      setDataset(data);
    } catch (error) {
      console.error('获取数据集详情失败:', error);
      message.error('获取数据集详情失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMethodChange = (e: any) => {
    setImportMethod(e.target.value);
  };
  
  const handleFileTypeChange = (e: any) => {
    setFileType(e.target.value);
  };
  
  const handleUploadChange = (info: any) => {
    let fileList = [...info.fileList];
    
    // 限制只能上传一个文件
    fileList = fileList.slice(-1);
    
    // 处理文件状态变化
    fileList = fileList.map(file => {
      if (file.response) {
        file.url = file.response.url;
      }
      return file;
    });
    
    setFileList(fileList);
    
    // 当文件上传成功时
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`);
      
      // 如果有预览功能，可以在这里处理
      // 模拟文件预览（实际中可能需要从服务器获取预览数据）
      setPreviewText([
        '问题,标准答案,分类,难度',
        '如何重置密码?,点击"忘记密码"链接，然后按照步骤操作。,账户管理,简单',
        '产品支持哪些付款方式?,我们支持信用卡、PayPal和银行转账。,支付,简单',
        '...更多数据行...'
      ]);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  };
  
  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text) {
      const lines = text.split('\n').filter(line => line.trim());
      setPreviewText(lines.slice(0, 5)); // 只显示前5行作为预览
    } else {
      setPreviewText([]);
    }
  };
  
  const customRequest = ({ file, onSuccess }: any) => {
    // 模拟上传成功
    setTimeout(() => {
      onSuccess("ok");
    }, 1000);
  };
  
  const beforeUpload = (file: RcFile) => {
    const isCSV = file.type === 'text/csv';
    const isExcel = 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.type === 'application/vnd.ms-excel';
    
    if (fileType === 'csv' && !isCSV) {
      message.error('只能上传CSV文件!');
      return false;
    }
    
    if (fileType === 'excel' && !isExcel) {
      message.error('只能上传Excel文件!');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过10MB!');
      return false;
    }
    
    return (fileType === 'csv' && isCSV) || (fileType === 'excel' && isExcel);
  };
  
  const handleSubmit = async (values: any) => {
    if (!id) {
      message.error('数据集ID无效');
      return;
    }
    
    setImporting(true);
    
    try {
      const request: ImportDataRequest = {
        dataset_id: id
      };
      
      if (importMethod === 'file') {
        if (fileList.length === 0) {
          message.error('请先上传文件');
          setImporting(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('file', fileList[0].originFileObj);
        formData.append('dataset_id', id);
        formData.append('include_rag_answers', includeRagAnswers.toString());
        
        request.file = formData;
      } else {
        const text = form.getFieldValue('importText');
        if (!text) {
          message.error('请输入要导入的数据');
          setImporting(false);
          return;
        }
        
        // 解析文本为问题对象数组
        const lines = text.split('\n').filter(line => line.trim());
        const questions = lines.map(line => {
          const [question_text, standard_answer, category, difficulty] = line.split(',');
          return {
            question_text,
            standard_answer,
            category: category || undefined,
            difficulty: difficulty || undefined
          };
        });
        
        request.questions = questions;
      }
      
      const result = await datasetService.importData(request);
      
      if (result.success) {
        message.success(`成功导入 ${result.imported_count} 个问题`);
        navigate(`/datasets/${id}`);
      } else {
        message.error('导入失败');
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      message.error('导入数据失败，请重试');
    } finally {
      setImporting(false);
    }
  };
  
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (!dataset) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyContent}>
          <Title level={4}>未找到数据集</Title>
          <Text type="secondary">该数据集可能已被删除或您没有访问权限</Text>
          <Button 
            type="primary" 
            onClick={() => navigate('/datasets')}
            className={styles.backButton}
          >
            返回数据集列表
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <Layout.Content className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(`/datasets/${id}`)}
        >
          返回数据集
        </Button>
        <Title level={2}>导入数据</Title>
        <Text type="secondary">
          将问答数据导入到 "{dataset.name}" 数据集
        </Text>
      </div>
      
      <Card className={styles.formCard}>
        <Form 
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            importMethod: 'file',
            fileType: 'csv',
            hasHeaderRow: true,
            skipDuplicates: true,
            encoding: 'utf-8'
          }}
        >
          <div className={styles.section}>
            <Title level={4}>选择导入方式</Title>
            
            <Form.Item name="importMethod">
              <Radio.Group onChange={handleMethodChange} value={importMethod}>
                <Space direction="vertical" className={styles.radioSpace}>
                  <Radio value="file">
                    <div className={styles.radioOption}>
                      <Text strong>从文件导入</Text>
                      <div className={styles.optionDescription}>
                        上传Excel或CSV文件批量导入问答对
                      </div>
                    </div>
                  </Radio>
                  <Radio value="text">
                    <div className={styles.radioOption}>
                      <Text strong>从文本导入</Text>
                      <div className={styles.optionDescription}>
                        直接输入或粘贴问答对文本
                      </div>
                    </div>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          </div>
          
          <Divider />
          
          {importMethod === 'file' ? (
            <div className={styles.section}>
              <Title level={4}>文件上传</Title>
              
              <Form.Item name="fileType" label="文件类型">
                <Radio.Group onChange={handleFileTypeChange} value={fileType}>
                  <Radio value="csv">CSV文件</Radio>
                  <Radio value="excel">Excel文件</Radio>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item name="fileUpload" label="上传文件">
                <Dragger
                  name="file"
                  fileList={fileList}
                  onChange={handleUploadChange}
                  customRequest={customRequest}
                  beforeUpload={beforeUpload}
                  maxCount={1}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p className="ant-upload-hint">
                    支持{fileType === 'csv' ? 'CSV' : 'Excel'}文件，每行一个问答对，最大10MB
                  </p>
                </Dragger>
              </Form.Item>
              
              {previewText.length > 0 && (
                <div className={styles.previewSection}>
                  <Title level={5}>文件预览</Title>
                  <div className={styles.previewContainer}>
                    {previewText.map((line, index) => (
                      <div key={index} className={styles.previewLine}>
                        {line}
                      </div>
                    ))}
                    {previewText.length > 3 && (
                      <div className={styles.previewMore}>...</div>
                    )}
                  </div>
                </div>
              )}
              
              <div className={styles.fileOptions}>
                <Title level={5}>导入选项</Title>
                
                <Form.Item name="hasHeaderRow" valuePropName="checked">
                  <Checkbox>第一行包含列标题</Checkbox>
                </Form.Item>
                
                <Form.Item name="skipDuplicates" valuePropName="checked">
                  <Checkbox>跳过重复问题</Checkbox>
                </Form.Item>
                
                <Form.Item name="encoding" label="文件编码">
                  <Select>
                    <Option value="utf-8">UTF-8</Option>
                    <Option value="gbk">GBK</Option>
                    <Option value="gb2312">GB2312</Option>
                  </Select>
                </Form.Item>
              </div>
              
              <Form.Item name="include_rag_answers" valuePropName="checked">
                <Checkbox onChange={(e) => setIncludeRagAnswers(e.target.checked)}>
                  包含RAG回答（Excel表格需要有rag_answer列）
                </Checkbox>
              </Form.Item>
              
              <div className={styles.fileFormat}>
                <Title level={5}>文件格式要求</Title>
                <Paragraph>
                  文件需包含以下列（列名不区分大小写）：
                </Paragraph>
                <ul className={styles.formatList}>
                  <li>question_text - 问题文本（必需）</li>
                  <li>standard_answer - 标准答案（必需）</li>
                  <li>category - 问题分类（可选）</li>
                  <li>difficulty - 问题难度（可选）</li>
                  <li>tags - 标签，用逗号分隔（可选）</li>
                </ul>
                <Button 
                  type="link" 
                  icon={<FileExcelOutlined />}
                  className={styles.downloadLink}
                >
                  下载模板文件
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.section}>
              <Title level={4}>文本导入</Title>
              
              <Form.Item 
                name="importText" 
                label="输入CSV格式数据"
                extra="每行一个问答对，格式为：问题,标准答案,分类,难度"
              >
                <TextArea 
                  rows={10} 
                  placeholder="问题1,标准答案1,分类1,难度1&#10;问题2,标准答案2,分类2,难度2&#10;..."
                  onChange={handleTextInputChange}
                />
              </Form.Item>
              
              {previewText.length > 0 && (
                <div className={styles.previewSection}>
                  <Title level={5}>预览</Title>
                  <div className={styles.previewContainer}>
                    {previewText.map((line, index) => (
                      <div key={index} className={styles.previewLine}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Form.Item name="skipDuplicatesText" valuePropName="checked">
                <Checkbox>跳过重复问题</Checkbox>
              </Form.Item>
            </div>
          )}
          
          <div className={styles.formActions}>
            <Button 
              onClick={() => navigate(`/datasets/${id}`)}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={importing}
            >
              开始导入
            </Button>
          </div>
        </Form>
      </Card>
    </Layout.Content>
  );
};

export default ImportDataPage; 