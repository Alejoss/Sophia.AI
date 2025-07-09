from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
import logging
from knowledge_paths.models import Node
from content.models import Content

# Get logger for quizzes models
logger = logging.getLogger('academia_blockchain.quizzes.models')


def upload_question_image(instance, filename):
    # Generate path: question_images/quiz_<id>/question_<id>_<filename>
    return f"question_images/quiz_{instance.quiz.id}/question_{instance.id}_{filename}"


class Quiz(models.Model):
    node = models.ForeignKey('knowledge_paths.Node', on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    max_attempts_per_day = models.SmallIntegerField(
        choices=[(i, str(i)) for i in range(2, 10)],
        default=2,
        help_text="Maximum number of attempts allowed per day (2-9)"
    )

    def __str__(self):
        return f"{self.title} (Max attempts/day: {self.max_attempts_per_day})"


class Question(models.Model):
    QUESTION_TYPES = [
        ('SINGLE', 'Single Choice'),
        ('MULTIPLE', 'Multiple Choice')
    ]
    
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    text = models.TextField()
    question_type = models.CharField(max_length=8, choices=QUESTION_TYPES, default='SINGLE')
    image = models.ImageField(upload_to=upload_question_image, null=True, blank=True)
    image_description = models.CharField(max_length=255, blank=True, help_text="Description of the image for accessibility")

    def __str__(self):
        return self.text

    def clean(self):
        logger.debug("Question clean method", extra={
            'question_id': self.pk,
            'question_type': self.question_type,
        })
        
        if self.pk:  # Only check for existing questions
            correct_options = self.options.filter(is_correct=True).count()
            logger.debug("Question validation", extra={
                'question_id': self.pk,
                'correct_options_count': correct_options,
            })
            
            if correct_options == 0:
                logger.warning("Question validation failed - no correct options", extra={
                    'question_id': self.pk,
                })
                raise ValidationError("Question must have at least one correct option")
            if self.question_type == 'SINGLE' and correct_options > 1:
                logger.warning("Question validation failed - multiple correct options for single choice", extra={
                    'question_id': self.pk,
                    'correct_options_count': correct_options,
                })
                raise ValidationError("Single choice questions can only have one correct option")

    def delete(self, *args, **kwargs):
        # Delete the image file when the question is deleted
        if self.image:
            self.image.delete()
        super().delete(*args, **kwargs)


class Option(models.Model):
    question = models.ForeignKey(Question, related_name='options', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text} ({'correct' if self.is_correct else 'incorrect'})"

    def clean(self):
        logger.debug("Option clean method", extra={
            'option_id': self.pk,
            'option_text': self.text,
            'is_correct': self.is_correct,
            'question_type': self.question.question_type,
        })
        
        # Only perform this validation if we're setting this option as correct
        if self.is_correct and self.question.question_type == 'SINGLE':
            # Instead of querying the database, get the current form data
            # This is necessary because the database hasn't been updated yet
            try:
                current_correct = Option.objects.filter(
                    question=self.question,
                    is_correct=True
                ).exclude(pk=self.pk)
                
                logger.debug("Option validation", extra={
                    'option_id': self.pk,
                    'other_correct_options_count': current_correct.count(),
                })
                if current_correct.exists():
                    # Instead of raising an error, we'll handle this in save()
                    pass
            except Option.DoesNotExist:
                pass

    def save(self, *args, **kwargs):
        logger.debug("Option save method", extra={
            'option_id': self.pk,
            'option_text': self.text,
            'is_correct': self.is_correct,
            'question_id': self.question.id,
        })
        
        # If this is a single choice question and we're marking this option as correct
        if self.is_correct and self.question.question_type == 'SINGLE':
            logger.info("Updating other options to not correct for single choice question", extra={
                'option_id': self.pk,
                'question_id': self.question.id,
                'question_text': self.question.text,
            })
            # First, update all other options to be incorrect
            Option.objects.filter(question=self.question).exclude(pk=self.pk).update(is_correct=False)
        
        # Then save this option
        super().save(*args, **kwargs)


class UserQuizAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, related_name='attempts', on_delete=models.CASCADE)
    completed_on = models.DateTimeField(auto_now_add=True)
    score = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.quiz.title} attempt on {self.completed_on}"


class Answer(models.Model):
    user_quiz_attempt = models.ForeignKey(UserQuizAttempt, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_options = models.ManyToManyField(Option, related_name='answers')

    def clean(self):
        # Validate the number of selected options matches the question type
        if self.pk:  # Only check for existing answers
            selected_count = self.selected_options.count()
            if self.question.question_type == 'SINGLE' and selected_count > 1:
                raise ValidationError("Cannot select multiple options for a single choice question")
            if selected_count == 0:
                raise ValidationError("Must select at least one option")

    def __str__(self):
        options_text = ", ".join([opt.text for opt in self.selected_options.all()])
        return f"Answer by {self.user_quiz_attempt.user.username} - Selected: {options_text}"
