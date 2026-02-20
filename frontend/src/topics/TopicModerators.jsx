import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  Alert,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import contentApi from "../api/contentApi";

const TopicModerators = ({ topicId, onModeratorsUpdate }) => {
  const [moderators, setModerators] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState({});
  const [canceling, setCanceling] = useState({});
  const [userOptions, setUserOptions] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [topicData, invitationsData] = await Promise.all([
          contentApi.getTopicDetails(topicId),
          contentApi.getTopicModeratorInvitations(topicId)
        ]);
        setModerators(topicData.moderators || []);
        setInvitations(invitationsData || []);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar los moderadores e invitaciones");
        setLoading(false);
      }
    };

    fetchData();
  }, [topicId]);

  // Debounced user search for autocomplete
  useEffect(() => {
    const q = usernameInput.trim();
    if (q.length < 2) {
      setUserOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setUserSearchLoading(true);
      const results = await contentApi.searchUsersByUsername(q);
      setUserOptions(results || []);
      setUserSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [usernameInput]);

  const handleInviteModerator = async () => {
    if (!usernameInput.trim()) {
      setError("Por favor ingrese un nombre de usuario");
      return;
    }

    setInviting(true);
    setError(null);

    try {
      const username = usernameInput.trim();
      const message = messageInput.trim();
      const invitation = await contentApi.inviteTopicModerator(topicId, username, message);
      
      // Refresh invitations and topic data
      const [topicData, invitationsData] = await Promise.all([
        contentApi.getTopicDetails(topicId),
        contentApi.getTopicModeratorInvitations(topicId)
      ]);
      setModerators(topicData.moderators || []);
      setInvitations(invitationsData || []);
      setUsernameInput("");
      setMessageInput("");
      
      if (onModeratorsUpdate) {
        onModeratorsUpdate(topicData);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Error al enviar invitación"
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveModerator = async (username) => {
    setRemoving((prev) => ({ ...prev, [username]: true }));
    setError(null);

    try {
      const updatedTopic = await contentApi.removeTopicModerators(topicId, [username]);
      setModerators(updatedTopic.moderators || []);
      
      if (onModeratorsUpdate) {
        onModeratorsUpdate(updatedTopic);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Error al eliminar moderador"
      );
    } finally {
      setRemoving((prev) => {
        const newState = { ...prev };
        delete newState[username];
        return newState;
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'ACCEPTED':
        return 'success';
      case 'DECLINED':
        return 'error';
      case 'CANCELLED':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'ACCEPTED':
        return 'Aceptada';
      case 'DECLINED':
        return 'Rechazada';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  if (loading) {
    return <Typography>Cargando moderadores...</Typography>;
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'PENDING');

  return (
    <Box>
      <Typography
        variant="h6"
        gutterBottom
        color="text.primary"
        sx={{
          fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
          fontWeight: 400,
          fontSize: "18px",
          mb: 2,
        }}
      >
        Moderadores
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Invite Moderator */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
        <Autocomplete
          freeSolo
          options={userOptions}
          getOptionLabel={(option) =>
            typeof option === "string" ? option : option?.username ?? ""
          }
          inputValue={usernameInput}
          onInputChange={(_, value) => setUsernameInput(value ?? "")}
          onChange={(_, option) => {
            if (option && typeof option === "object" && option.username) {
              setUsernameInput(option.username);
            }
          }}
          loading={userSearchLoading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Nombre de usuario"
              size="small"
              placeholder="Escriba para buscar o ingrese el username"
            />
          )}
        />
        <TextField
          label="Mensaje (opcional)"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          size="small"
          multiline
          rows={2}
          placeholder="Mensaje opcional para el invitado"
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleInviteModerator}
          disabled={inviting || !usernameInput.trim()}
        >
          Invitar Moderador
        </Button>
      </Box>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle1"
            gutterBottom
            color="text.primary"
            sx={{ mb: 1 }}
          >
            Invitaciones Pendientes
          </Typography>
          <List>
            {pendingInvitations.map((invitation) => (
              <ListItem
                key={invitation.id}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={invitation.invited_user?.username || 'Usuario'}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {invitation.message || 'Sin mensaje'}
                      </Typography>
                      <Chip
                        label={getStatusLabel(invitation.status)}
                        color={getStatusColor(invitation.status)}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => {
                      // Cancel invitation - for now just show error, can be implemented later
                      setError("Cancelar invitación aún no está implementado");
                    }}
                    disabled={canceling[invitation.id]}
                    color="error"
                  >
                    <CancelIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Active Moderators List */}
      <Typography
        variant="subtitle1"
        gutterBottom
        color="text.primary"
        sx={{ mb: 1 }}
      >
        Moderadores Activos
      </Typography>
      {moderators.length === 0 ? (
        <Alert severity="info">
          No hay moderadores asignados a este tema.
        </Alert>
      ) : (
        <List>
          {moderators.map((moderator) => (
            <ListItem
              key={moderator.id}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemText
                primary={moderator.username}
                secondary={moderator.email}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleRemoveModerator(moderator.username)}
                  disabled={removing[moderator.username]}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default TopicModerators;