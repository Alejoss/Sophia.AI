import React, { useContext } from 'react';
import { Link as RouterLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, Tab, Tabs, Typography, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import TopicCreationRequestsAdmin from '../topics/TopicCreationRequestsAdmin';
import BookClubsDashboardAdmin from '../bookClubs/BookClubsDashboardAdmin';

export const DashboardHome = () => (
  <>
    <BookClubsDashboardAdmin />
    <TopicCreationRequestsAdmin embedded />
  </>
);

const showDashboardTabs = (pathname) =>
  pathname === '/dashboard'
  || pathname === '/dashboard/'
  || pathname.startsWith('/dashboard/consultas')
  || pathname.startsWith('/dashboard/libros-destacados')
  || pathname.startsWith('/dashboard/pagos-bch')
  || pathname.startsWith('/dashboard/snapshots')
  || pathname.startsWith('/dashboard/certificados')
  || pathname.startsWith('/dashboard/credenciales');

const dashboardTabValue = (pathname) => {
  if (pathname.startsWith('/dashboard/consultas')) return 'consultations';
  if (pathname.startsWith('/dashboard/libros-destacados')) return 'featured-books';
  if (pathname.startsWith('/dashboard/pagos-bch')) return 'bch-payments';
  if (pathname.startsWith('/dashboard/snapshots')) return 'snapshots';
  if (pathname.startsWith('/dashboard/certificados') || pathname.startsWith('/dashboard/credenciales')) {
    return 'certificates';
  }
  return 'home';
};

const Dashboard = () => {
  const { t } = useTranslation('nav');
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
            {t('dashboard.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('dashboard.subtitle')}
          </Typography>
          <Tabs
            value={tabValue}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label={t('dashboard.home')}
              value="home"
              component={RouterLink}
              to="/dashboard"
            />
            <Tab
              label={t('dashboard.consultations')}
              value="consultations"
              component={RouterLink}
              to="/dashboard/consultas"
            />
            <Tab
              label={t('dashboard.featuredBooks')}
              value="featured-books"
              component={RouterLink}
              to="/dashboard/libros-destacados"
            />
            <Tab
              label={t('dashboard.bchPayments')}
              value="bch-payments"
              component={RouterLink}
              to="/dashboard/pagos-bch"
            />
            <Tab
              label={t('dashboard.snapshots')}
              value="snapshots"
              component={RouterLink}
              to="/dashboard/snapshots"
            />
            <Tab
              label={t('dashboard.certificates')}
              value="certificates"
              component={RouterLink}
              to="/dashboard/certificados"
            />
          </Tabs>
        </>
      )}
      <Outlet />
    </Box>
  );
};

export default Dashboard;
