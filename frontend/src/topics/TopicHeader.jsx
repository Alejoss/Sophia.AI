import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Paper, Button } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useAuth } from "../context/AuthContext";

const TopicHeader = ({ topic, onEdit, size = "large" }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isCreator = isAuthenticated && topic.creator === user?.id;

  const handleTitleClick = () => {
    navigate(`/content/topics/${topic.id}`);
  };

  // Size configurations (cover image: más ancha que alta, 16:9)
  const sizeConfig = {
    small: {
      coverHeight: 150,
      titleVariant: "h6",
      padding: 2,
      marginBottom: 2,
      descriptionVariant: "body2",
    },
    large: {
      coverHeight: 280,
      titleVariant: "h4",
      padding: 3,
      marginBottom: 3,
      descriptionVariant: "body1",
    },
  };

  const config = sizeConfig[size];

  return (
    <Paper sx={{ overflow: "hidden", mb: config.marginBottom }}>
      <Box sx={{ mb: config.marginBottom }}>
        {/* Topic Image - portada a todo ancho; título y botón sobre la imagen con gradiente */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            maxHeight: config.coverHeight,
            overflow: "hidden",
          }}
        >
          <img
            src={
              topic.topic_image ||
              `https://picsum.photos/800/450?random=${topic.id}`
            }
            alt={topic.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${((topic.topic_image_focal_x ?? 0.5) * 100).toFixed(1)}% ${((topic.topic_image_focal_y ?? 0.5) * 100).toFixed(1)}%`,
              display: "block",
            }}
          />
          {/* Gradiente y título/botón superpuestos */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              p: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography
                variant={config.titleVariant}
                onClick={handleTitleClick}
                sx={{
                  cursor: "pointer",
                  color: "white",
                  fontWeight: 600,
                  textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  "&:hover": {
                    color: "grey.200",
                  },
                }}
              >
                {topic.title}
              </Typography>
              {isCreator && (
                <Button
                  variant="contained"
                  size={size === "small" ? "small" : "medium"}
                  startIcon={<EditIcon />}
                  onClick={onEdit}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    color: "grey.900",
                    "&:hover": {
                      backgroundColor: "white",
                    },
                  }}
                >
                  Editar Tema
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Descripción debajo de la portada */}
        {topic.description && (
          <Box sx={{ px: config.padding, pt: 2, pb: config.padding }}>
            <Typography variant={config.descriptionVariant}>
              {topic.description}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default TopicHeader;
