from django.db import models
from django.contrib.auth.models import User
from content.models import ActivityRequirement
from content.models import Content


class Quiz(models.Model):
    activity_requirement = models.OneToOneField(ActivityRequirement, on_delete=models.CASCADE, related_name='quiz')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.title


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    text = models.TextField()

    def __str__(self):
        return self.text


class Option(models.Model):
    question = models.ForeignKey(Question, related_name='options', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)  # Indicates if this option is the correct answer

    def __str__(self):
        return f"{self.text} ({'correct' if self.is_correct else 'incorrect'})"


class UserQuizAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, related_name='attempts', on_delete=models.CASCADE)
    completed_on = models.DateTimeField(auto_now_add=True)
    score = models.IntegerField(null=True, blank=True)  # Could be calculated after completion

    def __str__(self):
        return f"{self.user.username} - {self.quiz.title} attempt on {self.completed_on}"


class Answer(models.Model):
    user_quiz_attempt = models.ForeignKey(UserQuizAttempt, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(Option, on_delete=models.CASCADE)

    def __str__(self):
        return f"Answer by {self.user_quiz_attempt.user.username} - {self.selected_option.text}"


class ExamCall(models.Model):
    activity_requirement = models.ForeignKey(ActivityRequirement, on_delete=models.CASCADE, related_name='exam_calls')
    teacher = models.ForeignKey(User, related_name='teacher_exam_calls', on_delete=models.CASCADE)
    student = models.ForeignKey(User, related_name='student_exam_calls', on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    call_type = models.CharField(max_length=10, choices=[('AUDIO', 'Audio'), ('VIDEO', 'Video')], default='AUDIO')
    completion_date = models.DateTimeField(null=True, blank=True)  # Optional: Track when the call was marked as completed

    def __str__(self):
        return f"{self.call_type} Call between {self.teacher.username} and {self.student.username}"
