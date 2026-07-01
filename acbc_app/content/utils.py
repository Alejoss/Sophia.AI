from django.conf import settings
from django.contrib.contenttypes.models import ContentType
import logging
from content.models import Content
from votes.models import VoteCount

# Get logger for content utils
logger = logging.getLogger('academia_blockchain.content.utils')


def build_media_url(file_field_or_key, request=None):
    """
    Return absolute media URL. S3: https://{domain}/{key}. Local/prod (no S3): MEDIA_URL + key.
    """
    if not file_field_or_key:
        return None
    key = file_field_or_key.name if hasattr(file_field_or_key, 'name') else str(file_field_or_key)
    if not key or not key.strip():
        return None
    key = key.strip()
    if key.startswith('http://') or key.startswith('https://'):
        return key
    use_s3 = getattr(settings, 'DEFAULT_FILE_STORAGE', '') and 's3' in str(getattr(settings, 'DEFAULT_FILE_STORAGE', '')).lower()
    if use_s3:
        domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
        if domain:
            return f"https://{domain.rstrip('/')}/{key.lstrip('/')}"
    # Local dev and prod (no S3): key is relative to MEDIA_ROOT; URL must be under MEDIA_URL
    media_url = (getattr(settings, 'MEDIA_URL', '') or '').rstrip('/')
    path = f"{media_url}/{key.lstrip('/')}" if media_url else key.lstrip('/')
    if request:
        return request.build_absolute_uri(path)
    return None


def sort_timeline_entries(entries):
    """Dated entries by start_date; undated entries by manual order."""
    dated = sorted(
        [entry for entry in entries if entry.start_date],
        key=lambda entry: (entry.start_date, entry.created_at, entry.pk),
    )
    undated = sorted(
        [entry for entry in entries if not entry.start_date],
        key=lambda entry: (entry.order, entry.created_at, entry.pk),
    )
    return dated + undated


def dated_timeline_entry_ids(timeline):
    return [
        entry.id
        for entry in sorted(
            timeline.entries.filter(start_date__isnull=False),
            key=lambda entry: (entry.start_date, entry.created_at, entry.pk),
        )
    ]


def timeline_entry_suggestion_is_duplicate(topic, title, start_date=None, end_date=None):
    from content.models import TopicTimeline

    timeline = TopicTimeline.objects.filter(topic=topic).first()
    if timeline is None:
        return False

    normalized_title = (title or '').strip()
    if not normalized_title:
        return False

    entries = timeline.entries.filter(title__iexact=normalized_title)
    if start_date:
        entries = entries.filter(start_date=start_date)
    else:
        entries = entries.filter(start_date__isnull=True)
    if end_date:
        entries = entries.filter(end_date=end_date)
    else:
        entries = entries.filter(end_date__isnull=True)
    return entries.exists()


def validate_timeline_entry_suggestion_contents(topic, user, contents_data):
    from content.models import ContentProfile

    if not contents_data:
        return []

    content_items = [
        item for item in contents_data
        if isinstance(item, dict) and item.get('content_id') is not None
    ]
    if len(content_items) > 1:
        raise ValueError({
            'contents': 'Solo se puede proponer un contenido por sugerencia.',
        })

    topic_content_ids = set(topic.contents.values_list('id', flat=True))
    user_content_ids = set(
        ContentProfile.objects.filter(user=user).values_list('content_id', flat=True)
    )

    seen_content_ids = set()
    duplicate_content_ids = []
    invalid_content_ids = []
    normalized = []

    for index, item in enumerate(contents_data):
        content_id = item.get('content_id') if isinstance(item, dict) else None
        if content_id is None:
            continue
        try:
            content_id = int(content_id)
        except (TypeError, ValueError):
            invalid_content_ids.append(content_id)
            continue

        if content_id in seen_content_ids:
            duplicate_content_ids.append(content_id)
        seen_content_ids.add(content_id)

        if content_id not in topic_content_ids and content_id not in user_content_ids:
            invalid_content_ids.append(content_id)

        normalized.append({
            'content_id': content_id,
            'order': item.get('order', index + 1),
            'caption': (item.get('caption') or '').strip(),
        })

    errors = {}
    if duplicate_content_ids:
        errors['contents'] = 'No se puede adjuntar el mismo contenido mas de una vez.'
    if invalid_content_ids:
        errors['contents'] = (
            'Solo puedes proponer contenidos que ya estan en el tema '
            'o que pertenecen a tu biblioteca.'
        )
    if errors:
        raise ValueError(errors)
    return normalized


