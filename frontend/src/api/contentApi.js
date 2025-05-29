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

    getUserContentById: async (userId) => {
        try {
            const response = await axiosInstance.get(`/content/user-content/${userId}/`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching content for user ${userId}:`, error);
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

    getContentDetails: async (contentId, context = null, contextId = null) => {
        try {
            let url = `/content/content_details/${contentId}/`;
            if (context && contextId) {
                url += `?context=${context}&id=${contextId}`;
            }
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching content details:', error);
            throw error;
        }
    },

    getUserCollections: async () => {
        try {
            const response = await axiosInstance.get('/content/collections/');
            return response.data;
        } catch (error) {
            console.error('Error fetching user collections:', error);
            throw error;
        }
    },

    createCollection: async (collectionData) => {
        try {
            const response = await axiosInstance.post('/content/collections/', collectionData);
            return response.data;
        } catch (error) {
            console.error('Error creating collection:', error);
            throw error;
        }
    },

    getCollectionContent: async (collectionId) => {
        try {
            const response = await axiosInstance.get(`/content/collections/${collectionId}/content/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching collection content:', error.response || error);
            throw error;
        }
    },

    addContentToCollection: async (collectionId, contentProfileIds) => {
        try {
            // Ensure contentProfileIds is an array
            const ids = Array.isArray(contentProfileIds) ? contentProfileIds : [contentProfileIds];
            
            const response = await axiosInstance.post(`/content/collections/${collectionId}/content/`, {
                content_profile_ids: ids
            });
            return response.data;
        } catch (error) {
            console.error('Error adding content to collection:', error);
            throw error;
        }
    },

    removeContentFromCollection: async (contentProfileId) => {
        try {
            const response = await axiosInstance.patch(`/content/content-profiles/${contentProfileId}/`, {
                collection: null
            });
            return response.data;
        } catch (error) {
            console.error('Error removing content from collection:', error);
            throw error;
        }
    },

    createTopic: async (topicData) => {
        try {
            const response = await axiosInstance.post('/content/topics/', topicData);
            return response.data;
        } catch (error) {
            console.error('Error creating topic:', error);
            throw error;
        }
    },

    getTopicDetails: async (topicId) => {
        try {
            const response = await axiosInstance.get(`/content/topics/${topicId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching topic details:', error);
            throw error;
        }
    },

    updateTopicImage: async (topicId, formData) => {
        try {
            const response = await axiosInstance.patch(
                `/content/topics/${topicId}/`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error updating topic image:', error);
            throw error;
        }
    },

    getTopics: async () => {
        try {
            const response = await axiosInstance.get('/content/topics/');
            return response.data;
        } catch (error) {
            console.error('Error fetching topics:', error);
            throw error;
        }
    },

    addContentToTopic: async (topicId, contentProfileIds) => {
        try {
            const response = await axiosInstance.post(`/content/topics/${topicId}/content/`, {
                content_profile_ids: contentProfileIds
            });
            return response.data;
        } catch (error) {
            console.error('Error adding content to topic:', error.response || error);
            throw error;
        }
    },

    removeContentFromTopic: async (topicId, contentIds) => {
        try {
            const response = await axiosInstance.patch(`/content/topics/${topicId}/content/`, {
                content_ids: contentIds
            });
            return response.data;
        } catch (error) {
            console.error('Error removing content from topic:', error);
            throw error;
        }
    },

    getTopicContentByType: async (topicId, mediaType) => {
        try {
            const response = await axiosInstance.get(`/content/topics/${topicId}/content/${mediaType}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching topic content by type:', error);
            throw error;
        }
    },

    getTopicBasicDetails: async (topicId) => {
        try {
            const response = await axiosInstance.get(`/content/topics/${topicId}/basic/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching topic basic details:', error);
            throw error;
        }
    },

    getRecentContent: async () => {
        try {
            const response = await axiosInstance.get('/content/recent-user-content/');
            return response.data;
        } catch (error) {
            console.error('Error fetching recent content:', error);
            throw error;
        }
    },

    updateContentProfile: async (profileId, profileData) => {
        try {
            const response = await axiosInstance.patch(
                `/content/content-profiles/${profileId}/`,
                profileData
            );
            return response.data;
        } catch (error) {
            console.error('Error updating content profile:', error);
            throw error;
        }
    },

    deleteContent: async (contentId) => {
        try {
            await axiosInstance.delete(`/content/content_details/${contentId}/`);
        } catch (error) {
            console.error('Error deleting content:', error);
            throw error;
        }
    },

    createPublication: async (publicationData) => {
        try {
            const response = await axiosInstance.post('/content/publications/', publicationData);
            return response.data;
        } catch (error) {
            console.error('Error creating publication:', error);
            throw error;
        }
    },

    getUserPublications: async () => {
        try {
            const response = await axiosInstance.get('/content/publications/');
            return response.data;
        } catch (error) {
            console.error('Error fetching user publications:', error);
            throw error;
        }
    },

    getUserPublicationsById: async (userId) => {
        try {
            const response = await axiosInstance.get(`/content/publications/user/${userId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching user publications:', error);
            throw error;
        }
    },

    getPublicationDetails: async (publicationId) => {
        try {
            const response = await axiosInstance.get(`/content/publications/${publicationId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching publication details:', error);
            throw error;
        }
    },

    updatePublication: async (publicationId, publicationData) => {
        try {
            const response = await axiosInstance.put(`/content/publications/${publicationId}/`, publicationData);
            return response.data;
        } catch (error) {
            console.error('Error updating publication:', error);
            throw error;
        }
    },

    deletePublication: async (publicationId) => {
        try {
            const response = await axiosInstance.delete(`/content/publications/${publicationId}/`);
            return response.data;
        } catch (error) {
            console.error('Error deleting publication:', error);
            throw error;
        }
    },

    getContentReferences: async (contentId) => {
        try {
            const response = await axiosInstance.get(`/content/references/${contentId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching content references:', error);
            throw error;
        }
    },

    updateTopic: async (topicId, topicData) => {
        try {
            const response = await axiosInstance.patch(`/content/topics/${topicId}/`, topicData);
            return response.data;
        } catch (error) {
            console.error('Error updating topic:', error);
            throw error;
        }
    },
};

export default contentApi;
