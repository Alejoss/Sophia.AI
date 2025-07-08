from django.shortcuts import render, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import KnowledgePath, Node
from .serializers import KnowledgePathSerializer, KnowledgePathCreateSerializer, NodeSerializer, KnowledgePathBasicSerializer, NodeReorderSerializer, KnowledgePathListSerializer, KnowledgePathEngagedSerializer
from utils.permissions import IsAuthor
from content.models import Content, ContentProfile
from django.db import IntegrityError, transaction
from django.db import models
from django.utils import timezone
from knowledge_paths.services.node_user_activity_service import mark_node_as_completed, get_knowledge_path_progress, is_node_available_for_user
from django.contrib.contenttypes.models import ContentType
from django.db.models import Prefetch
from votes.models import VoteCount, Vote
from profiles.models import UserNodeCompletion


class KnowledgePathCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = KnowledgePathCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class KnowledgePathPagination(PageNumberPagination):
    page_size = 9  # 3x3 grid
    page_size_query_param = 'page_size'
    max_page_size = 100

class KnowledgePathListView(APIView):
    pagination_class = KnowledgePathPagination

    def get(self, request):
        # Get the content type for KnowledgePath
        content_type = ContentType.objects.get_for_model(KnowledgePath)
        
        # Get all vote counts in a single query
        vote_counts = {
            vc.object_id: vc.vote_count 
            for vc in VoteCount.objects.filter(
                content_type=content_type
            )
        }
        
        # Get user votes in a single query only if user is authenticated
        user_votes = {}
        if request.user and request.user.is_authenticated:
            user_votes = {
                v.object_id: v.value 
                for v in Vote.objects.filter(
                    content_type=content_type,
                    user_id=request.user.id
                )
            }
        
        # Get knowledge paths and annotate with vote count, ordered by creation date (newest first)
        # Only show visible paths to everyone - hidden paths should stay hidden even to authors
        knowledge_paths = KnowledgePath.objects.select_related('author').filter(
            is_visible=True
        ).order_by('-created_at')
        
        # Add vote data to each knowledge path
        for path in knowledge_paths:
            path._vote_count = vote_counts.get(path.id, 0)
            path._user_vote = user_votes.get(path.id, 0)
        
        # Initialize paginator
        paginator = self.pagination_class()
        paginated_paths = paginator.paginate_queryset(knowledge_paths, request)
        
        # Serialize the paginated data with request context
        serializer = KnowledgePathListSerializer(
            paginated_paths, 
            many=True, 
            context={'request': request}
        )
        
        # Return paginated response
        return paginator.get_paginated_response(serializer.data)


class UserKnowledgePathsView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = KnowledgePathPagination

    def get(self, request):
        # Get the content type for KnowledgePath
        content_type = ContentType.objects.get_for_model(KnowledgePath)
        
        # Get all vote counts in a single query
        vote_counts = {
            vc.object_id: vc.vote_count 
            for vc in VoteCount.objects.filter(
                content_type=content_type
            )
        }
        
        # Get user votes in a single query
        user_votes = {
            v.object_id: v.value 
            for v in Vote.objects.filter(
                content_type=content_type,
                user_id=request.user.id
            )
        }
        
        # Get knowledge paths created by the authenticated user (both visible and hidden)
        knowledge_paths = KnowledgePath.objects.select_related('author').filter(
            author=request.user
        ).order_by('-created_at')
        
        # Add vote data to each knowledge path
        for path in knowledge_paths:
            path._vote_count = vote_counts.get(path.id, 0)
            path._user_vote = user_votes.get(path.id, 0)
        
        # Initialize paginator
        paginator = self.pagination_class()
        paginated_paths = paginator.paginate_queryset(knowledge_paths, request)
        
        # Serialize the paginated data with request context
        serializer = KnowledgePathListSerializer(
            paginated_paths, 
            many=True, 
            context={'request': request}
        )
        
        # Return paginated response
        return paginator.get_paginated_response(serializer.data)


