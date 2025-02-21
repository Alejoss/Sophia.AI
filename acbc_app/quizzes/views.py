from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Quiz, Question, Option
from .serializers import QuizSerializer, QuestionSerializer
from knowledge_paths.models import ActivityRequirement

# Create your views here.

class QuizCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Get the activity requirement
        activity_requirement_id = request.data.get('activity_requirement')
        activity_requirement = get_object_or_404(ActivityRequirement, pk=activity_requirement_id)

        # Create quiz with nested questions and options
        serializer = QuizSerializer(data=request.data)
        if serializer.is_valid():
            quiz = serializer.save(activity_requirement=activity_requirement)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class QuizDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        serializer = QuizSerializer(quiz)
        return Response(serializer.data)

    def put(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        serializer = QuizSerializer(quiz, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        quiz.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
