import axiosInstance from './axiosConfig';

const generalApi = {
    /**
     * Search for content, topics, knowledge paths, or people
     * @param {string} query - The search query
     * @param {string} type - The type of content to search for ('all', 'content', 'topics', 'knowledge_paths', 'people')
     * @param {number} page - The page number (optional, default: 1)
     * @param {number} pageSize - The number of results per page (optional, default: 10)
     * @returns {Promise} - A promise that resolves to the paginated search results
     */
    search: async (query, type = 'all', page = 1, pageSize = 10) => {
        try {
            const response = await axiosInstance.get('/search/', {
                params: {
                    q: query,
                    type: type,
                    page: page,
                    page_size: pageSize
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error performing search:', error);
            throw error;
        }
    },

    /**
     * Get global statistics or information
     * @returns {Promise} - A promise that resolves to the global statistics
     */
    getGlobalStats: async () => {
        try {
            const response = await axiosInstance.get('/general/stats/');
            return response.data;
        } catch (error) {
            console.error('Error fetching global statistics:', error);
            throw error;
        }
    },

    /**
     * Get featured content
     * @returns {Promise} - A promise that resolves to the featured content
     */
    getFeaturedContent: async () => {
        try {
            const response = await axiosInstance.get('/general/featured/');
            return response.data;
        } catch (error) {
            console.error('Error fetching featured content:', error);
            throw error;
        }
    }
};

export default generalApi; 