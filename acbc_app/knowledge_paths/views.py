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
import logging
from utils.logging_utils import knowledge_paths_logger, log_error, log_business_event, log_performance_metric


class KnowledgePathCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        try:
            knowledge_paths_logger.info("Knowledge path creation request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
            })
            
            serializer = KnowledgePathCreateSerializer(data=request.data)
            if serializer.is_valid():
                knowledge_path = serializer.save(author=request.user)
                
                knowledge_paths_logger.info("Knowledge path created successfully", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': knowledge_path.id,
                    'title': knowledge_path.title,
                })
                
                # Log business event
                log_business_event(
                    event_type="knowledge_path_created",
                    user_id=request.user.id,
                    object_id=knowledge_path.id,
                    object_type='knowledge_path',
                    extra={
                        'title': knowledge_path.title,
                        'is_visible': knowledge_path.is_visible,
                    }
                )
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                knowledge_paths_logger.warning("Knowledge path creation failed - validation errors", extra={
                    'user_id': request.user.id,
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error creating knowledge path", request.user.id, {
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while creating the knowledge path'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class KnowledgePathPagination(PageNumberPagination):
    page_size = 9  # 3x3 grid
    page_size_query_param = 'page_size'
    max_page_size = 100

class KnowledgePathListView(APIView):
    pagination_class = KnowledgePathPagination

    def get(self, request):
        try:
            knowledge_paths_logger.debug("Knowledge path list request", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'is_authenticated': request.user.is_authenticated,
            })
            
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
            
            knowledge_paths_logger.debug("Knowledge path list retrieved successfully", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'total_count': len(knowledge_paths),
                'paginated_count': len(paginated_paths),
            })
            
            # Return paginated response
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving knowledge path list", request.user.id if request.user.is_authenticated else None)
            return Response(
                {'error': 'An error occurred while retrieving knowledge paths'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserKnowledgePathsView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = KnowledgePathPagination

    def get(self, request):
        try:
            knowledge_paths_logger.debug("User knowledge paths request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
            })
            
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
            
            knowledge_paths_logger.debug("User knowledge paths retrieved successfully", extra={
                'user_id': request.user.id,
                'total_count': len(knowledge_paths),
                'paginated_count': len(paginated_paths),
            })
            
            # Return paginated response
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving user knowledge paths", request.user.id)
            return Response(
                {'error': 'An error occurred while retrieving your knowledge paths'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserEngagedKnowledgePathsView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = KnowledgePathPagination

    def get(self, request):
        try:
            knowledge_paths_logger.debug("User engaged knowledge paths request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
            })
            
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
            
            knowledge_paths_logger.debug("User engaged knowledge paths retrieved successfully", extra={
                'user_id': request.user.id,
                'total_count': len(knowledge_paths),
                'paginated_count': len(paginated_paths),
                'engaged_path_count': len(engaged_path_ids),
            })
            
            # Return paginated response
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving user engaged knowledge paths", request.user.id)
            return Response(
                {'error': 'An error occurred while retrieving your engaged knowledge paths'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserKnowledgePathsByUserIdView(APIView):
    """
    Get knowledge paths created by a specific user ID
    """
    pagination_class = KnowledgePathPagination

    def get(self, request, user_id):
        try:
            knowledge_paths_logger.debug("User knowledge paths by user ID request", extra={
                'requesting_user_id': request.user.id if request.user.is_authenticated else None,
                'target_user_id': user_id,
            })
            
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
            
            knowledge_paths_logger.debug("User knowledge paths by user ID retrieved successfully", extra={
                'requesting_user_id': request.user.id if request.user.is_authenticated else None,
                'target_user_id': user_id,
                'total_count': len(knowledge_paths),
                'paginated_count': len(paginated_paths),
            })
            
            # Return paginated response
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving knowledge paths by user ID", request.user.id if request.user.is_authenticated else None, {
                'target_user_id': user_id,
            })
            return Response(
                {'error': 'An error occurred while retrieving knowledge paths'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class KnowledgePathDetailView(APIView):
    """
    Retrieve a knowledge path and allow updating if user is the author
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        """Allow anonymous users to view knowledge paths"""
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
            serializer = KnowledgePathSerializer(knowledge_path, context={'request': request})
            
            knowledge_paths_logger.debug("Knowledge path detail retrieved", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'knowledge_path_id': pk,
                'author_id': knowledge_path.author.id,
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving knowledge path detail", request.user.id if request.user.is_authenticated else None, {
                'knowledge_path_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving the knowledge path'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk):
        """Require authentication for updates"""
        try:
            if not request.user.is_authenticated:
                knowledge_paths_logger.warning("Unauthenticated knowledge path update attempt", extra={
                    'knowledge_path_id': pk,
                })
                return Response(
                    {"error": "Authentication required to update knowledge paths"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
            knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
            
            # Check if user is the author
            if knowledge_path.author != request.user:
                knowledge_paths_logger.warning("Unauthorized knowledge path update attempt", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': pk,
                    'author_id': knowledge_path.author.id,
                })
                return Response(
                    {"error": "You do not have permission to update this knowledge path"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            knowledge_paths_logger.info("Knowledge path update request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': pk,
                'request_data': request.data,
            })
            
            serializer = KnowledgePathCreateSerializer(knowledge_path, data=request.data, context={'request': request})
            if serializer.is_valid():
                knowledge_paths_logger.debug("Knowledge path update - serializer is valid, saving...")
                updated_knowledge_path = serializer.save()
                
                knowledge_paths_logger.info("Knowledge path updated successfully", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': pk,
                    'title': updated_knowledge_path.title,
                })
                
                # Log business event
                log_business_event(
                    event_type="knowledge_path_updated",
                    user_id=request.user.id,
                    object_id=pk,
                    object_type='knowledge_path',
                    extra={
                        'title': updated_knowledge_path.title,
                        'is_visible': updated_knowledge_path.is_visible,
                    }
                )
                
                return Response(serializer.data)
            else:
                knowledge_paths_logger.warning("Knowledge path update failed - validation errors", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': pk,
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error updating knowledge path", request.user.id, {
                'knowledge_path_id': pk,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while updating the knowledge path'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NodeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            content_profile_id = request.data.get('content_profile_id')
            content_profile = get_object_or_404(ContentProfile, pk=content_profile_id)
            
            knowledge_paths_logger.info("Node creation request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'content_profile_id': content_profile_id,
                'title': request.data.get('title'),
            })
            
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
                
                knowledge_paths_logger.info("Node created successfully", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'node_id': node.id,
                    'title': node.title,
                    'media_type': node.media_type,
                })
                
                # Log business event
                log_business_event(
                    event_type="node_created",
                    user_id=request.user.id,
                    object_id=node.id,
                    object_type='node',
                    extra={
                        'knowledge_path_id': path_id,
                        'title': node.title,
                        'media_type': node.media_type,
                    }
                )
                
                serializer = NodeSerializer(node, context={'request': request})
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
            except IntegrityError:
                knowledge_paths_logger.warning("Node creation failed - content already exists in path", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'content_profile_id': content_profile_id,
                })
                return Response(
                    {"error": "This content has already been added to this knowledge path"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            log_error(e, "Error creating node", request.user.id, {
                'knowledge_path_id': path_id,
                'content_profile_id': request.data.get('content_profile_id'),
            })
            return Response(
                {'error': 'An error occurred while creating the node'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NodeDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, path_id, node_id):
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
            
            knowledge_paths_logger.info("Node deletion request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
                'node_title': node.title,
            })
            
            # Optional: Add permission check if needed
            # if knowledge_path.author != request.user:
            #     return Response(status=status.HTTP_403_FORBIDDEN)
            
            node.delete()
            
            knowledge_paths_logger.info("Node deleted successfully", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            
            # Log business event
            log_business_event(
                event_type="node_deleted",
                user_id=request.user.id,
                object_id=node_id,
                object_type='node',
                extra={
                    'knowledge_path_id': path_id,
                    'node_title': node.title,
                }
            )
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            log_error(e, "Error deleting node", request.user.id, {
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            return Response(
                {'error': 'An error occurred while deleting the node'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class KnowledgePathBasicDetailView(APIView):
    """Allow anonymous users to view basic knowledge path information"""

    def get(self, request, pk):
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
            serializer = KnowledgePathBasicSerializer(knowledge_path)
            
            knowledge_paths_logger.debug("Knowledge path basic detail retrieved", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'knowledge_path_id': pk,
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving knowledge path basic detail", request.user.id if request.user.is_authenticated else None, {
                'knowledge_path_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving the knowledge path'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NodeDetailView(APIView):
    """Allow anonymous users to view nodes, but require authentication for actions"""

    def get(self, request, path_id, node_id):
        """Allow anonymous users to view nodes"""
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
            serializer = NodeSerializer(node, context={'request': request})
            
            knowledge_paths_logger.debug("Node detail retrieved", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving node detail", request.user.id if request.user.is_authenticated else None, {
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            return Response(
                {'error': 'An error occurred while retrieving the node'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, path_id, node_id):
        """Require authentication for node completion"""
        try:
            if not request.user.is_authenticated:
                knowledge_paths_logger.warning("Unauthenticated node completion attempt", extra={
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                })
                return Response(
                    {"error": "Authentication required to complete nodes"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
            
            knowledge_paths_logger.info("Node completion request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
                'node_title': node.title,
            })
            
            # Check if the node is available for the user
            if not is_node_available_for_user(node, request.user):
                knowledge_paths_logger.warning("Node completion denied - node not available", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                })
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
            
            knowledge_paths_logger.info("Node completed successfully", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
                'was_created': created,
            })
            
            # Log business event
            log_business_event(
                event_type="node_completed",
                user_id=request.user.id,
                object_id=node_id,
                object_type='node',
                extra={
                    'knowledge_path_id': path_id,
                    'node_title': node.title,
                    'was_created': created,
                }
            )
            
            return Response({"message": "Node completed successfully"})
        except Exception as e:
            log_error(e, "Error completing node", request.user.id, {
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            return Response(
                {'error': 'An error occurred while completing the node'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, path_id, node_id):
        """Require authentication for node updates"""
        try:
            if not request.user.is_authenticated:
                knowledge_paths_logger.warning("Unauthenticated node update attempt", extra={
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                })
                return Response(
                    {"error": "Authentication required to update nodes"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
            
            # Check if user is the author of the knowledge path
            if knowledge_path.author != request.user:
                knowledge_paths_logger.warning("Unauthorized node update attempt", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                    'author_id': knowledge_path.author.id,
                })
                return Response(
                    {"error": "You do not have permission to update this node"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            knowledge_paths_logger.info("Node update request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
                'request_data': request.data,
            })
            
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
                    knowledge_paths_logger.warning("Node update failed - content profile not found", extra={
                        'user_id': request.user.id,
                        'knowledge_path_id': path_id,
                        'node_id': node_id,
                        'content_profile_id': content_profile_id,
                    })
                    return Response(
                        {"error": f"Content profile with id {content_profile_id} does not exist"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            serializer = NodeSerializer(node, data=request.data, context={'request': request}, partial=True)
            
            if serializer.is_valid():
                updated_node = serializer.save()
                
                knowledge_paths_logger.info("Node updated successfully", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                    'title': updated_node.title,
                })
                
                # Log business event
                log_business_event(
                    event_type="node_updated",
                    user_id=request.user.id,
                    object_id=node_id,
                    object_type='node',
                    extra={
                        'knowledge_path_id': path_id,
                        'title': updated_node.title,
                    }
                )
                
                return Response(serializer.data)
            else:
                knowledge_paths_logger.warning("Node update failed - validation errors", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error updating node", request.user.id, {
                'knowledge_path_id': path_id,
                'node_id': node_id,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while updating the node'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, path_id, node_id):
        """Require authentication for node deletion"""
        try:
            if not request.user.is_authenticated:
                knowledge_paths_logger.warning("Unauthenticated node deletion attempt", extra={
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                })
                return Response(
                    {"error": "Authentication required to delete nodes"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
            
            # Check if user is the author of the knowledge path
            if knowledge_path.author != request.user:
                knowledge_paths_logger.warning("Unauthorized node deletion attempt", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'node_id': node_id,
                    'author_id': knowledge_path.author.id,
                })
                return Response(
                    {"error": "You do not have permission to delete this node"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            knowledge_paths_logger.info("Node deletion request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
                'node_title': node.title,
            })
            
            node.delete()
            
            knowledge_paths_logger.info("Node deleted successfully", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            
            # Log business event
            log_business_event(
                event_type="node_deleted",
                user_id=request.user.id,
                object_id=node_id,
                object_type='node',
                extra={
                    'knowledge_path_id': path_id,
                    'node_title': node.title,
                }
            )
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            log_error(e, "Error deleting node", request.user.id, {
                'knowledge_path_id': path_id,
                'node_id': node_id,
            })
            return Response(
                {'error': 'An error occurred while deleting the node'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NodeReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, path_id):
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            if knowledge_path.author != request.user:
                knowledge_paths_logger.warning("Unauthorized node reorder attempt", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'author_id': knowledge_path.author.id,
                })
                return Response(status=status.HTTP_403_FORBIDDEN)

            knowledge_paths_logger.info("Node reorder request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': path_id,
                'request_data': request.data,
            })

            serializer = NodeReorderSerializer(data=request.data)
            if not serializer.is_valid():
                knowledge_paths_logger.warning("Node reorder failed - validation errors", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'errors': serializer.errors,
                })
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
                    
                    knowledge_paths_logger.info("Node reorder completed successfully", extra={
                        'user_id': request.user.id,
                        'knowledge_path_id': path_id,
                        'node_count': len(nodes),
                    })
                    
                    # Log business event
                    log_business_event(
                        event_type="nodes_reordered",
                        user_id=request.user.id,
                        object_id=path_id,
                        object_type='knowledge_path',
                        extra={
                            'node_count': len(nodes),
                        }
                    )
                    
                    return Response(NodeSerializer(nodes, many=True, context={'request': request}).data)

            except Exception as e:
                knowledge_paths_logger.error("Node reorder failed - transaction error", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': path_id,
                    'error': str(e),
                }, exc_info=True)
                return Response(
                    {'error': f'Failed to reorder nodes: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            log_error(e, "Error reordering nodes", request.user.id, {
                'knowledge_path_id': path_id,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while reordering nodes'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

def knowledge_path_detail(request, path_id):
    try:
        knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
        
        progress = get_knowledge_path_progress(request.user, knowledge_path)
        
        knowledge_paths_logger.debug("Knowledge path detail page rendered", extra={
            'user_id': request.user.id if request.user.is_authenticated else None,
            'knowledge_path_id': path_id,
            'progress': progress,
        })
        
        return render(request, 'knowledge_paths/detail.html', {
            'knowledge_path': knowledge_path,
            'progress': progress
        })
    except Exception as e:
        log_error(e, "Error rendering knowledge path detail page", request.user.id if request.user.is_authenticated else None, {
            'knowledge_path_id': path_id,
        })
        # For template rendering errors, we might want to return a generic error page
        return render(request, 'error.html', {'error': 'An error occurred while loading the knowledge path'})
