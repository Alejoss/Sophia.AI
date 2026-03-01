import axiosInstance from './axiosConfig';

const contentApi = {
    getUserContent: async () => {
        try {
            const response = await axiosInstance.get('/content/user-content/');
            return response.data;
        } catch (error) {
            console.error('Error fetching user content:', error);
            if (error.code === 'ECONNABORTED') {
                throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
            }
            throw error;
        }
    },

    getUserContentWithDetails: async () => {
        try {
            const response = await axiosInstance.get('/content/user-content-with-details/');
            return response.data;
        } catch (error) {
            console.error('Error fetching user content with details:', error);
            if (error.code === 'ECONNABORTED') {
                throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
            }
            throw error;
        }
    },

    getUserContentById: async (userId) => {
        try {
            const response = await axiosInstance.get(`/content/user-content/${userId}/`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching content for user ${userId}:`, error);
            if (error.code === 'ECONNABORTED') {
                throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
            }
            if (error.response?.status === 404) {
                throw new Error(`Usuario con ID ${userId} no encontrado.`);
            }
            throw error;
        }
    },

    // Presign: get URL to upload file directly to S3
    uploadContentPresign: async (metadata) => {
        console.log('[S3 upload] Presign request:', { filename: metadata?.filename, file_size: metadata?.file_size, media_type: metadata?.media_type });
        try {
            const response = await axiosInstance.post('/content/upload-content/presign/', metadata, {
                timeout: 15000,
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('[S3 upload] Presign OK, key:', response.data?.key);
            return response.data;
        } catch (err) {
            console.error('[S3 upload] Presign failed:', err.response?.status, err.response?.data || err.message);
            throw err;
        }
    },

    // Upload file directly to S3 with optional progress (XHR for progress)
    uploadFileToS3: async (file, uploadUrl, onProgress) => {
        const urlHost = uploadUrl ? new URL(uploadUrl).host : '(no URL)';
        console.log('[S3 upload] PUT to S3 starting, host:', urlHost, 'size:', file?.size);
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            xhr.withCredentials = false;
            if (onProgress && xhr.upload) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total });
                };
            }
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('[S3 upload] PUT to S3 success, status:', xhr.status);
                    resolve();
                } else {
                    console.error('[S3 upload] PUT to S3 failed:', xhr.status, xhr.statusText);
                    reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => {
                console.error('[S3 upload] PUT to S3 network error');
                reject(new Error('S3 upload failed'));
            };
            xhr.send(file);
        });
    },

    // Confirm: after S3 upload, create Content/ContentProfile/FileDetails
    uploadContentConfirm: async (key, metadata) => {
        console.log('[S3 upload] Confirm request, key:', key);
        try {
            const response = await axiosInstance.post('/content/upload-content/confirm/', { key, ...metadata }, {
                timeout: 15000,
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('[S3 upload] Confirm OK, content_id:', response.data?.content_id);
            return response.data;
        } catch (err) {
            console.error('[S3 upload] Confirm failed:', err.response?.status, err.response?.data || err.message);
            throw err;
        }
    },

    // Full S3 flow: presign -> upload to S3 -> confirm. Falls back to FormData upload if S3 not configured (e.g. dev).
    uploadContentViaS3: async (file, metadata, onProgress) => {
        console.log('[S3 upload] Starting flow for file:', file?.name, 'size:', file?.size);
        try {
            const presignData = await contentApi.uploadContentPresign({
                filename: file.name,
                file_size: file.size,
                content_type: file.type || 'application/octet-stream',
                media_type: metadata.media_type,
                title: metadata.title,
                author: metadata.author,
                personalNote: metadata.personalNote,
                is_visible: metadata.is_visible,
                is_producer: metadata.is_producer
            });
            await contentApi.uploadFileToS3(file, presignData.upload_url, onProgress);
            const result = await contentApi.uploadContentConfirm(presignData.key, {
                media_type: metadata.media_type,
                title: metadata.title,
                author: metadata.author,
                personalNote: metadata.personalNote,
                is_visible: metadata.is_visible,
                is_producer: metadata.is_producer,
                file_size: file.size
            });
            console.log('[S3 upload] Flow complete, content_id:', result?.content_id);
            return result;
        } catch (err) {
            if (err.response?.status === 503) {
                console.warn('[S3 upload] 503 received, falling back to FormData upload');
                const formData = new FormData();
                formData.append('file', file);
                formData.append('media_type', metadata.media_type);
                formData.append('title', metadata.title || '');
                formData.append('author', metadata.author || '');
                formData.append('personalNote', metadata.personalNote || '');
                formData.append('is_visible', String(metadata.is_visible ?? true));
                formData.append('is_producer', String(metadata.is_producer ?? false));
                const fallbackResult = await contentApi.uploadContent(formData, { onUploadProgress: onProgress ? (e) => onProgress(e) : undefined });
                console.log('[S3 upload] FormData fallback OK, content_id:', fallbackResult?.content_id);
                return fallbackResult;
            }
            console.error('[S3 upload] Flow failed:', err.response?.status, err.message);
            throw err;
        }
    },

    // Legacy: single POST with FormData (used for URL-only or fallback)
    uploadContent: async (contentData, options = {}) => {
        try {
            const config = contentData instanceof FormData
                ? {
                    timeout: options.timeout ?? 60000,
                    onUploadProgress: options.onUploadProgress
                }
                : { headers: { 'Content-Type': 'multipart/form-data' } };
            const response = await axiosInstance.post('/content/upload-content/', contentData, config);
            return response.data;
        } catch (error) {
            console.error('Error uploading content:', error);
            if (error.response) console.error('Error response:', error.response.data);
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

    getContentPreview: async (contentId, context = null, contextId = null) => {
        try {
            let url = `/content/content_preview/${contentId}/`;
            if (context && contextId) {
                url += `?context=${context}&id=${contextId}`;
            }
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching content preview:', error);
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

    getCollection: async (collectionId) => {
        try {
            const response = await axiosInstance.get(`/content/collections/${collectionId}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching collection:', error.response || error);
            throw error;
        }
    },

    updateCollection: async (collectionId, collectionData) => {
        try {
            const response = await axiosInstance.patch(`/content/collections/${collectionId}/`, collectionData);
            return response.data;
        } catch (error) {
            console.error('Error updating collection:', error.response || error);
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

    getTopicDetailsSimple: async (topicId) => {
        try {
            const response = await axiosInstance.get(`/content/topics/${topicId}/content-simple/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching topic details (simple):', error);
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

    updateContentProfileContent: async (profileId, contentId) => {
        try {
            const response = await axiosInstance.put(
                `/content/content-profiles/${profileId}/`,
                { content_id: contentId }
            );
            return response.data;
        } catch (error) {
            console.error('Error updating content profile content reference:', error);
            throw error;
        }
    },

    updateContent: async (contentId, contentData) => {
        try {
            console.log('contentApi.updateContent called with:', { contentId, contentData });
            const response = await axiosInstance.put(
                `/content/content_update/${contentId}/`,
                contentData
            );
            console.log('contentApi.updateContent response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error updating content:', error);
            console.error('Error response:', error.response?.data);
            throw error;
        }
    },

    checkContentModification: async (contentId) => {
        try {
            const response = await axiosInstance.get(`/content/content_modification_check/${contentId}/`);
            return response.data;
        } catch (error) {
            console.error('Error checking content modification:', error);
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

    deleteTopic: async (topicId) => {
        try {
            await axiosInstance.delete(`/content/topics/${topicId}/`);
        } catch (error) {
            console.error('Error deleting topic:', error);
            throw error;
        }
    },

    addTopicModerators: async (topicId, usernames) => {
        try {
            const response = await axiosInstance.post(`/content/topics/${topicId}/moderators/`, {
                usernames: usernames
            });
            return response.data;
        } catch (error) {
            console.error('Error adding topic moderators:', error);
            throw error;
        }
    },

    removeTopicModerators: async (topicId, usernames) => {
        try {
            const response = await axiosInstance.delete(`/content/topics/${topicId}/moderators/`, {
                data: { usernames: usernames }
            });
            return response.data;
        } catch (error) {
            console.error('Error removing topic moderators:', error);
            throw error;
        }
    },

    searchUsersByUsername: async (query) => {
        try {
            const response = await axiosInstance.get('/content/users/search/', {
                params: { q: query || '' }
            });
            return response.data?.results ?? [];
        } catch (error) {
            console.error('Error searching users:', error.response || error);
            return [];
        }
    },

    inviteTopicModerator: async (topicId, username, message = '') => {
        try {
            const response = await axiosInstance.post(`/content/topics/${topicId}/moderators/invite/`, {
                username: username,
                message: message
            });
            return response.data;
        } catch (error) {
            console.error('Error inviting topic moderator:', error.response || error);
            throw error;
        }
    },

    getTopicModeratorInvitations: async (topicId) => {
        try {
            const response = await axiosInstance.get(`/content/topics/${topicId}/moderators/invitations/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching topic moderator invitations:', error.response || error);
            throw error;
        }
    },

    acceptTopicModeratorInvitation: async (topicId, invitationId) => {
        try {
            const response = await axiosInstance.post(`/content/topics/${topicId}/moderators/invitations/${invitationId}/accept/`);
            return response.data;
        } catch (error) {
            console.error('Error accepting topic moderator invitation:', error.response || error);
            throw error;
        }
    },

    declineTopicModeratorInvitation: async (topicId, invitationId) => {
        try {
            const response = await axiosInstance.post(`/content/topics/${topicId}/moderators/invitations/${invitationId}/decline/`);
            return response.data;
        } catch (error) {
            console.error('Error declining topic moderator invitation:', error.response || error);
            throw error;
        }
    },

    getUserTopics: async (type = null) => {
        try {
            const url = type ? `/content/user/topics/?type=${type}` : '/content/user/topics/';
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching user topics:', error.response || error);
            throw error;
        }
    },

    getUserTopicInvitations: async (status = 'PENDING') => {
        try {
            const response = await axiosInstance.get(`/content/user/topics/invitations/?status=${status}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching user topic invitations:', error.response || error);
            throw error;
        }
    },

    // Content Suggestions API methods
    createContentSuggestion: async (topicId, contentId, message = '') => {
        try {
            const response = await axiosInstance.post(
                `/content/topics/${topicId}/content-suggestions/create/`,
                { content_id: contentId, message: message }
            );
            return response.data;
        } catch (error) {
            console.error('Error creating content suggestion:', error.response || error);
            throw error;
        }
    },

    getTopicContentSuggestions: async (topicId, filters = {}) => {
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.is_duplicate !== undefined) params.append('is_duplicate', filters.is_duplicate);
            
            const url = `/content/topics/${topicId}/content-suggestions${params.toString() ? '?' + params.toString() : ''}`;
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching topic content suggestions:', error.response || error);
            throw error;
        }
    },

    acceptContentSuggestion: async (topicId, suggestionId) => {
        try {
            const response = await axiosInstance.post(
                `/content/topics/${topicId}/content-suggestions/${suggestionId}/accept/`
            );
            return response.data;
        } catch (error) {
            console.error('Error accepting content suggestion:', error.response || error);
            throw error;
        }
    },

    rejectContentSuggestion: async (topicId, suggestionId, rejectionReason) => {
        try {
            const response = await axiosInstance.post(
                `/content/topics/${topicId}/content-suggestions/${suggestionId}/reject/`,
                { rejection_reason: rejectionReason }
            );
            return response.data;
        } catch (error) {
            console.error('Error rejecting content suggestion:', error.response || error);
            throw error;
        }
    },

    getUserContentSuggestions: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.topic_id) params.append('topic_id', filters.topic_id);
            
            const url = `/content/user/content-suggestions${params.toString() ? '?' + params.toString() : ''}`;
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching user content suggestions:', error.response || error);
            throw error;
        }
    },
    deleteContentSuggestion: async (topicId, suggestionId) => {
        try {
            const response = await axiosInstance.delete(
                `/content/topics/${topicId}/content-suggestions/${suggestionId}/`
            );
            return response.data;
        } catch (error) {
            console.error('Error deleting content suggestion:', error.response || error);
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
                throw new Error('No se puede obtener la vista previa para esta URL');
            }

            // Fallback to direct fetch if server fails
            console.log('Making direct fetch request...');
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Error al obtener los datos de la URL');
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/html')) {
                throw new Error('La URL debe apuntar a una página web');
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
                            throw new Error('Error al obtener los datos de YouTube');
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
                throw new Error('No se pudo extraer la información de vista previa de esta URL');
            }

            console.log('Final metadata:', metadata);
            return metadata;
        } catch (error) {
            // Log the full error for debugging
            console.error('Error fetching URL metadata:', error);
            
            // Return a user-friendly error message
            throw new Error(error.message || 'Error al obtener los datos de la URL');
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
