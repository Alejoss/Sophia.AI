import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import GoogleOAuthInitializer from './components/GoogleOAuthInitializer';

import Home from './generalComponents/Home.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import ProfilePageLayout from './layouts/ProfilePageLayout.jsx';
import Profile from './profiles/Profile.jsx';
import EditProfile from './profiles/EditProfile.jsx';
import Bookmarks from './profiles/Bookmarks.jsx';
import Certificates from './profiles/Certificates.jsx';
import CertificateRequests from './profiles/CertificateRequests.jsx';

import Login from './profiles/Login.jsx';
import LoginSuccessful from './profiles/LoginSuccessful.jsx';
import Logout from './profiles/Logout.jsx';
import Register from './profiles/Register.jsx';
import Welcome from './profiles/Welcome.jsx';
import UploadContentForm from './content/UploadContentForm.jsx';
import LibraryUploadContent from './content/LibraryUploadContent.jsx';
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
import ContentProfileEdit from './content/ContentProfileEdit.jsx';
import ContentSourceEdit from './content/ContentSourceEdit.jsx';
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
import ThreadList from './messages/ThreadList.jsx';
import MessagesLayout from './messages/MessagesLayout';
import Notifications from './profiles/Notifications';
import EventsList from './events/EventsList.jsx';
import EventCreate from './events/EventCreate.jsx';
import EventDetail from './events/EventDetail.jsx';
import EventEdit from './events/EventEdit.jsx';
import UserEvents from './events/UserEvents.jsx';
import ManageEvent from './events/ManageEvent.jsx';

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
              <Route path="notifications" element={<Notifications />} />
            </Route>
            <Route path="content">
              <Route path="upload_content_library" element={<UploadContentLibrary />} />
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
              <Route path="search/:contentId" element={<ContentDetailsSearch />} />
              <Route path=":contentId/edit" element={<ContentProfileEdit />} />
              <Route path=":contentId/source-edit" element={<ContentSourceEdit />} />
              <Route path="library_upload_content" element={<LibraryUploadContent />} />
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
              <Route path=":publicationId/edit" element={<PublicationEditForm />} />
              <Route path=":publicationId" element={<PublicationDetail />} />
            </Route>
            <Route path="search" element={<MainSearch />} />
            <Route path="welcome" element={<Welcome />} />
            <Route path="messages" element={<MessagesLayout />}>
              <Route path="thread/:userId" element={<MessageThread />} />
            </Route>
            <Route path="events">
              <Route path="" element={<EventsList />} />
              <Route path="create" element={<EventCreate />} />
              <Route path=":eventId" element={<EventDetail />} />
              <Route path=":eventId/edit" element={<EventEdit />} />
              <Route path=":eventId/manage" element={<ManageEvent />} />
            </Route>
          </Route>

          {/* Unified Profile pages with full-width layout */}
          <Route element={<ProfilePageLayout />}>
            <Route path="profiles/my_profile" element={<Profile />} />
            <Route path="profiles/my_profile/edit" element={<EditProfile />} />
            <Route path="profiles/user_profile/:profileId" element={<Profile />} />
            <Route path="profiles/profile_certificates" element={<Certificates />} />
            <Route path="profiles/certificate-requests" element={<CertificateRequests />} />
            <Route path="profiles/my_events" element={<UserEvents />} />
            <Route path="profiles/profile_bookmarks" element={<Bookmarks />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
