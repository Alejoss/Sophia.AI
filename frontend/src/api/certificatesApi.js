import axiosInstance from './axiosConfig';

const certificatesApi = {
    requestCertificate: async (pathId, data) => {
        try {
            const response = await axiosInstance.post(`/certificates/request/${pathId}/`, {
                notes: data.notes
            });
            return response.data;
        } catch (error) {
            console.error('Error requesting certificate:', error);
            throw error;
        }
    },

    getCertificateRequestStatus: async (pathId) => {
        try {
            const response = await axiosInstance.get(`/certificates/request-status/${pathId}/`);
            return response.data;
        } catch (error) {
            console.error('Error getting certificate request status:', error);
            throw error;
        }
    },

    getCertificateRequests: async () => {
        try {
            const response = await axiosInstance.get('/certificates/requests/');
            return response.data;
        } catch (error) {
            console.error('Error fetching certificate requests:', error);
            throw error;
        }
    },

    approveCertificateRequest: async (requestId, note = '') => {
        try {
            const response = await axiosInstance.post(`/certificates/requests/${requestId}/approve/`, { note });
            return response.data;
        } catch (error) {
            console.error('Error approving certificate request:', error);
            throw error;
        }
    },

    rejectCertificateRequest: async (requestId, reason, note = '') => {
        try {
            const response = await axiosInstance.post(`/certificates/requests/${requestId}/reject/`, { reason, note });
            return response.data;
        } catch (error) {
            console.error('Error rejecting certificate request:', error);
            throw error;
        }
    },

    cancelCertificateRequest: async (requestId) => {
        try {
            const response = await axiosInstance.post(`/certificates/requests/${requestId}/cancel/`);
            return response.data;
        } catch (error) {
            console.error('Error cancelling certificate request:', error);
            throw error;
        }
    },

    getCertificates: async () => {
        try {
            const response = await axiosInstance.get('/certificates/');
            return response.data;
        } catch (error) {
            console.error('Error getting certificates:', error);
            throw error;
        }
    },

    getKnowledgePathCertificateRequests: async (pathId) => {
        try {
            const response = await axiosInstance.get(`/certificates/requests/knowledge-path/${pathId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge path certificate requests:', error);
            throw error;
        }
    }
};

export default certificatesApi; 