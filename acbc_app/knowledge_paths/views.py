from django.shortcuts import render, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import KnowledgePath, Node
from .serializers import KnowledgePathSerializer, KnowledgePathCreateSerializer, NodeSerializer
from utils.permissions import IsAuthor
from content.models import Content
from django.db import IntegrityError


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
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        serializer = KnowledgePathSerializer(knowledge_path)
        return Response(serializer.data)

    def put(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path)
        serializer = KnowledgePathCreateSerializer(knowledge_path, data=request.data)
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
