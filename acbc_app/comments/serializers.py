from rest_framework import serializers
from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.username', read_only=True)
    replies = serializers.SerializerMethodField()  # Changed from have_replies to include actual replies
    reply_count = serializers.SerializerMethodField()
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    featured_badge = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 
            'body', 
            'author',  # This should be the ID
            'author_name',  # This is the username for display
            'created_at',
            'updated_at',
            'is_edited',
            'replies',
            'reply_count',
            'is_active',
            'vote_count',
            'user_vote',
            'parent',  # Added parent field
            'featured_badge'  # Author's featured badge
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_edited', 'is_active']

    def validate_body(self, value):
        # Validation to ensure the body field is not empty.
        if not value.strip():
            raise serializers.ValidationError("The body field cannot be empty.")
        return value

    def get_replies(self, obj):
        # Recursively serialize replies
        replies = obj.replies.filter(is_active=True).order_by('created_at')
        return CommentSerializer(replies, many=True).data

    def get_reply_count(self, obj):
        return obj.replies.filter(is_active=True).count()

    def get_vote_count(self, obj):
        count = obj.vote_count
        return count

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        vote = obj.get_user_vote(request.user)
        return vote

    def get_featured_badge(self, obj):
        """Get the author's featured badge if available."""
        try:
            from profiles.models import Profile
            from gamification.serializers import UserBadgeSummarySerializer
            
            # Get the author's profile
            try:
                profile = Profile.objects.get(user=obj.author)
            except Profile.DoesNotExist:
                return None
            
            # Return featured badge if it exists
            if profile.featured_badge:
                return UserBadgeSummarySerializer(profile.featured_badge, context=self.context).data
            return None
        except Exception:
            # If there's any error (e.g., gamification app not installed), return None
            return None


class KnowledgePathCommentSerializer(CommentSerializer):
    author_is_certified = serializers.SerializerMethodField()

    class Meta(CommentSerializer.Meta):
        # We inherit the fields from CommentSerializer and add the author_is_certified field
        fields = CommentSerializer.Meta.fields + ['author_is_certified']

    def get_author_is_certified(self, obj):
        # We call the model method to check if the author is certified for this KnowledgePath
        return obj.author_is_certified

    def validate(self, data):
        # Ensure this comment is not associated with a topic
        if data.get('topic') is not None:
            raise serializers.ValidationError("Knowledge path comments cannot have a topic association")
        return data


class TopicCommentSerializer(CommentSerializer):
    class Meta(CommentSerializer.Meta):
        # We inherit the fields from CommentSerializer
        fields = CommentSerializer.Meta.fields


class ContentTopicCommentSerializer(CommentSerializer):
    class Meta(CommentSerializer.Meta):
        # We inherit the fields from CommentSerializer
        fields = CommentSerializer.Meta.fields


class CommentCreateSerializer(serializers.ModelSerializer):
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['body', 'author', 'content_type', 'object_id', 'parent', 'reply_count']
        # Note: topic is intentionally excluded since it's only used for content+topic comments

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("The body field cannot be empty.")
        return value

    def create(self, validated_data):
        return Comment.objects.create(**validated_data)

    def get_reply_count(self, obj):
        # Method to get the count of active replies
        return obj.replies.filter(is_active=True).count()