"""
Incremental Topic.activity_score updates. Full recompute is only via management command.
"""
import logging

from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete, pre_save

from content.topic_activity import (
    WEIGHT_COMMENT,
    WEIGHT_TIMELINE,
    apply_topic_score_delta,
    apply_vote_value_change,
    content_link_delta,
    recompute_topic_activity_score,
)

logger = logging.getLogger('academia_blockchain.content.topic_activity')


def content_topics_changed(sender, instance, action, reverse, pk_set, **kwargs):
    if action == 'pre_clear':
        try:
            if reverse:
                instance._activity_clear_content_ids = list(
                    instance.contents.values_list('id', flat=True)
                )
            else:
                instance._activity_clear_topic_ids = list(
                    instance.topics.values_list('id', flat=True)
                )
        except Exception:
            logger.exception('Failed to capture M2M ids before clear')
        return

    if action not in ('post_add', 'post_remove', 'post_clear'):
        return

    try:
        if reverse:
            topic_id = instance.pk
            if action == 'post_clear':
                recompute_topic_activity_score(topic_id)
                return
            if not pk_set:
                return
            sign = 1 if action == 'post_add' else -1
            for content_id in pk_set:
                delta = content_link_delta(content_id, topic_id) * sign
                apply_topic_score_delta(topic_id, delta)
        else:
            content_id = instance.pk
            if action == 'post_clear':
                for topic_id in getattr(instance, '_activity_clear_topic_ids', []) or []:
                    recompute_topic_activity_score(topic_id)
                return
            if not pk_set:
                return
            sign = 1 if action == 'post_add' else -1
            for topic_id in pk_set:
                delta = content_link_delta(content_id, topic_id) * sign
                apply_topic_score_delta(topic_id, delta)
    except Exception:
        logger.exception('Failed to update topic activity score on content M2M change')


def content_pre_delete_capture_topics(sender, instance, **kwargs):
    try:
        instance._activity_topic_ids = list(instance.topics.values_list('id', flat=True))
    except Exception:
        instance._activity_topic_ids = []


def content_post_delete_recompute_topics(sender, instance, **kwargs):
    topic_ids = getattr(instance, '_activity_topic_ids', None) or []
    for topic_id in topic_ids:
        try:
            recompute_topic_activity_score(topic_id)
        except Exception:
            logger.exception(
                'Failed to recompute topic activity score after content delete',
                extra={'topic_id': topic_id, 'content_id': getattr(instance, 'id', None)},
            )


def vote_pre_save_capture_old_value(sender, instance, **kwargs):
    if instance.pk:
        try:
            from votes.models import Vote
            old = Vote.objects.filter(pk=instance.pk).values_list('value', flat=True).first()
            instance._activity_old_value = old if old is not None else 0
        except Exception:
            instance._activity_old_value = 0
    else:
        instance._activity_old_value = 0


def vote_post_save_apply_delta(sender, instance, created, **kwargs):
    try:
        old_value = getattr(instance, '_activity_old_value', 0)
        apply_vote_value_change(instance, old_value, instance.value)
    except Exception:
        logger.exception('Failed to update topic activity score on vote save')


def vote_post_delete_apply_delta(sender, instance, **kwargs):
    try:
        apply_vote_value_change(instance, instance.value, 0)
    except Exception:
        logger.exception('Failed to update topic activity score on vote delete')


def comment_pre_save_capture_state(sender, instance, **kwargs):
    if instance.pk:
        try:
            from comments.models import Comment
            old = Comment.objects.filter(pk=instance.pk).values_list(
                'topic_id', 'is_active'
            ).first()
            if old:
                instance._activity_old_topic_id, instance._activity_old_is_active = old
            else:
                instance._activity_old_topic_id = None
                instance._activity_old_is_active = False
        except Exception:
            instance._activity_old_topic_id = None
            instance._activity_old_is_active = False
    else:
        instance._activity_old_topic_id = None
        instance._activity_old_is_active = False


