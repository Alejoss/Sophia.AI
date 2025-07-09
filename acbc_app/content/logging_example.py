"""
Example of Django-standard logging usage in views.
This shows the proper way to implement logging in Django applications.
"""

import logging
import time
from django.http import HttpRequest
from rest_framework.response import Response
from rest_framework import status

# Get a logger for this module
logger = logging.getLogger('content')


class ExampleContentView:
    """
    Example showing Django-standard logging patterns.
    """
    
    def example_upload_method(self, request: HttpRequest) -> Response:
        """
        Example of proper logging in a Django view.
        """
        start_time = time.time()
        user_id = request.user.id if request.user.is_authenticated else None
        
        # Log the start of the operation
        logger.info(
            "Starting content upload",
            extra={
                'user_id': user_id,
                'operation': 'content_upload',
                'method': request.method,
            }
        )
        
        try:
            # Your business logic here
            # ...
            
            # Log successful completion
            duration = time.time() - start_time
            logger.info(
                "Content upload completed successfully",
                extra={
                    'user_id': user_id,
                    'duration': duration,
                    'operation': 'content_upload',
                }
            )
            
            return Response({'status': 'success'})
            
        except Exception as e:
            # Log errors with full context
            logger.error(
                f"Content upload failed: {str(e)}",
                extra={
                    'user_id': user_id,
                    'operation': 'content_upload',
                    'duration': time.time() - start_time,
                },
                exc_info=True  # This captures the full traceback for Sentry
            )
            
            return Response(
                {'error': 'Upload failed'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Example of different log levels
def example_log_levels():
    """
    Examples of different logging levels and when to use them.
    """
    
    # DEBUG - Detailed information for debugging
    logger.debug("Processing file chunk 1/10")
    
    # INFO - General information about program execution
    logger.info("User uploaded content", extra={'user_id': 123, 'file_size': 1024})
    
    # WARNING - Something unexpected happened, but the program can continue
    logger.warning("Large file detected", extra={'file_size': 50000000})
    
    # ERROR - A more serious problem occurred
    logger.error("Database connection failed", exc_info=True)
    
    # CRITICAL - A serious error that may prevent the program from running
    logger.critical("System out of memory", exc_info=True)


# Example of structured logging with extra data
def example_structured_logging():
    """
    Examples of structured logging with extra context.
    """
    
    # Business event logging
    logger.info(
        "User created content",
        extra={
            'user_id': 123,
            'content_id': 456,
            'content_type': 'document',
            'file_size': 1024,
            'event_type': 'content_created',
        }
    )
    
    # Performance logging
    logger.info(
        "Database query completed",
        extra={
            'query_time': 0.045,
            'rows_returned': 150,
            'query_type': 'SELECT',
        }
    )
    
    # Security logging
    logger.warning(
        "Failed login attempt",
        extra={
            'ip_address': '192.168.1.1',
            'username': 'unknown_user',
            'event_type': 'failed_login',
        }
    )


# Example of error logging that works with Sentry
def example_error_logging():
    """
    Example of error logging that will be captured by Sentry.
    """
    
    try:
        # Some operation that might fail
        result = 1 / 0
        
    except Exception as e:
        # This will be captured by Sentry when configured
        logger.error(
            f"Division by zero error: {str(e)}",
            extra={
                'operation': 'division',
                'user_id': 123,
            },
            exc_info=True  # This is crucial for Sentry
        )
        
        # Re-raise if you want the error to propagate
        raise 