class UserEngagedKnowledgePathsView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = KnowledgePathPagination

    def get(self, request):
        # Get knowledge paths that the user has engaged with (has completed at least one node)
        # This includes paths created by others that the user has started
        engaged_path_ids = UserNodeCompletion.objects.filter(
            user=request.user,
            is_completed=True
        ).values_list('knowledge_path_id', flat=True).distinct()
        
        # Exclude paths created by the user (those are shown in the "Created" tab)
        knowledge_paths = KnowledgePath.objects.select_related('author').filter(
            id__in=engaged_path_ids
        ).exclude(
            author=request.user
        ).order_by('-created_at')
        
        # Initialize paginator
        paginator = self.pagination_class()
        paginated_paths = paginator.paginate_queryset(knowledge_paths, request)
        
        # Serialize the paginated data with request context
        serializer = KnowledgePathEngagedSerializer(
            paginated_paths, 
            many=True, 
            context={'request': request}
        )
        
        # Return paginated response
        return paginator.get_paginated_response(serializer.data)


class UserKnowledgePathsByUserIdView(APIView):
    """
    Get knowledge paths created by a specific user ID
    """
    pagination_class = KnowledgePathPagination

    def get(self, request, user_id):
        # Get the content type for KnowledgePath
        content_type = ContentType.objects.get_for_model(KnowledgePath)
        
        # Get all vote counts in a single query
        vote_counts = {
            vc.object_id: vc.vote_count 
            for vc in VoteCount.objects.filter(
                content_type=content_type
            )
        }
        
        # Get user votes in a single query only if user is authenticated
        user_votes = {}
        if request.user and request.user.is_authenticated:
            user_votes = {
                v.object_id: v.value 
                for v in Vote.objects.filter(
                    content_type=content_type,
                    user_id=request.user.id
                )
            }
        
        # Get knowledge paths created by the specified user (only visible ones for other users)
        knowledge_paths = KnowledgePath.objects.select_related('author').filter(
            author_id=user_id,
            is_visible=True
        ).order_by('-created_at')
        
        # Add vote data to each knowledge path
        for path in knowledge_paths:
            path._vote_count = vote_counts.get(path.id, 0)
            path._user_vote = user_votes.get(path.id, 0)
        
        # Initialize paginator
        paginator = self.pagination_class()
        paginated_paths = paginator.paginate_queryset(knowledge_paths, request)
        
        # Serialize the paginated data with request context
        serializer = KnowledgePathListSerializer(
            paginated_paths, 
            many=True, 
            context={'request': request}
        )
        
        # Return paginated response
        return paginator.get_paginated_response(serializer.data)

