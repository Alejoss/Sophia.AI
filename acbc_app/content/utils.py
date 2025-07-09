from django.contrib.contenttypes.models import ContentType
import logging
from content.models import Content
from votes.models import VoteCount

# Get logger for content utils
logger = logging.getLogger('academia_blockchain.content.utils')

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