def comment_post_save_apply_delta(sender, instance, created, **kwargs):
    try:
        old_topic_id = getattr(instance, '_activity_old_topic_id', None)
        old_active = getattr(instance, '_activity_old_is_active', False)
        new_topic_id = instance.topic_id
        new_active = bool(instance.is_active)

        old_counts = bool(old_topic_id) and old_active
        new_counts = bool(new_topic_id) and new_active

        if old_counts and new_counts and old_topic_id == new_topic_id:
            return
        if old_counts:
            apply_topic_score_delta(old_topic_id, -WEIGHT_COMMENT)
        if new_counts:
            apply_topic_score_delta(new_topic_id, WEIGHT_COMMENT)
    except Exception:
        logger.exception('Failed to update topic activity score on comment save')


def comment_post_delete_apply_delta(sender, instance, **kwargs):
    try:
        if instance.topic_id and instance.is_active:
            apply_topic_score_delta(instance.topic_id, -WEIGHT_COMMENT)
    except Exception:
        logger.exception('Failed to update topic activity score on comment delete')


def timeline_entry_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        topic_id = instance.timeline.topic_id
        from content.models import TopicTimelineEntry
        if TopicTimelineEntry.objects.filter(timeline__topic_id=topic_id).count() == 1:
            apply_topic_score_delta(topic_id, WEIGHT_TIMELINE)
    except Exception:
        logger.exception('Failed to update topic activity score on timeline entry create')


def timeline_entry_post_delete(sender, instance, **kwargs):
    try:
        topic_id = instance.timeline.topic_id
        from content.models import TopicTimelineEntry
        if not TopicTimelineEntry.objects.filter(timeline__topic_id=topic_id).exists():
            apply_topic_score_delta(topic_id, -WEIGHT_TIMELINE)
    except Exception:
        logger.debug(
            'Skipped timeline activity score update on entry delete',
            exc_info=True,
        )


def connect_topic_activity_signals():
    """Register handlers once apps are ready (avoids import cycles)."""
    from comments.models import Comment
    from content.models import Content, TopicTimelineEntry
    from votes.models import Vote

    m2m_changed.connect(
        content_topics_changed,
        sender=Content.topics.through,
        dispatch_uid='topic_activity_content_topics_m2m',
    )
    pre_delete.connect(
        content_pre_delete_capture_topics,
        sender=Content,
        dispatch_uid='topic_activity_content_pre_delete',
    )
    post_delete.connect(
        content_post_delete_recompute_topics,
        sender=Content,
        dispatch_uid='topic_activity_content_post_delete',
    )

    pre_save.connect(
        vote_pre_save_capture_old_value,
        sender=Vote,
        dispatch_uid='topic_activity_vote_pre_save',
    )
    post_save.connect(
        vote_post_save_apply_delta,
        sender=Vote,
        dispatch_uid='topic_activity_vote_post_save',
    )
    post_delete.connect(
        vote_post_delete_apply_delta,
        sender=Vote,
        dispatch_uid='topic_activity_vote_post_delete',
    )

    pre_save.connect(
        comment_pre_save_capture_state,
        sender=Comment,
        dispatch_uid='topic_activity_comment_pre_save',
    )
    post_save.connect(
        comment_post_save_apply_delta,
        sender=Comment,
        dispatch_uid='topic_activity_comment_post_save',
    )
    post_delete.connect(
        comment_post_delete_apply_delta,
        sender=Comment,
        dispatch_uid='topic_activity_comment_post_delete',
    )

    post_save.connect(
        timeline_entry_post_save,
        sender=TopicTimelineEntry,
        dispatch_uid='topic_activity_timeline_post_save',
    )
    post_delete.connect(
        timeline_entry_post_delete,
        sender=TopicTimelineEntry,
        dispatch_uid='topic_activity_timeline_post_delete',
    )
