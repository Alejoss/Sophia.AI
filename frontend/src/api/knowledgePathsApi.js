import axiosInstance from './axiosConfig';

const knowledgePathsApi = {
    createKnowledgePath: async (knowledgePathData) => {
        try {
            console.log('knowledgePathsApi.createKnowledgePath - Input data:', knowledgePathData);
            
            // Check if there's an image file to upload
            const hasImage = knowledgePathData.image instanceof File;
            console.log('knowledgePathsApi.createKnowledgePath - Has image:', hasImage);
            
            let response;
            if (hasImage) {
                // Use FormData for file upload
                const formData = new FormData();
                if (knowledgePathData.title !== undefined) formData.append('title', knowledgePathData.title);
                if (knowledgePathData.description !== undefined) formData.append('description', knowledgePathData.description);
                // Ensure visibility updates work even when uploading an image
                if (knowledgePathData.is_visible !== undefined) formData.append('is_visible', String(knowledgePathData.is_visible));
                formData.append('image', knowledgePathData.image);
                
                console.log('knowledgePathsApi.createKnowledgePath - Using FormData');
                console.log('knowledgePathsApi.createKnowledgePath - FormData contents:');
                for (let [key, value] of formData.entries()) {
                    console.log(`${key}:`, value);
                }
                
                response = await axiosInstance.post('/knowledge_paths/create/', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else {
                // Use JSON for regular creation
                const { image, ...jsonData } = knowledgePathData;
                console.log('knowledgePathsApi.createKnowledgePath - Using JSON data:', jsonData);
                response = await axiosInstance.post('/knowledge_paths/create/', jsonData);
            }
            
            console.log('knowledgePathsApi.createKnowledgePath - Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error creating knowledge path:', error);
            console.error('Error response:', error.response?.data);
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
            console.log('knowledgePathsApi.updateKnowledgePath - Input data:', knowledgePathData);
            
            // Check if there's an image file to upload
            const hasImage = knowledgePathData.image instanceof File;
            console.log('knowledgePathsApi.updateKnowledgePath - Has image:', hasImage);
            
            let response;
            if (hasImage) {
                // Use FormData for file upload
                const formData = new FormData();
                formData.append('title', knowledgePathData.title);
                formData.append('description', knowledgePathData.description);
                formData.append('image', knowledgePathData.image);
                
                console.log('knowledgePathsApi.updateKnowledgePath - Using FormData');
                console.log('knowledgePathsApi.updateKnowledgePath - FormData contents:');
                for (let [key, value] of formData.entries()) {
                    console.log(`${key}:`, value);
                }
                
                response = await axiosInstance.put(`/knowledge_paths/${pathId}/`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else {
                // Use JSON for regular updates
                const { image, ...jsonData } = knowledgePathData;
                console.log('knowledgePathsApi.updateKnowledgePath - Using JSON data:', jsonData);
                response = await axiosInstance.put(`/knowledge_paths/${pathId}/`, jsonData);
            }
            
            console.log('knowledgePathsApi.updateKnowledgePath - Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error updating knowledge path:', error);
            console.error('Error response:', error.response?.data);
            throw error;
        }
    },

    addNode: async (pathId, nodeData) => {
        try {
            console.log('Sending request to add node:', { pathId, nodeData });
            const response = await axiosInstance.post(`/knowledge_paths/${pathId}/nodes/`, {
                content_profile_id: nodeData.content_profile_id,
                title: nodeData.title,
                description: nodeData.description
            });
            console.log('Response from add node:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error adding node:', error);
            throw error;
        }
    },

    getKnowledgePaths: async (page = 1, pageSize = 9) => {
        try {
            const response = await axiosInstance.get('/knowledge_paths/', {
                params: {
                    page,
                    page_size: pageSize
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge paths:', error);
            throw error;
        }
    },

    getUserKnowledgePaths: async (page = 1, pageSize = 9) => {
        try {
            const response = await axiosInstance.get('/knowledge_paths/my/', {
                params: {
                    page,
                    page_size: pageSize
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching user knowledge paths:', error);
            throw error;
        }
    },

    getUserEngagedKnowledgePaths: async (page = 1, pageSize = 9) => {
        try {
            const response = await axiosInstance.get('/knowledge_paths/engaged/', {
                params: {
                    page,
                    page_size: pageSize
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching user engaged knowledge paths:', error);
            throw error;
        }
    },

    getUserKnowledgePathsById: async (userId, page = 1, pageSize = 9) => {
        try {
            const response = await axiosInstance.get(`/knowledge_paths/user/${userId}/`, {
                params: {
                    page,
                    page_size: pageSize
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge paths by user ID:', error);
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

    getNodeContent: async (contentProfileId) => {
        if (!contentProfileId) {
            return null;
        }
        try {
            const response = await axiosInstance.get(`/content/content-profiles/${contentProfileId}/detail/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching node content:', error);
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

    reorderNodes: async (pathId, nodeOrders) => {
        try {
            const response = await axiosInstance.put(
                `/knowledge_paths/${pathId}/nodes/reorder/`,
                { node_orders: nodeOrders }
            );
            return response.data;
        } catch (error) {
            console.error('Error reordering nodes:', error);
            throw error;
        }
    },

    markNodeCompleted: async (pathId, nodeId) => {
        try {
            console.log('Sending node completion request:', { pathId, nodeId });
            const response = await axiosInstance.post(`/knowledge_paths/${pathId}/nodes/${nodeId}/`);
            console.log('Node completion API response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error in markNodeCompleted API call:', error);
            console.error('Error response:', error.response?.data);
            throw error;
        }
    },

    // Add other knowledge path-related API calls here as needed
};

export default knowledgePathsApi; 