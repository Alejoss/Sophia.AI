import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Typography,
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
import { applyApiErrorsToForm } from "../utils/apiFormErrors";

const inviteSchema = yup.object({
  username: yup
    .string()
    .trim()
    .required("Por favor ingrese un nombre de usuario"),
  message: yup.string().trim().default(""),
});

const TopicModerators = ({ topicId, onModeratorsUpdate }) => {
  const [moderators, setModerators] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteGeneralError, setInviteGeneralError] = useState("");
  const [removing, setRemoving] = useState({});
  const [canceling, setCanceling] = useState({});
  const [userOptions, setUserOptions] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(inviteSchema),
    defaultValues: { username: "", message: "" },
  });

  const usernameValue = watch("username") || "";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [topicData, invitationsData] = await Promise.all([
          contentApi.getTopicDetails(topicId),
          contentApi.getTopicModeratorInvitations(topicId),
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

  useEffect(() => {
    const q = usernameValue.trim();
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
  }, [usernameValue]);

  const refreshModeratorData = async () => {
    const [topicData, invitationsData] = await Promise.all([
      contentApi.getTopicDetails(topicId),
      contentApi.getTopicModeratorInvitations(topicId),
    ]);
    setModerators(topicData.moderators || []);
    setInvitations(invitationsData || []);
    if (onModeratorsUpdate) {
      onModeratorsUpdate(topicData);
    }
    return topicData;
  };

  const onInviteSubmit = async ({ username, message }) => {
    setInviteGeneralError("");

    try {
      await contentApi.inviteTopicModerator(topicId, username.trim(), message.trim());
      await refreshModeratorData();
      reset({ username: "", message: "" });
    } catch (err) {
      const { generalError } = applyApiErrorsToForm(
        err,
        setFormError,
        "Error al enviar invitación",
        { username: "username", message: "message" },
      );
      if (generalError) {
        setInviteGeneralError(generalError);
      }
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
        err.response?.data?.error || "Error al eliminar moderador",
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
      case "PENDING":
        return "warning";
      case "ACCEPTED":
        return "success";
      case "DECLINED":
        return "error";
      case "CANCELLED":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "PENDING":
        return "Pendiente";
      case "ACCEPTED":
        return "Aceptada";
      case "DECLINED":
        return "Rechazada";
      case "CANCELLED":
        return "Cancelada";
      default:
        return status;
    }
  };

  if (loading) {
    return <Typography>Cargando moderadores...</Typography>;
  }

  const pendingInvitations = invitations.filter((inv) => inv.status === "PENDING");

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

      <Box
        component="form"
        onSubmit={handleSubmit(onInviteSubmit)}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}
      >
        {inviteGeneralError && (
          <Alert severity="error" onClose={() => setInviteGeneralError("")}>
            {inviteGeneralError}
          </Alert>
        )}
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <Autocomplete
              freeSolo
              options={userOptions}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.username ?? ""
              }
              inputValue={field.value}
              onInputChange={(_, value) => field.onChange(value ?? "")}
              onChange={(_, option) => {
                if (option && typeof option === "object" && option.username) {
                  field.onChange(option.username);
                }
              }}
              loading={userSearchLoading}
              disabled={isSubmitting}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Nombre de usuario"
                  size="small"
                  placeholder="Escriba para buscar o ingrese el username"
                  error={!!errors.username}
                  helperText={errors.username?.message}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        />
        <TextField
          label="Mensaje (opcional)"
          size="small"
          multiline
          rows={2}
          placeholder="Mensaje opcional para el invitado"
          error={!!errors.message}
          helperText={errors.message?.message}
          disabled={isSubmitting}
          {...register("message")}
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<AddIcon />}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Enviando..." : "Invitar Moderador"}
        </Button>
      </Box>

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
                  primary={invitation.invited_user?.username || "Usuario"}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {invitation.message || "Sin mensaje"}
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
