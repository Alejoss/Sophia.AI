"""
Django-standard logging utilities for Sophia.AI Academia Blockchain application.
Provides simple, standard logging functions that work with Sentry.
"""

import logging
import traceback
from typing import Any, Dict, Optional
from django.http import HttpRequest


# Create standard Django loggers
def get_logger(name: str) -> logging.Logger:
    """Get a Django-standard logger."""
    return logging.getLogger(name)


# Application-specific loggers
auth_logger = get_logger('auth')
api_logger = get_logger('api')
blockchain_logger = get_logger('blockchain')
profiles_logger = get_logger('profiles')
events_logger = get_logger('events')
content_logger = get_logger('content')
certificates_logger = get_logger('certificates')
comments_logger = get_logger('comments')
quizzes_logger = get_logger('quizzes')
votes_logger = get_logger('votes')
knowledge_paths_logger = get_logger('knowledge_paths')
search_logger = get_logger('search')
user_messages_logger = get_logger('user_messages')
bookmarks_logger = get_logger('bookmarks')
notifications_logger = get_logger('notifications')


def log_request(request: HttpRequest, response=None, duration: float = None):
    """
    Log HTTP request details using Django standard logging.
    
    Args:
        request: Django HttpRequest object
        response: Django HttpResponse object (optional)
        duration: Request duration in seconds (optional)
    """
    extra = {
        'method': request.method,
        'path': request.path,
        'user_id': getattr(request.user, 'id', None),
        'username': getattr(request.user, 'username', None),
        'ip_address': _get_client_ip(request),
        'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        'query_params': dict(request.GET.items()),
    }
    
    if response:
        extra['status_code'] = response.status_code
        extra['response_size'] = len(response.content) if hasattr(response, 'content') else 0
    
    if duration:
        extra['duration'] = duration
    
    if response and response.status_code >= 400:
        api_logger.warning(f"HTTP {request.method} {request.path}", extra=extra)
    else:
        api_logger.info(f"HTTP {request.method} {request.path}", extra=extra)


def log_authentication_event(event_type: str, user_id: int = None, username: str = None, 
                           success: bool = True, extra: Optional[Dict[str, Any]] = None):
    """
    Log authentication events using Django standard logging.
    
    Args:
        event_type: Type of auth event (login, logout, register, password_reset, etc.)
        user_id: User ID (optional)
        username: Username (optional)
        success: Whether the operation was successful
        extra: Additional data to log
    """
    if extra is None:
        extra = {}
    
    extra.update({
        'event_type': event_type,
        'user_id': user_id,
        'username': username,
        'success': success,
    })
    
    if success:
        auth_logger.info(f"Authentication {event_type} successful", extra=extra)
    else:
        auth_logger.warning(f"Authentication {event_type} failed", extra=extra)


def log_blockchain_operation(operation: str, contract_address: str = None, 
                           transaction_hash: str = None, success: bool = True,
                           extra: Optional[Dict[str, Any]] = None):
    """
    Log blockchain operations using Django standard logging.
    
    Args:
        operation: Type of blockchain operation
        contract_address: Smart contract address (optional)
        transaction_hash: Transaction hash (optional)
        success: Whether the operation was successful
        extra: Additional data to log
    """
    if extra is None:
        extra = {}
    
    extra.update({
        'operation': operation,
        'contract_address': contract_address,
        'transaction_hash': transaction_hash,
        'success': success,
    })
    
    if success:
        blockchain_logger.info(f"Blockchain operation: {operation}", extra=extra)
    else:
        blockchain_logger.error(f"Blockchain operation failed: {operation}", extra=extra)


def log_business_event(event_type: str, user_id: int = None, object_id: int = None,
                      object_type: str = None, extra: Optional[Dict[str, Any]] = None):
    """
    Log business events using Django standard logging.
    
    Args:
        event_type: Type of business event
        user_id: User ID (optional)
        object_id: Related object ID (optional)
        object_type: Type of related object (optional)
        extra: Additional data to log
    """
    if extra is None:
        extra = {}
    
    extra.update({
        'event_type': event_type,
        'user_id': user_id,
        'object_id': object_id,
        'object_type': object_type,
    })
    
    # Route to appropriate logger based on object_type
    if object_type == 'profile':
        profiles_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'event':
        events_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'content':
        content_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'certificate':
        certificates_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'comment':
        comments_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'quiz':
        quizzes_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'vote':
        votes_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'knowledge_path':
        knowledge_paths_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'search':
        search_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'message':
        user_messages_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'bookmark':
        bookmarks_logger.info(f"Business event: {event_type}", extra=extra)
    elif object_type == 'notification':
        notifications_logger.info(f"Business event: {event_type}", extra=extra)
    else:
        # Default to API logger
        api_logger.info(f"Business event: {event_type}", extra=extra)


def log_error(error: Exception, context: str = None, user_id: int = None,
              extra: Optional[Dict[str, Any]] = None):
    """
    Log errors with context using Django standard logging.
    This will work seamlessly with Sentry when configured.
    
    Args:
        error: Exception object
        context: Context where the error occurred
        user_id: User ID (optional)
        extra: Additional data to log
    """
    if extra is None:
        extra = {}
    
    extra.update({
        'error_type': type(error).__name__,
        'error_message': str(error),
        'context': context,
        'user_id': user_id,
    })
    
    # Use error level which will be captured by Sentry
    api_logger.error(f"Error in {context}: {str(error)}", extra=extra, exc_info=True)


def log_performance_metric(metric_name: str, value: float, unit: str = None,
                          extra: Optional[Dict[str, Any]] = None):
    """
    Log performance metrics using Django standard logging.
    
    Args:
        metric_name: Name of the metric
        value: Metric value
        unit: Unit of measurement (optional)
        extra: Additional data to log
    """
    if extra is None:
        extra = {}
    
    extra.update({
        'metric_name': metric_name,
        'value': value,
        'unit': unit,
    })
    
    api_logger.info(f"Performance metric: {metric_name} = {value}{unit or ''}", extra=extra)


def _get_client_ip(request: HttpRequest) -> str:
    """Extract client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# Convenience functions for common logging patterns
def log_user_action(action: str, user_id: int, object_type: str = None, 
                   object_id: int = None, success: bool = True):
    """Log user actions using Django standard logging."""
    log_business_event(
        event_type=action,
        user_id=user_id,
        object_type=object_type,
        object_id=object_id,
        extra={'success': success}
    )


def log_content_operation(operation: str, content_id: int, user_id: int = None,
                         content_type: str = None, success: bool = True):
    """Log content-related operations using Django standard logging."""
    log_business_event(
        event_type=operation,
        user_id=user_id,
        object_id=content_id,
        object_type='content',
        extra={'content_type': content_type, 'success': success}
    )


def log_security_event(event_type: str, user_id: int = None, ip_address: str = None,
                      success: bool = True, extra: Optional[Dict[str, Any]] = None):
    """Log security-related events using Django standard logging."""
    if extra is None:
        extra = {}
    
    extra.update({
        'security_event': True,
        'ip_address': ip_address,
    })
    
    log_authentication_event(event_type, user_id, success=success, extra=extra) 