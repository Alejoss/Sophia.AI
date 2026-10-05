import React from 'react';
import { Box, Divider } from '@mui/material';
import TopicsConsultationsDashboard from './TopicsConsultationsDashboard';
import UnlimitedConsultationsAdmin from './UnlimitedConsultationsAdmin';

/**
 * Staff Consultas tab: topic enablement + daily-quota allowlist.
 */
const ConsultationsDashboard = () => (
  <Box>
    <TopicsConsultationsDashboard />
    <Divider sx={{ my: 2 }} />
    <UnlimitedConsultationsAdmin />
  </Box>
);

export default ConsultationsDashboard;
