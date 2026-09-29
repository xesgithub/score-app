import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import AdminPage from './pages/AdminPage';
import ResultsPage from './pages/ResultsPage';
import JudgePage from './pages/JudgePage';
import VersionFooter from './components/VersionFooter';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '/admin/results/:id', element: <ResultsPage /> },
  { path: '/judge', element: <JudgePage /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <VersionFooter />
  </React.StrictMode>
);
