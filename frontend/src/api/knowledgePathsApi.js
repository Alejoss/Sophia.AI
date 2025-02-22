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
            console.log('Sending request to add node:', { pathId, nodeData });
            const response = await axiosInstance.post(`/knowledge_paths/${pathId}/nodes/`, nodeData);
            console.log('Response from add node:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error adding node:', error);
            throw error;
        }
    },

    getKnowledgePaths: async () => {
        try {
            const response = await axiosInstance.get('/knowledge_paths/');
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge paths:', error);
            throw error;
        }
    },

    removeNode: async (pathId, nodeId) => {
        try {
            console.log('Sending request to remove node:', { pathId, nodeId });
            const response = await axiosInstance.delete(`/knowledge_paths/${pathId}/nodes/${nodeId}/`);
            console.log('Response from remove node:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error removing node:', error);
            throw error;
        }
    },

    getKnowledgePathBasic: async (pathId) => {
        try {
            const response = await axiosInstance.get(`/knowledge_paths/${pathId}/basic/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching basic knowledge path:', error);
            throw error;
        }
    },

    getNode: async (pathId, nodeId) => {
        try {
            const response = await axiosInstance.get(`/knowledge_paths/${pathId}/nodes/${nodeId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching node:', error);
            throw error;
        }
    },

    updateNode: async (pathId, nodeId, nodeData) => {
        try {
            const response = await axiosInstance.put(`/knowledge_paths/${pathId}/nodes/${nodeId}/`, nodeData);
            return response.data;
        } catch (error) {
            console.error('Error updating node:', error);
            throw error;
        }
    },

    // Add other knowledge path-related API calls here as needed
};

export default knowledgePathsApi; 