import logging
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from content.serializers import SimpleContentProfileSerializer
from .services import perform_search

logger = logging.getLogger(__name__)

# Create your views here.

class SearchPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'current_page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
            'results': data
        })

class SearchView(APIView):
    """
    API view for performing searches across different models.
    """
    permission_classes = [AllowAny]
    pagination_class = SearchPagination
    
    def get(self, request):
        """
        Handle GET requests for search.
        
        Query parameters:
        - q: The search query (required)
        - type: The type of content to search for ('all', 'content', 'topics', 'knowledge_paths') (optional, default: 'all')
        - page: The page number (optional, default: 1)
        - page_size: The number of results per page (optional, default: 10)
        """
        query = request.query_params.get('q', '')
        search_type = request.query_params.get('type', 'all')
        user = request.user.username if request.user.is_authenticated else 'anonymous'
        
        logger.info(f"Search request - Query: '{query}', Type: {search_type}, User: {user}")
        logger.debug(f"Search parameters - Query: '{query}', Type: {search_type}, Page: {request.query_params.get('page', '1')}, Page size: {request.query_params.get('page_size', '10')}")
        
        if not query:
            logger.warning(f"Search request failed - empty query from user {user}")
            return Response(
                {"error": "Search query is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get search results
            logger.debug(f"Performing search for query '{query}' with type '{search_type}'")
            results = perform_search(query, search_type)
            logger.debug(f"Search returned {len(results)} results")
            
            # Serialize results based on type
            serialized_results = []
            
            for result in results:
                if hasattr(result, 'content'):  # This is a ContentProfile object
                    # Serialize content profiles using SimpleContentProfileSerializer
                    serializer = SimpleContentProfileSerializer(result, context={'request': request})
                    serialized_data = serializer.data
                    # Add type information for frontend routing
                    serialized_data['type'] = 'content'
                    serialized_data['source'] = 'profile'
                    serialized_data['profile_id'] = result.id
                    serialized_results.append(serialized_data)
                else:
                    # Handle other result types (topics, knowledge paths)
                    serialized_results.append(result)
            
            logger.debug(f"Serialized {len(serialized_results)} search results")
            
            # Paginate the results
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(serialized_results, request)
            
            # Return paginated response
            logger.info(f"Search completed successfully - Query: '{query}', Type: {search_type}, Results: {len(serialized_results)}, User: {user}")
            return paginator.get_paginated_response(page)
        except Exception as e:
            logger.error(f"Error performing search for query '{query}' with type '{search_type}' for user {user}: {str(e)}", exc_info=True)
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
