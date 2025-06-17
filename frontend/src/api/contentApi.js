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
            // Debug logging
            console.log('\n=== Content Upload Request ===');
            if (contentData instanceof FormData) {
                console.log('FormData contents:');
                for (let [key, value] of contentData.entries()) {
                    if (value instanceof File) {
                        console.log(`${key}: File(name=${value.name}, type=${value.type}, size=${value.size})`);
                    } else {
                        console.log(`${key}: ${value}`);
                    }
                }
            } else {
                console.log('Content data:', contentData);
            }

            const response = await axiosInstance.post('/content/upload-content/', contentData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            console.log('Upload response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error uploading content:', error);
            if (error.response) {
                console.error('Error response:', error.response.data);
            }
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
            const response = await axiosInstance.get('/content/recent-content/');
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

    createContentProfile: async (contentId, profileData) => {
        try {
            const response = await axiosInstance.post(`/content/content-profiles/`, {
                content: contentId,
                ...profileData
            });
            return response.data;
        } catch (error) {
            console.error('Error creating content profile:', error);
            throw error;
        }
    },

    fetchUrlMetadata: async (url) => {
        console.log('\n=== Fetching URL Metadata ===');
        console.log('URL:', url);
        
        try {
            // First try server-side proxy if CORS allows
            try {
                console.log('Attempting server-side proxy...');
                const response = await axiosInstance.post('/content/preview-url/', { url });
                console.log('Server proxy successful:', response.data);
                return response.data;
            } catch (error) {
                // Log the full error for debugging
                console.log('Server proxy failed:', error.response?.data?.error || error.message);
                
                // If we got an error message from the server, use it
                if (error.response?.data?.error) {
                    throw new Error(error.response.data.error);
                }
                
                console.log('Falling back to client-side fetch');
            }

            // Only try client-side fetch for certain domains that we know support CORS
            const allowedDomains = ['youtube.com', 'youtu.be', 'github.com', 'githubusercontent.com'];
            const urlDomain = new URL(url).hostname;
            const isAllowedDomain = allowedDomains.some(domain => urlDomain.includes(domain));

            if (!isAllowedDomain) {
                throw new Error('Unable to fetch preview for this URL');
            }

            // Fallback to direct fetch if server fails
            console.log('Making direct fetch request...');
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch URL data');
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/html')) {
                throw new Error('URL must point to a webpage');
            }

            const html = await response.text();
            console.log('Parsing HTML content...');
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // Extract Open Graph metadata
            console.log('Extracting metadata...');
            const metadata = {
                title: getMetaContent(doc, 'og:title') || doc.title,
                description: getMetaContent(doc, 'og:description') || getMetaContent(doc, 'description'),
                image: getMetaContent(doc, 'og:image'),
                siteName: getMetaContent(doc, 'og:site_name'),
                type: getMetaContent(doc, 'og:type') || 'website',
                favicon: getFavicon(doc, url)
            };

            console.log('Initial metadata:', metadata);

            // Special handling for YouTube
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                console.log('Detected YouTube URL, fetching additional data...');
                const videoId = extractYouTubeId(url);
                if (videoId) {
                    console.log('YouTube video ID:', videoId);
                    metadata.image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                    metadata.type = 'video';
                    metadata.siteName = 'YouTube';
                    
                    try {
                        console.log('Fetching YouTube oEmbed data...');
                        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                        const oembedResponse = await fetch(oembedUrl);
                        if (!oembedResponse.ok) {
                            throw new Error('Failed to fetch YouTube data');
                        }
                        const oembedData = await oembedResponse.json();
                        if (oembedData.title) {
                            console.log('YouTube title:', oembedData.title);
                            metadata.title = oembedData.title;
                        }
                    } catch (e) {
                        console.warn('Failed to fetch YouTube oEmbed data:', e.message);
                    }
                }
            }

            // Validate required fields
            if (!metadata.title && !metadata.description && !metadata.image) {
                throw new Error('Could not extract preview information from this URL');
            }

            console.log('Final metadata:', metadata);
            return metadata;
        } catch (error) {
            // Log the full error for debugging
            console.error('Error fetching URL metadata:', error);
            
            // Return a user-friendly error message
            throw new Error(error.message || 'Failed to fetch URL data');
        }
    }
};

// Helper functions
function getMetaContent(doc, property) {
    // Try Open Graph meta first
    const ogMeta = doc.querySelector(`meta[property="${property}"]`);
    if (ogMeta) return ogMeta.getAttribute('content');

    // Try name attribute as fallback
    const nameMeta = doc.querySelector(`meta[name="${property}"]`);
    if (nameMeta) return nameMeta.getAttribute('content');

    return null;
}

function getFavicon(doc, url) {
    // Try standard favicon locations
    const links = Array.from(doc.querySelectorAll('link[rel*="icon"]'));
    if (links.length > 0) {
        // Sort by size preference if specified
        links.sort((a, b) => {
            const sizeA = parseInt(a.getAttribute('sizes')?.split('x')[0] || '0');
            const sizeB = parseInt(b.getAttribute('sizes')?.split('x')[0] || '0');
            return sizeB - sizeA;
        });
        const href = links[0].getAttribute('href');
        if (href) {
            return href.startsWith('http') ? href : new URL(href, url).href;
        }
    }

    // Fallback to default favicon location
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
}

function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
        /^[^&?/]+$/  // Direct video ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

export default contentApi;
