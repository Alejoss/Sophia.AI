import axiosInstance from './axiosConfig';

const knowledgePathsApi = {
    createKnowledgePath: async (knowledgePathData) => {
        try {
            const response = await axiosInstance.post('/knowledge_paths/create/', knowledgePathData);
            return response.data;
        } catch (error) {
            console.error('Error creating knowledge path:', error);
            throw error;
        }
    },

    getKnowledgePath: async (pathId) => {
        try {
            const response = await axiosInstance.get(`/knowledge_paths/${pathId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge path:', error);
            throw error;
        }
    },

    updateKnowledgePath: async (pathId, knowledgePathData) => {
        try {
            const response = await axiosInstance.put(`/knowledge_paths/${pathId}/`, knowledgePathData);
            return response.data;
        } catch (error) {
            console.error('Error updating knowledge path:', error);
            throw error;
        }
    },

    addNode: async (pathId, nodeData) => {
        try {
            const response = await axiosInstance.post(`/knowledge_paths/${pathId}/nodes/`, nodeData);
            return response.data;
        } catch (error) {
            console.error('Error adding node:', error);
            throw error;
        }
    },

    // Add other knowledge path-related API calls here as needed
};

export default knowledgePathsApi; 