import axiosInstance from './axiosConfig';

const commentsApi = {
    // Get comments for a topic
    getTopicComments: async (topicId) => {
        const response = await axiosInstance.get(`/comments/topic/${topicId}/`);
        return response.data;
    },

    // Add comment to a topic
    addTopicComment: async (topicId, body) => {
        const response = await axiosInstance.post(`/comments/topic/${topicId}/`, { body });
        return response.data;
    },

    // Get comments for a content within a topic
    getContentComments: async (topicId, contentId) => {
        const response = await axiosInstance.get(`/comments/topic/${topicId}/content/${contentId}/`);
        return response.data;
    },

    // Add comment to a content within a topic
    addContentComment: async (topicId, contentId, body) => {
        const response = await axiosInstance.post(`/comments/topic/${topicId}/content/${contentId}/`, { body });
        return response.data;
    },

    // Get replies for a comment
    getCommentReplies: async (commentId) => {
        try {
            const response = await axiosInstance.get(`/comments/replies/${commentId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching comment replies:', error);
            throw error;
        }
    },

    // Add reply to a comment
    addCommentReply: async (commentId, body) => {
        try {
            const response = await axiosInstance.post(`/comments/replies/${commentId}/`, { body });
            return response.data;
        } catch (error) {
            console.error('Error adding comment reply:', error);
            throw error;
        }
    },

    // Update a comment
    updateComment: async (commentId, body) => {
        try {
            const response = await axiosInstance.put(`/comments/${commentId}/`, { body });
            return response.data;
        } catch (error) {
            console.error('Error updating comment:', error);
            throw error;
        }
    },

    // Delete a comment
    deleteComment: async (commentId) => {
        const response = await axiosInstance.delete(`/comments/${commentId}/`);
        return response.data;
    },

    getKnowledgePathComments: async (pathId) => {
        try {
            const response = await axiosInstance.get(`/comments/knowledge-path/${pathId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge path comments:', error);
            throw error.response?.data || error.message;
        }
    },

    addKnowledgePathComment: async (pathId, body) => {
        try {
            const response = await axiosInstance.post(`/comments/knowledge-path/${pathId}/`, {
                body: body
            });
            return response.data;
        } catch (error) {
            console.error('Error adding knowledge path comment:', error);
            throw error.response?.data || error.message;
        }
    }
};

export default commentsApi; 