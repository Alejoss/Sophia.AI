import axiosInstance from './axiosConfig';

const votesApi = {
    // Get vote count and user's current vote for content in a topic
    getContentVoteStatus: async (topicId, contentId) => {
        console.log('Fetching content vote status:', { topicId, contentId });
        try {
            const response = await axiosInstance.get(
                `/votes/topics/${topicId}/contents/${contentId}/vote/`
            );
            console.log('Content vote status response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error fetching vote status:', {
                error,
                errorMessage: error.message,
                response: error.response?.data
            });
            throw error;
        }
    },

    // Vote on content (upvote or downvote)
    voteContent: async (topicId, contentId, action) => {
        console.log('Voting on content:', { topicId, contentId, action });
        try {
            const response = await axiosInstance.post(
                `/votes/topics/${topicId}/contents/${contentId}/vote/`,
                { action }
            );
            console.log('Content vote response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error voting on content:', {
                error,
                errorMessage: error.message,
                response: error.response?.data
            });
            throw error;
        }
    },

    // Helper methods to make the API easier to use
    upvoteContent: async (topicId, contentId) => {
        console.log('Upvoting content:', { topicId, contentId });
        return votesApi.voteContent(topicId, contentId, 'upvote');
    },

    downvoteContent: async (topicId, contentId) => {
        console.log('Downvoting content:', { topicId, contentId });
        return votesApi.voteContent(topicId, contentId, 'downvote');
    },

    // Similar methods for comments
    getCommentVoteStatus: async (commentId) => {
        console.log('Fetching comment vote status:', { commentId });
        try {
            const response = await axiosInstance.get(
                `/votes/comments/${commentId}/vote/`
            );
            console.log('Comment vote status response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error fetching comment vote status:', {
                error,
                errorMessage: error.message,
                response: error.response?.data
            });
            throw error;
        }
    },

    voteComment: async (commentId, action) => {
        console.log('Voting on comment:', { commentId, action });
        try {
            const response = await axiosInstance.post(
                `/votes/comments/${commentId}/vote/`,
                { action }
            );
            console.log('Comment vote response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error voting on comment:', {
                error,
                errorMessage: error.message,
                response: error.response?.data
            });
            throw error;
        }
    },

    // Knowledge Path voting
    getKnowledgePathVoteStatus: async (pathId) => {
        console.log('Fetching knowledge path vote status:', { pathId });
        try {
            const response = await axiosInstance.get(
                `/votes/knowledge-paths/${pathId}/vote/`
            );
            console.log('Knowledge path vote status response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error fetching knowledge path vote status:', {
                error,
                errorMessage: error.message,
                response: error.response?.data
            });
            throw error;
        }
    },

    voteKnowledgePath: async (pathId, action) => {
        console.log('Voting on knowledge path:', { pathId, action });
        try {
            const response = await axiosInstance.post(
                `/votes/knowledge-paths/${pathId}/vote/`,
                { action }
            );
            console.log('Knowledge path vote response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error voting on knowledge path:', {
                error,
                errorMessage: error.message,
                response: error.response?.data
            });
            throw error;
        }
    }
};

export default votesApi; 