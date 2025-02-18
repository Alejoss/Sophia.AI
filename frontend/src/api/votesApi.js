import axiosInstance from './axiosConfig';

const votesApi = {
    // Get vote count and user's current vote for content in a topic
    getContentVoteStatus: async (topicId, contentId) => {
        try {
            const response = await axiosInstance.get(
                `/votes/topics/${topicId}/contents/${contentId}/`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching vote status:', error);
            throw error;
        }
    },

    // Upvote content in a topic
    upvoteContent: async (topicId, contentId) => {
        try {
            const response = await axiosInstance.post(
                `/votes/topics/${topicId}/contents/${contentId}/upvote/`
            );
            return response.data;
        } catch (error) {
            console.error('Error upvoting content:', error);
            throw error;
        }
    },

    // Downvote content in a topic
    downvoteContent: async (topicId, contentId) => {
        try {
            const response = await axiosInstance.post(
                `/votes/topics/${topicId}/contents/${contentId}/downvote/`
            );
            return response.data;
        } catch (error) {
            console.error('Error downvoting content:', error);
            throw error;
        }
    }
};

export default votesApi; 