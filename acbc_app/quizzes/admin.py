from django.contrib import admin
import logging
from .models import Quiz, Question, Option, UserQuizAttempt, Answer

# Get logger for quizzes admin
logger = logging.getLogger('academia_blockchain.quizzes.admin')


class OptionInline(admin.TabularInline):
    model = Option
    extra = 1
    min_num = 2
    max_num = 10


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    min_num = 1
    inlines = [OptionInline]


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'node', 'max_attempts_per_day')
    list_filter = ('node__knowledge_path', 'max_attempts_per_day')
    search_fields = ('title', 'description', 'node__title')
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'quiz', 'question_type')
    list_filter = ('question_type', 'quiz')
    search_fields = ('text', 'quiz__title')
    inlines = [OptionInline]


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ('text', 'question', 'is_correct')
    list_filter = ('is_correct', 'question__question_type')
    search_fields = ('text', 'question__text')

    def save_model(self, request, obj, form, change):
        logger.debug("Admin save_model", extra={
            'option_id': obj.pk,
            'option_text': obj.text,
            'is_correct': obj.is_correct,
            'question_id': obj.question.id,
            'user_id': request.user.id,
        })
        
        # If marking as correct in a single choice question
        if obj.is_correct and obj.question.question_type == 'SINGLE':
            logger.info("Updating other options to not correct for single choice question in admin", extra={
                'option_id': obj.pk,
                'question_id': obj.question.id,
                'user_id': request.user.id,
            })
            # Update other options first
            Option.objects.filter(question=obj.question).exclude(pk=obj.pk).update(is_correct=False)
        
        super().save_model(request, obj, form, change)


@admin.register(UserQuizAttempt)
class UserQuizAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'quiz', 'score', 'completed_on')
    list_filter = ('quiz', 'completed_on')
    search_fields = ('user__username', 'quiz__title')
    readonly_fields = ('completed_on',)


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('user_quiz_attempt', 'question', 'get_selected_options')
    list_filter = ('question__question_type', 'user_quiz_attempt__completed_on')
    search_fields = ('user_quiz_attempt__user__username', 'question__text')
    filter_horizontal = ('selected_options',)

    def get_selected_options(self, obj):
        return ", ".join([opt.text for opt in obj.selected_options.all()])
    get_selected_options.short_description = 'Selected Options'