def resolve_pending_content_suggestions_for_topic_content(topic, content, reviewer):
    """
    When timeline acceptance adds (or uses) content on a topic, close matching
    pending ContentSuggestion rows so moderators do not review the same material twice.
    """
    from django.utils import timezone
    from content.models import ContentSuggestion

    now = timezone.now()
    pending = ContentSuggestion.objects.filter(
        topic=topic,
        content=content,
        status='PENDING',
    )
    for content_suggestion in pending:
        content_suggestion.status = 'ACCEPTED'
        content_suggestion.reviewed_by = reviewer
        content_suggestion.reviewed_at = now
        content_suggestion.save(
            update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'],
        )


def accept_timeline_entry_suggestion(suggestion, reviewer):
    """
    Publish a timeline entry from a suggestion: create the entry, link proposed
    contents, add any new contents to the topic, and resolve duplicate content
    suggestions. Returns (entry, list of content ids newly added to the topic).
    """
    from django.db import models
    from django.utils import timezone
    from content.models import (
        TopicTimeline,
        TopicTimelineEntry,
        TopicTimelineEntryContent,
    )

    topic = suggestion.topic
    timeline, _ = TopicTimeline.objects.get_or_create(
        topic=topic,
        defaults={
            'title': topic.title,
            'created_by': reviewer,
        },
    )
    max_order = timeline.entries.aggregate(models.Max('order'))['order__max'] or 0
    entry = TopicTimelineEntry.objects.create(
        timeline=timeline,
        title=suggestion.title,
        description=suggestion.description,
        start_date=suggestion.start_date,
        end_date=suggestion.end_date,
        order=max_order + 1,
        created_by=suggestion.suggested_by,
        updated_by=reviewer,
    )

    topic_content_ids = set(topic.contents.values_list('id', flat=True))
    added_content_ids = []
    entry_links = []

    for index, link in enumerate(suggestion.suggested_contents.all().order_by('order', 'id')):
        if link.content_id not in topic_content_ids:
            topic.contents.add(link.content)
            topic_content_ids.add(link.content_id)
            added_content_ids.append(link.content_id)
        resolve_pending_content_suggestions_for_topic_content(topic, link.content, reviewer)
        entry_links.append(TopicTimelineEntryContent(
            entry=entry,
            content=link.content,
            order=link.order or index + 1,
            caption=link.caption or '',
        ))

    if entry_links:
        TopicTimelineEntryContent.objects.bulk_create(entry_links)

    suggestion.status = 'ACCEPTED'
    suggestion.reviewed_by = reviewer
    suggestion.reviewed_at = timezone.now()
    suggestion.accepted_entry = entry
    suggestion.save()

    return entry, added_content_ids


def get_topic_content_id_set(topic):
    return set(topic.contents.values_list('id', flat=True))


def timeline_entry_content_suggestion_is_duplicate(entry, content):
    from content.models import TopicTimelineEntryContent

    return TopicTimelineEntryContent.objects.filter(entry=entry, content=content).exists()


def validate_timeline_entry_content_suggestion_content(topic, user, content):
    from content.models import ContentProfile

    topic_content_ids = set(topic.contents.values_list('id', flat=True))
    user_content_ids = set(
        ContentProfile.objects.filter(user=user).values_list('content_id', flat=True),
    )
    try:
        content_id = int(content.id)
    except (TypeError, ValueError, AttributeError):
        raise ValueError({'content_id': 'Contenido invalido.'}) from None

    if content_id not in topic_content_ids and content_id not in user_content_ids:
        raise ValueError({
            'content_id': (
                'Solo puedes proponer contenidos que ya estan en el tema '
                'o que pertenecen a tu biblioteca.'
            ),
        })
    return content


