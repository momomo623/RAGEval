import React from 'react';
import { Card, Typography, Button, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { DatasetDetail } from '../../../../types/dataset';
import styles from '../DatasetDetail.module.css';

const { Title, Text } = Typography;

interface RelatedProjectsTabProps {
  dataset: DatasetDetail;
}

const RelatedProjectsTab: React.FC<RelatedProjectsTabProps> = ({ dataset }) => {
  const navigate = useNavigate();

  return (
    <div className={styles.projectsContainer}>
      {dataset.projects && dataset.projects.length > 0 ? (
        <div className={styles.projectList}>
          {(dataset.projects || []).map(project => (
            <Card key={project.id} className={styles.projectCard}>
              <div className={styles.projectInfo}>
                <Title level={5}>{project.name}</Title>
              </div>
              <div className={styles.projectActions}>
                <Button 
                  type="link" 
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  查看项目
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className={styles.emptyProjects}>
          <Text type="secondary">该数据集尚未与任何项目关联</Text>
        </div>
      )}
    </div>
  );
};

export default RelatedProjectsTab;
