from django.shortcuts import render, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import KnowledgePath, Node, ActivityRequirement
from .serializers import KnowledgePathSerializer, KnowledgePathCreateSerializer, NodeSerializer, ActivityRequirementSerializer, KnowledgePathBasicSerializer, NodeReorderSerializer
from utils.permissions import IsAuthor
from content.models import Content
from django.db import IntegrityError, transaction
from django.db import models
from profiles.models import UserProgressKnowledgePath
from django.utils import timezone


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
        serializer = KnowledgePathSerializer(knowledge_paths, many=True)
        return Response(serializer.data)

class KnowledgePathDetailView(APIView):
    """
    TODO check this with another user
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
        print(f"Received request to create node for path {path_id}")
        print(f"Request data: {request.data}")
        
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        print(f"Found knowledge path: {knowledge_path}")
        
        content_id = request.data.get('content_id')
        print(f"Content ID from request: {content_id}")
        
        content = get_object_or_404(Content, pk=content_id)
        content_profile = content.profiles.get(user=request.user)
        print(f"Found content profile: {content_profile}")
        
        try:
            # The order will be handled by the model's save method
            node = Node.objects.create(
                knowledge_path=knowledge_path,
                content=content,
                title=content_profile.display_title,
                media_type=content.media_type
            )
            print(f"Created node: {node}")
            
            serializer = NodeSerializer(node)
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

class ActivityRequirementCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        # Get the knowledge path
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        
        # Add knowledge_path to the request data
        data = {
            **request.data,
            'knowledge_path': path_id
        }
        
        serializer = ActivityRequirementSerializer(data=data)
        if serializer.is_valid():
            activity_requirement = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

        with transaction.atomic():
            progress, created = UserProgressKnowledgePath.objects.get_or_create(
                user=request.user,
                current_node=node,
                defaults={'is_completed': True, 'completed_at': timezone.now()}
            )
            
            if not created:
                progress.is_completed = True
                progress.completed_at = timezone.now()
                progress.save()

        return Response({"status": "completed"}, status=status.HTTP_200_OK)

    def put(self, request, path_id, node_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        node = get_object_or_404(Node, pk=node_id, knowledge_path=knowledge_path)
        serializer = NodeSerializer(node, data=request.data, partial=True)
        
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
        print("Received reorder request for path:", path_id)
        print("Request data:", request.data)
        
        # Get the knowledge path and verify ownership
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
        if knowledge_path.author != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = NodeReorderSerializer(data=request.data)
        if not serializer.is_valid():
            print("Serializer validation errors:", serializer.errors)
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
                return Response(NodeSerializer(nodes, many=True).data)

        except Exception as e:
            print("Error during reordering:", str(e))
            return Response(
                {'error': f'Failed to reorder nodes: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
