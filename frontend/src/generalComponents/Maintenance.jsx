import React from "react";
import { Box, Container, Typography, useTheme } from "@mui/material";
import "../styles/maintenance.css";

const Maintenance = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const messageBoxBg = isDark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.77)";

  return (
    <Box className="maintenance-page">
      <Box className="maintenance-image-wrapper">
        <Box
          component="img"
          src="/images/maintenance_page.png"
          alt="Página en mantenimiento"
          className="maintenance-image"
        />
        <Box className="maintenance-image-overlay">
          <Typography variant="h1" component="h1" sx={styles.maintenanceTitle}>
            Estamos en mantenimiento ... pronto volveremos!
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg">
        <Box className="maintenance-message-wrapper">
          <Box sx={{ ...styles.messageBox, bgcolor: messageBoxBg }}>
            <Typography variant="h1" component="h1" sx={styles.title}>
              El Conocimiento es Poder
            </Typography>
            <Typography variant="h5" component="p" sx={styles.subtitle}>
              Aprende desde la autonomía. Explora temas creados por la comunidad y
              construye tu propia red de aprendizaje.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

const styles = {
  messageBox: {
    px: { xs: 2, md: 4 },
    py: { xs: 2.5, md: 3 },
    mx: "auto",
    maxWidth: 720,
    borderRadius: 2,
    boxShadow: 2,
    textAlign: "center",
  },
  title: {
    fontSize: { xs: "2rem", sm: "2.5rem", md: "3.5rem" },
    fontWeight: 600,
    mb: 3,
    color: "text.primary",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: { xs: "1.1rem", md: "1.5rem" },
    color: "text.secondary",
    mb: 0,
    maxWidth: "800px",
    mx: "auto",
    lineHeight: 1.6,
  },
  maintenanceTitle: {
    fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem" },
    fontWeight: 700,
    textAlign: "center",
    color: "#ffffff",
    mb: 0,
  },
};

export default Maintenance;
