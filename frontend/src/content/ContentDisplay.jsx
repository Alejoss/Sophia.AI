import React, { useState } from "react";
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
  Snackbar,
  Alert } from
"@mui/material";
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
import VoteComponent from "../votes/VoteComponent";
import {
  SequentialThumbnail,
  buildListingThumbnailSources,
  buildMediaPreviewThumbnailSources } from
"./ContentListingThumbnail";

const ContentDisplay = ({
  content,
  variant = "simple", // 'simple', 'preview', 'card', 'detailed'
  showActions = false,
  onRemove,
  onEdit,
  onClick,
  maxImageHeight = 300,
  showAuthor = true,
  showTitle = true,
  additionalActions,
  topicId = null,
  showSuggestFileButton = false,
  onSuggestFile = null
}) => {
  const [renderError, setRenderError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success"
  });
  const navigate = useNavigate();

  if (!content) {
    return null;
  }

  // Get appropriate data from either content or content_profile
  const profile = content.selected_profile || content;
  const title = profile.title || content.original_title || "Sin título";
  const author = profile.author || content.original_author;

  // For preview mode, expect the PreviewContentProfileSerializer structure
  // which has a nested 'content' field. Merge file_details from root when API flattens them.
  const contentData = content.content || content;
  const mediaType = contentData.media_type || "";
  const fileDetails = content.file_details || contentData.file_details;
  /** External page URL (YouTube, etc.). Never use file_details.url here — the API sets that to the storage file URL. */
  const contentExternalUrl = content.url ?? contentData?.url ?? null;
  const favicon = contentData.favicon;
  const selectedProfileThumbnail = content?.selected_profile?.thumbnail;
  const selectedProfileThumbnailPreview = content?.selected_profile?.thumbnail_preview;
  const previewProfileThumbnail = content?.thumbnail;
  const previewProfileThumbnailPreview = content?.thumbnail_preview;
  const customThumbnail = selectedProfileThumbnail || previewProfileThumbnail;
  /** Downsized WebP when available; falls back to full custom thumbnail or OG. */
  const customThumbnailForDisplay =
  selectedProfileThumbnailPreview ||
  previewProfileThumbnailPreview ||
  customThumbnail;
  const hasFileAvailable = Boolean(
    fileDetails?.file || content?.has_file_available || contentData?.has_file_available
  );

  // Debug logging for preview mode (moved after variable declarations)


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

  const formatDateTime = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      console.error("Error formatting datetime:", error);
      return null;
    }
  };

  /** Friendly site name for "Copiar URL - YouTube" style labels (from full or partial URL). */
  const getSourceSiteLabel = (urlString) => {
    if (!urlString || typeof urlString !== "string") return "Origen";
    const trimmed = urlString.trim();
    if (!trimmed) return "Origen";
    try {
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const hostname = new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
      const map = {
        "youtube.com": "YouTube",
        "youtu.be": "YouTube",
        "m.youtube.com": "YouTube",
        "vimeo.com": "Vimeo",
        "player.vimeo.com": "Vimeo",
        "dailymotion.com": "Dailymotion",
        "dai.ly": "Dailymotion",
        "facebook.com": "Facebook",
        "fb.watch": "Facebook",
        "instagram.com": "Instagram",
        "twitter.com": "X",
        "x.com": "X",
        "soundcloud.com": "SoundCloud",
        "spotify.com": "Spotify",
        "open.spotify.com": "Spotify",
        "archive.org": "Internet Archive",
        "drive.google.com": "Google Drive",
        "docs.google.com": "Google Docs",
        "twitch.tv": "Twitch",
        "tiktok.com": "TikTok"
      };
      if (map[hostname]) return map[hostname];
      const parts = hostname.split(".").filter(Boolean);
      const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || hostname;
      if (!base) return "Origen";
      return base.charAt(0).toUpperCase() + base.slice(1);
    } catch {
      return "Origen";
    }
  };

  const getCopyUrlTarget = () => {
    const external = contentExternalUrl && String(contentExternalUrl).trim();
    if (external) return resolveMediaUrl(external);
    if (fileDetails?.file) {
      return resolveMediaUrl(fileDetails.file);
    }
    return null;
  };

  const renderMediaTypeRow = () => {
    const mt = (contentData.media_type || "").toUpperCase();
    const labels = {
      VIDEO: "Video",
      AUDIO: "Audio",
      IMAGE: "Imagen",
      TEXT: "Texto"
    };
    const label = labels[mt] || (mt ? mt.charAt(0) + mt.slice(1).toLowerCase() : "Contenido");
    const iconSx = { fontSize: 28, color: "primary.main", opacity: 0.9 };
    let icon = <DescriptionIcon sx={iconSx} />;
    if (mt === "VIDEO") icon = <VideocamIcon sx={iconSx} />;else
    if (mt === "AUDIO") icon = <AudiotrackIcon sx={iconSx} />;else
    if (mt === "IMAGE") icon = <ImageIcon sx={iconSx} />;else
    if (mt === "TEXT")
    icon = contentExternalUrl ? <LinkIcon sx={iconSx} /> : <ArticleIcon sx={iconSx} />;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          py: 0.75,
          px: 1,
          borderRadius: 1,
          bgcolor: "action.hover",
          width: "fit-content",
          maxWidth: "100%"
        }}>
        
        {icon}
        <Typography variant="body2" fontWeight={600} color="text.primary">
          {label}
        </Typography>
      </Box>);

  };

  const getFileUrlFromContent = () => {
    try {
      if (fileDetails?.file) {
        return resolveMediaUrl(fileDetails.url ?? fileDetails.file);
      }
      const external = contentExternalUrl && String(contentExternalUrl).trim();
      if (external) return resolveMediaUrl(external);
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
      sx: { opacity: 0.7, color: "text.secondary" }
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

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCopyUrl = async (valueToCopy) => {
    if (!valueToCopy) {
      showSnackbar("No hay URL para copiar", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(valueToCopy);
      showSnackbar("URL copiada al portapapeles", "success");
    } catch (error) {
      console.error("Failed to copy URL:", error);
      showSnackbar("No se pudo copiar la URL", "error");
    }
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const renderContentByType = () => {
    const mediaTypeUpper = contentData.media_type?.toUpperCase();
    const fileUrl = getFileUrlFromContent();

    // Debug logging for detailed mode


    // Function to handle content clicks
    const handleContentClick = () => {
      if (fileUrl) window.open(fileUrl, "_blank");
    };

    // Check if content is clickable
    const isClickable = Boolean(fileUrl);

    switch (mediaTypeUpper) {
      case "IMAGE":{
          const thumbUrl = customThumbnailForDisplay || fileUrl;
          if (!thumbUrl) {
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
                  borderRadius: 0.5
                }}>
                
              <Typography color="text.secondary">
                Archivo de imagen no disponible
              </Typography>
            </Box>);

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
                "&:hover": isClickable ?
                {
                  boxShadow: 2,
                  borderColor: "primary.main"
                } :
                {}
              }}
              onClick={isClickable ? handleContentClick : undefined}
              title={isClickable ? "Haz clic para abrir la imagen en una nueva pestaña" : undefined}>
              
            <img
                src={thumbUrl}
                alt={title || contentData.original_title || "Content image"}
                loading={variant === "detailed" ? "eager" : "lazy"}
                fetchPriority={variant === "detailed" ? "high" : undefined}
                style={{
                  maxWidth: "100%",
                  maxHeight: maxImageHeight,
                  objectFit: "contain"
                }}
                onError={(e) => {
                  console.error(
                    "Image failed to load in detailed mode:",
                    thumbUrl
                  );
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }} />
              
            <Box
                sx={{
                  display: "none",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                  height: 200,
                  bgcolor: "grey.100",
                  color: "text.secondary"
                }}>
                
              <Typography color="text.primary">Error al cargar la imagen</Typography>
            </Box>
          </Box>);

        }
      case "VIDEO":
        if (!fileUrl || !fileDetails?.file) {
          const previewSources = buildMediaPreviewThumbnailSources({
            customThumbnailForDisplay,
            ogImage: fileDetails?.og_image,
            mediaType: mediaTypeUpper
          });
          if (previewSources.length > 0) {
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
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider"
                }}>
                
                <SequentialThumbnail
                  sources={previewSources}
                  loading={variant === "detailed" ? "eager" : "lazy"}
                  fetchPriority={variant === "detailed" ? "high" : undefined}
                  fallback={
                  <Typography color="text.secondary">
                      Archivo de video no disponible
                    </Typography>
                  } />
                
              </Box>);

          }
          return (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 200,
                bgcolor: "grey.100",
                borderRadius: 0.5
              }}>
              
              <Typography color="text.secondary">
                Archivo de video no disponible
              </Typography>
            </Box>);

        }

        return (
          <Box
            sx={{
              width: "100%",
              maxWidth: "800px",
              mx: "auto"
            }}>
            
            <video controls style={{ width: "100%" }} src={fileUrl}>
              Tu navegador no admite la etiqueta de video.
            </video>
          </Box>);

      case "AUDIO":
        if (!fileUrl || !fileDetails?.file) {
          const previewSources = buildMediaPreviewThumbnailSources({
            customThumbnailForDisplay,
            ogImage: fileDetails?.og_image,
            mediaType: mediaTypeUpper
          });
          if (previewSources.length > 0) {
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
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider"
                }}>
                
                <SequentialThumbnail
                  sources={previewSources}
                  loading={variant === "detailed" ? "eager" : "lazy"}
                  fetchPriority={variant === "detailed" ? "high" : undefined}
                  fallback={
                  <Typography color="text.secondary">
                      Archivo de audio no disponible
                    </Typography>
                  } />
                
              </Box>);

          }
          return (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: 100,
                bgcolor: "grey.100",
                borderRadius: 0.5
              }}>
              
              <Typography color="text.secondary">
                Archivo de audio no disponible
              </Typography>
            </Box>);

        }

        return (
          <Box
            sx={{
              width: "100%",
              maxWidth: "600px",
              mx: "auto"
            }}>
            
            <audio controls style={{ width: "100%" }} src={fileUrl}>
              Tu navegador no admite la etiqueta de audio.
            </audio>
          </Box>);

      case "TEXT":
        if (contentExternalUrl && String(contentExternalUrl).trim()) {
          const resolvedExternal = resolveMediaUrl(contentExternalUrl);
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
                  bgcolor: "grey.100"
                }
              }}
              onClick={() => window.open(resolvedExternal, "_blank")}
              title="Haz clic para abrir la URL en una nueva pestaña">
              
              <Typography variant="body1" color="text.primary">
                Contenido URL:{" "}
                <a
                  href={resolvedExternal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "primary.main",
                    textDecoration: "none"
                  }}
                  onClick={(e) => e.stopPropagation()}>
                  
                  {contentExternalUrl}
                </a>
              </Typography>
            </Box>);

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
                borderRadius: 0.5
              }}>
              
              <Typography color="text.secondary">
                No hay contenido de texto disponible
              </Typography>
            </Box>);

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
              borderRadius: 1
            }}>
            
            <Typography color="text.secondary">
              Tipo de medio no soportado: {mediaTypeUpper}
            </Typography>
          </Box>);

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
                md: "1fr 1fr" // Two columns on medium+ screens
              },
              gap: 3,
              mt: 2
            }}>
            
            {/* File Information */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom>
                
                Información del archivo
              </Typography>
              <Stack spacing={1.5}>
                {renderMediaTypeRow()}

                {!hasFileAvailable &&
                <Typography variant="body2" color="text.secondary">
                    {contentExternalUrl && String(contentExternalUrl).trim() ?
                  "No hay archivo descargable relacionado; solo enlace externo." :
                  "No hay archivo relacionado."}
                  </Typography>
                }

                {fileDetails?.file &&
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 1
                  }}>
                  
                    <StorageIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">
                      Archivo:
                    </Typography>
                    <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                    window.open(resolveMediaUrl(fileDetails.url ?? fileDetails.file), "_blank")
                    }>
                    
                      Descargar archivo
                    </Button>
                  </Box>
                }

                {hasFileAvailable && fileDetails?.file_size != null && Number.isFinite(Number(fileDetails.file_size)) &&
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <StorageIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">
                      Tamaño del archivo:{" "}
                      {Number(fileDetails.file_size) === 0 ?
                    "0 bytes" :
                    formatFileSize(Number(fileDetails.file_size))}
                    </Typography>
                  </Box>
                }

                {profile?.created_at &&
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.primary">
                      Perfil creado el: {formatDateTime(profile.created_at)}
                    </Typography>
                  </Box>
                }

                {(() => {
                  const copyTarget = getCopyUrlTarget();
                  if (!copyTarget) return null;
                  const site = getSourceSiteLabel(copyTarget);
                  return (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexWrap: "wrap"
                      }}>
                      
                      <LinkIcon fontSize="small" color="action" />
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleCopyUrl(copyTarget)}
                        sx={{ textTransform: "none" }}>
                        
                        {`Copiar URL - ${site}`}
                      </Button>
                    </Box>);

                })()}
              </Stack>
            </Box>

            {/* Shared By */}
            {profile?.user_username &&
            <Box>
                <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom>
                
                  Compartido por
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PersonIcon fontSize="small" color="action" />
                  {profile?.user ?
                <Link
                  to={`/profiles/user_profile/${profile.user}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit"
                  }}>
                  
                      <Typography
                    variant="body2"
                    color="primary"
                    sx={{
                      "&:hover": {
                        textDecoration: "underline"
                      }
                    }}>
                    
                        {profile.user_username}
                      </Typography>
                    </Link> :

                <Typography variant="body2" color="text.primary">
                      {profile.user_username}
                    </Typography>
                }
                </Box>
              </Box>
            }

            {/* Vote Information */}
            {contentData.vote_count !== undefined &&
            <Box>
                <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom>
                
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
            }

            {(contentData.has_spanish_subtitles || contentData.has_spanish_dubbing) &&
            <Box>
                <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom>
                
                  Accesibilidad en español
                </Typography>
                <Stack spacing={1}>
                  {contentData.has_spanish_subtitles &&
                <Typography variant="body2" color="text.primary">
                      Subtitulado en español
                    </Typography>
                }
                  {contentData.has_spanish_dubbing &&
                <Typography variant="body2" color="text.primary">
                      Doblado al español
                    </Typography>
                }
                </Stack>
              </Box>
            }
          </Box>
        </Box>);

    }
    return null;
  };

  const renderContent = () => {
    try {
      if (renderError) {
        return (
          <Typography color="error" align="center" sx={{ p: 2 }}>
            {renderError}
          </Typography>);

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
                position: "relative"
              }}
              onClick={onClick}>
              
              {/* Remove button in top-left corner */}
              {onRemove &&
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
                    color: "error.contrastText"
                  },
                  width: 24,
                  height: 24
                }}
                aria-label="Quitar contenido">
                
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "background.default"
                  }}>
                  
                  {getMediaTypeIcon(content)}
                </Box>
                <Box sx={{ overflow: "hidden", flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    noWrap
                    sx={{
                      color: "text.primary",
                      fontWeight: "medium"
                    }}>
                    
                    {title}
                  </Typography>
                  {author &&
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    noWrap
                    sx={{ fontSize: "0.8rem", mb: 0.5 }}>
                    
                      Por {author}
                    </Typography>
                  }
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}>
                    
                    {contentData.media_type}
                  </Typography>
                </Box>
                {showActions && additionalActions &&
                <Box onClick={(e) => e.stopPropagation()}>
                    {additionalActions}
                  </Box>
                }
              </Box>
            </Box>);


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
                  color: "error.contrastText"
                }}>
                
                <Typography variant="body2" color="text.primary">
                  Datos de contenido inválidos proporcionados
                </Typography>
              </Box>);

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

                // Prefer canonical content URL; otherwise open stored file
                if (contentExternalUrl && String(contentExternalUrl).trim()) {
                  window.open(resolveMediaUrl(contentExternalUrl), "_blank");
                } else if (fileDetails?.file) {
                  const fileUrl = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
                  if (fileUrl) {
                    window.open(fileUrl, "_blank");
                  }
                }
              }}
              title={
              contentExternalUrl && String(contentExternalUrl).trim() ?
              "Haz clic para abrir el enlace en una nueva pestaña" :
              fileDetails?.file ?
              "Haz clic para abrir el archivo en una nueva pestaña" :
              "Haz clic para ver el contenido"
              }
              sx={{
                cursor: "pointer",
                display: "flex",
                flexDirection: {
                  xs: "column", // Stack vertically on mobile
                  sm: "row" // Side by side on small screens and up
                },
                alignItems: {
                  xs: "stretch", // Stretch to full width on mobile
                  sm: "flex-start" // Align to start on larger screens
                },
                gap: {
                  xs: 2, // Smaller gap on mobile
                  sm: 2 // Standard gap on larger screens
                },
                p: {
                  xs: 1.5, // Less padding on mobile
                  sm: 2 // Standard padding on larger screens
                },
                "&:hover": {
                  backgroundColor: "action.hover",
                  borderRadius: 0.5,
                  boxShadow: 2
                },
                position: "relative",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0.5,
                minHeight: 100,
                transition: "all 0.2s ease-in-out",
                backgroundColor: "background.paper"
              }}>
              
              {/* Media Preview Section */}
              <Box
                sx={{
                  width: {
                    xs: "100%", // Full width on mobile
                    sm: 160 // Fixed width on larger screens
                  },
                  height: {
                    xs: 200, // Taller on mobile for better proportions
                    sm: 160 // Standard height on larger screens
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
                    cursor: "pointer"
                  },
                  "&:hover img": {
                    transform: "scale(1.05)"
                  }
                }}>
                
                <SequentialThumbnail
                  sources={buildListingThumbnailSources({
                    customThumbnailForDisplay,
                    hasImageFile:
                    contentData.media_type?.toUpperCase() === "IMAGE" &&
                    fileDetails?.file,
                    fileDetails,
                    favicon,
                    mediaType: contentData.media_type,
                    title,
                    resolveMediaUrl
                  })}
                  fallback={getMediaTypeIcon(contentData)}
                  loading="lazy" />
                
              </Box>

              {/* Content Information Section */}
              <Box sx={{
                flex: 1,
                minWidth: 0,
                // Ensure content takes full width on mobile
                width: {
                  xs: "100%",
                  sm: "auto"
                }
              }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: "medium",
                    color: "text.primary",
                    mb: 0.5,
                    fontSize: {
                      xs: "1rem", // Slightly smaller on mobile
                      sm: "1.1rem" // Standard size on larger screens
                    }
                  }}>
                  
                  {title || "Contenido sin título"}
                </Typography>

                {showAuthor && author &&
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}>
                  
                    By {author}
                  </Typography>
                }

                {/* Open Graph Description */}
                {fileDetails?.og_description &&
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    display: "-webkit-box",
                    WebkitLineClamp: {
                      xs: 3, // Show more lines on mobile
                      sm: 2 // Standard 2 lines on larger screens
                    },
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.4
                  }}>
                  
                    {fileDetails.og_description}
                  </Typography>
                }

                {/* Personal Note */}
                {profile?.personal_note &&
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    fontStyle: "italic",
                    display: "-webkit-box",
                    WebkitLineClamp: {
                      xs: 3, // Show more lines on mobile
                      sm: 2 // Standard 2 lines on larger screens
                    },
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.4
                  }}>
                  
                    "{profile.personal_note}"
                  </Typography>
                }

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
                        sm: "0.875rem"
                      }
                    }
                  }}>
                  
                  {/* Media Type Badge */}
                  <Chip
                    label={contentData.media_type || "UNKNOWN"}
                    size="small"
                    variant="outlined"
                    color="primary" />
                  

                  {/* Date - Priority: file upload date > content creation date */}
                  {(fileDetails?.uploaded_at || contentData.created_at) &&
                  <Chip
                    icon={<CalendarTodayIcon />}
                    label={formatDate(
                      fileDetails?.uploaded_at || contentData.created_at
                    )}
                    size="small"
                    variant="outlined" />

                  }

                  {contentData.has_spanish_subtitles &&
                  <Chip
                    label="Subtitulado en español"
                    size="small"
                    variant="outlined"
                    color="success" />

                  }

                  {contentData.has_spanish_dubbing &&
                  <Chip
                    label="Doblado al español"
                    size="small"
                    variant="outlined"
                    color="success" />

                  }

                  {/* Site Name for URLs */}
                  {fileDetails?.og_site_name &&
                  <Chip
                    label={fileDetails.og_site_name}
                    size="small"
                    variant="outlined"
                    color="secondary" />

                  }

                  {/* URL Indicator (external link only, not storage file URL) */}
                  {contentExternalUrl &&
                  <Chip
                    icon={<LinkIcon />}
                    label="URL"
                    size="small"
                    variant="outlined"
                    color="info" />

                  }

                  {hasFileAvailable &&
                  <Chip
                    icon={<StorageIcon />}
                    label="Archivo Disponible"
                    size="small"
                    variant="outlined"
                    color="info" />

                  }
                </Box>
              </Box>

              {/* Additional Actions */}
              {additionalActions &&
              <Box
                sx={{
                  flexShrink: 0,
                  alignSelf: {
                    xs: "stretch", // Full width on mobile
                    sm: "flex-start" // Auto width on larger screens
                  },
                  // Position actions below content on mobile
                  order: {
                    xs: 3, // After content on mobile
                    sm: 2 // After image on larger screens
                  }
                }}
                data-action-button>
                
                  {additionalActions}
                </Box>
              }

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
                    sm: "block"
                  }
                }}
                data-action-button>
                
                <Tooltip title="Ver detalles (abre en nueva pestaña)">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      const id = contentData.id || content.id;
                      const path = `/content/${id}/library`;
                      window.open(path, '_blank', 'noopener,noreferrer');
                    }}
                    sx={{
                      bgcolor: "background.paper",
                      color: "text.secondary",
                      "&:hover": {
                        bgcolor: "action.hover",
                        color: "text.primary"
                      }
                    }}>
                    
                    <SearchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>);


        case "card":
          // Function to handle card clicks when no onClick prop is provided
          const handleCardClick = (e) => {
            if (onClick) {
              onClick(e);
              return;
            }

            // Prefer canonical content URL; otherwise open stored file
            if (contentExternalUrl && String(contentExternalUrl).trim()) {
              window.open(resolveMediaUrl(contentExternalUrl), "_blank");
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
                  transition: "all 0.2s ease-in-out"
                }
              }}
              onClick={handleCardClick}
              title={
              contentExternalUrl && String(contentExternalUrl).trim() ?
              "Haz clic para abrir el enlace en una nueva pestaña" :
              fileDetails?.file ?
              "Haz clic para abrir el archivo en una nueva pestaña" :
              "Haz clic para ver el contenido"
              }>
              
              <CardMedia
                component="div"
                sx={{
                  height: {
                    xs: 180, // Taller on mobile for better proportions
                    sm: 140 // Standard height on larger screens
                  },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "background.paper"
                }}>
                
                <SequentialThumbnail
                  sources={buildListingThumbnailSources({
                    customThumbnailForDisplay,
                    hasImageFile:
                    contentData.media_type?.toUpperCase() === "IMAGE" &&
                    fileDetails?.file,
                    fileDetails,
                    favicon,
                    mediaType: contentData.media_type,
                    title,
                    resolveMediaUrl
                  })}
                  fallback={getMediaTypeIcon(contentData)}
                  loading="lazy" />
                
              </CardMedia>
              <CardContent sx={{
                flexGrow: 1,
                p: {
                  xs: 1.5, // Less padding on mobile
                  sm: 2 // Standard padding on larger screens
                }
              }}>
                {showTitle &&
                <Typography
                  gutterBottom
                  variant="h6"
                  component="div"
                  color="text.primary"
                  sx={{
                    fontSize: {
                      xs: "1.1rem", // Slightly smaller on mobile
                      sm: "1.25rem" // Standard size on larger screens
                    }
                  }}>
                  
                    {title}
                  </Typography>
                }
                {showAuthor && author &&
                <Typography variant="body2" color="text.secondary">
                    By {author}
                  </Typography>
                }
                {profile?.user_username &&
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1, fontStyle: "italic" }}>
                  
                    {profile.user_username}
                  </Typography>
                }
                {profile?.personal_note &&
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}>
                  
                    {profile.personal_note}
                  </Typography>
                }

                {/* Card Metadata */}
                <Box sx={{
                  mt: 2,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  "& .MuiChip-root": {
                    fontSize: {
                      xs: "0.75rem",
                      sm: "0.875rem"
                    }
                  }
                }}>
                  {/* Date - Priority: file upload date > content creation date */}
                  {(fileDetails?.uploaded_at || contentData.created_at) &&
                  <Chip
                    icon={<CalendarTodayIcon />}
                    label={formatDate(
                      fileDetails?.uploaded_at || contentData.created_at
                    )}
                    size="small"
                    variant="outlined" />

                  }
                  {profile?.collection_name &&
                  <Chip
                    icon={<FolderIcon />}
                    label={profile.collection_name}
                    size="small"
                    variant="outlined" />

                  }
                </Box>
                {contentData.vote_count !== undefined && topicId &&
                <Box sx={{ display: "flex", alignItems: "center", mt: 2 }} onClick={(e) => e.stopPropagation()}>
                    <VoteComponent
                    type="content"
                    ids={{ topicId, contentId: contentData.id }}
                    initialVoteCount={contentData.vote_count ?? 0}
                    initialUserVote={contentData.user_vote ?? 0} />
                  
                  </Box>
                }
              </CardContent>
              {showActions &&
              <CardActions sx={{
                p: {
                  xs: 1.5, // Less padding on mobile
                  sm: 2 // Standard padding on larger screens
                }
              }}>
                  {onEdit &&
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(e);
                  }}>
                  
                      Editar
                    </Button>
                }
                  {onRemove &&
                <Button
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(e);
                  }}>
                  
                      Eliminar
                    </Button>
                }
                  {additionalActions &&
                <Box onClick={(e) => e.stopPropagation()}>
                      {additionalActions}
                    </Box>
                }
                </CardActions>
              }
            </Card>);


        case "detailed":
          return (
            <Paper
              variant="outlined"
              sx={{ p: 2, bgcolor: "background.default", position: "relative" }}>
              
              <Box>
                <Typography variant="h6" gutterBottom color="text.primary">
                  {title}
                </Typography>
                {showAuthor && author &&
                <Typography
                  variant="body2"
                  color="text.secondary"
                  gutterBottom>
                  
                    By {author}
                  </Typography>
                }

                {/* Original Content Information */}
                {(contentData.original_title !== title ||
                contentData.original_author !== author) &&
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: "grey.50",
                    borderRadius: 0.5,
                    border: "1px solid",
                    borderColor: "divider"
                  }}>
                  
                    {contentData.original_author &&
                  <Typography variant="body2" color="text.primary">
                        <strong>autor original:</strong>{" "}
                        {contentData.original_author}
                      </Typography>
                  }
                  </Box>
                }
              </Box>

              {renderContentByType()}

              {!hasFileAvailable && showSuggestFileButton && onSuggestFile &&
              <Box sx={{ mt: 2 }}>
                  <Button
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggestFile();
                  }}>
                  
                    Sugerir archivo
                  </Button>
                </Box>
              }

              {/* Personal Note */}
              {profile?.personal_note &&
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
              }

              {/* Metadata Section */}
              {renderMetadataSection()}

              {showActions &&
              <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {onEdit &&
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(e);
                  }}>
                  
                      Cambiar contenido
                    </Button>
                }
                  {onRemove &&
                <Button
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(e);
                  }}>
                  
                      Eliminar
                    </Button>
                }
                  {additionalActions &&
                <Box onClick={(e) => e.stopPropagation()}>
                      {additionalActions}
                    </Box>
                }
                </Box>
              }
            </Paper>);


        default:
          return (
            <Typography color="error" align="center" sx={{ p: 2 }}>
              Variante desconocida: {variant}
            </Typography>);

      }
    } catch (error) {
      console.error("Error in renderContent:", error);
      return (
        <Typography color="error" align="center" sx={{ p: 2 }}>
          Error al renderizar el contenido: {error.message}
        </Typography>);

    }
  };

  try {
    return (
      <>
        {renderContent()}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={2500}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
          
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: "100%" }}>
            
            {snackbar.message}
          </Alert>
        </Snackbar>
      </>);

  } catch (error) {
    console.error("Fatal error in ContentDisplay:", error);
    return (
      <Typography color="error" align="center" sx={{ p: 2 }}>
        Error al mostrar el contenido: {error.message}
      </Typography>);

  }
};

export default ContentDisplay;