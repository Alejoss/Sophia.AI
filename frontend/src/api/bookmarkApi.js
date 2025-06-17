import axiosInstance from './axiosConfig';

// Map frontend media types to Django model names
const contentTypeMap = {
    'IMAGE': 'content',
    'TEXT': 'content',
    'VIDEO': 'content',
    'AUDIO': 'content'
};

export const checkBookmarkStatus = async (contentId, contentType, topicId = null) => {
    try {
        const params = {
            content_type: contentType,
            object_id: contentId
        };
        if (topicId) {
            params.topic_id = topicId;
        }
        const response = await axiosInstance.get('/bookmarks/check_status/', { params });
        return response.data;
    } catch (error) {
        console.error('Error checking bookmark status:', error);
        throw error;
    }
};

export const toggleBookmark = async (contentId, contentType, topicId = null, collection = null) => {
    try {
        const data = {
            content_type: contentType,
            object_id: contentId
        };
        if (topicId) {
            data.topic_id = topicId;
        }
        if (collection) {
            data.collection = collection;
        }
        const response = await axiosInstance.post('/bookmarks/toggle/', data);
        return response.data;
    } catch (error) {
        console.error('Error toggling bookmark:', error);
        throw error;
    }
};

export const getBookmarks = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/bookmarks/', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting bookmarks:', error);
        throw error;
    }
};

export const getCollections = async () => {
    try {
        const response = await axiosInstance.get('/bookmarks/collections/');
        return response.data;
    } catch (error) {
        console.error('Error getting collections:', error);
        throw error;
    }
};

export const deleteBookmark = async (bookmarkId) => {
    try {
        const response = await axiosInstance.delete(`/bookmarks/${bookmarkId}/`);
        return response.data;
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        throw error;
    }
};

const bookmarkApi = {
    checkBookmarkStatus: checkBookmarkStatus,
    toggleBookmark: toggleBookmark,
    getBookmarks: getBookmarks,
    getCollections: getCollections,
    deleteBookmark: deleteBookmark
};

export default bookmarkApi; 