import axiosInstance from './axiosConfig';

const votesApi = {
    // Get vote count and user's current vote for content in a topic
    getContentVoteStatus: async (topicId, contentId) => {
        try {
            const response = await axiosInstance.get(
                `/votes/topics/${topicId}/contents/${contentId}/vote/`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching vote status:', error);
            throw error;
        }
    },

    // Vote on content (upvote or downvote)
    voteContent: async (topicId, contentId, action) => {
        try {
            const response = await axiosInstance.post(
                `/votes/topics/${topicId}/contents/${contentId}/vote/`,
                { action }
            );
            return response.data;
        } catch (error) {
            console.error('Error voting on content:', error);
            throw error;
        }
    },

    // Helper methods to make the API easier to use
    upvoteContent: async (topicId, contentId) => {
        return votesApi.voteContent(topicId, contentId, 'upvote');
    },

    downvoteContent: async (topicId, contentId) => {
        return votesApi.voteContent(topicId, contentId, 'downvote');
    },

    // Similar methods for comments
    getCommentVoteStatus: async (commentId) => {
        try {
            const response = await axiosInstance.get(
                `/votes/comments/${commentId}/vote/`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching comment vote status:', error);
            throw error;
        }
    },

    voteComment: async (commentId, action) => {
        try {
            const response = await axiosInstance.post(
                `/votes/comments/${commentId}/vote/`,
                { action }
            );
            return response.data;
        } catch (error) {
            console.error('Error voting on comment:', error);
            throw error;
        }
    },

    // Knowledge Path voting
    getKnowledgePathVoteStatus: async (pathId) => {
        try {
            const response = await axiosInstance.get(
                `/votes/knowledge-paths/${pathId}/vote/`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge path vote status:', error);
            throw error;
        }
    },

    voteKnowledgePath: async (pathId, action) => {
        try {
            const response = await axiosInstance.post(
                `/votes/knowledge-paths/${pathId}/vote/`,
                { action }
            );
            return response.data;
        } catch (error) {
            console.error('Error voting on knowledge path:', error);
            throw error;
        }
    },

    // Publication voting
    getPublicationVoteStatus: async (publicationId) => {
        try {
            const response = await axiosInstance.get(
                `/votes/publications/${publicationId}/vote/`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching publication vote status:', error);
            throw error;
        }
    },

    votePublication: async (publicationId, action) => {
        try {
            const response = await axiosInstance.post(
                `/votes/publications/${publicationId}/vote/`,
                { action }
            );
            return response.data;
        } catch (error) {
            console.error('Error voting on publication:', error);
            throw error;
        }
    },

    // Helper methods for publication voting
    upvotePublication: async (publicationId) => {
        return votesApi.votePublication(publicationId, 'upvote');
    },

    downvotePublication: async (publicationId) => {
        return votesApi.votePublication(publicationId, 'downvote');
    }
};

export default votesApi; 