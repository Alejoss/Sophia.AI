from rest_framework import serializers
from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    have_replies = serializers.SerializerMethodField()  # Field to indicate if the comment has replies

    class Meta:
        model = Comment
        fields = ['id', 'author', 'body', 'created_at', 'updated_at', 'votes', 'topic', 'parent', 'have_replies']

    def validate_body(self, value):
        # Validation to ensure the body field is not empty.
        if not value.strip():
            raise serializers.ValidationError("The body field cannot be empty.")
        return value

    def get_have_replies(self, obj):
        # Method to check if the comment has any replies
        return obj.replies.exists()

    def to_representation(self, instance):
        # Call the original `to_representation` method to get the default representation
        representation = super().to_representation(instance)

        # Add the username field from the author
        representation['author'] = instance.author.username

        return representation


class KnowledgePathCommentSerializer(CommentSerializer):
    author_is_certified = serializers.SerializerMethodField()

    class Meta(CommentSerializer.Meta):
        # We inherit the fields from CommentSerializer and add the author_is_certified field
        fields = CommentSerializer.Meta.fields + ['author_is_certified']

    def get_author_is_certified(self, obj):
        # We call the model method to check if the author is certified for this KnowledgePath
        return obj.author_is_certified


class TopicCommentSerializer(CommentSerializer):
    class Meta(CommentSerializer.Meta):
        # We inherit the fields from CommentSerializer
        fields = CommentSerializer.Meta.fields


class ContentTopicCommentSerializer(CommentSerializer):
    class Meta(CommentSerializer.Meta):
        # We inherit the fields from CommentSerializer
        fields = CommentSerializer.Meta.fields