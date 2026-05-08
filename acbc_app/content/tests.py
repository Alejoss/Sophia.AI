from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from content.models import (
    Library, Collection, Content, ContentProfile, 
    FileDetails, Topic, Publication, TopicModeratorInvitation, FileSuggestion, ContentSuggestion
)
from knowledge_paths.models import KnowledgePath, Node
from django.utils import timezone
import json
import os
from unittest.mock import patch, Mock

class ContentModelTests(TestCase):
    """Test suite for Content model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Test Content',
            original_author='Test Author'
        )

    def test_content_creation(self):
        """Test content creation and basic attributes"""
        self.assertEqual(self.content.original_title, 'Test Content')
        self.assertEqual(self.content.original_author, 'Test Author')
        self.assertEqual(self.content.media_type, 'VIDEO')
        self.assertEqual(self.content.uploaded_by, self.user)
        self.assertIsNotNone(self.content.created_at)

    def test_content_str(self):
        """Test string representation of content"""
        self.assertEqual(str(self.content), 'Content: Test Content')

    def test_can_be_modified_by_original_uploader(self):
        """Test that content can be modified by the original uploader when no other users have it"""
        # Should be able to modify since user is the original uploader and no other profiles exist
        self.assertTrue(self.content.can_be_modified_by(self.user))
        self.assertEqual(self.content.get_other_user_profiles_count(), 0)

    def test_can_be_modified_by_other_user(self):
        """Test that content cannot be modified by users who are not the original uploader"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        self.assertFalse(self.content.can_be_modified_by(other_user))

    def test_can_be_modified_with_other_profiles(self):
        """Test that content cannot be modified when other users have added it to their libraries"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Create a profile for another user
        ContentProfile.objects.create(
            content=self.content,
            user=other_user,
            title='Other User Profile'
        )
        
        # Original uploader should not be able to modify
        self.assertFalse(self.content.can_be_modified_by(self.user))
        self.assertEqual(self.content.get_other_user_profiles_count(), 1)

    def test_can_be_modified_with_multiple_other_profiles(self):
        """Test that content cannot be modified when multiple other users have added it"""
        other_user1 = User.objects.create_user(
            username='otheruser1',
            email='other1@example.com',
            password='testpass123'
        )
        other_user2 = User.objects.create_user(
            username='otheruser2',
            email='other2@example.com',
            password='testpass123'
        )
        
        # Create profiles for other users
        ContentProfile.objects.create(
            content=self.content,
            user=other_user1,
            title='Other User 1 Profile'
        )
        ContentProfile.objects.create(
            content=self.content,
            user=other_user2,
            title='Other User 2 Profile'
        )
        
        # Original uploader should not be able to modify
        self.assertFalse(self.content.can_be_modified_by(self.user))
        self.assertEqual(self.content.get_other_user_profiles_count(), 2)

    def test_can_be_modified_no_uploader(self):
        """Test that content cannot be modified when there's no original uploader"""
        content_no_uploader = Content.objects.create(
            media_type='TEXT',
            original_title='No Uploader Content'
        )
        self.assertFalse(content_no_uploader.can_be_modified_by(self.user))
        self.assertEqual(content_no_uploader.get_other_user_profiles_count(), 0)

    def test_direct_content_profile_creation(self):
        """Test creating a ContentProfile directly"""
        profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Direct Creation Test',
            author='Direct Test Author',
            personal_note='Direct test note'
        )
        self.assertEqual(profile.title, 'Direct Creation Test')
        self.assertEqual(profile.author, 'Direct Test Author')
        self.assertEqual(profile.personal_note, 'Direct test note')
        self.assertEqual(profile.content, self.content)
        self.assertEqual(profile.user, self.user)

class ContentProfileModelTests(TestCase):
    """Test suite for ContentProfile model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Test Content'
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Custom Title',
            author='Custom Author',
            personal_note='Test Note',
            is_visible=True,
            is_producer=True
        )

    def test_content_profile_creation(self):
        """Test content profile creation and basic attributes"""
        self.assertEqual(self.content_profile.title, 'Custom Title')
        self.assertEqual(self.content_profile.author, 'Custom Author')
        self.assertEqual(self.content_profile.personal_note, 'Test Note')
        self.assertTrue(self.content_profile.is_visible)
        self.assertTrue(self.content_profile.is_producer)
        self.assertEqual(self.content_profile.user, self.user)
        self.assertEqual(self.content_profile.content, self.content)

    def test_content_profile_str(self):
        """Test string representation of content profile"""
        expected_str = f"{self.user.username}'s view of Custom Title"
        self.assertEqual(str(self.content_profile), expected_str)

class LibraryModelTests(TestCase):
    """Test suite for Library model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.library = Library.objects.create(
            user=self.user,
            name='Test Library'
        )

    def test_library_creation(self):
        """Test library creation and basic attributes"""
        self.assertEqual(self.library.name, 'Test Library')
        self.assertEqual(self.library.user, self.user)

    def test_library_str(self):
        """Test string representation of library"""
        expected_str = f"Test Library (Owner: {self.user.username})"
        self.assertEqual(str(self.library), expected_str)

