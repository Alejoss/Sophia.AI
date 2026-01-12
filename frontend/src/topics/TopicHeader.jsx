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

  // Size configurations
  const sizeConfig = {
    small: {
      imageSize: 80,
      titleVariant: "h6",
      padding: 2,
      marginBottom: 2,
      descriptionVariant: "body2",
    },
    large: {
      imageSize: 200,
      titleVariant: "h4",
      padding: 3,
      marginBottom: 3,
      descriptionVariant: "body1",
    },
  };

  const config = sizeConfig[size];

  return (
    <Paper sx={{ p: config.padding, mb: config.marginBottom }}>
      <Box
  sx={{
    display: {
      xs: "block", // mobile → stacked
      md: "flex",  // md and up → flex
    },
    alignItems: "flex-start",
    gap: 3,
    mb: config.marginBottom,
    "& > *:not(:last-child)": {
      mb: {
        xs: 2, // vertical spacing when stacked on mobile
        md: 0, // reset on desktop
      },
    },
  }}
>
        {/* Topic Image */}
        <Box sx={{ width: config.imageSize, height: config.imageSize }}>
          <img
            src={
              topic.topic_image ||
              `https://picsum.photos/400/400?random=${topic.id}`
            }
            alt={topic.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "2px",
            }}
          />
        </Box>

        {/* Topic Info */}
        <Box
          sx={{
            flex: {
              xs: "unset", // mobile (no flex grow/shrink)
              md: 1, // from md and up → flex: 1
            },
          }}
        >
          <Box
            sx={{
              display: {
                xs: "block", // mobile
                md: "flex", // from md and up
              },
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            {" "}
            <Typography
              variant={config.titleVariant}
              gutterBottom
              onClick={handleTitleClick}
              sx={{
                cursor: "pointer",
                "&:hover": {
                  color: "primary.main",
                },
              }}
            >
              {topic.title}
            </Typography>
            {isCreator && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onEdit}
                size={size === "small" ? "small" : "medium"}
              >
                Editar Tema
              </Button>
            )}
          </Box>
          {topic.description && (
            <Typography variant={config.descriptionVariant} sx={{ mt: 2 }}>
              {topic.description}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default TopicHeader;
