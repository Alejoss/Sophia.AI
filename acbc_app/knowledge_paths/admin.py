from django.contrib import admin
from .models import KnowledgePath, Node, ActivityRequirement, NodeActivityRequirement


@admin.register(KnowledgePath)
class KnowledgePathAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'created_at', 'updated_at', 'votes')
    search_fields = ('title', 'description', 'author__username')
    list_filter = ('created_at', 'updated_at')
    readonly_fields = ('votes',)


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('title', 'knowledge_path', 'media_type', 'created_at')
    list_filter = ('media_type', 'created_at')
    search_fields = ('title', 'description', 'knowledge_path__title')


@admin.register(ActivityRequirement)
class ActivityRequirementAdmin(admin.ModelAdmin):
    list_display = ('activity_type', 'knowledge_path', 'description')
    list_filter = ('activity_type', 'knowledge_path')
    search_fields = ('description', 'knowledge_path__title')


@admin.register(NodeActivityRequirement)
class NodeActivityRequirementAdmin(admin.ModelAdmin):
    list_display = ('preceding_node', 'following_node', 'activity_requirement', 'is_mandatory')
    list_filter = ('is_mandatory', 'activity_requirement__activity_type')
    search_fields = ('preceding_node__title', 'following_node__title')