def accept_timeline_entry_content_suggestion(suggestion, reviewer):
    """
    Publish a content link on an existing timeline entry. Adds content to the
    topic when needed and resolves duplicate pending content suggestions.
    """
    from django.db import models
    from django.utils import timezone
    from content.models import TopicTimelineEntryContent

    entry = suggestion.entry
    topic = suggestion.topic
    content = suggestion.content

    if not timeline_entry_content_suggestion_is_duplicate(entry, content):
        topic_content_ids = set(topic.contents.values_list('id', flat=True))
        if content.id not in topic_content_ids:
            topic.contents.add(content)
        resolve_pending_content_suggestions_for_topic_content(topic, content, reviewer)
        max_order = entry.entry_contents.aggregate(models.Max('order'))['order__max'] or 0
        TopicTimelineEntryContent.objects.create(
            entry=entry,
            content=content,
            order=max_order + 1,
            caption='',
        )

    suggestion.status = 'ACCEPTED'
    suggestion.reviewed_by = reviewer
    suggestion.reviewed_at = timezone.now()
    suggestion.save()


def get_top_voted_contents(topic, media_type, limit=None):
    """
    Get all contents of a specific media type for a topic, ordered by vote count.
    
    Args:
        topic: The Topic instance
        media_type: The media type to filter by (e.g., 'IMAGE', 'TEXT', 'AUDIO', 'VIDEO')
        limit: Optional number of contents to return (default: None, returns all)
    
    Returns:
        List of Content objects ordered by vote count
    """
    logger.debug("Getting top voted contents", extra={
        'topic_id': topic.id,
        'media_type': media_type,
        'limit': limit,
    })
    
    # Get all contents of this media type for the topic
    contents = list(topic.contents.filter(media_type=media_type))
    logger.debug("Found contents for topic", extra={
        'topic_id': topic.id,
        'media_type': media_type,
        'content_count': len(contents),
    })
    
    # Get vote counts for all these contents in this specific topic
    content_type = ContentType.objects.get_for_model(Content)
    vote_counts = VoteCount.objects.filter(
        content_type=content_type,
        object_id__in=[c.id for c in contents],
        topic=topic  # Filter by specific topic
    )
    logger.debug("Found vote count records", extra={
        'vote_count_records': vote_counts.count(),
    })
    
    # Create a dictionary of vote counts
    vote_count_dict = {vc.object_id: vc.vote_count for vc in vote_counts}
    logger.debug("Vote count dictionary created", extra={
        'vote_count_entries': len(vote_count_dict),
    })
    
    # Sort contents by vote count (defaulting to 0 if no votes)
    sorted_contents = sorted(
        contents,
        key=lambda c: vote_count_dict.get(c.id, 0),
        reverse=True
    )
    logger.debug("Contents sorted by vote count", extra={
        'sorted_content_count': len(sorted_contents),
    })
    
    # Return all contents if no limit specified, otherwise return top N
    result = sorted_contents[:limit] if limit else sorted_contents
    logger.info("Returning top voted contents", extra={
        'topic_id': topic.id,
        'media_type': media_type,
        'result_count': len(result),
        'limit_applied': limit is not None,
    })
    return result


def get_topic_contents_ordered_for_public_view(topic):
    """
    Same ordering as TopicDetailView: by media type buckets (IMAGE, TEXT, AUDIO,
    VIDEO), each bucket sorted by vote count for this topic. Any content not
    covered (unexpected media_type) is appended by id for stability.
    """
    ordered = []
    for media_type in ("IMAGE", "TEXT", "AUDIO", "VIDEO"):
        ordered.extend(get_top_voted_contents(topic, media_type))
    seen = {c.id for c in ordered}
    extras = [c for c in topic.contents.all() if c.id not in seen]
    extras.sort(key=lambda c: c.id)
    return ordered + extras
