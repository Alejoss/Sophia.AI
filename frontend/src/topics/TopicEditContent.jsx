import { Navigate, useParams } from 'react-router-dom';

const TopicEditContent = () => {
  const { topicId } = useParams();
  return <Navigate to={`/content/topics/${topicId}/edit?tab=content`} replace />;
};

export default TopicEditContent;
