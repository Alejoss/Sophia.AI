import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import contentApi from '../api/contentApi';

// ContentDisplay Mode: Uses SimpleContentProfileSerializer for minimal information in content selection
const TopicAddContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [selectedContentProfileIds, setSelectedContentProfileIds] = useState([]);

    console.log('TopicAddContent rendering with topicId:', topicId);

    const handleCancel = () => {
        console.log('TopicAddContent: Cancel clicked');
        navigate(`/content/topics/${topicId}`);
    };

    const handleSave = async (selectedContentProfileIds) => {
        try {
            console.log('TopicAddContent - handleSave called with:', {
                topicId,
                selectedContentProfileIds
            });

            // Make API call with the content profile IDs
            const response = await contentApi.addContentToTopic(topicId, selectedContentProfileIds);
            console.log('TopicAddContent - API response:', response);
            navigate(`/content/topics/${topicId}`);
        } catch (error) {
            console.error('TopicAddContent - Failed to add content to topic:', error.response || error);
            throw error;
        }
    };

    const handleSelectionChange = (selectedContentProfiles) => {
        // Store the content profile IDs
        const profileIds = selectedContentProfiles.map(profile => profile.id);
        setSelectedContentProfileIds(profileIds);
        console.log('TopicAddContent - Selection changed, profile IDs:', profileIds);
    };

    const filterContent = (content) => {
        // Filter out content that's already in this topic
        const isInTopic = content.content.topics?.some(topicIdInArray => topicIdInArray === parseInt(topicId));
        
        console.log('TopicAddContent filtering content:', {
            contentProfileId: content.id,
            contentTitle: content.title,
            topicId: topicId,
            isInTopic,
            topics: content.content.topics,
            contentStructure: JSON.stringify(content, null, 2)
        });
        return !isInTopic;
    };

    console.log('TopicAddContent: About to render LibrarySelectMultiple');
    
    return (
        <LibrarySelectMultiple
            title={`Add Content to Topic (ID: ${topicId})`}
            description="Select content from your library to add to this topic"
            onCancel={handleCancel}
            onSave={handleSave}
            onSelectionChange={handleSelectionChange}
            filterFunction={filterContent}
            contextName={topicId}
            selectedIds={selectedContentProfileIds}
        />
    );
};

export default TopicAddContent; 