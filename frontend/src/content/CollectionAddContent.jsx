import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LibrarySelectMultiple from './LibrarySelectMultiple';
import contentApi from '../api/contentApi';

const CollectionAddContent = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        console.log('CollectionAddContent mounted with collectionId:', collectionId);
    }, [collectionId]);

    const handleCancel = () => {
        navigate(`/content/collections/${collectionId}`);
    };

    const handleSave = async (selectedContentProfileIds) => {
        try {
            console.log('Saving content to collection:', {
                collectionId,
                selectedContentProfileIds
            });
            // Make a single API call with all selected content profile IDs
            await contentApi.addContentToCollection(collectionId, selectedContentProfileIds);
            navigate(`/content/collections/${collectionId}`);
        } catch (error) {
            console.error('Failed to add content to collection:', error);
            throw error;
        }
    };

    const filterContent = (content) => {
        // Filter out content that's already in this collection
        const isInCollection = content.collection?.id === parseInt(collectionId);
        console.log('CollectionAddContent filtering content:', {
            contentId: content.id,
            contentTitle: content.title,
            collectionId: collectionId,
            isInCollection,
            contentCollection: content.collection,
            contentStructure: JSON.stringify(content, null, 2)
        });
        return !isInCollection;
    };

    return (
        <LibrarySelectMultiple
            title="Add Content to Collection"
            description="Select content from your library to add to this collection"
            onCancel={handleCancel}
            onSave={handleSave}
            filterFunction={filterContent}
        />
    );
};

export default CollectionAddContent; 