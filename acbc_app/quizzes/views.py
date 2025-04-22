from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Quiz, Question, Option, UserQuizAttempt, Answer
from .serializers import QuizSerializer, QuestionSerializer, QuizCreateSerializer, QuizSubmissionSerializer, QuizAttemptResultSerializer
from knowledge_paths.models import KnowledgePath, Node
from django.db import transaction
from django.utils import timezone
from datetime import timedelta


class QuizCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Extract data from the request
        path_id = request.data.get('path_id')
        node_id = request.data.get('node_id')
        quiz_data = request.data.get('quiz')

        # Get the node
        node = get_object_or_404(Node, pk=node_id)

        # Add the node to the quiz data
        quiz_data['node'] = node.id

        # Create the quiz
        serializer = QuizCreateSerializer(data=quiz_data)
        if serializer.is_valid():
            quiz = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class QuizDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        serializer = QuizSerializer(quiz, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        node_id = request.data.get('node')
        
        print("Received quiz update data:", request.data)
        print("Received max_attempts_per_day:", request.data.get('max_attempts_per_day'))
        print("Type of max_attempts_per_day:", type(request.data.get('max_attempts_per_day')))
        
        if node_id:
            node = get_object_or_404(Node, pk=node_id)
            quiz.node = node
        
        serializer = QuizSerializer(quiz, data=request.data)
        if serializer.is_valid():
            print("Serializer is valid")
            serializer.save()
            return Response(serializer.data)
        print("Serializer errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        quiz.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuizzesByKnowledgePathView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, path_id):
        # Get the knowledge path
        knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)

        # Fetch quizzes associated with the knowledge path
        quizzes = Quiz.objects.filter(node__knowledge_path=knowledge_path)
        serializer = QuizSerializer(quizzes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, quiz_id):
        quiz = get_object_or_404(Quiz, pk=quiz_id)
        
        # Get today's date (midnight)
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count today's attempts
        today_attempts = UserQuizAttempt.objects.filter(
            user=request.user,
            quiz=quiz,
            completed_on__gte=today
        ).count()
        
        # Check if user has exceeded daily attempts limit
        if today_attempts >= quiz.max_attempts_per_day:
            return Response({
                'status': 'error',
                'message': f'You have reached the maximum number of attempts ({quiz.max_attempts_per_day}) for today'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate submission
        serializer = QuizSubmissionSerializer(
            data=request.data,
            context={'quiz_id': quiz_id}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create the attempt
        attempt = UserQuizAttempt.objects.create(
            user=request.user,
            quiz=quiz
        )

        submitted_answers = serializer.validated_data['answers']
        total_questions = len(submitted_answers)
        correct_answers = 0

        # Process each answer
        for question_id, selected_option_ids in submitted_answers.items():
            question = Question.objects.get(pk=question_id)
            
            # Create Answer record
            answer = Answer.objects.create(
                user_quiz_attempt=attempt,
                question=question
            )
            answer.selected_options.set(selected_option_ids)

            # Check if answer is correct
            correct_options = set(question.options.filter(is_correct=True).values_list('id', flat=True))
            submitted_options = set(selected_option_ids)
            
            if submitted_options == correct_options:
                correct_answers += 1

        # Calculate and save score
        score = round((correct_answers / total_questions) * 100)
        attempt.score = score
        attempt.save()

        # Get next node information if score is 100
        next_node = None
        if score == 100:
            current_node = quiz.node
            next_node = current_node.get_next_node()

        # Return the result
        result_serializer = QuizAttemptResultSerializer(attempt)
        
        return Response({
            'status': 'completed',
            'attempt': result_serializer.data,
            'correct_answers': correct_answers,
            'total_questions': total_questions,
            'attempts_remaining': quiz.max_attempts_per_day - (today_attempts + 1),
            'next_node': {
                'id': next_node.id,
                'title': next_node.title,
                'knowledge_path': next_node.knowledge_path_id
            } if next_node else None
        }, status=status.HTTP_201_CREATED)
