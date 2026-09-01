import React, { useContext } from 'react';
import { Link as RouterLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, Tab, Tabs, Typography, CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import TopicCreationRequestsAdmin from '../topics/TopicCreationRequestsAdmin';
import BookClubsDashboardAdmin from '../bookClubs/BookClubsDashboardAdmin';
import TopicsConversarDashboard from '../topics/TopicsConversarDashboard';

export const DashboardHome = () => (
  <>
    <BookClubsDashboardAdmin />
    <TopicsConversarDashboard />
    <TopicCreationRequestsAdmin embedded />
  </>
);

const showDashboardTabs = (pathname) =>
  pathname === '/dashboard'
  || pathname === '/dashboard/'
  || pathname.startsWith('/dashboard/libros-destacados');

const dashboardTabValue = (pathname) => {
  if (pathname.startsWith('/dashboard/libros-destacados')) return 'featured-books';
  return 'home';
};

const Dashboard = () => {
  const { authState, authInitialized } = useContext(AuthContext);
  const location = useLocation();
  const withTabs = showDashboardTabs(location.pathname);
  const tabValue = dashboardTabValue(location.pathname);

  if (!authInitialized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/profiles/login" replace />;
  }

  if (!authState.user?.is_staff && !authState.user?.is_superuser) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto', pb: 6 }}>
      {withTabs && (
        <>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Panel de administración de la plataforma.
          </Typography>
          <Tabs
            value={tabValue}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label="Inicio"
              value="home"
              component={RouterLink}
              to="/dashboard"
            />
            <Tab
              label="Libros destacados"
              value="featured-books"
              component={RouterLink}
              to="/dashboard/libros-destacados"
            />
          </Tabs>
        </>
      )}
      <Outlet />
    </Box>
  );
};

export default Dashboard;
