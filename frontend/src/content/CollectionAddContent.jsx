import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LibrarySelectMultiple from './LibrarySelectMultiple';
import contentApi from '../api/contentApi';

const CollectionAddContent = () => {
  const { collectionId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {

  }, [collectionId]);

  const handleCancel = () => {
    navigate(`/content/collections/${collectionId}`);
  };

  const handleSave = async (selectedContentProfileIds) => {
    try {


      // Make a single API call with all selected content profile IDs
      await contentApi.addContentToCollection(collectionId, selectedContentProfileIds);
      navigate(`/content/collections/${collectionId}`);
    } catch (error) {
      console.error('Failed to add content to collection:', error);
      throw error;
    }
  };

  return (
    <LibrarySelectMultiple
      title="Add Content to Collection"
      description="Select content from your library to add to this collection"
      onCancel={handleCancel}
      onSave={handleSave}
      excludeCollectionId={collectionId}
    />
  );


};

export default CollectionAddContent;