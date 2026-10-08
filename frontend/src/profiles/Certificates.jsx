import React, { useState, useEffect, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import certificatesApi from "../api/certificatesApi";
import { AuthContext } from "../context/AuthContext";
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Stack,
  Link as MuiLink } from
"@mui/material";
import { applyApiErrorsToForm } from "../utils/apiFormErrors.js";

const Certificates = ({ isOwnProfile = false, userId = null }) => {
  const { t } = useTranslation("profiles");
  const rejectSchema = useMemo(
    () =>
      yup.object({
        reason: yup.string().trim().required(() => t("certificates.reasonRequired")),
      }),
    [t],
  );
  const [activeTab, setActiveTab] = useState("certificates");
  const [certificates, setCertificates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveNote, setApproveNote] = useState("");
  const [rejectGeneralError, setRejectGeneralError] = useState("");
  const { authState } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register: registerReject,
    handleSubmit: handleRejectSubmit,
    reset: resetRejectForm,
    setError: setRejectFormError,
    formState: { errors: rejectErrors, isSubmitting: isRejectSubmitting },
  } = useForm({
    resolver: yupResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get('tab');
    if (tabParam === 'requests' && isOwnProfile) {
      setActiveTab('requests');
    } else if (tabParam === 'certificates') {
      setActiveTab('certificates');
    }
  }, [location.search, isOwnProfile]);

  useEffect(() => {
    if (activeTab === "certificates") {
      fetchCertificates();
    } else if (activeTab === "requests") {
      fetchRequests();
    }
  }, [activeTab, isOwnProfile, userId]);

  const fetchCertificates = async () => {
    try {
      setCertificatesLoading(true);
      let data;
      if (isOwnProfile || !userId) {
        data = await certificatesApi.getCertificates();
      } else {
        data = await certificatesApi.getUserCertificatesById(userId);
      }

      setCertificates(data);
    } catch (err) {
      setError(t("certificates.loadError"));
      console.error(err);
    } finally {
      setCertificatesLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      // Only fetch requests for owners, not visitors
      if (isOwnProfile || !userId) {
        const data = await certificatesApi.getCertificateRequests();
        setRequests(data);
      } else {
        // For visitors, don't show certificate requests
        setRequests([]);
      }
    } catch (err) {
      setError(t("certificates.loadRequestsError"));
      console.error(err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await certificatesApi.approveCertificateRequest(
        selectedRequest.id,
        approveNote
      );
      setApproveDialogOpen(false);
      setApproveNote("");
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      setError(t("certificates.approveError"));
      console.error(err);
    }
  };

  const onRejectSubmit = async ({ reason }) => {
    if (!selectedRequest) return;

    setRejectGeneralError("");

    try {
      await certificatesApi.rejectCertificateRequest(
        selectedRequest.id,
        reason
      );
      setRejectDialogOpen(false);
      resetRejectForm({ reason: "" });
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      const { generalError } = applyApiErrorsToForm(
        err,
        setRejectFormError,
        t("certificates.rejectError"),
        { rejection_reason: "reason" },
      );
      if (generalError) {
        setRejectGeneralError(generalError);
      }
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await certificatesApi.cancelCertificateRequest(requestId);
      fetchRequests();
    } catch (err) {
      setError(t("certificates.cancelError"));
      console.error(err);
    }
  };

  const openApproveDialog = (request) => {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (request) => {
    setSelectedRequest(request);
    resetRejectForm({ reason: "" });
    setRejectGeneralError("");
    setRejectDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "APPROVED":
        return "success";
      case "REJECTED":
        return "error";
      default:
        return "default";
    }
  };

  const sortRequests = (requests) => {
    const pendingRequests = requests.filter((req) => req.status === "PENDING");
    const nonPendingRequests = requests.filter(
      (req) => req.status !== "PENDING"
    );
    nonPendingRequests.sort(
      (a, b) => new Date(b.request_date) - new Date(a.request_date)
    );
    return [...pendingRequests, ...nonPendingRequests];
  };

  const getCertificateTitle = (certificate) => {
    if (certificate.knowledge_path_title) {
      return certificate.knowledge_path_title;
    } else if (certificate.event_title) {
      return certificate.event_title;
    } else {
      return t("certificates.certificate");
    }
  };

  const getCertificateType = (certificate) => {
    if (certificate.knowledge_path_title) {
      return t("certificates.knowledgePath");
    } else if (certificate.event_title) {
      return t("certificates.event");
    } else {
      return t("certificates.certificate");
    }
  };

  const getRequestTitle = (request) => {
    if (request.knowledge_path_title) {
      return request.knowledge_path_title;
    } else if (request.event_title) {
      return request.event_title;
    } else {
      return t("certificates.request");
    }
  };

  const getRequestType = (request) => {
    if (request.knowledge_path_title) {
      return t("certificates.knowledgePath");
    } else if (request.event_title) {
      return t("certificates.event");
    } else {
      return t("certificates.certificate");
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (isOwnProfile) {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('section', 'certificates');
      searchParams.set('tab', newValue);
      navigate({ pathname: location.pathname, search: searchParams.toString() });
    }
  };

  return (
    <Box>
      {/* Material-UI Tabs - Only show requests tab for owners */}
      {isOwnProfile ?
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={t("certificates.tabCertificates")} value="certificates" />
            <Tab label={t("certificates.tabRequests")} value="requests" />
          </Tabs>
        </Box> :

      // For visitors, show a simple header
      <Box sx={{ mb: 3 }}>
          <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem", // ~24px on mobile
              sm: "1.75rem", // ~28px on small screens
              md: "2.125rem" // ~34px on desktop (default h4)
            },
            fontWeight: 600
          }}>
          
            {t("certificates.count", { count: certificates.length })}
          </Typography>
        </Box>
      }

      {/* Tab Content */}
      <Box>
        {(activeTab === "certificates" || !isOwnProfile) &&
        <Box>
            {certificatesLoading ?
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="200px">
            
                <CircularProgress />
              </Box> :
          error ?
          <Alert severity="error">{error}</Alert> :
          certificates.length === 0 ?
          <Typography variant="body1" color="text.secondary">
                {isOwnProfile ?
            t("certificates.emptyOwn") :
            t("certificates.emptyOther")}
              </Typography> :

          <Stack spacing={2}>
                {certificates.map((certificate) =>
            <Card key={certificate.id}>
                    <CardContent>
                      <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 2,
                    flexWrap: "wrap"
                  }}>
                  
                        <Box sx={{ flex: 1, minWidth: 240 }}>
                          <Typography variant="h6" color="text.primary">
                            {getCertificateTitle(certificate)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t("certificates.type", { type: getCertificateType(certificate) })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t("certificates.issuedOn", {
                              date: new Date(certificate.issued_on).toLocaleDateString(),
                            })}
                          </Typography>
                          {certificate.blockchain_hash &&
                    <Chip
                      label={t("certificates.onBlockchain")}
                      color="success"
                      size="small"
                      sx={{ mt: 1 }} />

                    }
                        </Box>
                        {(certificate.download_url || certificate.certificate_file_url) &&
                  <Button
                    variant="contained"
                    color="primary"
                    href={certificate.download_url || certificate.certificate_file_url}
                    target="_blank"
                    rel="noopener noreferrer">
                    
                            {t("certificates.download")}
                          </Button>
                  }
                      </Box>
                    </CardContent>
                  </Card>
            )}
              </Stack>
          }
          </Box>
        }
        {isOwnProfile && activeTab === "requests" &&
        <Box>
            {requestsLoading ?
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="200px">
            
                <CircularProgress />
              </Box> :
          error ?
          <Alert severity="error">{error}</Alert> :
          requests.length === 0 ?
          <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t("certificates.emptyRequestsTitle")}
                </Typography>
                <Box
              mt={3}
              sx={{
                display: {
                  xs: "block", // mobile → stacked
                  md: "flex" // md and up → flex row
                }
              }}
              gap={2}
              justifyContent="center">
              
                  <Button
                sx={{
                  mb: {
                    xs: 2, // vertical spacing between children on mobile
                    md: 0 // no spacing when flex row
                  }
                }}
                variant="contained"
                color="primary"
                onClick={() => navigate("/knowledge_path/create")}>
                
                    {t("certificates.createPath")}
                  </Button>
                  <Button
                variant="contained"
                color="secondary"
                onClick={() => navigate("/events/create")}>
                
                    {t("certificates.createEvent")}
                  </Button>
                </Box>
              </Box> :

          <Stack spacing={4}>
                {/* Teacher View */}
                {requests.filter(
              (req) =>
              req.knowledge_path_author === authState.user?.username ||
              req.event_owner === authState.user?.username
            ).length > 0 &&
            <Box>
                    <Typography
                variant="h5"
                gutterBottom
                color="text.primary"
                sx={{ fontWeight: 600 }}>
                
                      {t("certificates.toReview")}
                    </Typography>
                    {sortRequests(
                requests.filter(
                  (req) =>
                  req.knowledge_path_author === authState.user?.username ||
                  req.event_owner === authState.user?.username
                )
              ).map((request) =>
              <Card key={request.id} sx={{ mb: 2 }}>
                        <CardContent>
                          <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 2,
                      flexWrap: "wrap"
                    }}>
                    
                            <Box sx={{ flex: 1, minWidth: 240 }}>
                              <Typography variant="h6">
                                {getRequestTitle(request)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t("certificates.requestedBy")}{" "}
                                <MuiLink
                          component={Link}
                          to={`/profiles/user_profile/${request.requester_id}`}
                          underline="hover">
                          
                                  {request.requester}
                                </MuiLink>
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t("certificates.type", { type: getRequestType(request) })}
                              </Typography>
                              <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                        sx={{ mt: 1 }} />
                      
                              {request.notes && (
                      typeof request.notes === "object" &&
                      Object.keys(request.notes).length > 0 ||
                      typeof request.notes === "string" &&
                      request.notes.trim() !== "") &&
                      <Typography variant="body2" sx={{ mt: 1 }}>
                                    {t("certificates.notes")}{" "}
                                    {typeof request.notes === "object" ?
                        JSON.stringify(request.notes) :
                        request.notes}
                                  </Typography>
                      }
                            </Box>

                            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                              {request.status === "PENDING" &&
                      <>
                                  <Button
                          variant="contained"
                          color="success"
                          onClick={() => openApproveDialog(request)}>
                          
                                    {t("certificates.approve")}
                                  </Button>
                                  <Button
                          variant="contained"
                          color="error"
                          onClick={() => openRejectDialog(request)}>
                          
                                    {t("certificates.reject")}
                                  </Button>
                                </>
                      }
                              {request.status === "REJECTED" &&
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => openApproveDialog(request)}>
                        
                                  {t("certificates.acceptRequest")}
                                </Button>
                      }
                            </Stack>
                          </Box>

                          {request.rejection_reason &&
                  <Typography
                    variant="body2"
                    color="error"
                    sx={{ mt: 1 }}>
                    
                              {t("certificates.rejectionReason", { reason: request.rejection_reason })}
                            </Typography>
                  }
                        </CardContent>
                      </Card>
              )}
                  </Box>
            }

                {/* Student View */}
                {requests.filter(
              (req) => req.requester === authState.user?.username
            ).length > 0 &&
            <Box>
                    <Typography
                variant="h5"
                gutterBottom
                color="text.primary"
                sx={{ fontWeight: 600 }}>
                
                      {t("certificates.myRequests")}
                    </Typography>
                    {sortRequests(
                requests.filter(
                  (req) => req.requester === authState.user?.username
                )
              ).map((request) =>
              <Card key={request.id} sx={{ mb: 2 }}>
                        <CardContent>
                          <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 2,
                      flexWrap: "wrap"
                    }}>
                    
                            <Box sx={{ flex: 1, minWidth: 240 }}>
                              <Typography variant="h6" color="text.primary">
                                {getRequestTitle(request)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t("certificates.requestedOn", {
                                  date: new Date(request.request_date).toLocaleDateString(),
                                })}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t("certificates.author")}{" "}
                                <MuiLink
                          component={Link}
                          to={`/profiles/user_profile/${
                          request.knowledge_path_author_id ||
                          request.event_owner_id}`
                          }
                          underline="hover">
                          
                                  {request.knowledge_path_author ||
                          request.event_owner}
                                </MuiLink>
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t("certificates.type", { type: getRequestType(request) })}
                              </Typography>
                              <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                        sx={{ mt: 1 }} />
                      
                              {request.notes && (
                      typeof request.notes === "object" &&
                      Object.keys(request.notes).length > 0 ||
                      typeof request.notes === "string" &&
                      request.notes.trim() !== "") &&
                      <Typography variant="body2" sx={{ mt: 1 }}>
                                    {t("certificates.notes")}{" "}
                                    {typeof request.notes === "object" ?
                        JSON.stringify(request.notes) :
                        request.notes}
                                  </Typography>
                      }
                            </Box>
                            {request.status === "PENDING" &&
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleCancel(request.id)}>
                      
                                {t("certificates.cancel")}
                              </Button>
                    }
                          </Box>
                          {request.rejection_reason &&
                  <Typography
                    variant="body2"
                    color="error"
                    sx={{ mt: 1 }}>
                    
                              {t("certificates.rejectionReason", { reason: request.rejection_reason })}
                            </Typography>
                  }
                        </CardContent>
                      </Card>
              )}
                  </Box>
            }
              </Stack>
          }
          </Box>
        }
      </Box>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}>
        
        <DialogTitle>{t("certificates.approveTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t("certificates.noteOptional")}
            type="text"
            fullWidth
            multiline
            rows={4}
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)} />
          
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>{t("cancel")}</Button>
          <Button onClick={handleApprove} color="primary">
            {t("certificates.approve")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => !isRejectSubmitting && setRejectDialogOpen(false)}>

        <Box component="form" onSubmit={handleRejectSubmit(onRejectSubmit)} noValidate>
          <DialogTitle>{t("certificates.rejectTitle")}</DialogTitle>
          <DialogContent>
            {rejectGeneralError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {rejectGeneralError}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              label={t("certificates.reasonLabel")}
              type="text"
              fullWidth
              multiline
              rows={4}
              error={!!rejectErrors.reason}
              helperText={rejectErrors.reason?.message}
              disabled={isRejectSubmitting}
              {...registerReject("reason")}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialogOpen(false)} disabled={isRejectSubmitting}>
              {t("cancel")}
            </Button>
            <Button type="submit" color="error" disabled={isRejectSubmitting}>
              {isRejectSubmitting ? t("certificates.rejecting") : t("certificates.reject")}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>);

};

export default Certificates;