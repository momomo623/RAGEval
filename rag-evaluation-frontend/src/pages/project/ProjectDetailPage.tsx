import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Card, PageHeader, message, Button, Spin } from 'antd';
import { projectService } from '../../services/project.service';
import { QuestionsManager } from '../../components/Questions/QuestionsManager';
import { EvaluationsManager } from '../../components/Evaluations/EvaluationsManager';
import { PerformanceTestsManager } from '../Projects/PerformanceTests/PerformanceTestsManager';

const { TabPane } = Tabs;

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!projectId) {
      message.error('项目ID无效');
      navigate('/projects');
      return;
    }
    
    const fetchProject = async () => {
      setLoading(true);
      try {
        const data = await projectService.getProjectById(projectId);
        setProject(data);
      } catch (error) {
        console.error('获取项目详情失败:', error);
        message.error('获取项目详情失败');
        navigate('/projects');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProject();
  }, [projectId, navigate]);
  
  if (loading) {
    return <Spin size="large" />;
  }
  
  if (!project) {
    return null;
  }
  
  return (
    <div>
      <PageHeader
        title={project.name}
        subTitle={project.description}
        onBack={() => navigate('/projects')}
        extra={[
          <Button key="edit" onClick={() => navigate(`/projects/edit/${projectId}`)}>
            编辑项目
          </Button>,
        ]}
      />
      
      <Card style={{ marginTop: 16 }}>
        <Tabs defaultActiveKey="questions">
          <TabPane tab="问题管理" key="questions">
            <QuestionsManager projectId={projectId} />
          </TabPane>
          
          <TabPane tab="评测管理" key="evaluations">
            <EvaluationsManager projectId={projectId} />
          </TabPane>
          
          <TabPane tab="性能测试" key="performance">
            <PerformanceTestsManager projectId={projectId} />
          </TabPane>
          
          <TabPane tab="报告管理" key="reports">
            {/* 报告管理组件 */}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}; 