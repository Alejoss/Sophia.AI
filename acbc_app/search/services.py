from django.db.models import Q
from django.contrib.auth.models import User
from content.models import Content, Topic, ContentProfile
from knowledge_paths.models import KnowledgePath
from profiles.models import Profile
from .serializers import (
    SearchResultSerializer, 
    ContentSearchSerializer, 
    TopicSearchSerializer, 
    KnowledgePathSearchSerializer
)

def perform_search(query, search_type='all'):
    """
    Perform a search across different models based on the query and search type.
    
    Args:
        query (str): The search query
        search_type (str): The type of content to search for ('all', 'content', 'topics', 'knowledge_paths')
        
    Returns:
        list: A list of serialized search results
    """
    results = []
    
    # Normalize the search type
    search_type = search_type.lower()
    
    # Search in content
    if search_type in ['all', 'content']:
        content_results = search_content(query)
        results.extend(content_results)
    
    # Search in topics
    if search_type in ['all', 'topics']:
        topic_results = search_topics(query)
        results.extend(topic_results)
    
    # Search in knowledge paths
    if search_type in ['all', 'knowledge_paths']:
        knowledge_path_results = search_knowledge_paths(query)
        results.extend(knowledge_path_results)
    
    return results

def search_content(query):
    """
    Search for content items through visible ContentProfiles with optimized queries.
    This function searches in the ContentProfile model's customized fields
    and only returns results from visible profiles.
    """
    # Base query for ContentProfiles - only search visible ones
    profile_query = (Q(title__icontains=query) | Q(author__icontains=query)) & Q(is_visible=True)
    
    # Search in ContentProfile model with optimized query
    content_profiles = ContentProfile.objects.filter(profile_query).select_related(
        'content'
    ).only(
        'id', 'title', 'author', 'content_id', 'user_id', 'is_visible',
        'content__id', 'content__original_title', 'content__original_author', 
        'content__media_type'
    ).order_by('-updated_at')
    
    results = []
    
    # Add results from content profiles
    for profile in content_profiles:
        content = profile.content
        
        # Use the customized title and author from the profile
        result = {
            'id': content.id,
            'title': profile.title or content.original_title,
            'author': profile.author or content.original_author,
            'media_type': content.media_type,
            'type': 'content',
            'source': 'profile',
            'profile_id': profile.id,
            'user_id': profile.user_id if profile.user else None
        }
        results.append(result)
    
    return results

def search_topics(query):
    """
    Search for topics with optimized queries.
    """
    topic_query = Q(title__icontains=query) | Q(description__icontains=query)
    topics = Topic.objects.filter(topic_query).only(
        'id', 'title', 'description', 'created_at'
    ).order_by('-created_at')
    
    results = []
    for topic in topics:
        # Convert to simplified search result format
        result = {
            'id': topic.id,
            'title': topic.title,
            'description': topic.description,
            'type': 'topic'
        }
        results.append(result)
    
    return results

def search_knowledge_paths(query):
    """
    Search for knowledge paths with optimized queries.
    """
    path_query = Q(title__icontains=query) | Q(description__icontains=query)
    paths = KnowledgePath.objects.filter(path_query).only(
        'id', 'title', 'description', 'created_at'
    ).order_by('-created_at')
    
    results = []
    for path in paths:
        # Convert to simplified search result format
        result = {
            'id': path.id,
            'title': path.title,
            'description': path.description,
            'type': 'knowledge_path'
        }
        results.append(result)
    
    return results 