import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import CreateProject from '../pages/CreateProject';
import DatasetsPage from '../pages/Datasets';
import CreateDatasetPage from '../pages/Datasets/CreateDataset';
import DatasetDetailPage from '../pages/Datasets/DatasetDetail';
import ImportDataPage from '../pages/Datasets/ImportData';
import SelectDatasetsPage from '../pages/Projects/SelectDatasets';
import MainLayout from '../components/Layout/MainLayout';
import { authService } from '../services/auth.service';
import ProjectDetailPage from '../pages/Projects/ProjectDetail';

// 受保护的路由组件（使用布局）
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <MainLayout>{children}</MainLayout>;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* 项目相关路由 */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/create" 
          element={
            <ProtectedRoute>
              <CreateProject />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:projectId/datasets" 
          element={
            <ProtectedRoute>
              <SelectDatasetsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:id" 
          element={
            <ProtectedRoute>
              <ProjectDetailPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 数据集相关路由 */}
        <Route 
          path="/datasets" 
          element={
            <ProtectedRoute>
              <DatasetsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/datasets/create" 
          element={
            <ProtectedRoute>
              <CreateDatasetPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/datasets/:id" 
          element={
            <ProtectedRoute>
              <DatasetDetailPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/datasets/:id/import" 
          element={
            <ProtectedRoute>
              <ImportDataPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 选择数据集 */}
        <Route 
          path="/projects/:projectId/select-datasets" 
          element={
            <ProtectedRoute>
              <SelectDatasetsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 默认路由 */}
        <Route 
          path="/" 
          element={
            authService.isAuthenticated() ? 
            <Navigate to="/dashboard" replace /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter; 