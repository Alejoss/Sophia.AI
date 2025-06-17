from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from .models import Bookmark
from .serializers import BookmarkSerializer, BookmarkCreateSerializer
from content.models import Content

class BookmarkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all bookmarks for the current user"""
        print("GET /bookmarks/ - List bookmarks")
        bookmarks = Bookmark.get_user_bookmarks(request.user)
        
        # Filter by content type if provided
        content_type = request.query_params.get('content_type')
        if content_type:
            try:
                ct = ContentType.objects.get(model=content_type)
                bookmarks = bookmarks.filter(content_type=ct)
            except ContentType.DoesNotExist:
                return Response(
                    {'error': f"Content type '{content_type}' does not exist"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Filter by collection if provided
        collection = request.query_params.get('collection')
        if collection:
            bookmarks = bookmarks.filter(collection=collection)
            
        serializer = BookmarkSerializer(bookmarks, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        """Create a new bookmark"""
        print("POST /bookmarks/ - Create bookmark")
        serializer = BookmarkCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class BookmarkDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get a specific bookmark"""
        print(f"GET /bookmarks/{pk}/ - Get bookmark")
        try:
            bookmark = Bookmark.objects.get(pk=pk, user=request.user)
            serializer = BookmarkSerializer(bookmark)
            return Response(serializer.data)
        except Bookmark.DoesNotExist:
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def put(self, request, pk):
        """Update a bookmark"""
        print(f"PUT /bookmarks/{pk}/ - Update bookmark")
        try:
            bookmark = Bookmark.objects.get(pk=pk, user=request.user)
            serializer = BookmarkSerializer(bookmark, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Bookmark.DoesNotExist:
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, pk):
        """Delete a bookmark"""
        print(f"DELETE /bookmarks/{pk}/ - Delete bookmark")
        try:
            bookmark = Bookmark.objects.get(pk=pk, user=request.user)
            bookmark.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Bookmark.DoesNotExist:
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )

class BookmarkStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Check if a content is bookmarked by the current user"""
        print("GET /bookmarks/check_status/ - Check bookmark status")
        print(f"Query params: {request.query_params}")
        
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')
        topic_id = request.query_params.get('topic_id')
        
        if not content_type or not object_id:
            return Response(
                {'error': 'content_type and object_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        print(f"Content type: {content_type}, Object ID: {object_id}, Topic ID: {topic_id}")
        print(f"User: {request.user}")
        
        try:
            # Get the content type
            ct = ContentType.objects.get(model=content_type)
            print(f"Found content type: {ct}")
            
            # Check if the object exists
            model_class = ct.model_class()
            try:
                obj = model_class.objects.get(id=object_id)
                print(f"Found object: {obj}")
            except model_class.DoesNotExist:
                print(f"Object not found with ID: {object_id}")
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
                except Topic.DoesNotExist:
                    return Response(
                        {'error': 'Topic not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # If no topic_id provided, look for bookmarks without topic
                bookmark_filter['topic__isnull'] = True
            
            # Check if bookmark exists
            is_bookmarked = Bookmark.objects.filter(**bookmark_filter).exists()
            
            print(f"Is bookmarked: {is_bookmarked}")
            return Response({'is_bookmarked': is_bookmarked})
            
        except ContentType.DoesNotExist:
            print(f"Content type not found: {content_type}")
            return Response(
                {'error': f"Content type '{content_type}' does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookmarkToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Toggle bookmark status for a content"""
        print("POST /bookmarks/toggle/ - Toggle bookmark")
        print(f"Request data: {request.data}")
        print(f"User: {request.user}")
        
        serializer = BookmarkCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            print(f"Invalid serializer data: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            content_type = ContentType.objects.get(model=serializer.validated_data['content_type'])
            print(f"Content type: {content_type}")
            
            model_class = content_type.model_class()
            print(f"Model class: {model_class}")
            
            obj = model_class.objects.get(id=serializer.validated_data['object_id'])
            print(f"Found object: {obj}")
            
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
                except Topic.DoesNotExist:
                    return Response(
                        {'error': 'Topic not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # If no topic_id provided, look for bookmarks without topic
                bookmark_filter['topic__isnull'] = True
            
            # Check if bookmark exists
            try:
                bookmark = Bookmark.objects.get(**bookmark_filter)
                print("Bookmark exists, removing it")
                # Bookmark exists, remove it
                bookmark.delete()
                return Response({'status': 'removed', 'is_bookmarked': False})
            except Bookmark.DoesNotExist:
                print("Bookmark doesn't exist, creating it")
                # Bookmark doesn't exist, create it
                bookmark = Bookmark.create_bookmark(
                    user=request.user,
                    obj=obj,
                    topic=topic
                )
                return Response({
                    'status': 'created',
                    'is_bookmarked': True,
                    'bookmark': BookmarkSerializer(bookmark).data
                })
        except ContentType.DoesNotExist:
            print(f"Content type not found: {serializer.validated_data['content_type']}")
            return Response(
                {'error': f"Content type '{serializer.validated_data['content_type']}' does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookmarkCollectionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get list of unique collections for the current user"""
        print("GET /bookmarks/collections/ - Get collections")
        collections = Bookmark.objects.filter(
            user=request.user
        ).exclude(
            collection__isnull=True
        ).values_list(
            'collection', flat=True
        ).distinct()
        
        return Response(list(collections)) 