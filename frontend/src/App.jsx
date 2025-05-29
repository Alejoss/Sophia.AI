import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import GoogleOAuthInitializer from './components/GoogleOAuthInitializer';

import Home from './generalComponents/Home.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import ProfileDetail from './profiles/ProfileDetail.jsx';
import PersonalProfile from './profiles/PersonalProfile.jsx';
import EditProfile from './profiles/EditProfile.jsx';
import Bookmarks from './profiles/Bookmarks.jsx';
import Certificates from './profiles/Certificates.jsx';
import Events from './profiles/Events.jsx';
import Login from './profiles/Login.jsx';
import LoginSuccessful from './profiles/LoginSuccessful.jsx';
import Logout from './profiles/Logout.jsx';
import Register from './profiles/Register.jsx';
import Welcome from './profiles/Welcome.jsx';
import UploadContentForm from './content/UploadContentForm.jsx';
import UploadContent from './content/UploadContent.jsx';
import LibraryUser from './content/LibraryUser.jsx';
import CollectionsUser from './content/CollectionsUser.jsx';
import CreateCollectionForm from './content/CreateCollectionForm.jsx';
import Collection from './content/Collection.jsx';
import CollectionEditContent from './content/CollectionEditContent.jsx';
import ContentDetailsTopic from './content/ContentDetailsTopic';
import ContentDetailsLibrary from './content/ContentDetailsLibrary';
import ContentDetailsSearch from './content/ContentDetailsSearch';
import TopicCreationForm from './topics/TopicCreationForm';
import TopicEdit from './topics/TopicEdit';
import TopicList from './topics/TopicList';
import TopicAddContent from './topics/TopicAddContent';
import TopicEditContent from './topics/TopicEditContent';
import TopicDetail from './topics/TopicDetail';
import TopicContentMediaType from './topics/TopicContentMediaType';
import ContentEdit from './content/ContentEdit.jsx';
import KnowledgePathCreationForm from './knowledgePaths/KnowledgePathCreationForm';
import KnowledgePathEdit from './knowledgePaths/KnowledgePathEdit';
import KnowledgePathList from './knowledgePaths/KnowledgePathList';
import KnowledgePathDetail from './knowledgePaths/KnowledgePathDetail';
import QuizForm from './quizzes/QuizForm';
import NodeCreate from './knowledgePaths/NodeCreate';
import NodeEdit from './knowledgePaths/NodeEdit';
import NodeDetail from './knowledgePaths/NodeDetail';
import Quiz from './quizzes/Quiz';
import PublicationCreationForm from './publications/PublicationCreationForm';
import PublicationEditForm from './publications/PublicationEditForm';
import UploadContentLibrary from './content/UploadContentLibrary';
import PublicationDetail from './publications/PublicationDetail';
import MainSearch from './generalComponents/MainSearch';
import MessageThread from './messages/MessageThread.jsx';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="profiles">
              <Route path="login" element={
                <GoogleOAuthInitializer>
                  <Login />
                </GoogleOAuthInitializer>
              } />
              <Route path="register" element={
                <GoogleOAuthInitializer>
                  <Register />
                </GoogleOAuthInitializer>
              } />
              <Route path="login_successful" element={<LoginSuccessful />} />
              <Route path="logout" element={<Logout />} />              
              <Route path="profile_certificates" element={<Certificates />} />
              <Route path="my_profile" element={<PersonalProfile />} />
              <Route path="my_profile/edit" element={<EditProfile />} />
              <Route path="profile_events" element={<Events />} />
              <Route path="profile_bookmarks" element={<Bookmarks />} />          
              <Route path="user_profile/:profileId" element={<ProfileDetail />} />
            </Route>
            <Route path="content">
              <Route path="upload_content_library" element={<UploadContentLibrary />} />
              <Route path="library_user" element={<LibraryUser />} />
              <Route path="library/:userId" element={<LibraryUser />} />
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
              <Route path="search/:contentId" element={<ContentDetailsSearch />} />
              <Route path=":contentId/edit" element={<ContentEdit />} />
              <Route path="upload_content" element={<UploadContent />} />
            </Route>
            <Route path="knowledge_path">
              <Route path="" element={<KnowledgePathList />} />
              <Route path=":pathId" element={<KnowledgePathDetail />} />
              <Route path="create" element={<KnowledgePathCreationForm />} />
              <Route path=":pathId/edit" element={<KnowledgePathEdit />} />
              <Route path=":pathId/add-node" element={<NodeCreate />} />
              <Route path=":pathId/nodes/:nodeId/edit" element={<NodeEdit />} />
              <Route path=":pathId/nodes/:nodeId" element={<NodeDetail />} />
            </Route>
            <Route path="quizzes">
              <Route path=":pathId/create" element={<QuizForm mode="create" />} />
              <Route path=":quizId/edit" element={<QuizForm mode="edit" />} />
              <Route path=":quizId" element={<Quiz />} />
            </Route>
            <Route path="publications">
              <Route path="create" element={<PublicationCreationForm />} />
              <Route path=":publicationId" element={<PublicationDetail />} />
              <Route path=":publicationId/edit" element={<PublicationEditForm />} />
            </Route>
            <Route path="search" element={<MainSearch />} />
            <Route path="welcome" element={<Welcome />} />
            <Route path="messages">
              <Route path="thread/:userId" element={<MessageThread />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
