"""
Django middleware for automatic request/response logging.
"""

import time
from django.utils.deprecation import MiddlewareMixin
from .logging_utils import log_request


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to automatically log HTTP requests and responses.
    """
    
    def process_request(self, request):
        """Store request start time."""
        request.start_time = time.time()
    
    def process_response(self, request, response):
        """Log request details and timing."""
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
        else:
            duration = None
        
        # Skip logging for certain paths (health checks, static files, etc.)
        skip_paths = [
            '/health/',
            '/static/',
            '/media/',
            '/favicon.ico',
        ]
        
        should_skip = any(request.path.startswith(path) for path in skip_paths)
        
        if not should_skip:
            log_request(request, response, duration)
        
        return response
    
    def process_exception(self, request, exception):
        """Log exceptions."""
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
        else:
            duration = None
        
        # Create a mock response for logging
        from django.http import HttpResponse
        mock_response = HttpResponse(status=500)
        
        log_request(request, mock_response, duration)
        
        # Re-raise the exception
        raise exception 