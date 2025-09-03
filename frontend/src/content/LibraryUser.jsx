import React, { useState, useEffect, useContext } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Button,
} from "@mui/material";
import NoteIcon from "@mui/icons-material/Note";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { isAuthenticated } from "../context/localStorageUtils";
import contentApi from "../api/contentApi";
import { useNavigate } from "react-router-dom";
import { getFileUrl } from "../utils/fileUtils";
import { AuthContext } from "../context/AuthContext";
import ContentDisplay from "./ContentDisplay";

const LibraryUser = () => {
  // TODO order by most recent by default
  const [userContent, setUserContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("ALL");
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const currentUser = authState.user;

  useEffect(() => {
    const fetchUserContent = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Fetching user content for current user");

        const data = await contentApi.getUserContentWithDetails();

        console.log("Received data:", data);

        // Filter out any content items that might be null or undefined
        const validContent = Array.isArray(data)
          ? data.filter((item) => item && item.content)
          : [];
        console.log("Valid content count:", validContent.length);
        setUserContent(validContent);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user content:", err);
        setError(
          err.response?.data?.error || err.message || "Failed to fetch content"
        );
        setLoading(false);
      }
    };

    if (isAuthenticated()) {
      fetchUserContent();
    } else {
      setLoading(false);
    }
  }, []);

  const handleFilterChange = (event, newFilter) => {
    setMediaFilter(newFilter || "ALL");
  };

  const filteredContent = userContent.filter((contentProfile) => {
    if (!contentProfile || !contentProfile.content) return false;
    return (
      mediaFilter === "ALL" || contentProfile.content.media_type === mediaFilter
    );
  });

  if (loading) return <Typography>Loading content...</Typography>;
  if (error)
    return (
      <Box sx={{ pt: 12, px: 3, textAlign: "center" }}>
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            setError(null);
            setLoading(true);
            // Trigger the useEffect again
            const fetchUserContent = async () => {
              try {
                setLoading(true);
                setError(null);

                const data = await contentApi.getUserContentWithDetails();

                const validContent = Array.isArray(data)
                  ? data.filter((item) => item && item.content)
                  : [];
                setUserContent(validContent);
                setLoading(false);
              } catch (err) {
                console.error("Error fetching user content:", err);
                setError(
                  err.response?.data?.error ||
                    err.message ||
                    "Failed to fetch content"
                );
                setLoading(false);
              }
            };
            fetchUserContent();
          }}
        >
          Retry
        </Button>
      </Box>
    );
  if (!isAuthenticated())
    return <Typography>Please login to view content</Typography>;

  return (
    <Box
      sx={{
        pt: 12,
        px: 3,
        pt: {
          xs: 6,
          md: 12,
        },
         px: {
          xs: 1,
          md: 3,
        },
      }}
    >
      <Typography variant="h4" gutterBottom>
        My Content Library
      </Typography>

      <Box
        sx={{
          mb: 3,
          display: {
            xs: "block", // mobile → stacked
            md: "flex", // md and up → flex row
          },
          alignItems: "center",
          gap: 2,
        }}
      >
        <ToggleButtonGroup
          value={mediaFilter}
          exclusive
          onChange={handleFilterChange}
          aria-label="media type filter"
          sx={{
            mb: {
              xs: 2,
              md: 0,
            },
            "& .MuiToggleButton-root": {
              color: "text.primary",
              backgroundColor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              "&.Mui-selected": {
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
              },
              "&:hover": {
                backgroundColor: "action.hover",
              },
            },
          }}
        >
          <ToggleButton value="ALL">All</ToggleButton>
          <ToggleButton value="IMAGE">Images</ToggleButton>
          <ToggleButton value="TEXT">Text</ToggleButton>
          <ToggleButton value="VIDEO">Video</ToggleButton>
          <ToggleButton value="AUDIO">Audio</ToggleButton>
        </ToggleButtonGroup>

        <Box
          sx={{
            display: {
              xs: "block", // mobile → stacked
              md: "flex", // md and up → flex row
            },
            gap: 2,
          }}
        >
          <Button
            sx={{
              width: {
                xs: "100%", // full width on mobile
                md: 280, // fixed 280px on md+
              },
              mb: {
                xs: 2,
                md: 0,
              },
            }}
            variant="contained"
            color="primary"
            onClick={() => navigate("/content/collections")}
          >
            Collections
          </Button>

          <Button
            sx={{
              width: {
                xs: "100%", // full width on mobile
                md: 280, // fixed 280px on md+
              },
              mb: {
                xs: 2,
                md: 0,
              },
            }}
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/profiles/my_profile?section=knowledge-paths")
            }
          >
            My Knowledge Paths
          </Button>

          <Button
            sx={{
              width: {
                xs: "100%", // full width on mobile
                md: 280, // fixed 280px on md+
              },
              mb: {
                xs: 2,
                md: 0,
              },
            }}
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate("/content/library_upload_content")}
          >
            Upload Content
          </Button>
        </Box>
      </Box>

      {mediaFilter === "TEXT" ? (
        // Table view for text files
        <Box sx={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px" }}>Title</th>
                <th style={{ textAlign: "left", padding: "12px" }}>Author</th>
                <th style={{ textAlign: "left", padding: "12px" }}>Notes</th>
                <th style={{ textAlign: "left", padding: "12px" }}>File</th>
              </tr>
            </thead>
            <tbody>
              {filteredContent.map((contentProfile) => (
                <tr
                  key={contentProfile.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    navigate(
                      `/content/${contentProfile.content.id}/library?context=library&id=${currentUser.id}`
                    )
                  }
                >
                  <td style={{ padding: "12px" }}>{contentProfile.title}</td>
                  <td style={{ padding: "12px" }}>{contentProfile.author}</td>
                  <td style={{ padding: "12px" }}>
                    {contentProfile.personal_note && (
                      <IconButton
                        size="small"
                        title={contentProfile.personal_note}
                      >
                        <NoteIcon color="primary" />
                      </IconButton>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {contentProfile.content.file_details?.file && (
                      <a
                        href={getFileUrl(
                          contentProfile.content.file_details.file
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      ) : (
        // Grid view using ContentDisplay in card mode
        <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
          {filteredContent.map((contentProfile) => (
            <Box
              gridColumn={{ xs: "span 12", sm: "span 6", md: "span 4" }}
              key={contentProfile.id}
            >
              <ContentDisplay
                content={contentProfile}
                variant="card"
                showAuthor={true}
                onClick={() =>
                  navigate(
                    `/content/${contentProfile.content.id}/library?context=library&id=${currentUser.id}`
                  )
                }
              />
            </Box>
          ))}

          {filteredContent.length === 0 && (
            <Box gridColumn={{ xs: "span 12" }}>
              <Typography variant="body1" color="text.secondary" align="center">
                No content found for the selected filter.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default LibraryUser;
