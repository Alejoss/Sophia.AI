from django.db.models import Q
from django.contrib.auth.models import User
from content.models import Content, Topic, ContentProfile
from knowledge_paths.models import KnowledgePath
from profiles.models import Profile
from content.serializers import SimpleContentProfileSerializer
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
    This function searches in both ContentProfile model's customized fields AND
    the original Content fields, and only returns results from visible profiles.
    Returns ContentProfile objects that can be serialized with SimpleContentProfileSerializer.
    """
    # Base query for ContentProfiles - only search visible ones
    # Search in both ContentProfile fields AND original Content fields
    profile_query = (
        Q(title__icontains=query) | 
        Q(author__icontains=query) |
        Q(content__original_title__icontains=query) |
        Q(content__original_author__icontains=query)
    ) & Q(is_visible=True)
    
    # Search in ContentProfile model with optimized query
    content_profiles = ContentProfile.objects.filter(profile_query).select_related(
        'content', 'content__file_details'
    ).order_by('-updated_at')
    
    return content_profiles

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