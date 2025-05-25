import React, { useEffect, useState } from 'react';
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
import Settings from '../pages/Settings';

// 管理员页面
import AdminDashboard from '../pages/Admin/Dashboard';
import UserManagement from '../pages/Admin/UserManagement';
import AllDatasets from '../pages/Admin/AllDatasets';
import AllProjects from '../pages/Admin/AllProjects';

// 受保护的路由组件（使用布局）
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <MainLayout>{children}</MainLayout>;
};

// 管理员路由保护组件
const AdminRoute = ({ children }: { children: React.ReactElement }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const userInfo = await authService.getCurrentUser();
        setIsAdmin(userInfo?.is_admin || false);
      } catch (error) {
        console.error('检查管理员状态失败:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
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
          path="/projects/:projectId/select-datasets"
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

        {/* 设置路由 */}
        <Route
          path="/user/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* 管理员路由 */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/datasets"
          element={
            <AdminRoute>
              <AllDatasets />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/projects"
          element={
            <AdminRoute>
              <AllProjects />
            </AdminRoute>
          }
        />

        {/* 默认路由 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
