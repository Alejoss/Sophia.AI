import logging
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

logger = logging.getLogger(__name__)


class QuizCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logger.info(f"Quiz creation requested by user {request.user.username}")
        logger.debug(f"Quiz creation data: {request.data}")
        
        try:
            # Extract data from the request
            path_id = request.data.get('path_id')
            node_id = request.data.get('node_id')
            quiz_data = request.data.get('quiz')
            
            logger.debug(f"Creating quiz for path ID: {path_id}, node ID: {node_id}")

            # Get the node
            node = get_object_or_404(Node, pk=node_id)
            logger.debug(f"Found node: {node.title} (ID: {node.id})")

            # Add the node to the quiz data
            quiz_data['node'] = node.id

            # Create the quiz
            serializer = QuizCreateSerializer(data=quiz_data)
            if serializer.is_valid():
                quiz = serializer.save()
                logger.info(f"Quiz created successfully - ID: {quiz.id}, Title: {quiz.title}, User: {request.user.username}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Quiz creation failed - validation errors from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating quiz for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to create quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class QuizDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        logger.info(f"Quiz detail requested - Quiz ID: {pk}, User: {request.user.username}")
        
        try:
            quiz = get_object_or_404(Quiz, pk=pk)
            serializer = QuizSerializer(quiz, context={'request': request})
            logger.debug(f"Quiz detail retrieved successfully - Quiz: {quiz.title}, User: {request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving quiz detail for quiz {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk):
        logger.info(f"Quiz update requested - Quiz ID: {pk}, User: {request.user.username}")
        logger.debug(f"Quiz update data: {request.data}")
        
        try:
            quiz = get_object_or_404(Quiz, pk=pk)
            node_id = request.data.get('node')
            
            logger.debug(f"Received quiz update data: {request.data}")
            logger.debug(f"Received max_attempts_per_day: {request.data.get('max_attempts_per_day')}")
            logger.debug(f"Type of max_attempts_per_day: {type(request.data.get('max_attempts_per_day'))}")
            
            if node_id:
                node = get_object_or_404(Node, pk=node_id)
                quiz.node = node
                logger.debug(f"Updated quiz node to: {node.title}")
            
            serializer = QuizSerializer(quiz, data=request.data)
            if serializer.is_valid():
                logger.debug("Quiz update serializer is valid")
                updated_quiz = serializer.save()
                logger.info(f"Quiz updated successfully - ID: {pk}, Title: {updated_quiz.title}, Updated by: {request.user.username}")
                return Response(serializer.data)
            else:
                logger.warning(f"Quiz update failed - validation errors for quiz {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating quiz {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to update quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk):
        logger.info(f"Quiz deletion requested - Quiz ID: {pk}, User: {request.user.username}")
        
        try:
            quiz = get_object_or_404(Quiz, pk=pk)
            quiz_title = quiz.title
            quiz.delete()
            logger.info(f"Quiz deleted successfully - ID: {pk}, Title: {quiz_title}, Deleted by: {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting quiz {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to delete quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class QuizzesByKnowledgePathView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, path_id):
        logger.info(f"Quizzes by knowledge path requested - Path ID: {path_id}, User: {request.user.username}")
        
        try:
            # Get the knowledge path
            knowledge_path = get_object_or_404(KnowledgePath, pk=path_id)
            logger.debug(f"Found knowledge path: {knowledge_path.title}")

            # Fetch quizzes associated with the knowledge path
            quizzes = Quiz.objects.filter(node__knowledge_path=knowledge_path)
            serializer = QuizSerializer(quizzes, many=True)
            
            logger.info(f"Successfully retrieved {len(serializer.data)} quizzes for knowledge path {knowledge_path.title}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving quizzes for knowledge path {path_id} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve quizzes'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, quiz_id):
        logger.info(f"Quiz submission requested - Quiz ID: {quiz_id}, User: {request.user.username}")
        logger.debug(f"Quiz submission data: {request.data}")
        
        try:
            quiz = get_object_or_404(Quiz, pk=quiz_id)
            logger.debug(f"Found quiz: {quiz.title}")
            
            # Get today's date (midnight)
            today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Count today's attempts
            today_attempts = UserQuizAttempt.objects.filter(
                user=request.user,
                quiz=quiz,
                completed_on__gte=today
            ).count()
            
            logger.debug(f"Today's attempts for user {request.user.username}: {today_attempts}/{quiz.max_attempts_per_day}")
            
            # Check if user has exceeded daily attempts limit
            if today_attempts >= quiz.max_attempts_per_day:
                logger.warning(f"User {request.user.username} exceeded daily attempts limit for quiz {quiz_id}")
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
                logger.warning(f"Quiz submission validation failed for user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            # Create the attempt
            attempt = UserQuizAttempt.objects.create(
                user=request.user,
                quiz=quiz
            )
            logger.debug(f"Created quiz attempt - ID: {attempt.id}")

            submitted_answers = serializer.validated_data['answers']
            total_questions = len(submitted_answers)
            correct_answers = 0

            logger.debug(f"Processing {total_questions} questions for quiz attempt {attempt.id}")

            # Process each answer
            for question_id, selected_option_ids in submitted_answers.items():
                question = Question.objects.get(pk=question_id)
                logger.debug(f"Processing question {question_id}: {question.text}")
                
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
                    logger.debug(f"Question {question_id} answered correctly")
                else:
                    logger.debug(f"Question {question_id} answered incorrectly")

            # Calculate and save score
            score = round((correct_answers / total_questions) * 100)
            attempt.score = score
            attempt.save()
            
            logger.info(f"Quiz attempt completed - ID: {attempt.id}, Score: {score}%, Correct: {correct_answers}/{total_questions}")

            # Get next node information if score is 100
            next_node = None
            if score == 100:
                current_node = quiz.node
                next_node = current_node.get_next_node()
                if next_node:
                    logger.info(f"Quiz passed with 100% - Next node available: {next_node.title}")
                else:
                    logger.info(f"Quiz passed with 100% - No next node available")

            # Return the result
            result_serializer = QuizAttemptResultSerializer(attempt)
            
            logger.info(f"Quiz submission completed successfully for user {request.user.username} - Score: {score}%")
            
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
            
        except Exception as e:
            logger.error(f"Error submitting quiz {quiz_id} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to submit quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
