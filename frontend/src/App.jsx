import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider, useThemeMode } from './context/ThemeContext.jsx';
import GoogleOAuthInitializer from './components/GoogleOAuthInitializer';
import ProtectedRoute from './components/ProtectedRoute';

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
import TopicContentSuggestionsPage from './topics/TopicContentSuggestionsPage';
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

/** Redirects /content/:contentId to /content/:contentId/library so bare content URLs show the library view. */
const ContentIdRedirect = () => {
  const { contentId } = useParams();
  return <Navigate to={`/content/${contentId}/library`} replace />;
};

const AppContent = () => {
  const { theme } = useThemeMode();
  
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
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
              <Route path="library_user" element={<LibraryUser />} />
              <Route path="collections" element={<CollectionsUser />} />
              <Route path="collections/create" element={<CreateCollectionForm />} />
              <Route path="collections/:collectionId" element={<Collection />} />
              <Route path="collections/:collectionId/edit" element={<CollectionEditContent />} />
              <Route path="create_topic" element={<ProtectedRoute><TopicCreationForm /></ProtectedRoute>} />
              <Route path="topics/:topicId/edit" element={<ProtectedRoute><TopicEdit /></ProtectedRoute>} />
              <Route path="topics" element={<ProtectedRoute><TopicList /></ProtectedRoute>} />
              <Route path="topics/:topicId/add-content" element={<ProtectedRoute><TopicAddContent /></ProtectedRoute>} />
              <Route path="topics/:topicId/edit-content" element={<ProtectedRoute><TopicEditContent /></ProtectedRoute>} />
              <Route path="topics/:topicId" element={<ProtectedRoute><TopicDetail /></ProtectedRoute>} />
              <Route path="topics/:topicId/suggestions" element={<ProtectedRoute><TopicContentSuggestionsPage /></ProtectedRoute>} />
              <Route path="topics/:topicId/:mediaType" element={<ProtectedRoute><TopicContentMediaType /></ProtectedRoute>} />
              <Route path=":contentId" element={<ContentIdRedirect />} />
              <Route path=":contentId/topic/:topicId" element={<ContentDetailsTopic />} />
              <Route path=":contentId/library" element={<ContentDetailsLibrary />} />
              <Route path="search/:contentId" element={<ContentDetailsSearch />} />
              <Route path=":contentId/edit" element={<ContentProfileEdit />} />
              <Route path=":contentId/source-edit" element={<ContentSourceEdit />} />
              <Route path="library_upload_content" element={<LibraryUploadContent />} />
            </Route>
            <Route path="knowledge_path">
              <Route path="" element={<ProtectedRoute><KnowledgePathList /></ProtectedRoute>} />
              <Route path=":pathId" element={<ProtectedRoute><KnowledgePathDetail /></ProtectedRoute>} />
              <Route path="create" element={<ProtectedRoute><KnowledgePathCreationForm /></ProtectedRoute>} />
              <Route path=":pathId/edit" element={<ProtectedRoute><KnowledgePathEdit /></ProtectedRoute>} />
              <Route path=":pathId/add-node" element={<ProtectedRoute><NodeCreate /></ProtectedRoute>} />
              <Route path=":pathId/nodes/:nodeId/edit" element={<ProtectedRoute><NodeEdit /></ProtectedRoute>} />
              <Route path=":pathId/nodes/:nodeId" element={<ProtectedRoute><NodeDetail /></ProtectedRoute>} />
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
    </MuiThemeProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
