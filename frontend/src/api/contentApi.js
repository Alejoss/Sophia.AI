import axiosInstance from './axiosConfig';

const contentApi = {
    getUserContent: async () => {
        try {
            const response = await axiosInstance.get('/content/user-content/');
            return response.data;
        } catch (error) {
            console.error('Error fetching user content:', error);
            throw error;
        }
    },

    // Add other content-related API calls here
    uploadContent: async (contentData) => {
        try {
            const response = await axiosInstance.post('/content/upload/', contentData);
            return response.data;
        } catch (error) {
            console.error('Error uploading content:', error);
            throw error;
        }
    },

    getContentDetails: async (contentId) => {
        try {
            const response = await axiosInstance.get(`/content/${contentId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching content details:', error);
            throw error;
        }
    },
};

export default contentApi; 