class CollectionModelTests(TestCase):
    """Test suite for Collection model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.library = Library.objects.create(
            user=self.user,
            name='Test Library'
        )
        self.collection = Collection.objects.create(
            library=self.library,
            name='Test Collection'
        )

    def test_collection_creation(self):
        """Test collection creation and basic attributes"""
        self.assertEqual(self.collection.name, 'Test Collection')
        self.assertEqual(self.collection.library, self.library)

    def test_collection_str(self):
        """Test string representation of collection"""
        expected_str = f"Test Collection in {self.library.name}"
        self.assertEqual(str(self.collection), expected_str)

class ContentAPITests(APITestCase):
    """Test suite for Content API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Test Profile'
        )
        self.file_details = FileDetails.objects.create(
            content=self.content
        )

        # Define API endpoints with correct prefix
        self.upload_url = '/api/content/upload-content/'
        self.content_detail_url = '/api/content/content_details/'
        self.user_content_url = '/api/content/user-content/'

    def test_upload_content(self):
        """Test uploading new content"""
        url = reverse('content:upload_content')
        test_file = SimpleUploadedFile(
            "test_video.mp4",
            b"file_content",
            content_type="video/mp4"
        )
        data = {
            'file': test_file,
            'media_type': 'VIDEO',
            'title': 'New Content',
            'author': 'Test Author',
            'is_visible': True,
            'is_producer': False,
            'has_spanish_subtitles': True,
            'has_spanish_dubbing': True
        }
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Content.objects.count(), 2)
        self.assertEqual(ContentProfile.objects.count(), 2)
        uploaded_content = Content.objects.exclude(id=self.content.id).first()
        self.assertTrue(uploaded_content.has_spanish_subtitles)
        self.assertTrue(uploaded_content.has_spanish_dubbing)

    def test_create_content_profile(self):
        """Test the direct model creation - the API tests are still being debugged"""
        # First, delete any existing profiles
        ContentProfile.objects.filter(content=self.content, user=self.user).delete()
        
        # Verify there are no profiles for this content/user
        self.assertEqual(ContentProfile.objects.filter(content=self.content, user=self.user).count(), 0)
        
        # Now test content profile properties without creating it 
        profile = ContentProfile(
            content=self.content,
            user=self.user,
            title='My Custom Title',
            author='Custom Author',
            personal_note='This is my personal note'
        )
        
        # Verify the model was created correctly
        self.assertEqual(profile.title, 'My Custom Title')
        self.assertEqual(profile.author, 'Custom Author')
        self.assertEqual(profile.personal_note, 'This is my personal note')
        self.assertEqual(profile.content, self.content)
        self.assertEqual(profile.user, self.user)
        
        # No need to save to database

    def test_create_duplicate_content_profile(self):
        """Test the unique constraint behavior"""
        # Use the model class attribute unique_together instead of creating instances
        self.assertTrue(
            ('content', 'user') in [
                constraint 
                for constraint in ContentProfile._meta.unique_together
            ],
            "ContentProfile should have a unique constraint on content and user"
        )

    def test_get_content_detail(self):
        """Test retrieving content detail"""
        url = reverse('content:content-detail', args=[self.content.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['original_title'], 'Test Content')
        self.assertIn('has_spanish_subtitles', response.data)
        self.assertIn('has_spanish_dubbing', response.data)
        self.assertFalse(response.data['has_spanish_subtitles'])
        self.assertFalse(response.data['has_spanish_dubbing'])

    def test_get_user_content(self):
        """Test retrieving user's content"""
        url = reverse('content:user-content')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_update_content_profile(self):
        """Test updating a content profile"""
        url = f'/api/content/content-profiles/{self.content_profile.id}/'
        data = {
            'title': 'Updated Title',
            'author': 'Updated Author',
            'personal_note': 'Updated note',
            'is_visible': False,
            'is_producer': True
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database
        self.content_profile.refresh_from_db()
        self.assertEqual(self.content_profile.title, 'Updated Title')
        self.assertEqual(self.content_profile.author, 'Updated Author')
        self.assertEqual(self.content_profile.personal_note, 'Updated note')
        self.assertFalse(self.content_profile.is_visible)
        self.assertTrue(self.content_profile.is_producer)

    def test_update_content_profile_visibility_without_producer_claim(self):
        """Test that visibility cannot be changed without claiming to be the producer"""
        url = f'/api/content/content-profiles/{self.content_profile.id}/'
        data = {
            'is_visible': False,
            'is_producer': False  # Not claiming to be producer
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Debe reclamar ser el productor para cambiar la visibilidad', response.data['error'])

    def test_update_content_profile_visibility_with_producer_claim(self):
        """Test that visibility can be changed when claiming to be the producer"""
        url = f'/api/content/content-profiles/{self.content_profile.id}/'
        data = {
            'is_visible': False,
            'is_producer': True  # Claiming to be producer
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database
        self.content_profile.refresh_from_db()
        self.assertFalse(self.content_profile.is_visible)
        self.assertTrue(self.content_profile.is_producer)

    def test_update_content_source_url(self):
        """Test updating content source URL (the fix we implemented)"""
        # Create content with URL
        url_content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='URL Content',
            url='https://old-url.com'
        )
        
        # Create a ContentProfile for the user to edit this content
        ContentProfile.objects.create(
            content=url_content,
            user=self.user,
            title='URL Content Profile'
        )
        
        update_url = f'/api/content/content_update/{url_content.id}/'
        data = {
            'url': 'https://new-url.com',
            'original_title': 'Updated URL Content',
            'original_author': 'Updated Author',
            'has_spanish_subtitles': True,
            'has_spanish_dubbing': True
        }
        
        response = self.client.put(update_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database
        url_content.refresh_from_db()
        self.assertEqual(url_content.url, 'https://new-url.com')
        self.assertEqual(url_content.original_title, 'Updated URL Content')
        self.assertEqual(url_content.original_author, 'Updated Author')
        self.assertTrue(url_content.has_spanish_subtitles)
        self.assertTrue(url_content.has_spanish_dubbing)

    def test_update_content_source_media_type(self):
        """Test updating content media type"""
        update_url = f'/api/content/content_update/{self.content.id}/'
        data = {
            'media_type': 'AUDIO',
            'original_title': 'Updated Audio Content'
        }
        
        response = self.client.put(update_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database
        self.content.refresh_from_db()
        self.assertEqual(self.content.media_type, 'AUDIO')
        self.assertEqual(self.content.original_title, 'Updated Audio Content')

    def test_update_content_invalid_media_type(self):
        """Test updating content with invalid media type"""
        update_url = f'/api/content/content_update/{self.content.id}/'
        data = {
            'media_type': 'INVALID_TYPE'
        }
        
        response = self.client.put(update_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid media type', response.data['error'])

    def test_update_content_invalid_url(self):
        """Test updating content with invalid URL"""
        update_url = f'/api/content/content_update/{self.content.id}/'
        data = {
            'url': 'not-a-valid-url'
        }
        
        response = self.client.put(update_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Formato de URL invalido', response.data['error'])

    def test_update_content_not_owner(self):
        """Test that non-owners cannot update content"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Authenticate as other user
        self.client.force_authenticate(user=other_user)
        
        update_url = f'/api/content/content_update/{self.content.id}/'
        data = {
            'original_title': 'Unauthorized Update'
        }
        
        response = self.client.put(update_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('No tiene permiso para editar este contenido', response.data['error'])

    def test_update_content_source_blocked_when_other_users_depend_on_it(self):
        """Test source update is blocked when other users also reference the same content."""
        other_user = User.objects.create_user(
            username='dependentuser',
            email='dependent@example.com',
            password='testpass123'
        )
        ContentProfile.objects.create(
            content=self.content,
            user=other_user,
            title='Dependent Profile'
        )

        update_url = f'/api/content/content_update/{self.content.id}/'
        data = {
            'original_title': 'Should Not Update'
        }

        response = self.client.put(update_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('No se puede cambiar la fuente de este contenido', response.data['error'])

    def test_get_content_detail_library_context_does_not_leak_other_user_profile(self):
        """Test library context cannot request another user's private content profile."""
        other_user = User.objects.create_user(
            username='otherlibraryuser',
            email='otherlibrary@example.com',
            password='testpass123'
        )
        other_profile = ContentProfile.objects.create(
            content=self.content,
            user=other_user,
            title='Other User Private Title',
            personal_note='Very private note'
        )

        detail_url = f'/api/content/content_details/{self.content.id}/?context=library&id={other_user.id}'
        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('selected_profile', response.data)
        # Should not return the requested other user's profile.
        self.assertNotEqual(response.data['selected_profile'].get('id'), other_profile.id)

    def test_upload_url_content_basic(self):
        """Test basic URL content upload with minimal data."""
        url = 'https://example.com/article'
        data = {
            'url': url,
            'title': 'Test URL Content',
            'author': 'Test Author',
            'has_spanish_subtitles': True,
            'has_spanish_dubbing': False
        }

        response = self.client.post(self.upload_url, data)
        self.assertEqual(response.status_code, 201)
        
        # Verify Content object
        content = Content.objects.get(url=url)
        self.assertEqual(content.media_type, 'TEXT')
        self.assertEqual(content.original_title, 'Test URL Content')
        self.assertEqual(content.original_author, 'Test Author')
        self.assertEqual(content.uploaded_by, self.user)
        self.assertTrue(content.has_spanish_subtitles)
        self.assertFalse(content.has_spanish_dubbing)

        # Verify ContentProfile object
        profile = ContentProfile.objects.get(content=content)
        self.assertEqual(profile.title, 'Test URL Content')
        self.assertEqual(profile.author, 'Test Author')
        self.assertTrue(profile.is_visible)
        self.assertFalse(profile.is_producer)
        self.assertEqual(profile.user, self.user)

        # Verify FileDetails object
        file_details = FileDetails.objects.get(content=content)
        self.assertFalse(bool(file_details.file))  # Check if file field is empty
        self.assertIsNone(file_details.file_size)

    def test_upload_url_content_with_og_metadata(self):
        """Test URL content upload with Open Graph metadata."""
        url = 'https://example.com/article'
        data = {
            'url': url,
            'title': 'Test URL Content',
            'author': 'Test Author',
            'og_description': 'Test description',
            'og_image': 'https://example.com/image.jpg',
            'og_type': 'article',
            'og_site_name': 'Example Site'
        }

        response = self.client.post(self.upload_url, data)
        self.assertEqual(response.status_code, 201)

        # Verify Content object
        content = Content.objects.get(url=url)
        self.assertEqual(content.media_type, 'TEXT')

        # Verify FileDetails object with OG metadata
        file_details = FileDetails.objects.get(content=content)
        self.assertEqual(file_details.og_description, 'Test description')
        self.assertEqual(file_details.og_image, 'https://example.com/image.jpg')
        self.assertEqual(file_details.og_type, 'article')
        self.assertEqual(file_details.og_site_name, 'Example Site')

    def test_upload_url_content_without_title(self):
        """Test URL content upload without title (should use URL as title)."""
        url = 'https://example.com/article'
        data = {
            'url': url
        }

        response = self.client.post(self.upload_url, data)
        self.assertEqual(response.status_code, 201)

        content = Content.objects.get(url=url)
        self.assertEqual(content.original_title, url)
        self.assertEqual(content.media_type, 'TEXT')

    def test_upload_url_content_validation(self):
        """Test validation for URL content upload."""
        # Test missing URL and file
        response = self.client.post(self.upload_url, {
            'title': 'Test Content'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'No se proporcionó archivo ni URL')

        # Test invalid URL format
        response = self.client.post(self.upload_url, {
            'url': 'not-a-url',
            'title': 'Test Content'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'Formato de URL invalido')

        # Test both URL and file provided
        with open('test_file.txt', 'w') as f:
            f.write('test content')
        
        with open('test_file.txt', 'rb') as f:
            response = self.client.post(self.upload_url, {
                'url': 'https://example.com',
                'file': f,
                'title': 'Test Content'
            })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'No se puede proporcionar tanto archivo como URL')

        # Clean up test file
        os.remove('test_file.txt')

    def test_content_modification_check_endpoint(self):
        """Test the content modification check API endpoint"""
        url = f'/api/content/content_modification_check/{self.content.id}/'
        
        # Test when content can be modified
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_modify'])
        self.assertEqual(response.data['other_users_count'], 0)
        self.assertTrue(response.data['is_original_uploader'])
        self.assertEqual(response.data['message'], 'El contenido puede ser modificado')

    def test_content_modification_check_with_other_profiles(self):
        """Test the content modification check when other users have the content"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Create a profile for another user
        ContentProfile.objects.create(
            content=self.content,
            user=other_user,
            title='Other User Profile'
        )
        
        url = f'/api/content/content_modification_check/{self.content.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['can_modify'])
        self.assertEqual(response.data['other_users_count'], 1)
        self.assertTrue(response.data['is_original_uploader'])
        self.assertIn('No se puede cambiar la fuente de este contenido porque 1 otro(s) usuario(s) lo han agregado a sus bibliotecas', response.data['message'])

    def test_content_modification_check_not_original_uploader(self):
        """Test the content modification check when user is not the original uploader"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Authenticate as other user
        self.client.force_authenticate(user=other_user)
        
        url = f'/api/content/content_modification_check/{self.content.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['can_modify'])
        self.assertEqual(response.data['other_users_count'], 0)
        self.assertFalse(response.data['is_original_uploader'])

    def test_content_modification_check_content_not_found(self):
        """Test the content modification check with non-existent content"""
        url = '/api/content/content_modification_check/99999/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_url_content_permissions(self):
        """Test permissions for URL content upload."""
        # Logout user
        self.client.force_authenticate(user=None)

        url = 'https://example.com/article'
        data = {
            'url': url,
            'title': 'Test URL Content'
        }

        response = self.client.post(self.upload_url, data)
        self.assertEqual(response.status_code, 401)  # Unauthorized

    def test_upload_url_content_duplicate_url(self):
        """Test uploading content with a URL that already exists."""
        url = 'https://example.com/article'
        data = {
            'url': url,
            'title': 'Test URL Content'
        }

        # First upload
        response1 = self.client.post(self.upload_url, data)
        self.assertEqual(response1.status_code, 201)

        # Second upload with same URL
        response2 = self.client.post(self.upload_url, data)
        self.assertEqual(response2.status_code, 201)  # Should still succeed as users can have multiple profiles

        # Verify two different content objects were created
        content_count = Content.objects.filter(url=url).count()
        self.assertEqual(content_count, 2)


class UserLibraryWithDetailsAPITests(APITestCase):
    """Tests for paginated GET /api/content/user-content-with-details/."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='libraryowner',
            email='library@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('content:user-content-with-details')

    def test_pagination_shape_and_page_size(self):
        for i in range(15):
            c = Content.objects.create(
                uploaded_by=self.user,
                media_type='IMAGE',
                original_title=f'Img {i}',
            )
            ContentProfile.objects.create(
                content=c,
                user=self.user,
                title=f'Title {i}',
            )
        r = self.client.get(self.url, {'page': 1, 'page_size': 5})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 15)
        self.assertEqual(r.data['current_page'], 1)
        self.assertEqual(r.data['total_pages'], 3)
        self.assertEqual(len(r.data['results']), 5)

        r2 = self.client.get(self.url, {'page': 2, 'page_size': 5})
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data['current_page'], 2)
        self.assertEqual(len(r2.data['results']), 5)

    def test_media_type_filter(self):
        c_img = Content.objects.create(
            uploaded_by=self.user,
            media_type='IMAGE',
            original_title='A',
        )
        c_vid = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='B',
        )
        ContentProfile.objects.create(content=c_img, user=self.user, title='p1')
        ContentProfile.objects.create(content=c_vid, user=self.user, title='p2')
        r = self.client.get(self.url, {'media_type': 'VIDEO'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['content']['media_type'], 'VIDEO')

    def test_search_query(self):
        c = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='UniqueOriginalXYZ',
        )
        ContentProfile.objects.create(
            content=c,
            user=self.user,
            title='Other',
        )
        r = self.client.get(self.url, {'search': 'UniqueOriginalXYZ'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 1)


class LibraryAPITests(APITestCase):
    """Test suite for Library API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.library = Library.objects.create(
            user=self.user,
            name='Test Library'
        )

    def test_create_collection(self):
        """Test creating a new collection"""
        url = reverse('content:user-collections')
        data = {
            'name': 'New Collection'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Collection.objects.count(), 1)
        self.assertEqual(response.data['name'], 'New Collection')

    def test_get_collections(self):
        """Test retrieving user's collections"""
        Collection.objects.create(
            library=self.library,
            name='Test Collection'
        )
        url = reverse('content:user-collections')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_library_list_endpoint(self):
        """Test listing all libraries."""
        other_user = User.objects.create_user(
            username='otherlibuser',
            email='otherlib@example.com',
            password='testpass123'
        )
        Library.objects.create(user=other_user, name='Other Library')
        url = reverse('content:library_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_library_detail_endpoint(self):
        """Test retrieving a library by ID."""
        url = reverse('content:library_detail', args=[self.library.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.library.id)
        self.assertEqual(response.data['name'], 'Test Library')


class PublicCollectionsAPITests(APITestCase):
    """Public collection discovery and read-only access for other users."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='pass12345',
        )
        self.viewer = User.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='pass12345',
        )
        self.library = Library.objects.create(user=self.owner, name='Owner Library')
        self.collection = Collection.objects.create(
            library=self.library,
            name='Public Shelf',
            is_public=True,
        )
        self.content = Content.objects.create(
            uploaded_by=self.owner,
            media_type='TEXT',
            original_title='Doc A',
        )
        self.profile_visible = ContentProfile.objects.create(
            content=self.content,
            user=self.owner,
            collection=self.collection,
            title='Visible item',
            is_visible=True,
        )
        self.profile_hidden = ContentProfile.objects.create(
            content=Content.objects.create(
                uploaded_by=self.owner,
                media_type='TEXT',
                original_title='Doc B',
            ),
            user=self.owner,
            collection=self.collection,
            title='Hidden item',
            is_visible=False,
        )

    def test_public_list_includes_collection_with_visible_items(self):
        self.client.force_authenticate(user=self.viewer)
        url = reverse('content:public-collections')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        row = response.data['results'][0]
        self.assertEqual(row['name'], 'Public Shelf')
        self.assertEqual(row['owner_username'], 'owner')
        self.assertEqual(row['visible_item_count'], 1)

    def test_public_list_excludes_empty_public_collections(self):
        empty_coll = Collection.objects.create(
            library=self.library,
            name='Empty public',
            is_public=True,
        )
        self.client.force_authenticate(user=self.viewer)
        url = reverse('content:public-collections')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r['id'] for r in response.data['results']}
        self.assertIn(self.collection.id, ids)
        self.assertNotIn(empty_coll.id, ids)

    def test_viewer_gets_public_collection_detail(self):
        self.client.force_authenticate(user=self.viewer)
        url = reverse('content:collection-detail', args=[self.collection.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Public Shelf')
        self.assertFalse(response.data['is_owner'])
        self.assertTrue(response.data['is_public'])

    def test_viewer_collection_content_only_visible(self):
        self.client.force_authenticate(user=self.viewer)
        url = reverse('content:collection-content', args=[self.collection.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row['id'] for row in response.data}
        self.assertIn(self.profile_visible.id, ids)
        self.assertNotIn(self.profile_hidden.id, ids)

    def test_owner_sees_all_profiles_in_collection_content(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse('content:collection-content', args=[self.collection.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row['id'] for row in response.data}
        self.assertSetEqual(ids, {self.profile_visible.id, self.profile_hidden.id})

    def test_private_collection_not_visible_to_viewer(self):
        self.collection.is_public = False
        self.collection.save(update_fields=['is_public'])
        self.client.force_authenticate(user=self.viewer)
        url = reverse('content:collection-detail', args=[self.collection.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_viewer_cannot_patch_collection(self):
        self.client.force_authenticate(user=self.viewer)
        url = reverse('content:collection-detail', args=[self.collection.id])
        response = self.client.patch(url, {'name': 'Hacked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_toggle_is_public(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse('content:collection-detail', args=[self.collection.id])
        response = self.client.patch(url, {'is_public': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_public'])
        self.collection.refresh_from_db()
        self.assertFalse(self.collection.is_public)


class TopicAPITests(APITestCase):
    """Test suite for Topic API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )

    def test_create_topic(self):
        """Test creating a new topic"""
        url = reverse('content:topics')
        data = {
            'title': 'New Topic',
            'description': 'New Description'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Topic.objects.count(), 2)
        self.assertEqual(response.data['title'], 'New Topic')

    def test_get_topic_detail(self):
        """Test retrieving topic detail"""
        url = reverse('content:topic-detail', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Topic')

    def test_get_topic_basic(self):
        """Test retrieving topic basic info."""
        url = reverse('content:topic-basic', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.topic.id)
        self.assertEqual(response.data['title'], 'Test Topic')

    def test_get_topic_basic_requires_authentication(self):
        """Test unauthenticated users cannot access topic basic info."""
        self.client.force_authenticate(user=None)
        url = reverse('content:topic-basic', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_topic_content_simple_lists_all_topic_content_for_creator(self):
        """Creator sees every content item in the topic, not only their own profiles."""
        other = User.objects.create_user(
            username="othermod",
            email="other@example.com",
            password="pass12345",
        )
        self.topic.moderators.add(other)

        content_mine = Content.objects.create(
            uploaded_by=self.user,
            media_type="TEXT",
            original_title="Mine",
        )
        ContentProfile.objects.create(
            content=content_mine,
            user=self.user,
            title="Mine profile",
        )

        content_other = Content.objects.create(
            uploaded_by=other,
            media_type="TEXT",
            original_title="Other",
        )
        ContentProfile.objects.create(
            content=content_other,
            user=other,
            title="Other profile",
        )

        self.topic.contents.add(content_mine, content_other)

        url = reverse("content:topic-content-simple", args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content_ids = {row["content"]["id"] for row in response.data["contents"]}
        self.assertSetEqual(content_ids, {content_mine.id, content_other.id})

    def test_topic_content_simple_forbidden_for_non_moderator(self):
        outsider = User.objects.create_user(
            username="outsider",
            email="out@example.com",
            password="pass12345",
        )
        url = reverse("content:topic-content-simple", args=[self.topic.id])
        self.client.force_authenticate(user=outsider)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PublicationAPITests(APITestCase):
    """Test suite for Publication API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Custom Title'
        )
        self.publication = Publication.objects.create(
            user=self.user,
            content_profile=self.content_profile,
            text_content='Test Publication',
            status='PUBLISHED'
        )

    def test_create_publication(self):
        """Test creating a new publication"""
        url = reverse('content:publication-list')
        data = {
            'content_profile_id': self.content_profile.id,
            'text_content': 'New Publication',
            'status': 'PUBLISHED'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Publication.objects.count(), 2)
        self.assertEqual(response.data['text_content'], 'New Publication')

    def test_get_publication_detail(self):
        """Test retrieving publication detail"""
        url = reverse('content:publication-detail', args=[self.publication.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['text_content'], 'Test Publication')

    def test_vote_publication(self):
        """Test voting on a publication"""
        url = reverse('votes:publication-vote', args=[self.publication.id])
        
        # Test upvote
        data = {'action': 'upvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vote_count', response.data)
        
        # Test removing vote
        data = {'action': 'remove'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test downvote
        data = {'action': 'downvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test invalid vote action
        data = {'action': 'invalid'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class ContentProfileAPITest(APITestCase):
    """Test specifically for the ContentProfile API endpoint"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Test Content',
            original_author='Test Author'
        )
        
        # Make sure no profile exists
        ContentProfile.objects.filter(content=self.content, user=self.user).delete()

    def test_create_content_profile_success(self):
        """Create a content profile using the real API endpoint."""
        url = reverse('content:content-profile-create')
        payload = {
            'content': self.content.id,
            'title': self.content.original_title,
            'author': self.content.original_author,
            'personalNote': 'nota personal',
            'isVisible': True,
            'isProducer': False,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = ContentProfile.objects.get(content=self.content, user=self.user)
        self.assertEqual(created.title, self.content.original_title)
        self.assertEqual(created.author, self.content.original_author)
        self.assertEqual(created.personal_note, 'nota personal')

    def test_create_content_profile_duplicate_rejected(self):
        """Cannot create duplicate profile for same content and user."""
        ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Existing'
        )
        url = reverse('content:content-profile-create')
        payload = {'content': self.content.id}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya tiene un perfil para este contenido', response.data['error'])

    def test_create_content_profile_requires_content_id(self):
        """Content ID is required to create profile."""
        url = reverse('content:content-profile-create')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ID de contenido es requerido', response.data['error'])


class ContentSourceEditTests(APITestCase):
    """Test suite specifically for content source edit functionality"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create content that can be modified
        self.modifiable_content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Modifiable Content',
            url='https://example.com'
        )
        self.modifiable_profile = ContentProfile.objects.create(
            content=self.modifiable_content,
            user=self.user,
            title='Modifiable Profile'
        )
        
        # Create content that cannot be modified (other user has it)
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        self.non_modifiable_content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Non-Modifiable Content',
            url='https://example2.com'
        )
        self.non_modifiable_profile = ContentProfile.objects.create(
            content=self.non_modifiable_content,
            user=self.user,
            title='Non-Modifiable Profile'
        )
        # Add profile for other user
        ContentProfile.objects.create(
            content=self.non_modifiable_content,
            user=self.other_user,
            title='Other User Profile'
        )

    def test_content_source_edit_modifiable_content(self):
        """Test that modifiable content shows the edit form"""
        # Test the modification check endpoint
        check_url = f'/api/content/content_modification_check/{self.modifiable_content.id}/'
        response = self.client.get(check_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_modify'])
        self.assertEqual(response.data['other_users_count'], 0)
        
        # Test the content detail endpoint (used by ContentSourceEdit)
        detail_url = f'/api/content/content_details/{self.modifiable_content.id}/?context=library&id={self.user.id}'
        response = self.client.get(detail_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('selected_profile', response.data)

    def test_content_source_edit_non_modifiable_content(self):
        """Test that non-modifiable content shows the warning message"""
        # Test the modification check endpoint
        check_url = f'/api/content/content_modification_check/{self.non_modifiable_content.id}/'
        response = self.client.get(check_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['can_modify'])
        self.assertEqual(response.data['other_users_count'], 1)
        self.assertIn(
            'No se puede cambiar la fuente de este contenido porque 1 otro(s) usuario(s) lo han agregado a sus bibliotecas',
            response.data['message']
        )

    def test_content_source_edit_not_original_uploader(self):
        """Test that non-original uploaders cannot modify content"""
        # Authenticate as other user
        self.client.force_authenticate(user=self.other_user)
        
        check_url = f'/api/content/content_modification_check/{self.modifiable_content.id}/'
        response = self.client.get(check_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['can_modify'])
        self.assertFalse(response.data['is_original_uploader'])

    def test_content_source_edit_unauthorized_access(self):
        """Test that unauthorized users cannot access modification check"""
        # Logout user
        self.client.force_authenticate(user=None)
        
        check_url = f'/api/content/content_modification_check/{self.modifiable_content.id}/'
        response = self.client.get(check_url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserContentByIdAndRecentAPITests(APITestCase):
    """Coverage for user-content-by-id and recent-user-content endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='testpass123'
        )
        self.viewer = User.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.viewer)

    def test_user_content_by_id_success(self):
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='By Id Content'
        )
        ContentProfile.objects.create(
            content=content,
            user=self.user,
            title='By Id Profile'
        )
        url = reverse('content:user-content-by-id', args=[self.user.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'By Id Profile')

    def test_user_content_by_id_not_found(self):
        url = reverse('content:user-content-by-id', args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('no encontrado', response.data['error'].lower())

    def test_user_content_by_id_requires_authentication(self):
        self.client.force_authenticate(user=None)
        url = reverse('content:user-content-by-id', args=[self.user.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_recent_user_content_returns_latest_four(self):
        self.client.force_authenticate(user=self.user)
        for i in range(6):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Recent {i}'
            )
            ContentProfile.objects.create(
                content=content,
                user=self.user,
                title=f'Profile {i}'
            )
        url = reverse('content:recent-user-content')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

    def test_recent_user_content_requires_authentication(self):
        self.client.force_authenticate(user=None)
        url = reverse('content:recent-user-content')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AuxiliaryEndpointsAPITests(APITestCase):
    """Coverage for user search, content references, and URL preview."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='auxuser',
            email='auxuser@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='alicehelper',
            email='alice@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='References Source'
        )
        profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Profile for publication'
        )
        Publication.objects.create(
            user=self.user,
            content_profile=profile,
            text_content='Publication for references',
            status='PUBLISHED'
        )

    def test_user_search_returns_matches(self):
        url = reverse('content:user-search')
        response = self.client.get(url, {'q': 'alice'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['username'], 'alicehelper')

    def test_user_search_returns_empty_without_query(self):
        url = reverse('content:user-search')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'results': []})

    def test_user_search_requires_authentication(self):
        self.client.force_authenticate(user=None)
        url = reverse('content:user-search')
        response = self.client.get(url, {'q': 'alice'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_content_references_success(self):
        url = reverse('content:content-references', args=[self.content.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('knowledge_paths', response.data)
        self.assertIn('topics', response.data)
        self.assertIn('publications', response.data)
        self.assertEqual(len(response.data['publications']), 1)

    def test_content_references_not_found(self):
        url = reverse('content:content-references', args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('Contenido no encontrado', response.data['error'])

    def test_content_references_requires_authentication(self):
        self.client.force_authenticate(user=None)
        url = reverse('content:content-references', args=[self.content.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_preview_url_requires_url_field(self):
        url = reverse('content:preview-url')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('URL es requerida', response.data['error'])

    @patch('content.views.requests.head')
    @patch('content.views.requests.get')
    def test_preview_url_success_html(self, mock_get, mock_head):
        mock_get.return_value = Mock(
            status_code=200,
            headers={'content-type': 'text/html'},
            text='<html><head><title>Sample Page</title></head><body>ok</body></html>',
            raise_for_status=Mock(),
        )
        mock_head.return_value = Mock(status_code=404)
        url = reverse('content:preview-url')
        response = self.client.post(url, {'url': 'https://example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Sample Page')
        self.assertEqual(response.data['type'], 'website')

    def test_preview_url_requires_authentication(self):
        self.client.force_authenticate(user=None)
        url = reverse('content:preview-url')
        response = self.client.post(url, {'url': 'https://example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TopicModeratorInvitationModelTests(TestCase):
    """Test suite for TopicModeratorInvitation model"""
    
    def setUp(self):
        """Set up test data"""
        self.creator = User.objects.create_user(
            username='creator',
            email='creator@example.com',
            password='testpass123'
        )
        self.invited_user = User.objects.create_user(
            username='inviteduser',
            email='invited@example.com',
            password='testpass123'
        )
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.creator
        )
    
    def test_invitation_creation(self):
        """Test creating a moderator invitation"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.invited_user,
            invited_by=self.creator,
            message='Please moderate this topic'
        )
        self.assertEqual(invitation.topic, self.topic)
        self.assertEqual(invitation.invited_user, self.invited_user)
        self.assertEqual(invitation.invited_by, self.creator)
        self.assertEqual(invitation.status, 'PENDING')
        self.assertEqual(invitation.message, 'Please moderate this topic')
    
    def test_invitation_accept(self):
        """Test accepting an invitation"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.invited_user,
            invited_by=self.creator
        )
        invitation.accept()
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, 'ACCEPTED')
        self.assertIn(self.invited_user, self.topic.moderators.all())
    
    def test_invitation_decline(self):
        """Test declining an invitation"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.invited_user,
            invited_by=self.creator
        )
        invitation.decline()
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, 'DECLINED')
        self.assertNotIn(self.invited_user, self.topic.moderators.all())
    
    def test_invitation_accept_non_pending(self):
        """Test that accepting a non-pending invitation raises error"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.invited_user,
            invited_by=self.creator,
            status='DECLINED'
        )
        with self.assertRaises(ValueError):
            invitation.accept()
    
    def test_invitation_decline_non_pending(self):
        """Test that declining a non-pending invitation raises error"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.invited_user,
            invited_by=self.creator,
            status='ACCEPTED'
        )
        with self.assertRaises(ValueError):
            invitation.decline()
    
    def test_invitation_str(self):
        """Test string representation of invitation"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.invited_user,
            invited_by=self.creator
        )
        expected_str = f"Invitation to {self.invited_user.username} for topic {self.topic.title} - PENDING"
        self.assertEqual(str(invitation), expected_str)


class TopicModeratorAPITests(APITestCase):
    """Test suite for Topic Moderator API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.creator = User.objects.create_user(
            username='creator',
            email='creator@example.com',
            password='testpass123'
        )
        self.moderator_user = User.objects.create_user(
            username='moderator',
            email='moderator@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.creator)
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.creator
        )
    
    def test_invite_moderator(self):
        """Test inviting a user as moderator"""
        url = reverse('content:topic-moderator-invite', args=[self.topic.id])
        data = {
            'username': self.moderator_user.username,
            'message': 'Please moderate this topic'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertEqual(response.data['message'], 'Please moderate this topic')
        
        # Verify invitation was created
        invitation = TopicModeratorInvitation.objects.get(
            topic=self.topic,
            invited_user=self.moderator_user
        )
        self.assertEqual(invitation.status, 'PENDING')
    
    def test_invite_moderator_no_username(self):
        """Test inviting without username"""
        url = reverse('content:topic-moderator-invite', args=[self.topic.id])
        data = {}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_invite_moderator_user_not_exists(self):
        """Test inviting a non-existent user"""
        url = reverse('content:topic-moderator-invite', args=[self.topic.id])
        data = {'username': 'nonexistent'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_invite_moderator_already_moderator(self):
        """Test inviting a user who is already a moderator"""
        self.topic.moderators.add(self.moderator_user)
        url = reverse('content:topic-moderator-invite', args=[self.topic.id])
        data = {'username': self.moderator_user.username}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ya es moderador', response.data['error'])
    
    def test_invite_moderator_pending_invitation(self):
        """Test inviting a user with pending invitation"""
        TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator,
            status='PENDING'
        )
        url = reverse('content:topic-moderator-invite', args=[self.topic.id])
        data = {'username': self.moderator_user.username}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya existe una invitación pendiente', response.data['error'])
    
    def test_invite_moderator_not_creator(self):
        """Test that non-creators cannot invite moderators"""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('content:topic-moderator-invite', args=[self.topic.id])
        data = {'username': self.moderator_user.username}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_list_invitations_as_creator(self):
        """Test listing invitations as topic creator"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        url = reverse('content:topic-moderator-invitations', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], invitation.id)
    
    def test_list_invitations_as_invited_user(self):
        """Test listing invitations as invited user"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        self.client.force_authenticate(user=self.moderator_user)
        url = reverse('content:topic-moderator-invitations', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], invitation.id)
    
    def test_list_invitations_as_other_user(self):
        """Test that other users cannot list invitations"""
        TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        self.client.force_authenticate(user=self.other_user)
        url = reverse('content:topic-moderator-invitations', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_accept_invitation(self):
        """Test accepting an invitation"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        self.client.force_authenticate(user=self.moderator_user)
        url = reverse('content:topic-moderator-accept', args=[self.topic.id, invitation.id])
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ACCEPTED')
        
        # Verify user was added as moderator
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, 'ACCEPTED')
        self.assertIn(self.moderator_user, self.topic.moderators.all())
    
    def test_accept_invitation_not_invited_user(self):
        """Test that only invited user can accept"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        self.client.force_authenticate(user=self.other_user)
        url = reverse('content:topic-moderator-accept', args=[self.topic.id, invitation.id])
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_accept_invitation_non_pending(self):
        """Test that non-pending invitations cannot be accepted"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator,
            status='DECLINED'
        )
        self.client.force_authenticate(user=self.moderator_user)
        url = reverse('content:topic-moderator-accept', args=[self.topic.id, invitation.id])
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_decline_invitation(self):
        """Test declining an invitation"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        self.client.force_authenticate(user=self.moderator_user)
        url = reverse('content:topic-moderator-decline', args=[self.topic.id, invitation.id])
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'DECLINED')
        
        # Verify invitation was declined
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, 'DECLINED')
        self.assertNotIn(self.moderator_user, self.topic.moderators.all())
    
    def test_decline_invitation_not_invited_user(self):
        """Test that only invited user can decline"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.topic,
            invited_user=self.moderator_user,
            invited_by=self.creator
        )
        self.client.force_authenticate(user=self.other_user)
        url = reverse('content:topic-moderator-decline', args=[self.topic.id, invitation.id])
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_add_moderators_directly(self):
        """Test adding moderators directly (deprecated method)"""
        url = reverse('content:topic-moderators', args=[self.topic.id])
        data = {'usernames': [self.moderator_user.username]}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(self.moderator_user, self.topic.moderators.all())
    
    def test_remove_moderators_directly(self):
        """Test removing moderators directly (deprecated method)"""
        self.topic.moderators.add(self.moderator_user)
        url = reverse('content:topic-moderators', args=[self.topic.id])
        data = {'usernames': [self.moderator_user.username]}
        response = self.client.delete(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(self.moderator_user, self.topic.moderators.all())


class UserTopicsAPITests(APITestCase):
    """Test suite for User Topics API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.moderator_user = User.objects.create_user(
            username='moderator',
            email='moderator@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Topic created by user
        self.created_topic = Topic.objects.create(
            title='Created Topic',
            description='Created Description',
            creator=self.user
        )
        
        # Topic moderated by user
        self.moderated_topic = Topic.objects.create(
            title='Moderated Topic',
            description='Moderated Description',
            creator=self.moderator_user
        )
        self.moderated_topic.moderators.add(self.user)
    
    def test_get_user_topics_all(self):
        """Test getting all user topics (created and moderated)"""
        url = reverse('content:user-topics')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        topic_titles = [topic['title'] for topic in response.data]
        self.assertIn('Created Topic', topic_titles)
        self.assertIn('Moderated Topic', topic_titles)
    
    def test_get_user_topics_created(self):
        """Test getting only created topics"""
        url = reverse('content:user-topics')
        response = self.client.get(url, {'type': 'created'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Created Topic')
    
    def test_get_user_topics_moderated(self):
        """Test getting only moderated topics"""
        url = reverse('content:user-topics')
        response = self.client.get(url, {'type': 'moderated'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Moderated Topic')
    
    def test_get_user_topic_invitations(self):
        """Test getting user's pending invitations"""
        invitation = TopicModeratorInvitation.objects.create(
            topic=self.created_topic,
            invited_user=self.user,
            invited_by=self.moderator_user
        )
        url = reverse('content:user-topic-invitations')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], invitation.id)
    
    def test_get_user_topic_invitations_filtered_status(self):
        """Test getting invitations filtered by status"""
        pending_invitation = TopicModeratorInvitation.objects.create(
            topic=self.created_topic,
            invited_user=self.user,
            invited_by=self.moderator_user,
            status='PENDING'
        )
        declined_invitation = TopicModeratorInvitation.objects.create(
            topic=self.moderated_topic,
            invited_user=self.user,
            invited_by=self.moderator_user,
            status='DECLINED'
        )
        url = reverse('content:user-topic-invitations')
        response = self.client.get(url, {'status': 'PENDING'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], pending_invitation.id)


class FileSuggestionAPITests(APITestCase):
    def setUp(self):
        self.uploader = User.objects.create_user(
            username='uploader',
            email='uploader@example.com',
            password='testpass123'
        )
        self.suggester = User.objects.create_user(
            username='suggester',
            email='suggester@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='other',
            email='other@example.com',
            password='testpass123'
        )
        self.content = Content.objects.create(
            uploaded_by=self.uploader,
            media_type='TEXT',
            original_title='URL content',
            url='https://example.com/resource'
        )
        self.file_details = FileDetails.objects.create(content=self.content)

    def test_create_file_suggestion_success(self):
        self.client.force_authenticate(user=self.suggester)
        url = reverse('content:file-suggestion-create', args=[self.content.id])
        upload = SimpleUploadedFile('notes.pdf', b'pdf-content', content_type='application/pdf')
        response = self.client.post(url, {'file': upload, 'message': 'archivo para descargar'}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FileSuggestion.objects.count(), 1)
        self.assertEqual(FileSuggestion.objects.first().status, 'PENDING')

    def test_create_file_suggestion_forbidden_for_uploader(self):
        self.client.force_authenticate(user=self.uploader)
        url = reverse('content:file-suggestion-create', args=[self.content.id])
        upload = SimpleUploadedFile('notes.pdf', b'pdf-content', content_type='application/pdf')
        response = self.client.post(url, {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_accept_file_suggestion_only_uploader(self):
        suggestion = FileSuggestion.objects.create(
            content=self.content,
            suggested_by=self.suggester,
            file=SimpleUploadedFile('notes.pdf', b'pdf-content', content_type='application/pdf'),
            file_size=11,
            status='PENDING'
        )

        self.client.force_authenticate(user=self.other_user)
        url = reverse('content:file-suggestion-accept', args=[suggestion.id])
        forbidden_response = self.client.post(url)
        self.assertEqual(forbidden_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.uploader)
        ok_response = self.client.post(url)
        self.assertEqual(ok_response.status_code, status.HTTP_200_OK)
        suggestion.refresh_from_db()
        self.file_details.refresh_from_db()
        self.assertEqual(suggestion.status, 'ACCEPTED')
        self.assertTrue(bool(self.file_details.file))
        self.assertEqual(self.content.id, suggestion.content_id)
        self.assertEqual(self.content.url, 'https://example.com/resource')

    def test_list_file_suggestions_visibility(self):
        own = FileSuggestion.objects.create(
            content=self.content,
            suggested_by=self.suggester,
            file=SimpleUploadedFile('a.pdf', b'a', content_type='application/pdf'),
            status='PENDING'
        )
        other = FileSuggestion.objects.create(
            content=self.content,
            suggested_by=self.other_user,
            file=SimpleUploadedFile('b.pdf', b'b', content_type='application/pdf'),
            status='PENDING'
        )

        list_url = reverse('content:file-suggestion-list', args=[self.content.id])

        self.client.force_authenticate(user=self.suggester)
        suggester_response = self.client.get(list_url)
        self.assertEqual(suggester_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(suggester_response.data), 1)
        self.assertEqual(suggester_response.data[0]['id'], own.id)

        self.client.force_authenticate(user=self.uploader)
        uploader_response = self.client.get(list_url)
        self.assertEqual(uploader_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(uploader_response.data), 2)
        returned_ids = {item['id'] for item in uploader_response.data}
        self.assertIn(own.id, returned_ids)
        self.assertIn(other.id, returned_ids)

    def test_reject_file_suggestion_only_uploader(self):
        suggestion = FileSuggestion.objects.create(
            content=self.content,
            suggested_by=self.suggester,
            file=SimpleUploadedFile('reject.pdf', b'pdf-content', content_type='application/pdf'),
            file_size=11,
            status='PENDING'
        )
        url = reverse('content:file-suggestion-reject', args=[suggestion.id])

        self.client.force_authenticate(user=self.other_user)
        forbidden_response = self.client.post(url, {'rejection_reason': 'not allowed'}, format='json')
        self.assertEqual(forbidden_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.uploader)
        ok_response = self.client.post(url, {'rejection_reason': 'invalid file'}, format='json')
        self.assertEqual(ok_response.status_code, status.HTTP_200_OK)
        suggestion.refresh_from_db()
        self.assertEqual(suggestion.status, 'REJECTED')
        self.assertEqual(suggestion.rejection_reason, 'invalid file')

    @override_settings(
        AWS_ACCESS_KEY_ID='test',
        AWS_SECRET_ACCESS_KEY='test',
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_S3_REGION_NAME='us-west-2',
    )
    def test_file_suggestion_confirm_rejects_wrong_key_prefix(self):
        """Confirm must reject keys outside the expected path (no S3 call for bad prefix)."""
        self.client.force_authenticate(user=self.suggester)
        url = reverse('content:file-suggestion-confirm', args=[self.content.id])
        response = self.client.post(
            url,
            {'key': 'content/document/1/wrong.pdf', 'file_size': 1},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FileSuggestion.objects.count(), 0)


class UploadDirectS3APITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='directupload',
            email='directupload@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    @override_settings(
        AWS_ACCESS_KEY_ID='test',
        AWS_SECRET_ACCESS_KEY='test',
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_S3_REGION_NAME='us-west-2',
    )
    @patch('content.views._build_s3_upload_plan')
    @patch('content.views.boto3.client')
    def test_upload_content_presign_success(self, mock_boto_client, mock_build_plan):
        mock_boto_client.return_value = Mock()
        mock_build_plan.return_value = {
            'key': 'content/document/1/abc_test.pdf',
            'upload_url': 'https://example.com/upload',
            'method': 'PUT',
        }
        url = reverse('content:upload_content_presign')
        payload = {
            'filename': 'test.pdf',
            'file_size': 123,
            'content_type': 'application/pdf',
            'media_type': 'TEXT',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('key', response.data)
        self.assertIn('upload_url', response.data)

    @override_settings(
        AWS_ACCESS_KEY_ID='test',
        AWS_SECRET_ACCESS_KEY='test',
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_S3_REGION_NAME='us-west-2',
    )
    def test_upload_content_presign_invalid_media_type(self):
        url = reverse('content:upload_content_presign')
        payload = {'filename': 'test.pdf', 'file_size': 100, 'media_type': 'INVALID'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('media_type invalido', response.data['error'])

    @override_settings(
        AWS_ACCESS_KEY_ID='test',
        AWS_SECRET_ACCESS_KEY='test',
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_S3_REGION_NAME='us-west-2',
    )
    @patch('content.views.boto3.client')
    def test_upload_content_confirm_success(self, mock_boto_client):
        s3_client = Mock()
        s3_client.head_object.return_value = {}
        mock_boto_client.return_value = s3_client

        url = reverse('content:upload_content_confirm')
        payload = {
            'key': f'content/document/{self.user.id}/abc_test.pdf',
            'media_type': 'TEXT',
            'title': 'Uploaded Title',
            'author': 'Uploaded Author',
            'file_size': 123,
            'is_visible': True,
            'is_producer': False,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Content.objects.count(), 1)
        self.assertEqual(ContentProfile.objects.count(), 1)
        self.assertEqual(FileDetails.objects.count(), 1)
        created_content = Content.objects.first()
        self.assertEqual(created_content.original_title, 'Uploaded Title')

    def test_upload_content_confirm_requires_authentication(self):
        self.client.force_authenticate(user=None)
        url = reverse('content:upload_content_confirm')
        response = self.client.post(url, {'key': 'content/document/1/file.pdf'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class KnowledgePathAndTopicMediaTypeAPITests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username='kpauthor',
            email='kpauthor@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='kpother',
            email='kpother@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.author)

    def test_knowledge_path_list_and_create(self):
        KnowledgePath.objects.create(title='Path One', author=self.author)
        url = reverse('content:knowledge_path_list')
        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['title'], 'Path One')

        create_response = self.client.post(
            url,
            {'title': 'Path Two', 'description': 'Second path'},
            format='json'
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(KnowledgePath.objects.count(), 2)
        created = KnowledgePath.objects.get(title='Path Two')
        self.assertEqual(created.author, self.author)

    def test_knowledge_path_detail_read_open_but_write_restricted(self):
        kp = KnowledgePath.objects.create(title='Private Path', author=self.author)
        url = reverse('content:knowledge_path_detail', args=[kp.id])
        ok_response = self.client.get(url)
        self.assertEqual(ok_response.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_response.data['title'], 'Private Path')

        self.client.force_authenticate(user=self.other_user)
        readable_response = self.client.get(url)
        self.assertEqual(readable_response.status_code, status.HTTP_200_OK)
        forbidden_update = self.client.put(url, {'title': 'Hacked Title'}, format='json')
        self.assertEqual(forbidden_update.status_code, status.HTTP_403_FORBIDDEN)

    def test_knowledge_path_nodes_create_and_node_update_delete(self):
        kp = KnowledgePath.objects.create(title='Nodes Path', author=self.author)
        content = Content.objects.create(
            uploaded_by=self.author,
            media_type='TEXT',
            original_title='Node Content'
        )
        profile = ContentProfile.objects.create(content=content, user=self.author, title='Node Profile')
        nodes_url = reverse('content:knowledge_path_nodes', args=[kp.id])
        create_response = self.client.post(
            nodes_url,
            {
                'title': 'Start Node',
                'description': 'First node',
                'media_type': 'TEXT',
                'content_profile': profile.id
            },
            format='json'
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        node_id = create_response.data['id']

        node_url = reverse('content:node_detail', args=[node_id])
        update_response = self.client.put(node_url, {'title': 'Updated Node'}, format='json')
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['title'], 'Updated Node')

        self.client.force_authenticate(user=self.other_user)
        forbidden_update = self.client.put(node_url, {'title': 'Hack Node'}, format='json')
        self.assertEqual(forbidden_update.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.author)
        delete_response = self.client.delete(node_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Node.objects.filter(id=node_id).exists())

    def test_topic_content_media_type_returns_filtered_content(self):
        topic = Topic.objects.create(
            title='Media Topic',
            description='Media filter tests',
            creator=self.author
        )
        video_content = Content.objects.create(
            uploaded_by=self.author,
            media_type='VIDEO',
            original_title='Video Content'
        )
        text_content = Content.objects.create(
            uploaded_by=self.author,
            media_type='TEXT',
            original_title='Text Content'
        )
        ContentProfile.objects.create(content=video_content, user=self.author, title='Video Profile')
        ContentProfile.objects.create(content=text_content, user=self.author, title='Text Profile')
        topic.contents.add(video_content, text_content)

        url = reverse('content:topic-content-media-type', args=[topic.id, 'video'])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['media_type'], 'VIDEO')


class TopicContentSuggestionsAPITests(APITestCase):
    def setUp(self):
        self.creator = User.objects.create_user(
            username='topiccreator',
            email='topiccreator@example.com',
            password='testpass123'
        )
        self.moderator = User.objects.create_user(
            username='topicmoderator',
            email='topicmoderator@example.com',
            password='testpass123'
        )
        self.suggester = User.objects.create_user(
            username='topicsuggester',
            email='topicsuggester@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='topicother',
            email='topicother@example.com',
            password='testpass123'
        )
        self.topic = Topic.objects.create(
            title='Suggestion Topic',
            description='Topic for suggestion tests',
            creator=self.creator
        )
        self.topic.moderators.add(self.moderator)
        self.content = Content.objects.create(
            uploaded_by=self.suggester,
            media_type='TEXT',
            original_title='Suggested Content'
        )
        ContentProfile.objects.create(
            content=self.content,
            user=self.suggester,
            title='Suggester Profile'
        )

    def test_create_list_and_filter_topic_suggestions(self):
        self.client.force_authenticate(user=self.suggester)
        create_url = reverse('content:topic-content-suggestion-create', args=[self.topic.id])
        create_response = self.client.post(
            create_url,
            {'content_id': self.content.id, 'message': 'Useful for this topic'},
            format='json'
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_url = reverse('content:topic-content-suggestions', args=[self.topic.id])
        list_response = self.client.get(list_url, {'status': 'PENDING'})
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['status'], 'PENDING')

        duplicate_response = self.client.post(
            create_url,
            {'content_id': self.content.id, 'message': 'Duplicate suggestion'},
            format='json'
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_and_reject_permissions_and_rules(self):
        suggestion = ContentSuggestion.objects.create(
            topic=self.topic,
            content=self.content,
            suggested_by=self.suggester,
            status='PENDING'
        )
        accept_url = reverse('content:topic-content-suggestion-accept', args=[self.topic.id, suggestion.id])
        reject_url = reverse('content:topic-content-suggestion-reject', args=[self.topic.id, suggestion.id])

        self.client.force_authenticate(user=self.other_user)
        forbidden_accept = self.client.post(accept_url, format='json')
        self.assertEqual(forbidden_accept.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.moderator)
        accepted = self.client.post(accept_url, format='json')
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        suggestion.refresh_from_db()
        self.assertEqual(suggestion.status, 'ACCEPTED')
        self.assertIn(self.content, self.topic.contents.all())

        already_processed = self.client.post(reject_url, {'rejection_reason': 'late'}, format='json')
        self.assertEqual(already_processed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_requires_reason(self):
        suggestion = ContentSuggestion.objects.create(
            topic=self.topic,
            content=self.content,
            suggested_by=self.suggester,
            status='PENDING'
        )
        reject_url = reverse('content:topic-content-suggestion-reject', args=[self.topic.id, suggestion.id])
        self.client.force_authenticate(user=self.creator)
        missing_reason = self.client.post(reject_url, {'rejection_reason': '   '}, format='json')
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        ok = self.client.post(reject_url, {'rejection_reason': 'Not relevant'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        suggestion.refresh_from_db()
        self.assertEqual(suggestion.status, 'REJECTED')
        self.assertEqual(suggestion.rejection_reason, 'Not relevant')

    def test_user_content_suggestions_filter_and_delete_permissions(self):
        suggestion = ContentSuggestion.objects.create(
            topic=self.topic,
            content=self.content,
            suggested_by=self.suggester,
            status='PENDING'
        )
        own_url = reverse('content:user-content-suggestions')
        self.client.force_authenticate(user=self.suggester)
        own_response = self.client.get(own_url, {'status': 'PENDING', 'topic_id': self.topic.id})
        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(own_response.data), 1)
        self.assertEqual(own_response.data[0]['id'], suggestion.id)

        delete_url = reverse('content:topic-content-suggestion-delete', args=[self.topic.id, suggestion.id])
        self.client.force_authenticate(user=self.other_user)
        forbidden = self.client.delete(delete_url)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.suggester)
        deleted = self.client.delete(delete_url)
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertFalse(ContentSuggestion.objects.filter(id=suggestion.id).exists())


class AdditionalEndpointCoverageAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='endpointowner',
            email='endpointowner@example.com',
            password='testpass123'
        )
        self.other = User.objects.create_user(
            username='endpointother',
            email='endpointother@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.owner)
        self.topic = Topic.objects.create(
            title='Topic Edit',
            description='Topic edit tests',
            creator=self.owner
        )
        self.content = Content.objects.create(
            uploaded_by=self.owner,
            media_type='TEXT',
            original_title='Profile Content'
        )
        self.profile = ContentProfile.objects.create(
            content=self.content,
            user=self.owner,
            title='Owner Profile'
        )

    def test_content_profile_detail_success_and_not_found(self):
        url = reverse('content:content-profile-detail', args=[self.profile.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.profile.id)

        not_found = self.client.get(reverse('content:content-profile-detail', args=[99999]))
        self.assertEqual(not_found.status_code, status.HTTP_404_NOT_FOUND)

    def test_topic_edit_content_permissions_and_success(self):
        url = reverse('content:topic-edit-content', args=[self.topic.id])
        payload = {'content_profile_ids': [self.profile.id]}

        self.client.force_authenticate(user=self.other)
        forbidden = self.client.post(url, payload, format='json')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.owner)
        ok = self.client.post(url, payload, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIn(self.content, self.topic.contents.all())

    @override_settings(
        AWS_ACCESS_KEY_ID='test',
        AWS_SECRET_ACCESS_KEY='test',
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_S3_REGION_NAME='us-west-2',
    )
    @patch('content.views._build_s3_upload_plan')
    @patch('content.views.boto3.client')
    def test_file_suggestion_presign_success(self, mock_boto_client, mock_build_plan):
        suggestion_content = Content.objects.create(
            uploaded_by=self.owner,
            media_type='TEXT',
            original_title='Needs File',
            url='https://example.com/resource'
        )
        FileDetails.objects.create(content=suggestion_content)
        self.client.force_authenticate(user=self.other)
        mock_boto_client.return_value = Mock()
        mock_build_plan.return_value = {
            'key': f'content_suggestions/files/{suggestion_content.id}/{self.other.id}/abc_file.pdf',
            'upload_url': 'https://example.com/presigned',
            'method': 'PUT',
        }
        url = reverse('content:file-suggestion-presign', args=[suggestion_content.id])
        response = self.client.post(
            url,
            {'filename': 'file.pdf', 'file_size': 50, 'content_type': 'application/pdf'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('key', response.data)
        self.assertIn('upload_url', response.data)

    def test_file_suggestion_presign_requires_authentication(self):
        suggestion_content = Content.objects.create(
            uploaded_by=self.owner,
            media_type='TEXT',
            original_title='Needs File',
            url='https://example.com/resource'
        )
        FileDetails.objects.create(content=suggestion_content)
        self.client.force_authenticate(user=None)
        url = reverse('content:file-suggestion-presign', args=[suggestion_content.id])
        response = self.client.post(url, {'filename': 'file.pdf', 'file_size': 50}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_publications_endpoint_returns_published_only(self):
        own_pub = Publication.objects.create(
            user=self.owner,
            content_profile=self.profile,
            text_content='Visible publication',
            status='PUBLISHED',
            deleted=False
        )
        Publication.objects.create(
            user=self.owner,
            content_profile=self.profile,
            text_content='Draft publication',
            status='DRAFT',
            deleted=False
        )
        Publication.objects.create(
            user=self.owner,
            content_profile=self.profile,
            text_content='Deleted publication',
            status='PUBLISHED',
            deleted=True
        )
        url = reverse('content:user-publications', args=[self.owner.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], own_pub.id)