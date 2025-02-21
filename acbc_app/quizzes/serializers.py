from rest_framework import serializers
from .models import Quiz, Question, Option, UserQuizAttempt, Answer


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'question_type', 'image', 'image_description', 'options']


class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)

    class Meta:
        model = Quiz
        fields = ['id', 'activity_requirement', 'title', 'description', 'questions']

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
        instance.save()

        # Handle questions update
        instance.questions.all().delete()  # Remove existing questions
        for question_data in questions_data:
            options_data = question_data.pop('options')
            question = Question.objects.create(quiz=instance, **question_data)
            
            for option_data in options_data:
                Option.objects.create(question=question, **option_data)

        return instance 