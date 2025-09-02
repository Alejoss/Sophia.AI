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
import { useNavigate } from "react-router-dom";
import { getFileUrl } from "../utils/fileUtils";
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
  const title = profile.title || content.original_title || "Untitled";
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

  // Standardized way to get file URL from different possible structures
  const getFileUrlFromContent = () => {
    try {
      // For URL-based content, use the content URL directly
      if (url) {
        return url;
      }

      // For file-based content, get the file URL from file_details
      if (fileDetails) {
        if (fileDetails.file) {
          // Always use getFileUrl to convert relative paths to absolute URLs
          return getFileUrl(fileDetails.file);
        }
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
    const [showFallbackIcon, setShowFallbackIcon] = useState(false);

    // Handle non-URL content or non-TEXT URL content
    const mediaType = content.media_type?.toUpperCase();

    // Debug logging for PDF detection
    if (mediaType === "TEXT") {
      console.log("PDF Detection Debug:", {
        mediaType,
        hasUrl: !!content.url,
        fileDetails: content.file_details,
        filePath: content.file_details?.file,
        isPdf: content.file_details?.file?.toLowerCase().includes(".pdf"),
      });
    }

    switch (mediaType) {
      case "VIDEO":
        return <VideocamIcon {...iconProps} />;
      case "AUDIO":
        return <AudiotrackIcon {...iconProps} />;
      case "TEXT":
        if (content.url) {
          return <LinkIcon {...iconProps} />;
        }
        // Improved PDF detection - check if file path contains .pdf
        if (
          content.file_details?.file &&
          content.file_details.file.toLowerCase().includes(".pdf")
        ) {
          return <PictureAsPdfIcon {...iconProps} />;
        }
        return <ArticleIcon {...iconProps} />;
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
                borderRadius: 1,
              }}
            >
              <Typography color="text.secondary">
                Image file not available
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
            title={isClickable ? "Click to open image in new tab" : undefined}
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
              <Typography>Failed to load image</Typography>
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
                borderRadius: 1,
              }}
            >
              <Typography color="text.secondary">
                Video file not available
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
                    borderRadius: 1,
                  }
                : {},
            }}
            onClick={isClickable ? handleContentClick : undefined}
            title={isClickable ? "Click to open video in new tab" : undefined}
          >
            <video controls style={{ width: "100%" }} src={fileUrl}>
              Your browser does not support the video tag.
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
                borderRadius: 1,
              }}
            >
              <Typography color="text.secondary">
                Audio file not available
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
                    borderRadius: 1,
                  }
                : {},
            }}
            onClick={isClickable ? handleContentClick : undefined}
            title={isClickable ? "Click to open audio in new tab" : undefined}
          >
            <audio controls style={{ width: "100%" }} src={fileUrl}>
              Your browser does not support the audio tag.
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
              title={isClickable ? "Click to open file in new tab" : undefined}
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
                bgcolor: "info.light",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "info.main",
                cursor: "pointer",
                "&:hover": {
                  boxShadow: 2,
                  borderColor: "primary.main",
                },
              }}
              onClick={handleContentClick}
              title="Click to open URL in new tab"
            >
              <Typography variant="body1">
                URL Content:{" "}
                <a href={url} target="_blank" rel="noopener noreferrer">
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
                borderRadius: 1,
              }}
            >
              <Typography color="text.secondary">
                No text content available
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
              Unsupported media type: {mediaTypeUpper}
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
            Content Details
          </Typography>
          <Stack spacing={2}>
            {/* File Information */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                File Information
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
                    <Typography variant="body2">File:</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        window.open(getFileUrl(fileDetails.file), "_blank")
                      }
                      sx={{ ml: 1 }}
                    >
                      Download File
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          getFileUrl(fileDetails.file)
                        )
                      }
                    >
                      Copy URL
                    </Button>
                  </Box>
                )}

                {/* Only show URL for URL-based content (when there's no file) */}
                {url && !fileDetails?.file && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <LinkIcon fontSize="small" color="action" />
                    <Typography variant="body2">URL:</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => window.open(url, "_blank")}
                      sx={{ ml: 1 }}
                    >
                      Open URL
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      Copy URL
                    </Button>
                  </Box>
                )}

                {fileDetails?.file_size && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <StorageIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      File size:{" "}
                      {(fileDetails.file_size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Box>
                )}

                {fileDetails?.text_length && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <DescriptionIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Text length: {fileDetails.text_length.toLocaleString()}{" "}
                      characters
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Timestamps */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Timestamps
              </Typography>
              <Stack spacing={1}>
                {contentData.created_at && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Content created: {formatDate(contentData.created_at)}
                    </Typography>
                  </Box>
                )}

                {fileDetails?.uploaded_at && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      File uploaded: {formatDate(fileDetails.uploaded_at)}
                    </Typography>
                  </Box>
                )}

                {profile?.created_at && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Profile created: {formatDate(profile.created_at)}
                    </Typography>
                  </Box>
                )}

                {profile?.updated_at && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Profile updated: {formatDate(profile.updated_at)}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* User Information */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                User Information
              </Typography>
              <Stack spacing={1}>
                {profile?.user_username && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Profile owner: {profile.user_username}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Organization */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Organization
              </Typography>
              <Stack spacing={1}>
                {profile?.collection_name && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FolderIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Collection: {profile.collection_name}
                    </Typography>
                  </Box>
                )}

                {contentData.topics && contentData.topics.length > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FolderIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Associated topics: {contentData.topics.length}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Status Flags */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Status
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {profile?.is_visible ? (
                    <VisibilityIcon fontSize="small" color="success" />
                  ) : (
                    <VisibilityOffIcon fontSize="small" color="error" />
                  )}
                  <Typography variant="body2">
                    {profile?.is_visible ? "Visible" : "Hidden"} in search
                  </Typography>
                </Box>

                {profile?.is_producer && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      You are the producer
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Vote Information */}
            {contentData.vote_count !== undefined && (
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Engagement
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ThumbUpIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Votes: {contentData.vote_count}
                    </Typography>
                  </Box>

                  {contentData.user_vote !== undefined && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <ThumbUpIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        Your vote:{" "}
                        {contentData.user_vote === 1
                          ? "Upvoted"
                          : contentData.user_vote === -1
                          ? "Downvoted"
                          : "No vote"}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
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
              Website Information
            </Typography>
            <Stack spacing={2}>
              {fileDetails.og_type && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Type:
                  </Typography>
                  <Typography variant="body1">{fileDetails.og_type}</Typography>
                </Box>
              )}

              {fileDetails.og_site_name && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Site:
                  </Typography>
                  <Typography variant="body1">
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
                    Description:
                  </Typography>
                  <Typography variant="body1">
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
                borderRadius: 1,
                position: "relative",
              }}
              onClick={onClick}
            >
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
                      By {author}
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
                  borderRadius: 1,
                  backgroundColor: "error.light",
                  color: "error.contrastText",
                }}
              >
                <Typography variant="body2">
                  Invalid content data provided
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
                  const fileUrl = getFileUrl(fileDetails.file);
                  if (fileUrl) {
                    window.open(fileUrl, "_blank");
                  }
                }
              }}
              title={
                url
                  ? "Click to open link in new tab"
                  : fileDetails?.file
                  ? "Click to open file in new tab"
                  : "Click to view content"
              }
              sx={{
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 2,
                p: 2,
                "&:hover": {
                  backgroundColor: "action.hover",
                  borderRadius: 1,
                  boxShadow: 2,
                },
                position: "relative",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                minHeight: 100,
                transition: "all 0.2s ease-in-out",
                backgroundColor: "background.paper",
              }}
            >
              {/* Media Preview Section */}
              <Box
                sx={{
                  width: 160,
                  height: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "background.default",
                  borderRadius: 1,
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
                    const imageSrc = getFileUrl(fileDetails.file);
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: "medium",
                    color: "text.primary",
                    mb: 0.5,
                    fontSize: "1.1rem",
                  }}
                >
                  {title || "Untitled Content"}
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
                      WebkitLineClamp: 2,
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
                      WebkitLineClamp: 2,
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
                  sx={{ flexShrink: 0, alignSelf: "flex-start" }}
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
                }}
                data-action-button
              >
                <Tooltip title="View Details">
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
            } else if (fileDetails?.file) {
              const fileUrl = getFileUrl(fileDetails.file);
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
                  ? "Click to open link in new tab"
                  : fileDetails?.file
                  ? "Click to open file in new tab"
                  : "Click to view content"
              }
            >
              <CardMedia
                component="div"
                sx={{
                  height: 140,
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
                    const imageSrc = getFileUrl(fileDetails.file);
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
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="div">
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
                <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
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
                <CardActions>
                  {onEdit && (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(e);
                      }}
                    >
                      Edit
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
                      Remove
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
                <Typography variant="h6" gutterBottom>
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
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {contentData.original_title && (
                      <Typography variant="body2" gutterBottom>
                        <strong>original title:</strong>{" "}
                        {contentData.original_title}
                      </Typography>
                    )}
                    {contentData.original_author && (
                      <Typography variant="body2">
                        <strong>original author:</strong>{" "}
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
                    Personal Notes
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
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
                      Change Content
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
                      Remove
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
              Unknown variant: {variant}
            </Typography>
          );
      }
    } catch (error) {
      console.error("Error in renderContent:", error);
      return (
        <Typography color="error" align="center" sx={{ p: 2 }}>
          Error rendering content: {error.message}
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
        Error displaying content: {error.message}
      </Typography>
    );
  }
};

export default ContentDisplay;
