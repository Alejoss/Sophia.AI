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


def _normalize_optional_url(value):
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.core.validators import URLValidator

    value = (value or '').strip()
    if not value:
        return ''
    if not value.lower().startswith(('http://', 'https://')):
        value = f'https://{value}'
    try:
        URLValidator()(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(
            'Introduce un enlace válido, por ejemplo https://linkedin.com/in/usuario'
        ) from exc
    return value


def _profile_for(user):
    from profiles.models import Profile

    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


class BookClubMemberIntroductionSerializer(serializers.Serializer):
    """
    Club presentation form backed by Profile (source of truth).

    - intro_description → Profile.profile_description
    - social_url → Profile.external_url
    - additional_url → BookClubMembership.additional_url (extra optional link)
    Membership.intro_updated_at marks that the user presented themselves in this club.
    """

    intro_description = serializers.CharField(
        required=True, allow_blank=False, max_length=1000
    )
    social_url = serializers.CharField(
        required=False, allow_blank=True, max_length=500
    )
    additional_url = serializers.CharField(
        required=False, allow_blank=True, max_length=500
    )
    intro_updated_at = serializers.DateTimeField(read_only=True)
    sourced_from_profile = serializers.BooleanField(read_only=True)

    def validate_social_url(self, value):
        return _normalize_optional_url(value)

    def validate_additional_url(self, value):
        return _normalize_optional_url(value)

    def to_representation(self, membership):
        profile = getattr(membership.user, 'profile', None)
        profile_description = (getattr(profile, 'profile_description', None) or '').strip()
        profile_url = (getattr(profile, 'external_url', None) or '').strip()
        # Prefer Profile; fall back to legacy membership copies if profile empty.
        intro = profile_description or (membership.intro_description or '').strip()
        social = profile_url or (membership.social_url or '').strip()
        return {
            'intro_description': intro,
            'social_url': social,
            'additional_url': membership.additional_url or '',
            'intro_updated_at': membership.intro_updated_at,
            'sourced_from_profile': bool(profile_description or profile_url),
        }

    def update(self, membership, validated_data):
        profile = _profile_for(membership.user)
        intro = validated_data['intro_description'].strip()
        social = validated_data.get('social_url', '') or ''
        additional = validated_data.get('additional_url', '') or ''

        profile.profile_description = intro
        profile.external_url = social
        profile.save(update_fields=['profile_description', 'external_url'])

        # Keep membership mirrors for roster fallback / admin, and mark presented.
        membership.intro_description = intro
        membership.social_url = social
        membership.additional_url = additional
        membership.intro_updated_at = timezone.now()
        membership.save(
            update_fields=[
                'intro_description',
                'social_url',
                'additional_url',
                'intro_updated_at',
            ]
        )
        return membership


class BookClubMemberPublicSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    is_me = serializers.SerializerMethodField()
    has_introduced = serializers.BooleanField(read_only=True)
    intro_description = serializers.SerializerMethodField()
    social_url = serializers.SerializerMethodField()

    class Meta:
        model = BookClubMembership
        fields = [
            'id',
            'user_id',
            'username',
            'role',
            'intro_description',
            'social_url',
            'additional_url',
            'joined_at',
            'intro_updated_at',
            'has_introduced',
            'is_me',
        ]
        read_only_fields = fields

    def _profile(self, obj):
        return getattr(obj.user, 'profile', None)

    def get_intro_description(self, obj):
        profile = self._profile(obj)
        description = (getattr(profile, 'profile_description', None) or '').strip()
        return description or (obj.intro_description or '').strip()

    def get_social_url(self, obj):
        profile = self._profile(obj)
        url = (getattr(profile, 'external_url', None) or '').strip()
        return url or (obj.social_url or '').strip()

    def get_is_me(self, obj):
        request = self.context.get('request')
        return bool(
            request
            and request.user.is_authenticated
            and request.user.id == obj.user_id
        )


class BookClubListSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    knowledge_path_title = serializers.SerializerMethodField()

    class Meta:
        model = BookClub
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'telegram_group_url',
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

    def get_knowledge_path_title(self, obj):
        return obj.knowledge_path.title if obj.knowledge_path_id else None

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
    # CharField so we can normalize t.me/... → https:// before URL validation.
    telegram_group_url = serializers.CharField(
        required=False, allow_blank=True, max_length=500
    )

    class Meta:
        model = BookClub
        fields = [
            'title',
            'description',
            'cover_image',
            'telegram_group_url',
            'knowledge_path',
            'topic',
            'starts_at',
            'ends_at',
            'status',
            'slug',
        ]
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
            'knowledge_path': {'required': False, 'allow_null': True},
            'topic': {'required': False, 'allow_null': True},
            'description': {'required': False, 'allow_blank': True},
            'cover_image': {'required': False, 'allow_null': True},
            'starts_at': {'required': False, 'allow_null': True},
            'ends_at': {'required': False, 'allow_null': True},
            'status': {'required': False},
        }

    def validate_knowledge_path(self, value):
        if value is None:
            return value
        if not isinstance(value, KnowledgePath):
            raise serializers.ValidationError('Invalid knowledge path.')
        return value

    def validate_topic(self, value):
        if value is not None and not isinstance(value, Topic):
            raise serializers.ValidationError('Invalid topic.')
        return value

    def validate_telegram_group_url(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError
        from django.core.validators import URLValidator

        if value is None:
            return ''
        value = str(value).strip()
        if not value:
            return ''
        if value.startswith('@'):
            value = f'https://t.me/{value[1:]}'
        elif value.lower().startswith(('t.me/', 'telegram.me/')):
            value = f'https://{value}'
        elif not value.lower().startswith(('http://', 'https://')):
            if '/' not in value and value.replace('_', '').isalnum():
                value = f'https://t.me/{value}'
        try:
            URLValidator()(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                'URL de Telegram no válida. Usa https://t.me/tu-grupo'
            ) from exc
        return value

    def _ensure_knowledge_path(self, club, user):
        if club.knowledge_path_id:
            return club
        club.knowledge_path = KnowledgePath.objects.create(
            title=club.title,
            description=club.description or '',
            author=user,
            is_visible=False,
        )
        club.save(update_fields=['knowledge_path', 'updated_at'])
        return club

    def create(self, validated_data):
        request = self.context['request']
        club = BookClub.objects.create(created_by=request.user, **validated_data)
        self._ensure_knowledge_path(club, request.user)
        BookClubMembership.objects.create(
            book_club=club,
            user=request.user,
            role=MembershipRole.ADMIN,
        )
        return club

    def update(self, instance, validated_data):
        club = super().update(instance, validated_data)
        request = self.context.get('request')
        user = request.user if request else club.created_by
        return self._ensure_knowledge_path(club, user)


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
    has_answered = serializers.SerializerMethodField()
    can_see_answers = serializers.SerializerMethodField()

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
            'has_answered',
            'can_see_answers',
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
            'has_answered',
            'can_see_answers',
        ]

    def get_answer_count(self, obj):
        from book_clubs.permissions import user_can_see_answers

        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user_can_see_answers(obj, user):
            return None
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

    def get_has_answered(self, obj):
        from book_clubs.permissions import user_has_answered

        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return user_has_answered(obj, user)

    def get_can_see_answers(self, obj):
        from book_clubs.permissions import user_can_see_answers

        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return user_can_see_answers(obj, user)

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
        if not club.knowledge_path_id:
            raise serializers.ValidationError(
                'This club has no knowledge path yet.'
            )
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
