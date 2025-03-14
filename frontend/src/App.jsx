import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';

import Home from './generalComponents/Home.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import ProfileDetail from './profiles/ProfileDetail.jsx';
import ProfileData from './profiles/ProfileData.jsx';
import Bookmarks from './profiles/Bookmarks.jsx';
import Certificates from './profiles/Certificates.jsx';
import Events from './profiles/Events.jsx';
import Login from './profiles/Login.jsx';
import LoginSuccessful from './profiles/LoginSuccessful.jsx';
import Logout from './profiles/Logout.jsx';
import UploadContentForm from './content/UploadContentForm.jsx';
import LibraryUser from './content/LibraryUser.jsx';
import CollectionsUser from './content/CollectionsUser.jsx';
import CreateCollectionForm from './content/CreateCollectionForm.jsx';
import Collection from './content/Collection.jsx';
import CollectionEditContent from './content/CollectionEditContent.jsx';
import ContentDetailsTopic from './content/ContentDetailsTopic';
import TopicCreationForm from './content/TopicCreationForm';
import TopicEdit from './content/TopicEdit';
import TopicList from './content/TopicList';
import TopicAddContent from './content/TopicAddContent';
import TopicEditContent from './content/TopicEditContent';
import TopicDetail from './content/TopicDetail';
import TopicContentMediaType from './content/TopicContentMediaType';
import ContentDetailsLibrary from './content/ContentDetailsLibrary';
import KnowledgePathCreationForm from './knowledgePaths/KnowledgePathCreationForm';
import KnowledgePathEdit from './knowledgePaths/KnowledgePathEdit';
import KnowledgePathList from './knowledgePaths/KnowledgePathList';
import KnowledgePathDetail from './knowledgePaths/KnowledgePathDetail';
import QuizCreate from './quizzes/QuizCreate';
import ContentEdit from './content/ContentEdit.jsx';
import NodeCreate from './knowledgePaths/NodeCreate';
import NodeEdit from './knowledgePaths/NodeEdit';
import NodeDetail from './knowledgePaths/NodeDetail';

const App = () => {
  return (
    <AuthProvider>

    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="profiles">
            <Route path="login" element={<Login />} />
            <Route path="login_successful" element={<LoginSuccessful />} />
            <Route path="logout" element={<Logout />} />
            <Route path="profile_certificates" element={<Certificates />} />
            <Route path="profile_data" element={<ProfileData />} />
            <Route path="profile_events" element={<Events />} />
            <Route path="profile_bookmarks" element={<Bookmarks />} />          
            <Route path="user_profile/:profileId" element={<ProfileDetail />} />
          </Route>
          <Route path="content">
            <Route path="upload_content" element={<UploadContentForm />} />
            <Route path="library_user" element={<LibraryUser />} />
            <Route path="collections" element={<CollectionsUser />} />
            <Route path="collections/create" element={<CreateCollectionForm />} />
            <Route path="collections/:collectionId" element={<Collection />} />
            <Route path="collections/:collectionId/edit" element={<CollectionEditContent />} />
            <Route path="create_topic" element={<TopicCreationForm />} />
            <Route path="topics/:topicId/edit" element={<TopicEdit />} />
            <Route path="topics" element={<TopicList />} />
            <Route path="topics/:topicId/add-content" element={<TopicAddContent />} />
            <Route path="topics/:topicId/edit-content" element={<TopicEditContent />} />
            <Route path="topics/:topicId" element={<TopicDetail />} />
            <Route path="topics/:topicId/:mediaType" element={<TopicContentMediaType />} />
            <Route path=":contentId/topic/:topicId" element={<ContentDetailsTopic />} />
            <Route path=":contentId/library" element={<ContentDetailsLibrary />} />
            <Route path=":contentId/edit" element={<ContentEdit />} />
          </Route>
          <Route path="knowledge_path">
            <Route path="" element={<KnowledgePathList />} />
            <Route path=":pathId" element={<KnowledgePathDetail />} />
            <Route path="create" element={<KnowledgePathCreationForm />} />
            <Route path=":pathId/edit" element={<KnowledgePathEdit />} />
            <Route path=":pathId/add-node" element={<NodeCreate />} />
            <Route path=":pathId/add-quiz" element={<QuizCreate />} />
            <Route path=":pathId/nodes/:nodeId/edit" element={<NodeEdit />} />
            <Route path=":pathId/nodes/:nodeId" element={<NodeDetail />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
