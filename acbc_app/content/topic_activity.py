"""
Topic activity score: incremental deltas on events + full recompute for backfill/repair.

score =
  (contents * WEIGHT_CONTENT)
+ (positive_likes_on_topic_contents * WEIGHT_LIKE)
+ (active_comments_with_topic * WEIGHT_COMMENT)
+ (has_timeline_entries ? WEIGHT_TIMELINE : 0)
"""
from django.contrib.contenttypes.models import ContentType
from django.db.models import F, Q

WEIGHT_CONTENT = 10
WEIGHT_LIKE = 3
WEIGHT_COMMENT = 5
WEIGHT_TIMELINE = 50


def apply_topic_score_delta(topic_id, delta):
    """Atomically adjust a topic's cached activity_score. No-op if delta is 0."""
    if not topic_id or not delta:
        return
    from content.models import Topic

    Topic.objects.filter(pk=topic_id).update(activity_score=F('activity_score') + delta)


def apply_topics_score_delta(topic_ids, delta):
    """Apply the same delta to many topics."""
    if not delta:
        return
    ids = {tid for tid in topic_ids if tid}
    if not ids:
        return
    from content.models import Topic

    Topic.objects.filter(pk__in=ids).update(activity_score=F('activity_score') + delta)


def positive_like_contribution(vote_value):
    """1 if this vote counts as a positive like, else 0."""
    return 1 if vote_value and vote_value > 0 else 0


def count_positive_likes_for_content(content_id, topic_id=None):
    """
    Count positive votes on a content item.
    If topic_id is set, include global votes (topic null) and votes scoped to that topic.
    """
    from content.models import Content
    from votes.models import Vote

    content_ct = ContentType.objects.get_for_model(Content)
    qs = Vote.objects.filter(
        content_type=content_ct,
        object_id=content_id,
        value__gt=0,
    )
    if topic_id is not None:
        qs = qs.filter(Q(topic__isnull=True) | Q(topic_id=topic_id))
    return qs.count()


def content_link_delta(content_id, topic_id):
    """Score change when linking/unlinking one content to a topic."""
    likes = count_positive_likes_for_content(content_id, topic_id=topic_id)
    return WEIGHT_CONTENT + (WEIGHT_LIKE * likes)


def topic_ids_for_vote(vote):
    """Topics whose score should change for this vote (Content votes only)."""
    from content.models import Content

    content_ct = ContentType.objects.get_for_model(Content)
    if vote.content_type_id != content_ct.id:
        return []

    if vote.topic_id:
        return [vote.topic_id]

    try:
        content = Content.objects.get(pk=vote.object_id)
    except Content.DoesNotExist:
        return []
    return list(content.topics.values_list('id', flat=True))


def apply_vote_value_change(vote, old_value, new_value):
    """Apply score delta from a change in Vote.value (create/update/delete)."""
    delta_likes = positive_like_contribution(new_value) - positive_like_contribution(old_value)
    if not delta_likes:
        return
    apply_topics_score_delta(topic_ids_for_vote(vote), delta_likes * WEIGHT_LIKE)


def compute_topic_activity_score(topic):
    """Compute the absolute activity score for a topic from current DB state."""
    from comments.models import Comment
    from content.models import Content, TopicTimelineEntry
    from votes.models import Vote

    content_count = topic.contents.count()
    content_ids = list(topic.contents.values_list('id', flat=True))

    likes = 0
    if content_ids:
        content_ct = ContentType.objects.get_for_model(Content)
        likes = Vote.objects.filter(
            content_type=content_ct,
            object_id__in=content_ids,
            value__gt=0,
        ).filter(Q(topic__isnull=True) | Q(topic_id=topic.id)).count()

    comments = Comment.objects.filter(topic_id=topic.id, is_active=True).count()
    has_timeline = TopicTimelineEntry.objects.filter(timeline__topic_id=topic.id).exists()

    return (
        content_count * WEIGHT_CONTENT
        + likes * WEIGHT_LIKE
        + comments * WEIGHT_COMMENT
        + (WEIGHT_TIMELINE if has_timeline else 0)
    )


def recompute_topic_activity_score(topic_id):
    """Full recompute and persist for one topic. Returns the new score."""
    from content.models import Topic

    topic = Topic.objects.filter(pk=topic_id).first()
    if topic is None:
        return None
    score = compute_topic_activity_score(topic)
    Topic.objects.filter(pk=topic_id).update(activity_score=score)
    return score


def recompute_all_topic_activity_scores(topic_ids=None):
    """Full recompute for many topics (or all). Returns count updated."""
    from content.models import Topic

    qs = Topic.objects.all().order_by('id')
    if topic_ids is not None:
        qs = qs.filter(pk__in=topic_ids)

    updated = 0
    for topic in qs.iterator():
        score = compute_topic_activity_score(topic)
        Topic.objects.filter(pk=topic.pk).update(activity_score=score)
        updated += 1
    return updated