class KnowledgePathDetailView(APIView):
    """
    Retrieve a knowledge path and allow updating if user is the author
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        """Allow anonymous users to view knowledge paths"""
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        serializer = KnowledgePathSerializer(knowledge_path, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        """Require authentication for updates"""
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required to update knowledge paths"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        
        # Check if user is the author
        if knowledge_path.author != request.user:
            return Response(
                {"error": "You do not have permission to update this knowledge path"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Debug: Print request data
        print(f"KnowledgePathDetailView PUT - Request data: {request.data}")
        print(f"KnowledgePathDetailView PUT - Request FILES: {request.FILES}")
        
        serializer = KnowledgePathCreateSerializer(knowledge_path, data=request.data, context={'request': request})
        if serializer.is_valid():
            print(f"KnowledgePathDetailView PUT - Serializer is valid, saving...")
            serializer.save()
            return Response(serializer.data)
        else:
            print(f"KnowledgePathDetailView PUT - Serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class NodeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        
        content_profile_id = request.data.get('content_profile_id')
        content_profile = get_object_or_404(ContentProfile, pk=content_profile_id)
        
        try:
            # Use the user-provided title if available, otherwise fall back to content profile
            title = request.data.get('title') or content_profile.title or content_profile.content.original_title
            description = request.data.get('description', '')
            node = Node.objects.create(
                knowledge_path=knowledge_path,
                content_profile=content_profile,
                title=title,
                description=description,
                media_type=content_profile.content.media_type
            )
            
            serializer = NodeSerializer(node, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except IntegrityError:
            return Response(
                {"error": "This content has already been added to this knowledge path"},
                status=status.HTTP_400_BAD_REQUEST
            )

class NodeDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, path_id, node_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        
        # Optional: Add permission check if needed
        # if knowledge_path.author != request.user:
        #     return Response(status=status.HTTP_403_FORBIDDEN)
        
        node.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class KnowledgePathBasicDetailView(APIView):
    """Allow anonymous users to view basic knowledge path information"""

    def get(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        serializer = KnowledgePathBasicSerializer(knowledge_path)
        return Response(serializer.data)

class NodeDetailView(APIView):
    """Allow anonymous users to view nodes, but require authentication for actions"""

    def get(self, request, path_id, node_id):
        """Allow anonymous users to view nodes"""
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        serializer = NodeSerializer(node, context={'request': request})
        return Response(serializer.data)

    def post(self, request, path_id, node_id):
        """Require authentication for node completion"""
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required to complete nodes"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        
        # Check if the node is available for the user
        if not is_node_available_for_user(node, request.user):
            return Response(
                {"error": "This node is not available for completion"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Mark the node as completed
        completion, created = UserNodeCompletion.objects.get_or_create(
            user=request.user,
            knowledge_path=knowledge_path,
            node=node,
            defaults={'is_completed': True, 'completed_at': timezone.now()}
        )
        
        if not created:
            completion.is_completed = True
            completion.completed_at = timezone.now()
            completion.save()
        
        return Response({"message": "Node completed successfully"})

    def put(self, request, path_id, node_id):
        """Require authentication for node updates"""
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required to update nodes"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        
        # Check if user is the author of the knowledge path
        if knowledge_path.author != request.user:
            return Response(
                {"error": "You do not have permission to update this node"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check for content_profile_id in the request data
        content_profile_id = request.data.get('content_profile_id')
        if content_profile_id:
            try:
                # Fetch the new content profile and update the node
                content_profile = ContentProfile.objects.get(pk=content_profile_id)
                node.content_profile = content_profile
                node.media_type = content_profile.content.media_type
                # Don't save yet, let the serializer handle that
            except ContentProfile.DoesNotExist:
                return Response(
                    {"error": f"Content profile with id {content_profile_id} does not exist"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = NodeSerializer(node, data=request.data, context={'request': request}, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, path_id, node_id):
        """Require authentication for node deletion"""
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required to delete nodes"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        
        # Check if user is the author of the knowledge path
        if knowledge_path.author != request.user:
            return Response(
                {"error": "You do not have permission to delete this node"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        node.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class NodeReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, path_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        if knowledge_path.author != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = NodeReorderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Get all affected nodes in a single query
                nodes_dict = {
                    node.id: node 
                    for node in Node.objects.filter(knowledge_path=knowledge_path)
                }
                
                # Create temporary order mapping to avoid conflicts
                temp_order = 10000  # Some large number
                for node_order in serializer.validated_data['node_orders']:
                    node = nodes_dict[node_order['id']]
                    node.order = temp_order + node_order['order']
                    node.save()

                # Now set final orders
                for node_order in serializer.validated_data['node_orders']:
                    node = nodes_dict[node_order['id']]
                    node.order = node_order['order']
                    node.save()

                nodes = Node.objects.filter(knowledge_path=knowledge_path).order_by('order')
                return Response(NodeSerializer(nodes, many=True, context={'request': request}).data)

        except Exception as e:
            return Response(
                {'error': f'Failed to reorder nodes: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

def knowledge_path_detail(request, path_id):
    knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
    
    progress = get_knowledge_path_progress(request.user, knowledge_path)
    
    return render(request, 'knowledge_paths/detail.html', {
        'knowledge_path': knowledge_path,
        'progress': progress
    })
