import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from .models import Bookmark
from .serializers import BookmarkSerializer, BookmarkCreateSerializer
from content.models import Content

logger = logging.getLogger(__name__)

class BookmarkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all bookmarks for the current user"""
        logger.info(f"Bookmark list requested by user {request.user.username} (ID: {request.user.id})")
        
        try:
            bookmarks = Bookmark.get_user_bookmarks(request.user)
            logger.debug(f"Retrieved {bookmarks.count()} bookmarks for user {request.user.username}")
            
            # Filter by content type if provided
            content_type = request.query_params.get('content_type')
            if content_type:
                logger.debug(f"Filtering by content type: {content_type}")
                try:
                    ct = ContentType.objects.get(model=content_type)
                    bookmarks = bookmarks.filter(content_type=ct)
                    logger.debug(f"Filtered to {bookmarks.count()} bookmarks")
                except ContentType.DoesNotExist:
                    logger.warning(f"Invalid content type requested: {content_type}")
                    return Response(
                        {'error': f"Content type '{content_type}' does not exist"},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            # Filter by collection if provided
            collection = request.query_params.get('collection')
            if collection:
                logger.debug(f"Filtering by collection: {collection}")
                bookmarks = bookmarks.filter(collection=collection)
                logger.debug(f"Filtered to {bookmarks.count()} bookmarks")
                
            serializer = BookmarkSerializer(bookmarks, many=True, context={'request': request})
            logger.info(f"Successfully returned {len(serializer.data)} bookmarks for user {request.user.username}")
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error retrieving bookmarks for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve bookmarks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """Create a new bookmark"""
        logger.info(f"Bookmark creation requested by user {request.user.username} (ID: {request.user.id})")
        logger.debug(f"Bookmark creation data: {request.data}")
        
        try:
            serializer = BookmarkCreateSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                bookmark = serializer.save()
                logger.info(f"Bookmark created successfully - ID: {bookmark.id}, User: {request.user.username}, Content: {bookmark.content_type.model}-{bookmark.object_id}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Invalid bookmark data from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating bookmark for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to create bookmark'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookmarkDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get a specific bookmark"""
        logger.info(f"Bookmark detail requested - ID: {pk}, User: {request.user.username}")
        
        try:
            bookmark = Bookmark.objects.get(pk=pk, user=request.user)
            serializer = BookmarkSerializer(bookmark)
            logger.debug(f"Bookmark {pk} retrieved successfully for user {request.user.username}")
            return Response(serializer.data)
        except Bookmark.DoesNotExist:
            logger.warning(f"Bookmark {pk} not found for user {request.user.username}")
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error retrieving bookmark {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve bookmark'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk):
        """Update a bookmark"""
        logger.info(f"Bookmark update requested - ID: {pk}, User: {request.user.username}")
        logger.debug(f"Update data: {request.data}")
        
        try:
            bookmark = Bookmark.objects.get(pk=pk, user=request.user)
            serializer = BookmarkSerializer(bookmark, data=request.data, partial=True)
            if serializer.is_valid():
                updated_bookmark = serializer.save()
                logger.info(f"Bookmark {pk} updated successfully for user {request.user.username}")
                return Response(serializer.data)
            else:
                logger.warning(f"Invalid update data for bookmark {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Bookmark.DoesNotExist:
            logger.warning(f"Bookmark {pk} not found for user {request.user.username}")
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating bookmark {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to update bookmark'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk):
        """Delete a bookmark"""
        logger.info(f"Bookmark deletion requested - ID: {pk}, User: {request.user.username}")
        
        try:
            bookmark = Bookmark.objects.get(pk=pk, user=request.user)
            bookmark_content = f"{bookmark.content_type.model}-{bookmark.object_id}"
            bookmark.delete()
            logger.info(f"Bookmark {pk} ({bookmark_content}) deleted successfully for user {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Bookmark.DoesNotExist:
            logger.warning(f"Bookmark {pk} not found for user {request.user.username}")
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error deleting bookmark {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to delete bookmark'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookmarkStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Check if a content is bookmarked by the current user"""
        logger.info(f"Bookmark status check requested by user {request.user.username}")
        logger.debug(f"Query params: {request.query_params}")
        
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')
        topic_id = request.query_params.get('topic_id')
        
        if not content_type or not object_id:
            logger.warning(f"Missing required parameters from user {request.user.username}: content_type={content_type}, object_id={object_id}")
            return Response(
                {'error': 'content_type and object_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        logger.debug(f"Checking bookmark status - Content type: {content_type}, Object ID: {object_id}, Topic ID: {topic_id}")
        
        try:
            # Get the content type
            ct = ContentType.objects.get(model=content_type)
            logger.debug(f"Found content type: {ct}")
            
            # Check if the object exists
            model_class = ct.model_class()
            try:
                obj = model_class.objects.get(id=object_id)
                logger.debug(f"Found object: {obj}")
            except model_class.DoesNotExist:
                logger.warning(f"Object not found with ID: {object_id} for content type: {content_type}")
                return Response(
                    {'error': 'Content not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Build the filter for bookmark existence
            bookmark_filter = {
                'user': request.user,
                'content_type': ct,
                'object_id': object_id
            }
            
            # Add topic filter if provided
            if topic_id:
                from content.models import Topic
                try:
                    topic = Topic.objects.get(id=topic_id)
                    bookmark_filter['topic'] = topic
                    logger.debug(f"Added topic filter: {topic}")
                except Topic.DoesNotExist:
                    logger.warning(f"Topic not found with ID: {topic_id}")
                    return Response(
                        {'error': 'Topic not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # If no topic_id provided, look for bookmarks without topic
                bookmark_filter['topic__isnull'] = True
                logger.debug("Looking for bookmarks without topic")
            
            # Check if bookmark exists
            is_bookmarked = Bookmark.objects.filter(**bookmark_filter).exists()
            
            logger.info(f"Bookmark status check completed - User: {request.user.username}, Content: {content_type}-{object_id}, Is bookmarked: {is_bookmarked}")
            return Response({'is_bookmarked': is_bookmarked})
            
        except ContentType.DoesNotExist:
            logger.warning(f"Content type not found: {content_type}")
            return Response(
                {'error': f"Content type '{content_type}' does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error checking bookmark status for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookmarkToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Toggle bookmark status for a content"""
        logger.info(f"Bookmark toggle requested by user {request.user.username}")
        logger.debug(f"Toggle data: {request.data}")
        
        try:
            serializer = BookmarkCreateSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                logger.warning(f"Invalid toggle data from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            content_type = ContentType.objects.get(model=serializer.validated_data['content_type'])
            logger.debug(f"Content type: {content_type}")
            
            model_class = content_type.model_class()
            logger.debug(f"Model class: {model_class}")
            
            obj = model_class.objects.get(id=serializer.validated_data['object_id'])
            logger.debug(f"Found object: {obj}")
            
            # Build the filter for bookmark existence
            bookmark_filter = {
                'user': request.user,
                'content_type': content_type,
                'object_id': obj.id
            }
            
            # Add topic filter if provided
            topic = None
            if serializer.validated_data.get('topic_id'):
                from content.models import Topic
                try:
                    topic = Topic.objects.get(id=serializer.validated_data['topic_id'])
                    bookmark_filter['topic'] = topic
                    logger.debug(f"Added topic filter: {topic}")
                except Topic.DoesNotExist:
                    logger.warning(f"Topic not found with ID: {serializer.validated_data['topic_id']}")
                    return Response(
                        {'error': 'Topic not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # If no topic_id provided, look for bookmarks without topic
                bookmark_filter['topic__isnull'] = True
                logger.debug("Looking for bookmarks without topic")
            
            # Check if bookmark exists
            try:
                bookmark = Bookmark.objects.get(**bookmark_filter)
                logger.info(f"Bookmark exists, removing it - User: {request.user.username}, Content: {content_type.model}-{obj.id}")
                # Bookmark exists, remove it
                bookmark.delete()
                return Response({'status': 'removed', 'is_bookmarked': False})
            except Bookmark.DoesNotExist:
                logger.info(f"Bookmark doesn't exist, creating it - User: {request.user.username}, Content: {content_type.model}-{obj.id}")
                # Bookmark doesn't exist, create it
                bookmark = Bookmark.create_bookmark(
                    user=request.user,
                    obj=obj,
                    topic=topic
                )
                logger.info(f"Bookmark created successfully - ID: {bookmark.id}")
                return Response({
                    'status': 'created',
                    'is_bookmarked': True,
                    'bookmark': BookmarkSerializer(bookmark).data
                })
        except ContentType.DoesNotExist:
            logger.warning(f"Content type not found: {serializer.validated_data['content_type']}")
            return Response(
                {'error': f"Content type '{serializer.validated_data['content_type']}' does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error toggling bookmark for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookmarkCollectionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get list of unique collections for the current user"""
        logger.info(f"Bookmark collections requested by user {request.user.username}")
        
        try:
            collections = Bookmark.objects.filter(
                user=request.user
            ).exclude(
                collection__isnull=True
            ).values_list(
                'collection', flat=True
            ).distinct()
            
            collections_list = list(collections)
            logger.info(f"Retrieved {len(collections_list)} unique collections for user {request.user.username}")
            logger.debug(f"Collections: {collections_list}")
            
            return Response(collections_list)
        except Exception as e:
            logger.error(f"Error retrieving bookmark collections for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve bookmark collections'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 