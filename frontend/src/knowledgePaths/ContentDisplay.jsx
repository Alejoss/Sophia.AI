import React from 'react';

const ContentDisplay = ({ content }) => {
  if (!content) return null;

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-600">Selected content:</p>
      <p className="font-medium">{content.original_title}</p>
      <p className="text-sm text-gray-500">{content.media_type}</p>
      {content.media_type === 'IMAGE' && content.file_details?.file && (
        <div className="mt-2">
          <img
            src={content.file_details.file.startsWith('http') 
              ? content.file_details.file  // TODO this should use a .env variable
              : `http://localhost:8000${content.file_details.file}`  // TODO this should use a .env variable
            }
            alt={content.original_title}
            className="max-h-48 rounded-lg object-contain"
            onError={(e) => {
              console.error('Image failed to load:', content.file_details.file);
              e.target.src = '/placeholder-image.png';
              e.target.onerror = null;
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ContentDisplay; 