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

    requestEventCertificate: async (eventId, data) => {
        try {
            const response = await axiosInstance.post(`/certificates/event-request/${eventId}/`, {
                notes: data.notes
            });
            return response.data;
        } catch (error) {
            console.error('Error requesting event certificate:', error);
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

    getEventCertificateRequestStatus: async (eventId) => {
        try {
            const response = await axiosInstance.get(`/certificates/event-request-status/${eventId}/`);
            return response.data;
        } catch (error) {
            console.error('Error getting event certificate request status:', error);
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

    rejectCertificateRequest: async (requestId, reason) => {
        try {
            const response = await axiosInstance.post(`/certificates/requests/${requestId}/reject/`, { rejection_reason: reason });
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

    getUserCertificatesById: async (userId) => {
        try {
            const response = await axiosInstance.get(`/certificates/?user=${userId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting user certificates by ID:', error);
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
    },

    getEventCertificateRequests: async (eventId) => {
        try {
            const response = await axiosInstance.get(`/certificates/requests/event/${eventId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching event certificate requests:', error);
            throw error;
        }
    },

    generateEventCertificate: async (eventId, registrationId, data = {}) => {
        try {
            const url = `/certificates/generate-event-certificate/${eventId}/${registrationId}/`;
            const requestData = {
                note: data.note || ''
            };
            
            console.log('DEBUG: Calling certificate generation API');
            console.log('DEBUG: URL:', url);
            console.log('DEBUG: Data:', requestData);
            
            const response = await axiosInstance.post(url, requestData);
            console.log('DEBUG: Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error generating event certificate:', error);
            console.error('DEBUG: Error response:', error.response?.data);
            throw error;
        }
    }
};

export default certificatesApi; 