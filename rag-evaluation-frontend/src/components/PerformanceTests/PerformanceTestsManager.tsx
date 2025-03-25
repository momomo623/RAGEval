import React, { useState } from 'react';
import { PerformanceTestsList } from './PerformanceTestsList';
import { CreatePerformanceTestForm } from './CreatePerformanceTestForm';
import { PerformanceTestDetailView } from './PerformanceTestDetail';

interface PerformanceTestsManagerProps {
  projectId: string;
}

export const PerformanceTestsManager: React.FC<PerformanceTestsManagerProps> = ({ projectId }) => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setView('create');
  };

  const handleViewDetail = (testId: string) => {
    setSelectedTestId(testId);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedTestId(null);
  };

  const handleCreateSuccess = (testId: string) => {
    setSelectedTestId(testId);
    setView('detail');
  };

  return (
    <div>
      {view === 'list' && (
        <PerformanceTestsList 
          projectId={projectId} 
          onCreateNew={handleCreateNew} 
          onViewDetail={handleViewDetail} 
        />
      )}
      
      {view === 'create' && (
        <CreatePerformanceTestForm 
          projectId={projectId} 
          onSuccess={handleCreateSuccess}
          onCancel={handleBackToList}
        />
      )}
      
      {view === 'detail' && selectedTestId && (
        <PerformanceTestDetailView 
          testId={selectedTestId} 
          onBack={handleBackToList} 
        />
      )}
    </div>
  );
}; 