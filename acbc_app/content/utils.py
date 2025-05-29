from django.contrib.contenttypes.models import ContentType
from content.models import Content
from votes.models import VoteCount

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
    print(f"\n=== get_top_voted_contents for {media_type} ===")    
    
    # Get all contents of this media type for the topic
    contents = list(topic.contents.filter(media_type=media_type))
    print(f"\nFound {len(contents)} contents of type {media_type}")
    
    # Get vote counts for all these contents in this specific topic
    content_type = ContentType.objects.get_for_model(Content)
    vote_counts = VoteCount.objects.filter(
        content_type=content_type,
        object_id__in=[c.id for c in contents],
        topic=topic  # Filter by specific topic
    )
    print(f"\nFound {vote_counts.count()} vote count records")
    
    # Create a dictionary of vote counts
    vote_count_dict = {vc.object_id: vc.vote_count for vc in vote_counts}
    print("\nVote count dictionary:")
    for content_id, count in vote_count_dict.items():
        print(f"- Content ID: {content_id}, Vote Count: {count}")
    
    # Sort contents by vote count (defaulting to 0 if no votes)
    sorted_contents = sorted(
        contents,
        key=lambda c: vote_count_dict.get(c.id, 0),
        reverse=True
    )
    print("\nSorted contents:")
    for content in sorted_contents:
        vote_count = vote_count_dict.get(content.id, 0)
        print(f"- Content ID: {content.id}, Title: {content.original_title}, Vote Count: {vote_count}")
    
    # Return all contents if no limit specified, otherwise return top N
    result = sorted_contents[:limit] if limit else sorted_contents
    print(f"\nReturning {len(result)} contents:")
    for content in result:
        vote_count = vote_count_dict.get(content.id, 0)
        print(f"- Content ID: {content.id}, Title: {content.original_title}, Vote Count: {vote_count}")
    
    print("=== End get_top_voted_contents ===\n")
    return result
