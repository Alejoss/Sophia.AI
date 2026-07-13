from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import serializers

from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMembership,
    DiscussionQuestion,
    DiscussionQuestionStatus,
    MembershipRole,
)
from comments.models import Comment
from events.models import Event
from knowledge_paths.models import KnowledgePath, Node
from knowledge_paths.services.node_user_activity_service import get_knowledge_path_progress
from content.models import Topic


class BookClubMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = BookClubMembership
        fields = ['id', 'user_id', 'username', 'role', 'joined_at']
        read_only_fields = fields


class BookClubListSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    knowledge_path_title = serializers.CharField(source='knowledge_path.title', read_only=True)

    class Meta:
        model = BookClub
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'status',
            'starts_at',
            'ends_at',
            'knowledge_path',
            'knowledge_path_title',
            'topic',
            'member_count',
            'is_member',
            'can_manage',
            'created_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at']

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.user_is_member(request.user)

    def get_can_manage(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.user_can_manage(request.user)


class BookClubDetailSerializer(BookClubListSerializer):
    my_role = serializers.SerializerMethodField()

    class Meta(BookClubListSerializer.Meta):
        fields = BookClubListSerializer.Meta.fields + [
            'my_role',
            'created_by',
            'updated_at',
        ]

    def get_my_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None


class BookClubCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookClub
        fields = [
            'title',
            'description',
            'cover_image',
            'knowledge_path',
            'topic',
            'starts_at',
            'ends_at',
            'status',
            'slug',
        ]
        extra_kwargs = {
            'slug': {'required': False},
            'topic': {'required': False, 'allow_null': True},
        }

    def validate_knowledge_path(self, value):
        if not isinstance(value, KnowledgePath):
            raise serializers.ValidationError('Invalid knowledge path.')
        return value

    def validate_topic(self, value):
        if value is not None and not isinstance(value, Topic):
            raise serializers.ValidationError('Invalid topic.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        club = BookClub.objects.create(created_by=request.user, **validated_data)
        BookClubMembership.objects.create(
            book_club=club,
            user=request.user,
            role=MembershipRole.ADMIN,
        )
        return club


class BookClubEventSerializer(serializers.ModelSerializer):
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    title = serializers.CharField(source='event.title', read_only=True)
    description = serializers.CharField(source='event.description', read_only=True)
    date_start = serializers.DateTimeField(source='event.date_start', read_only=True)
    date_end = serializers.DateTimeField(source='event.date_end', read_only=True)
    platform = serializers.CharField(source='event.platform', read_only=True)
    schedule_description = serializers.CharField(
        source='event.schedule_description', read_only=True
    )
    is_visible = serializers.BooleanField(source='event.is_visible', read_only=True)

    class Meta:
        model = BookClubEvent
        fields = [
            'id',
            'event_id',
            'title',
            'description',
            'date_start',
            'date_end',
            'platform',
            'schedule_description',
            'is_visible',
            'created_at',
        ]
        read_only_fields = fields


class BookClubEventCreateSerializer(serializers.Serializer):
    event_id = serializers.IntegerField()

    def validate_event_id(self, value):
        try:
            return Event.objects.get(pk=value, deleted=False)
        except Event.DoesNotExist:
            raise serializers.ValidationError('Event not found.')

    def create(self, validated_data):
        club = self.context['book_club']
        event = validated_data['event_id']
        link, _ = BookClubEvent.objects.get_or_create(book_club=club, event=event)
        return link


class DiscussionQuestionSerializer(serializers.ModelSerializer):
    mission_label = serializers.CharField(read_only=True)
    node_title = serializers.CharField(source='node.title', read_only=True, allow_null=True)
    node_order = serializers.IntegerField(source='node.order', read_only=True, allow_null=True)
    answer_count = serializers.SerializerMethodField()
    event_title = serializers.CharField(source='event.title', read_only=True, allow_null=True)
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = DiscussionQuestion
        fields = [
            'id',
            'book_club',
            'node',
            'node_title',
            'node_order',
            'mission_label',
            'event',
            'event_title',
            'body',
            'order',
            'status',
            'effective_status',
            'opens_at',
            'closes_at',
            'answer_count',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'book_club',
            'created_by',
            'created_at',
            'updated_at',
            'mission_label',
            'node_title',
            'node_order',
            'event_title',
            'answer_count',
            'effective_status',
        ]

    def get_answer_count(self, obj):
        ct = ContentType.objects.get_for_model(DiscussionQuestion)
        return Comment.objects.filter(
            content_type=ct,
            object_id=obj.id,
            parent=None,
            is_active=True,
        ).count()

    def get_effective_status(self, obj):
        # Reflect schedule without mutating in serializer
        status = obj.status
        now = timezone.now()
        if status == DiscussionQuestionStatus.DRAFT and obj.opens_at and obj.opens_at <= now:
            status = DiscussionQuestionStatus.OPEN
        if status == DiscussionQuestionStatus.OPEN and obj.closes_at and obj.closes_at <= now:
            status = DiscussionQuestionStatus.CLOSED
        return status


class DiscussionQuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscussionQuestion
        fields = [
            'node',
            'event',
            'body',
            'order',
            'status',
            'opens_at',
            'closes_at',
        ]
        extra_kwargs = {
            'node': {'required': False, 'allow_null': True},
            'event': {'required': False, 'allow_null': True},
            'opens_at': {'required': False, 'allow_null': True},
            'closes_at': {'required': False, 'allow_null': True},
        }

    def validate_node(self, value):
        if value is None:
            return value
        club = self.context['book_club']
        if value.knowledge_path_id != club.knowledge_path_id:
            raise serializers.ValidationError(
                'Node must belong to this club\'s knowledge path.'
            )
        return value

    def validate_body(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Question body cannot be empty.')
        return value.strip()

    def create(self, validated_data):
        request = self.context['request']
        club = self.context['book_club']
        return DiscussionQuestion.objects.create(
            book_club=club,
            created_by=request.user,
            **validated_data,
        )


class HubSerializer(serializers.Serializer):
    """Assembled in the view; this documents the shape."""

    club = BookClubDetailSerializer()
    progress = serializers.DictField()
    next_mission = serializers.DictField(allow_null=True)
    next_event = BookClubEventSerializer(allow_null=True)
    open_questions = DiscussionQuestionSerializer(many=True)
    past_questions = DiscussionQuestionSerializer(many=True)
    recent_activity = serializers.ListField()
    quick_links = serializers.DictField()
