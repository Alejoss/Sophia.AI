from django.shortcuts import render, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import KnowledgePath, Node
from .serializers import KnowledgePathSerializer, KnowledgePathCreateSerializer, NodeSerializer, KnowledgePathBasicSerializer, NodeReorderSerializer
from utils.permissions import IsAuthor
from content.models import Content, ContentProfile
from django.db import IntegrityError, transaction
from django.db import models
from django.utils import timezone
from knowledge_paths.services.node_user_activity_service import mark_node_as_completed, get_knowledge_path_progress


class KnowledgePathCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KnowledgePathCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class KnowledgePathListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        knowledge_paths = KnowledgePath.objects.all().order_by('-created_at')
        serializer = KnowledgePathSerializer(knowledge_paths, many=True, context={'request': request})
        return Response(serializer.data)

class KnowledgePathDetailView(APIView):
    """
    Retrieve a knowledge path and allow updating if user is the author
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        serializer = KnowledgePathSerializer(knowledge_path, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path)
        serializer = KnowledgePathCreateSerializer(knowledge_path, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
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
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        serializer = KnowledgePathBasicSerializer(knowledge_path)
        return Response(serializer.data)

class NodeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, path_id, node_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        
        # Let the serializer handle availability logic
        serializer = NodeSerializer(node, context={'request': request})
        if not serializer.data['is_available']:
            return Response(
                {"error": "This node is not yet available"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        return Response(serializer.data)

    def post(self, request, path_id, node_id):
        """Mark node as completed"""
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)

        # Let the serializer handle availability logic
        serializer = NodeSerializer(node, context={'request': request})
        if not serializer.data['is_available']:
            return Response(
                {"error": "This node is not yet available"},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            mark_node_as_completed(request.user, node)
            return Response({"status": "completed"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Failed to mark node as completed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, path_id, node_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        serializer = NodeSerializer(node, data=request.data, context={'request': request}, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, path_id, node_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
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
