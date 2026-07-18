from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class BookClubStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    ACTIVE = 'active', 'Active'
    CLOSED = 'closed', 'Closed'


class DiscussionQuestionStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    OPEN = 'open', 'Open'
    CLOSED = 'closed', 'Closed'


class BookClub(models.Model):
    """
    Cohort container for a reading club cycle.
    Orchestrates a KnowledgePath (missions), Topic (Investigación / timeline),
    and Events (lives).
    """
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to='book_club_covers/', null=True, blank=True)
    telegram_group_url = models.URLField(
        max_length=500,
        blank=True,
        help_text='Link al grupo de Telegram del ciclo (t.me/...).',
    )
    knowledge_path = models.ForeignKey(
        'knowledge_paths.KnowledgePath',
        on_delete=models.PROTECT,
        related_name='book_clubs',
        null=True,
        blank=True,
        help_text='Optional. If omitted on create, an empty path is created for missions.',
    )
    topic = models.ForeignKey(
        'content.Topic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='book_clubs',
        help_text='Tema de Investigación: timeline y biblioteca de media en el hub.',
    )
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=BookClubStatus.choices,
        default=BookClubStatus.DRAFT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_book_clubs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-starts_at', '-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or 'club'
            slug = base
            counter = 1
            while BookClub.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                counter += 1
                slug = f'{base}-{counter}'
            self.slug = slug
        super().save(*args, **kwargs)

    def user_is_member(self, user):
        if not user or not user.is_authenticated:
            return False
        return self.memberships.filter(user=user).exists()

    def user_can_manage(self, user):
        """Club management is staff-only (no per-club mentor/admin roles)."""
        if not user or not user.is_authenticated:
            return False
        return user.is_staff or user.is_superuser


class BookClubMembership(models.Model):
    book_club = models.ForeignKey(BookClub, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='book_club_memberships',
    )
    intro_description = models.TextField(
        blank=True,
        help_text='Presentación del miembro: qué hace.',
    )
    social_url = models.URLField(max_length=500, blank=True)
    additional_url = models.URLField(max_length=500, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    intro_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('book_club', 'user')]
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['book_club', 'user']),
        ]

    def __str__(self):
        return f'{self.user.username} @ {self.book_club.slug}'

    @property
    def has_introduced(self):
        """True once the member completed Preséntate for this club."""
        return self.intro_updated_at is not None


class BookClubMissionRelease(models.Model):
    """Collective release date for one mission in a club's knowledge path."""

    book_club = models.ForeignKey(
        BookClub,
        on_delete=models.CASCADE,
        related_name='mission_releases',
    )
    node = models.ForeignKey(
        'knowledge_paths.Node',
        on_delete=models.CASCADE,
        related_name='book_club_releases',
    )
    opens_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Null keeps the mission locked until staff schedules it.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['node__order']
        constraints = [
            models.UniqueConstraint(
                fields=['book_club', 'node'],
                name='unique_book_club_mission_release',
            ),
        ]

    def __str__(self):
        return f'{self.book_club.slug} · mission {self.node.order}'

    def clean(self):
        if (
            self.book_club_id
            and self.node_id
            and self.book_club.knowledge_path_id != self.node.knowledge_path_id
        ):
            raise ValidationError(
                {'node': 'La misión debe pertenecer al camino vinculado al club.'}
            )


class BookClubEvent(models.Model):
    """Links live sessions to a book club without altering the Event model."""
    book_club = models.ForeignKey(BookClub, on_delete=models.CASCADE, related_name='club_events')
    event = models.ForeignKey('events.Event', on_delete=models.CASCADE, related_name='book_club_links')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('book_club', 'event')]
        ordering = ['event__date_start', 'created_at']

    def __str__(self):
        return f'{self.book_club.slug} ↔ {self.event_id}'


class DiscussionQuestion(models.Model):
    """
    Guided forum prompt after a mission (Node) or live session.
    Answers are Comment threads; members only see others' answers after
    posting their own (staff can always see).
    """
    book_club = models.ForeignKey(
        BookClub,
        on_delete=models.CASCADE,
        related_name='discussion_questions',
    )
    node = models.ForeignKey(
        'knowledge_paths.Node',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='discussion_questions',
        help_text='Mission this question follows (e.g. after Mission 1).',
    )
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='discussion_questions',
        help_text='Optional live session this question opens after.',
    )
    body = models.TextField(help_text='The discussion question text.')
    order = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=DiscussionQuestionStatus.choices,
        default=DiscussionQuestionStatus.DRAFT,
    )
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_discussion_questions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['book_club', 'status']),
            models.Index(fields=['opens_at']),
        ]

    def __str__(self):
        preview = (self.body[:60] + '…') if len(self.body) > 60 else self.body
        return f'[{self.status}] {preview}'

    def apply_schedule(self, now=None):
        """
        Auto-transition draft→open / open→closed based on opens_at / closes_at.
        Does not save; caller decides when to persist.
        """
        now = now or timezone.now()
        changed = False
        if (
            self.status == DiscussionQuestionStatus.DRAFT
            and self.opens_at
            and self.opens_at <= now
        ):
            self.status = DiscussionQuestionStatus.OPEN
            changed = True
        if (
            self.status == DiscussionQuestionStatus.OPEN
            and self.closes_at
            and self.closes_at <= now
        ):
            self.status = DiscussionQuestionStatus.CLOSED
            changed = True
        return changed

    @property
    def mission_label(self):
        if not self.node_id:
            return None
        order = self.node.order
        title = self.node.title
        return f'Misión {order}: {title}'
