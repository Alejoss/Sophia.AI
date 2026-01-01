import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  CircularProgress,
  Container,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import contentApi from "../api/contentApi";
import VoteComponent from "../votes/VoteComponent";
import ContentDisplay from "./ContentDisplay";
import ContentReferences from "./ContentReferences";

// ContentDisplay Mode: "detailed" - Full content detail view from search results
const ContentDetailsSearch = () => {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState(null);
  const [references, setReferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get search query from location state
  const searchQuery = location.state?.searchQuery || "";

  useEffect(() => {
    const fetchContent = async () => {
      try {
        // Get profile ID from URL if present
        const searchParams = new URLSearchParams(location.search);
        const profileId = searchParams.get("profile");

        // Fetch content details
        const contentData = await contentApi.getContentDetails(
          contentId,
          "search",
          profileId
        );
        setContent(contentData);

        // Fetch content references
        const referencesData = await contentApi.getContentReferences(contentId);
        setReferences(referencesData);
      } catch (err) {
        console.error("Error fetching content details:", err);
        setError("Error al cargar el contenido");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [contentId, location.search]);

  if (loading)
    return (
      <Container sx={{ pt: 12, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Container>
    );

  if (error)
    return (
      <Container sx={{ pt: 12 }}>
        <Typography color="error">{error}</Typography>
      </Container>
    );

  if (!content)
    return (
      <Container sx={{ pt: 12 }}>
        <Typography>Contenido no encontrado</Typography>
      </Container>
    );

  const handleBackToSearch = () => {
    navigate("/search", { state: { searchQuery } });
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        px: 0,
        pt: {
          xs: 6, // 48px (on mobile)
          md: 12, // 96px (on md and up)
        },
        pb: 4,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleBackToSearch}
        >
          Hacer otra búsqueda
        </Button>
      </Box>

      {searchQuery && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: "info.light" }}>
          <Typography variant="body1">
            Estás viendo este contenido como resultado de buscar:{" "}
            <strong>"{searchQuery}"</strong>
          </Typography>
        </Paper>
      )}

      <Paper
        sx={{
          p: {
            xs: 1.5, // 12px on mobile (xs)
            sm: 2, // 16px on small screens
            md: 3, // 24px on medium+
          },
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontSize: {
                  xs: "1.25rem", // ~20px on mobile
                  sm: "1.5rem", // ~24px on small screens
                  md: "2rem", // ~32px on medium+
                },
              }}
              gutterBottom
            >
              {content.selected_profile?.title ||
                content.original_title ||
                "Untitled Content"}
            </Typography>

            {content.selected_profile?.author && (
              <Typography
                variant="subtitle1"
                color="text.secondary"
                gutterBottom
              >
                By {content.selected_profile.author}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Content Display */}
        <ContentDisplay
          content={content}
          variant="detailed"
          showAuthor={true}
        />
      </Paper>

      {/* Content References Section */}
      {references && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography 
            variant="h5" 
            gutterBottom 
            color="text.primary"
            sx={{
              fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "20px"
            }}
          >
            References
          </Typography>
          <ContentReferences references={references} />
        </Paper>
      )}
    </Container>
  );
};

export default ContentDetailsSearch;
