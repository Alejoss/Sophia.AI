import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  Stack,
  CardActions,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { resolveMediaUrl } from "../utils/fileUtils";
import DescriptionIcon from "@mui/icons-material/Description";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArticleIcon from "@mui/icons-material/Article";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VideocamIcon from "@mui/icons-material/Videocam";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import LinkIcon from "@mui/icons-material/Link";
import ImageIcon from "@mui/icons-material/Image";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import StorageIcon from "@mui/icons-material/Storage";
import FolderIcon from "@mui/icons-material/Folder";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { formatFileSize } from "../utils/fileUtils";

const ContentDisplay = ({
  content,
  variant = "simple", // 'simple', 'preview', 'card', 'detailed'
  showActions = false,
  onRemove,
  onEdit,
  onClick,
  maxImageHeight = 300,
  showAuthor = true,
  additionalActions,
  topicId = null,
}) => {
  const [renderError, setRenderError] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const navigate = useNavigate();

  if (!content) {
    return null;
  }

  // Reset image load error when content changes
  useEffect(() => {
    setImageLoadError(false);
  }, [content.id]);

  // Get appropriate data from either content or content_profile
  const profile = content.selected_profile || content;
  const title = profile.title || content.original_title || "Sin título";
  const author = profile.author || content.original_author;

  // For preview mode, expect the PreviewContentProfileSerializer structure
  // which has a nested 'content' field
  const contentData = content.content || content;
  const mediaType = contentData.media_type || "";
  const fileDetails = contentData.file_details;
  const url = contentData.url || fileDetails?.url;
  const favicon = contentData.favicon;

  // Debug logging for preview mode (moved after variable declarations)
  if (variant === "preview") {
    console.log("ContentDisplay Preview Mode - Content Data:", {
      id: content.id,
      title: title,
      author: author,
      personal_note: content.personal_note,
      contentData: contentData,
      hasNestedContent: !!content.content,
    });
  }

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  };

  const getFileUrlFromContent = () => {
    try {
      if (url) return resolveMediaUrl(url);
      if (fileDetails) {
        const v = fileDetails.url ?? fileDetails.file;
        return resolveMediaUrl(v);
      }
      return null;
    } catch (error) {
      console.error("Error getting file URL:", error);
      setRenderError(`Error getting file URL: ${error.message}`);
      return null;
    }
  };

  const getMediaTypeIcon = (content) => {
    const iconProps = {
      fontSize: "large",
      sx: { opacity: 0.7, color: "text.secondary" },
    };

    // Use media_type from serializer
    const mediaType = content.media_type?.toUpperCase();

    switch (mediaType) {
      case "VIDEO":
        return <VideocamIcon {...iconProps} />;
      case "AUDIO":
        return <AudiotrackIcon {...iconProps} />;
      case "TEXT":
        // If content has URL, show link icon; otherwise show article icon
        // PDF detection should come from serializer if needed
        return content.url ? <LinkIcon {...iconProps} /> : <ArticleIcon {...iconProps} />;
      case "IMAGE":
        return <ImageIcon {...iconProps} />;
      default:
        return <DescriptionIcon {...iconProps} />;
    }
  };

  const renderContentByType = () => {
    const mediaTypeUpper = contentData.media_type?.toUpperCase();
    const fileUrl = getFileUrlFromContent();

    // Debug logging for detailed mode
    if (variant === "detailed") {
      console.log("ContentDisplay Detailed Mode - renderContentByType:", {
        mediaType: mediaTypeUpper,
        fileUrl: fileUrl,
        hasFileDetails: !!fileDetails,
        fileDetails: fileDetails,
        contentData: contentData,
      });
    }

    // Function to handle content clicks
    const handleContentClick = () => {
      if (fileUrl) {
        // Open file in new tab
        window.open(fileUrl, "_blank");
      } else if (url) {
        // Open URL in new tab
        window.open(url, "_blank");
      }
    };

    // Check if content is clickable
    const isClickable = fileUrl || url;

    switch (mediaTypeUpper) {
      case "IMAGE":
        if (!fileUrl) {
          console.warn("No file URL found for image content:", contentData);
          return (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 200,
                bgcolor: "grey.100",
                borderRadius: 0.5,
              }}
            >
              <Typography color="text.secondary">
                Archivo de imagen no disponible
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              maxHeight: maxImageHeight,
              overflow: "hidden",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              cursor: isClickable ? "pointer" : "default",
              "&:hover": isClickable
                ? {
                    boxShadow: 2,
                    borderColor: "primary.main",
                  }
                : {},
            }}
            onClick={isClickable ? handleContentClick : undefined}
            title={isClickable ? "Haz clic para abrir la imagen en una nueva pestaña" : undefined}
          >
            <img
              src={fileUrl}
              alt={title || contentData.original_title || "Content image"}
              style={{
                maxWidth: "100%",
                maxHeight: maxImageHeight,
                objectFit: "contain",
              }}
              onError={(e) => {
                console.error(
                  "Image failed to load in detailed mode:",
                  fileUrl
                );
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <Box
              sx={{
                display: "none",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 200,
                bgcolor: "grey.100",
                color: "text.secondary",
              }}
            >
              <Typography color="text.primary">Error al cargar la imagen</Typography>
            </Box>
          </Box>
        );
      case "VIDEO":
        if (!fileUrl) {
          return (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 200,
                bgcolor: "grey.100",
                borderRadius: 0.5,
              }}
            >
              <Typography color="text.secondary">
                Archivo de video no disponible
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            sx={{
              width: "100%",
              maxWidth: "800px",
              mx: "auto",
              cursor: isClickable ? "pointer" : "default",
              "&:hover": isClickable
                ? {
                    boxShadow: 2,
                    borderRadius: 0.5,
                  }
                : {},
            }}
            onClick={isClickable ? handleContentClick : undefined}
            title={isClickable ? "Haz clic para abrir el video en una nueva pestaña" : undefined}
          >
            <video controls style={{ width: "100%" }} src={fileUrl}>
              Tu navegador no admite la etiqueta de video.
            </video>
          </Box>
        );
      case "AUDIO":
        if (!fileUrl) {
          return (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 100,
                bgcolor: "grey.100",
                borderRadius: 0.5,
              }}
            >
              <Typography color="text.secondary">
                Archivo de audio no disponible
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            sx={{
              width: "100%",
              maxWidth: "600px",
              mx: "auto",
              cursor: isClickable ? "pointer" : "default",
              "&:hover": isClickable
                ? {
                    boxShadow: 2,
                    borderRadius: 0.5,
                  }
                : {},
            }}
            onClick={isClickable ? handleContentClick : undefined}
            title={isClickable ? "Haz clic para abrir el audio en una nueva pestaña" : undefined}
          >
            <audio controls style={{ width: "100%" }} src={fileUrl}>
              Tu navegador no admite la etiqueta de audio.
            </audio>
          </Box>
        );
      case "TEXT":
        if (contentData.file_details?.extracted_text) {
          return (
            <Box
              sx={{
                width: "100%",
                maxWidth: "800px",
                mx: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                p: 2,
                bgcolor: "grey.50",
                borderRadius: 0.5,
                border: "1px solid",
                borderColor: "divider",
                cursor: isClickable ? "pointer" : "default",
                "&:hover": isClickable
                  ? {
                      boxShadow: 2,
                      borderColor: "primary.main",
                    }
                  : {},
              }}
              onClick={isClickable ? handleContentClick : undefined}
              title={isClickable ? "Haz clic para abrir el archivo en una nueva pestaña" : undefined}
            >
              {contentData.file_details.extracted_text}
            </Box>
          );
        } else if (url) {
          return (
            <Box
              sx={{
                width: "100%",
                maxWidth: "800px",
                mx: "auto",
                p: 2,
                bgcolor: "grey.50",
                borderRadius: 0.5,
                border: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                "&:hover": {
                  boxShadow: 2,
                  borderColor: "primary.main",
                  bgcolor: "grey.100",
                },
              }}
              onClick={handleContentClick}
              title="Haz clic para abrir la URL en una nueva pestaña"
            >
              <Typography variant="body1" color="text.primary">
                Contenido URL:{" "}
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    color: "primary.main",
                    textDecoration: "none"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {url}
                </a>
              </Typography>
            </Box>
          );
        } else {
          return (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 100,
                bgcolor: "grey.100",
                borderRadius: 0.5,
              }}
            >
              <Typography color="text.secondary">
                No hay contenido de texto disponible
              </Typography>
            </Box>
          );
        }
      default:
        return (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: 100,
              bgcolor: "grey.100",
              borderRadius: 1,
            }}
          >
            <Typography color="text.secondary">
              Tipo de medio no soportado: {mediaTypeUpper}
            </Typography>
          </Box>
        );
    }
  };

  const renderMetadataSection = () => {
    if (variant === "detailed") {
      return (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom color="text.secondary">
            Detalles del contenido
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr", // Single column on mobile
                md: "1fr 1fr", // Two columns on medium+ screens
              },
              gap: 3,
              mt: 2,
            }}
          >
            {/* File Information */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Información del archivo
              </Typography>
              <Stack spacing={1}>
                {fileDetails?.file && (
                  <Box
                    sx={{
                      display: {
                        xs: "block", // mobile (default)
                        md: "flex", // from md and up
                      },
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <StorageIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">Archivo:</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        window.open(resolveMediaUrl(fileDetails.url ?? fileDetails.file), "_blank")
                      }
                      sx={{ ml: 1 }}
                    >
                      Descargar archivo
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          resolveMediaUrl(fileDetails.url ?? fileDetails.file)
                        )
                      }
                    >
                      Copiar URL
                    </Button>
                  </Box>
                )}

                {/* Only show URL for URL-based content (when there's no file) */}
                {url && !fileDetails?.file && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <LinkIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">URL:</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => window.open(url, "_blank")}
                      sx={{ ml: 1 }}
                    >
                      Abrir URL
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      Copiar URL
                    </Button>
                  </Box>
                )}

                {fileDetails?.file_size && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <StorageIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">
                      Tamaño del archivo:{" "}
                      {(fileDetails.file_size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Box>
                )}

                {fileDetails?.text_length && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <DescriptionIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">
                      Longitud del texto: {fileDetails.text_length.toLocaleString()}{" "}
                      caracteres
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Shared By */}
            {profile?.user_username && (
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Compartido por
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PersonIcon fontSize="small" color="action" />
                  {profile?.user ? (
                    <Link
                      to={`/profiles/user_profile/${profile.user}`}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="primary"
                        sx={{
                          "&:hover": {
                            textDecoration: "underline",
                          },
                        }}
                      >
                        {profile.user_username}
                      </Typography>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.primary">
                      {profile.user_username}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {/* Creation Date */}
            {contentData.created_at && (
              <Tooltip title="Creado el" arrow>
                <Box 
                  sx={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 1,
                    cursor: "help",
                    width: "fit-content"
                  }}
                >
                  <CalendarTodayIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.primary">
                    {formatDate(contentData.created_at)}
                  </Typography>
                </Box>
              </Tooltip>
            )}

            {/* Vote Information */}
            {contentData.vote_count !== undefined && (
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Participación
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ThumbUpIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">
                      Votos: {contentData.vote_count}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
          </Box>
        </Box>
      );
    }
    return null;
  };

  const renderOpenGraphSection = () => {
    if (variant === "detailed" && fileDetails) {
      const hasOGData =
        fileDetails.og_description ||
        fileDetails.og_image ||
        fileDetails.og_site_name ||
        fileDetails.og_type;

      if (hasOGData) {
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              Información del sitio web
            </Typography>
            <Stack spacing={2}>
              {fileDetails.og_type && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Tipo:
                  </Typography>
                  <Typography variant="body1" color="text.primary">{fileDetails.og_type}</Typography>
                </Box>
              )}

              {fileDetails.og_site_name && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Sitio:
                  </Typography>
                  <Typography variant="body1" color="text.primary">
                    {fileDetails.og_site_name}
                  </Typography>
                </Box>
              )}

              {fileDetails.og_description && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Descripción:
                  </Typography>
                  <Typography variant="body1" color="text.primary">
                    {fileDetails.og_description}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        );
      }
    }
    return null;
  };

  const renderContent = () => {
    try {
      if (renderError) {
        return (
          <Typography color="error" align="center" sx={{ p: 2 }}>
            {renderError}
          </Typography>
        );
      }

      switch (variant) {
        case "simple":
          return (
            <Box
              sx={{
                p: 1,
                "&:hover": { bgcolor: "action.hover" },
                cursor: onClick ? "pointer" : "default",
                borderRadius: 0.5,
                position: "relative",
              }}
              onClick={onClick}
            >
              {/* Remove button in top-left corner */}
              {onRemove && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  sx={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    zIndex: 10,
                    bgcolor: "background.paper",
                    color: "text.primary",
                    boxShadow: 1,
                    "&:hover": {
                      bgcolor: "error.main",
                      color: "error.contrastText",
                    },
                    width: 24,
                    height: 24,
                  }}
                  aria-label="Quitar contenido"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "background.default",
                  }}
                >
                  {getMediaTypeIcon(content)}
                </Box>
                <Box sx={{ overflow: "hidden", flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    noWrap
                    sx={{
                      color: "text.primary",
                      fontWeight: "medium",
                    }}
                  >
                    {title}
                  </Typography>
                  {author && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ fontSize: "0.8rem", mb: 0.5 }}
                    >
                      Por {author}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    {contentData.media_type}
                  </Typography>
                </Box>
                {showActions && additionalActions && (
                  <Box onClick={(e) => e.stopPropagation()}>
                    {additionalActions}
                  </Box>
                )}
              </Box>
            </Box>
          );

        case "preview":
          // Fallback for malformed content data
          if (!content || typeof content !== "object") {
            return (
              <Box
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "error.main",
                  borderRadius: 0.5,
                  backgroundColor: "error.light",
                  color: "error.contrastText",
                }}
              >
                <Typography variant="body2" color="text.primary">
                  Datos de contenido inválidos proporcionados
                </Typography>
              </Box>
            );
          }

          return (
            <Box
              onClick={(e) => {
                // Handle clicks for different content types
                if (onClick) {
                  onClick(e);
                  return;
                }

                // Don't trigger if clicking on action buttons
                if (e.target.closest("[data-action-button]")) {
                  return;
                }

                // Handle different content types
                if (url) {
                  // URL-based content - open the URL
                  window.open(url, "_blank");
                } else if (fileDetails?.file) {
                  // File-based content - open the file
                  const fileUrl = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
                  if (fileUrl) {
                    window.open(fileUrl, "_blank");
                  }
                }
              }}
              title={
                url
                  ? "Haz clic para abrir el enlace en una nueva pestaña"
                  : fileDetails?.file
                  ? "Haz clic para abrir el archivo en una nueva pestaña"
                  : "Haz clic para ver el contenido"
              }
              sx={{
                cursor: "pointer",
                display: "flex",
                flexDirection: {
                  xs: "column", // Stack vertically on mobile
                  sm: "row",    // Side by side on small screens and up
                },
                alignItems: {
                  xs: "stretch", // Stretch to full width on mobile
                  sm: "flex-start", // Align to start on larger screens
                },
                gap: {
                  xs: 2, // Smaller gap on mobile
                  sm: 2, // Standard gap on larger screens
                },
                p: {
                  xs: 1.5, // Less padding on mobile
                  sm: 2,   // Standard padding on larger screens
                },
                "&:hover": {
                  backgroundColor: "action.hover",
                  borderRadius: 0.5,
                  boxShadow: 2,
                },
                position: "relative",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0.5,
                minHeight: 100,
                transition: "all 0.2s ease-in-out",
                backgroundColor: "background.paper",
              }}
            >
              {/* Media Preview Section */}
              <Box
                sx={{
                  width: {
                    xs: "100%",     // Full width on mobile
                    sm: 160,        // Fixed width on larger screens
                  },
                  height: {
                    xs: 200,        // Taller on mobile for better proportions
                    sm: 160,        // Standard height on larger screens
                  },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "background.default",
                  borderRadius: 0.5,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  flexShrink: 0,
                  boxShadow: 1,
                  "& img": {
                    transition: "transform 0.2s ease-in-out",
                    cursor: "pointer",
                  },
                  "&:hover img": {
                    transform: "scale(1.05)",
                  },
                }}
              >
                {(() => {
                  // Priority order: 1) file image, 2) og_image, 3) favicon, 4) media type icon

                  // 1. Check if content has a file that is an image
                  const isImage =
                    contentData.media_type?.toUpperCase() === "IMAGE";
                  const hasImageFile = isImage && fileDetails?.file;

                  if (hasImageFile) {
                    const imageSrc = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
                    return (
                      <img
                        src={imageSrc}
                        alt={title || "Content image"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={() => setImageLoadError(true)}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open the image in new tab when clicked
                          window.open(imageSrc, "_blank");
                        }}
                      />
                    );
                  }

                  // 2. Check for Open Graph image
                  if (fileDetails?.og_image && !imageLoadError) {
                    return (
                      <img
                        src={fileDetails.og_image}
                        alt="Website preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={() => setImageLoadError(true)}
                      />
                    );
                  }

                  // 3. Check for favicon
                  if (favicon && !imageLoadError) {
                    return (
                      <img
                        src={favicon}
                        alt="Site favicon"
                        style={{
                          width: "32px",
                          height: "32px",
                          objectFit: "contain",
                        }}
                        onError={() => setImageLoadError(true)}
                      />
                    );
                  }

                  // 4. Fallback to media type icon
                  return getMediaTypeIcon(contentData);
                })()}
              </Box>

              {/* Content Information Section */}
              <Box sx={{ 
                flex: 1, 
                minWidth: 0,
                // Ensure content takes full width on mobile
                width: {
                  xs: "100%",
                  sm: "auto",
                }
              }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: "medium",
                    color: "text.primary",
                    mb: 0.5,
                    fontSize: {
                      xs: "1rem",    // Slightly smaller on mobile
                      sm: "1.1rem",  // Standard size on larger screens
                    },
                  }}
                >
                  {title || "Contenido sin título"}
                </Typography>

                {showAuthor && author && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    By {author}
                  </Typography>
                )}

                {/* Open Graph Description */}
                {fileDetails?.og_description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: {
                        xs: 3,  // Show more lines on mobile
                        sm: 2,  // Standard 2 lines on larger screens
                      },
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.4,
                    }}
                  >
                    {fileDetails.og_description}
                  </Typography>
                )}

                {/* Personal Note */}
                {profile?.personal_note && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 1,
                      fontStyle: "italic",
                      display: "-webkit-box",
                      WebkitLineClamp: {
                        xs: 3,  // Show more lines on mobile
                        sm: 2,  // Standard 2 lines on larger screens
                      },
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.4,
                    }}
                  >
                    "{profile.personal_note}"
                  </Typography>
                )}

                {/* Metadata Row */}
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    alignItems: "center",
                    mt: 1,
                    // Ensure chips don't overflow on mobile
                    "& .MuiChip-root": {
                      fontSize: {
                        xs: "0.75rem",
                        sm: "0.875rem",
                      },
                    },
                  }}
                >
                  {/* Media Type Badge */}
                  <Chip
                    label={contentData.media_type || "UNKNOWN"}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />

                  {/* Date - Priority: file upload date > content creation date */}
                  {(fileDetails?.uploaded_at || contentData.created_at) && (
                    <Chip
                      icon={<CalendarTodayIcon />}
                      label={formatDate(
                        fileDetails?.uploaded_at || contentData.created_at
                      )}
                      size="small"
                      variant="outlined"
                    />
                  )}

                  {/* Site Name for URLs */}
                  {fileDetails?.og_site_name && (
                    <Chip
                      label={fileDetails.og_site_name}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  )}

                  {/* URL Indicator */}
                  {url && (
                    <Chip
                      icon={<LinkIcon />}
                      label="URL"
                      size="small"
                      variant="outlined"
                      color="info"
                    />
                  )}
                </Box>
              </Box>

              {/* Additional Actions */}
              {additionalActions && (
                <Box
                  sx={{ 
                    flexShrink: 0, 
                    alignSelf: {
                      xs: "stretch",    // Full width on mobile
                      sm: "flex-start", // Auto width on larger screens
                    },
                    // Position actions below content on mobile
                    order: {
                      xs: 3,  // After content on mobile
                      sm: 2,  // After image on larger screens
                    },
                  }}
                  data-action-button
                >
                  {additionalActions}
                </Box>
              )}

              {/* Details Link */}
              <Box
                sx={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  zIndex: 1,
                  // Hide on very small screens to avoid overlap
                  display: {
                    xs: "none",
                    sm: "block",
                  },
                }}
                data-action-button
              >
                <Tooltip title="Ver detalles">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to ContentDetailsLibrary with the content ID
                      const contentId = contentData.id || content.id;
                      navigate(`/content/${contentId}/library`);
                    }}
                    sx={{
                      bgcolor: "background.paper",
                      color: "text.secondary",
                      "&:hover": {
                        bgcolor: "action.hover",
                        color: "text.primary",
                      },
                    }}
                  >
                    <SearchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );

        case "card":
          // Function to handle card clicks when no onClick prop is provided
          const handleCardClick = (e) => {
            if (onClick) {
              onClick(e);
              return;
            }

            // Fallback: open file or URL in new tab
            if (url) {
              window.open(url, "_blank");
            } else if (fileDetails?.file || fileDetails?.url) {
              const fileUrl = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
              if (fileUrl) {
                window.open(fileUrl, "_blank");
              }
            }
          };

          return (
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
                position: "relative",
                "&:hover": {
                  boxShadow: 3,
                  transform: "translateY(-2px)",
                  transition: "all 0.2s ease-in-out",
                },
              }}
              onClick={handleCardClick}
              title={
                url
                  ? "Haz clic para abrir el enlace en una nueva pestaña"
                  : fileDetails?.file
                  ? "Haz clic para abrir el archivo en una nueva pestaña"
                  : "Haz clic para ver el contenido"
              }
            >
              <CardMedia
                component="div"
                sx={{
                  height: {
                    xs: 180,  // Taller on mobile for better proportions
                    sm: 140,  // Standard height on larger screens
                  },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "background.paper",
                }}
              >
                {(() => {
                  // Priority order: 1) file image, 2) og_image, 3) favicon, 4) media type icon

                  // 1. Check if content has a file that is an image
                  const isImage =
                    contentData.media_type?.toUpperCase() === "IMAGE";
                  const hasImageFile = isImage && fileDetails?.file;

                  if (hasImageFile) {
                    const imageSrc = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
                    return (
                      <img
                        src={imageSrc}
                        alt={title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          console.log("Image failed to load:", imageSrc);
                          e.target.style.display = "none";
                        }}
                      />
                    );
                  }

                  // 2. Check for Open Graph image
                  if (fileDetails?.og_image && !imageLoadError) {
                    return (
                      <img
                        src={fileDetails.og_image}
                        alt="Website preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={() => setImageLoadError(true)}
                      />
                    );
                  }

                  // 3. Check for favicon
                  if (favicon && !imageLoadError) {
                    return (
                      <img
                        src={favicon}
                        alt="Site favicon"
                        style={{
                          width: "32px",
                          height: "32px",
                          objectFit: "contain",
                        }}
                        onError={() => setImageLoadError(true)}
                      />
                    );
                  }

                  // 4. Fallback to media type icon
                  return getMediaTypeIcon(contentData);
                })()}
              </CardMedia>
              <CardContent sx={{ 
                flexGrow: 1,
                p: {
                  xs: 1.5,  // Less padding on mobile
                  sm: 2,    // Standard padding on larger screens
                },
              }}>
                <Typography 
                  gutterBottom 
                  variant="h6" 
                  component="div"
                  color="text.primary"
                  sx={{
                    fontSize: {
                      xs: "1.1rem",  // Slightly smaller on mobile
                      sm: "1.25rem",  // Standard size on larger screens
                    },
                  }}
                >
                  {title}
                </Typography>
                {showAuthor && author && (
                  <Typography variant="body2" color="text.secondary">
                    By {author}
                  </Typography>
                )}
                {profile?.user_username && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1, fontStyle: "italic" }}
                  >
                    {profile.user_username}
                  </Typography>
                )}
                {profile?.personal_note && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {profile.personal_note}
                  </Typography>
                )}

                {/* Card Metadata */}
                <Box sx={{ 
                  mt: 2, 
                  display: "flex", 
                  flexWrap: "wrap", 
                  gap: 1,
                  "& .MuiChip-root": {
                    fontSize: {
                      xs: "0.75rem",
                      sm: "0.875rem",
                    },
                  },
                }}>
                  {/* Date - Priority: file upload date > content creation date */}
                  {(fileDetails?.uploaded_at || contentData.created_at) && (
                    <Chip
                      icon={<CalendarTodayIcon />}
                      label={formatDate(
                        fileDetails?.uploaded_at || contentData.created_at
                      )}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {profile?.collection_name && (
                    <Chip
                      icon={<FolderIcon />}
                      label={profile.collection_name}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </CardContent>
              {showActions && (
                <CardActions sx={{
                  p: {
                    xs: 1.5,  // Less padding on mobile
                    sm: 2,    // Standard padding on larger screens
                  },
                }}>
                  {onEdit && (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(e);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(e);
                      }}
                    >
                      Eliminar
                    </Button>
                  )}
                  {additionalActions && (
                    <Box onClick={(e) => e.stopPropagation()}>
                      {additionalActions}
                    </Box>
                  )}
                </CardActions>
              )}
            </Card>
          );

        case "detailed":
          return (
            <Paper
              variant="outlined"
              sx={{ p: 2, bgcolor: "background.default", position: "relative" }}
            >
              <Box>
                <Typography variant="h6" gutterBottom color="text.primary">
                  {title}
                </Typography>
                {showAuthor && author && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    By {author}
                  </Typography>
                )}

                {/* Original Content Information */}
                {(contentData.original_title !== title ||
                  contentData.original_author !== author) && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: "grey.50",
                      borderRadius: 0.5,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {contentData.original_author && (
                      <Typography variant="body2" color="text.primary">
                        <strong>autor original:</strong>{" "}
                        {contentData.original_author}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {renderContentByType()}

              {/* Personal Note */}
              {profile?.personal_note && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom color="text.secondary">
                    Notas personales
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }} color="text.primary">
                      {profile.personal_note}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Metadata Section */}
              {renderMetadataSection()}

              {/* Open Graph Section */}
              {renderOpenGraphSection()}

              {showActions && (
                <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {onEdit && (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(e);
                      }}
                    >
                      Cambiar contenido
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(e);
                      }}
                    >
                      Eliminar
                    </Button>
                  )}
                  {additionalActions && (
                    <Box onClick={(e) => e.stopPropagation()}>
                      {additionalActions}
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          );

        default:
          return (
            <Typography color="error" align="center" sx={{ p: 2 }}>
              Variante desconocida: {variant}
            </Typography>
          );
      }
    } catch (error) {
      console.error("Error in renderContent:", error);
      return (
        <Typography color="error" align="center" sx={{ p: 2 }}>
          Error al renderizar el contenido: {error.message}
        </Typography>
      );
    }
  };

  try {
    return renderContent();
  } catch (error) {
    console.error("Fatal error in ContentDisplay:", error);
    return (
      <Typography color="error" align="center" sx={{ p: 2 }}>
        Error al mostrar el contenido: {error.message}
      </Typography>
    );
  }
};

export default ContentDisplay;
