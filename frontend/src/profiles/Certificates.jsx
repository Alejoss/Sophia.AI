import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import certificatesApi from '../api/certificatesApi';
import { AuthContext } from '../context/AuthContext';
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Button
} from '@mui/material';

const Certificates = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authState } = useContext(AuthContext);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const data = await certificatesApi.getCertificates();
      setCertificates(data);
    } catch (err) {
      setError('Failed to load certificates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <div className="container mx-auto p-4">
      <Typography variant="h4" gutterBottom>
        My Certificates
      </Typography>

      {certificates.length === 0 ? (
        <Typography variant="body1" color="textSecondary">
          You haven't earned any certificates yet. Complete knowledge paths to earn certificates!
        </Typography>
      ) : (
        <div className="grid gap-4">
          {certificates.map((certificate) => (
            <Card key={certificate.id} className="mb-4">
              <CardContent>
                <div className="flex justify-between items-start">
                  <div>
                    <Typography variant="h6">
                      {certificate.knowledge_path_title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Issued on: {new Date(certificate.issued_on).toLocaleDateString()}
                    </Typography>
                    {certificate.blockchain_hash && (
                      <Chip
                        label="On Blockchain"
                        color="success"
                        size="small"
                        className="mt-2"
                      />
                    )}
                  </div>
                  {certificate.download_url && (
                    <Button
                      variant="contained"
                      color="primary"
                      href={certificate.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Certificates;
