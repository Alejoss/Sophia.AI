from rest_framework import serializers
import logging
from .models import Quiz, Question, Option, UserQuizAttempt, Answer
from knowledge_paths.services.node_user_activity_service import has_completed_quiz

# Get logger for quizzes serializers
logger = logging.getLogger('academia_blockchain.quizzes.serializers')


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True)
    correct_answers = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ['id', 'text', 'question_type', 'image', 'image_description', 'options', 'correct_answers']

    def get_correct_answers(self, obj):
        # Get the IDs of all correct options for this question
        return [opt.id for opt in obj.options.filter(is_correct=True)]


class AnswerSerializer(serializers.ModelSerializer):
    selected_options = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    question = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Answer
        fields = ['question', 'selected_options']


class UserQuizAttemptSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = UserQuizAttempt
        fields = ['id', 'completed_on', 'score', 'answers']


class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)
    knowledge_path = serializers.SerializerMethodField()
    node = serializers.PrimaryKeyRelatedField(read_only=True)
    user_attempts = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    next_node = serializers.SerializerMethodField()
    max_attempts_per_day = serializers.IntegerField(min_value=2, max_value=9)
    last_attempt = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'node', 'title', 'description', 'questions', 'knowledge_path', 
                 'user_attempts', 'max_attempts_per_day', 'is_completed', 'next_node', 'last_attempt']

    def validate_max_attempts_per_day(self, value):
        logger.debug("Validating max_attempts_per_day", extra={
            'value': value,
            'value_type': type(value).__name__,
        })
        if not isinstance(value, int):
            try:
                value = int(value)
                logger.debug("Converted value to int", extra={'converted_value': value})
            except (ValueError, TypeError):
                logger.warning("Failed to convert max_attempts_per_day to int", extra={
                    'value': value,
                    'value_type': type(value).__name__,
                })
                raise serializers.ValidationError('Debe ser un número válido')
        
        if value < 2 or value > 9:
            logger.warning("max_attempts_per_day validation failed - out of range", extra={
                'value': value,
                'min_allowed': 2,
                'max_allowed': 9,
            })
            raise serializers.ValidationError('El valor debe estar entre 2 y 9')
        return value

    def get_knowledge_path(self, obj):
        return obj.node.knowledge_path.id if obj.node and obj.node.knowledge_path else None

    def get_user_attempts(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            attempts = UserQuizAttempt.objects.filter(
                quiz=obj,
                user=request.user
            ).order_by('-completed_on')
            return UserQuizAttemptSerializer(attempts, many=True).data
        return []

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return has_completed_quiz(request.user, obj)
        return False

    def get_next_node(self, obj):
        """Get the next node in the knowledge path if it exists."""
        if not obj.node:
            return None
            
        next_node = obj.node.get_next_node()
        if next_node:
            return {
                'id': next_node.id,
                'title': next_node.title,
                'knowledge_path': next_node.knowledge_path_id
            }
        return None

    def get_last_attempt(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            last_attempt = UserQuizAttempt.objects.filter(
                quiz=obj,
                user=request.user
            ).order_by('-completed_on').first()
            if last_attempt:
                return UserQuizAttemptSerializer(last_attempt).data
        return None

    def create(self, validated_data):
        questions_data = validated_data.pop('questions')
        quiz = Quiz.objects.create(**validated_data)

        for question_data in questions_data:
            options_data = question_data.pop('options')
            question = Question.objects.create(quiz=quiz, **question_data)
            
            for option_data in options_data:
                Option.objects.create(question=question, **option_data)

        return quiz

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', [])
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.max_attempts_per_day = validated_data.get('max_attempts_per_day', instance.max_attempts_per_day)
        instance.save()

        # Handle questions update
        instance.questions.all().delete()  # Remove existing questions
        for question_data in questions_data:
            options_data = question_data.pop('options')
            question = Question.objects.create(quiz=instance, **question_data)
            
            for option_data in options_data:
                Option.objects.create(question=question, **option_data)

        return instance


class QuizCreateSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)

    class Meta:
        model = Quiz
        fields = ['title', 'description', 'node', 'questions', 'max_attempts_per_day']

    def create(self, validated_data):
        questions_data = validated_data.pop('questions')
        node = validated_data.pop('node')
        
        # Create the Quiz with the node
        quiz = Quiz.objects.create(node=node, **validated_data)
        
        for question_data in questions_data:
            options_data = question_data.pop('options')
            question = Question.objects.create(quiz=quiz, **question_data)
            for option_data in options_data:
                Option.objects.create(question=question, **option_data)
        
        return quiz


class QuizSubmissionSerializer(serializers.Serializer):
    answers = serializers.DictField(
        child=serializers.ListField(
            child=serializers.IntegerField()
        )
    )

    def validate_answers(self, answers):
        quiz_id = self.context.get('quiz_id')
        if not quiz_id:
            raise serializers.ValidationError("El ID del cuestionario es requerido")

        # Validate that all question IDs exist in this quiz
        quiz_question_ids = set(Question.objects.filter(quiz_id=quiz_id).values_list('id', flat=True))
        submitted_question_ids = set(map(int, answers.keys()))
        
        if not submitted_question_ids.issubset(quiz_question_ids):
            raise serializers.ValidationError("IDs de preguntas inválidos enviados")

        # Validate that all option IDs exist and belong to their respective questions
        for question_id, option_ids in answers.items():
            question = Question.objects.get(id=int(question_id))
            valid_option_ids = set(question.options.values_list('id', flat=True))
            submitted_option_ids = set(option_ids)

            if not submitted_option_ids.issubset(valid_option_ids):
                raise serializers.ValidationError(f"IDs de opciones inválidos para la pregunta {question_id}")

            # Validate single choice questions have exactly one answer
            if question.question_type == 'SINGLE' and len(option_ids) != 1:
                raise serializers.ValidationError(f"La pregunta de opción única {question_id} debe tener exactamente una respuesta")

        return answers


class QuizAttemptResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserQuizAttempt
        fields = ['id', 'completed_on', 'score'] 