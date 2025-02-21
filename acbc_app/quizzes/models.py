from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from knowledge_paths.models import ActivityRequirement
from content.models import Content


def upload_question_image(instance, filename):
    # Generate path: question_images/quiz_<id>/question_<id>_<filename>
    return f"question_images/quiz_{instance.quiz.id}/question_{instance.id}_{filename}"


class Quiz(models.Model):
    activity_requirement = models.ForeignKey('knowledge_paths.ActivityRequirement', on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.title


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
        # Validate that multiple choice questions have at least one correct option
        if self.pk:  # Only check for existing questions
            correct_options = self.options.filter(is_correct=True).count()
            if correct_options == 0:
                raise ValidationError("Question must have at least one correct option")
            if self.question_type == 'SINGLE' and correct_options > 1:
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
        if self.is_correct and self.question.question_type == 'SINGLE':
            # Check if there's already a correct option for single choice questions
            existing_correct = self.question.options.filter(is_correct=True).exclude(pk=self.pk).exists()
            if existing_correct:
                raise ValidationError("Single choice questions can only have one correct option")


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
