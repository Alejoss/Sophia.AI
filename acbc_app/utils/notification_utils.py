"""
Utility functions for handling notifications across the application.
"""
from django.contrib.contenttypes.models import ContentType
from notifications.models import Notification
from knowledge_paths.models import KnowledgePath
from content.models import ContentProfile
import traceback
import logging

# Get logger for notifications
logger = logging.getLogger('academia_blockchain.notifications')

def notify_comment_reply(comment):
    """
    Create a notification when someone replies to a comment.
    """
    logger.info("Creating comment reply notification", extra={
        'comment_id': comment.id,
        'author_id': comment.author.id,
        'author_username': comment.author.username,
        'parent_comment_id': comment.parent.id if comment.parent else None,
        'parent_author_id': comment.parent.author.id if comment.parent else None,
        'parent_author_username': comment.parent.author.username if comment.parent else None,
    })
    
    if comment.parent:
        try:
            # Get content types for debugging
            comment_ct = ContentType.objects.get_for_model(comment)
            parent_ct = ContentType.objects.get_for_model(comment.parent)
            logger.debug(f"Content types - Comment: {comment_ct}, Parent: {parent_ct}")
            
            # Check if notification already exists
            existing_notifications = Notification.objects.filter(
                recipient=comment.parent.author,
                actor_content_type=ContentType.objects.get_for_model(comment.author),
                actor_object_id=comment.author.id,
                verb='respondió a',
                action_object_content_type=comment_ct,
                action_object_object_id=comment.id,
                target_content_type=parent_ct,
                target_object_id=comment.parent.id
            )
            logger.debug(f"Existing notifications count: {existing_notifications.count()}")
            
            if existing_notifications.exists():
                logger.info("Notification already exists - skipping creation", extra={
                    'comment_id': comment.id,
                    'parent_comment_id': comment.parent.id,
                })
                return
            
            # Create the notification directly
            notification = Notification.objects.create(
                recipient=comment.parent.author,
                actor_content_type=ContentType.objects.get_for_model(comment.author),
                actor_object_id=comment.author.id,
                verb='respondió a',
                action_object_content_type=comment_ct,
                action_object_object_id=comment.id,
                target_content_type=parent_ct,
                target_object_id=comment.parent.id,
                description=f'{comment.author.username} respondió a tu comentario'
            )
            logger.info("Comment reply notification created successfully", extra={
                'notification_id': notification.id,
                'comment_id': comment.id,
                'recipient_id': notification.recipient.id,
                'actor_id': notification.actor.id,
                'target_id': notification.target_object_id,
            })
            
            # Verify the notification was created
            if notification:
                logger.debug("Notification verification successful", extra={
                    'notification_id': notification.id,
                    'recipient': notification.recipient.username,
                    'actor': notification.actor.username,
                    'verb': notification.verb,
                    'timestamp': notification.timestamp.isoformat(),
                    'unread': notification.unread,
                    'target_content_type': str(notification.target_content_type),
                    'target_object_id': notification.target_object_id,
                })
            else:
                logger.warning("Notification not found in database after creation", extra={
                    'comment_id': comment.id,
                    'parent_comment_id': comment.parent.id,
                })
                
        except Exception as e:
            logger.error(f"Error creating comment reply notification: {str(e)}", extra={
                'comment_id': comment.id,
                'parent_comment_id': comment.parent.id if comment.parent else None,
                'author_id': comment.author.id,
            }, exc_info=True)
    else:
        logger.info("No parent comment found - skipping notification", extra={
            'comment_id': comment.id,
        })

def notify_knowledge_path_comment(comment):
    """
    Create a notification when someone comments on a knowledge path.
    Only notifies the knowledge path author if the comment is not a reply.
    
    Args:
        comment: The Comment instance that was created
    """
    logger.info("Creating knowledge path comment notification", extra={
        'comment_id': comment.id,
        'author_id': comment.author.id,
        'author_username': comment.author.username,
        'parent_comment_id': comment.parent.id if comment.parent else None,
    })
    
    # Only notify for top-level comments (not replies)
    if comment.parent:
        logger.info("Comment is a reply - skipping notification", extra={
            'comment_id': comment.id,
            'parent_comment_id': comment.parent.id,
        })
        return
        
    try:
        # Verify this is a knowledge path comment
        if not isinstance(comment.content_object, KnowledgePath):
            logger.info("Comment is not on a knowledge path - skipping notification", extra={
                'comment_id': comment.id,
                'content_object_type': type(comment.content_object).__name__,
            })
            return
            
        knowledge_path = comment.content_object
        logger.debug(f"Knowledge path details - ID: {knowledge_path.id}, Title: {knowledge_path.title}, Author: {knowledge_path.author.username}")
        
        # Don't notify if user comments on their own knowledge path
        if comment.author == knowledge_path.author:
            logger.info("User is commenting on their own knowledge path - skipping notification", extra={
                'comment_id': comment.id,
                'knowledge_path_id': knowledge_path.id,
                'author_id': comment.author.id,
            })
            return
            
        # Get content types for debugging
        comment_ct = ContentType.objects.get_for_model(comment)
        knowledge_path_ct = ContentType.objects.get_for_model(knowledge_path)
        logger.debug(f"Content types - Comment: {comment_ct}, Knowledge Path: {knowledge_path_ct}")
        
        # Check if notification already exists
        existing_notifications = Notification.objects.filter(
            recipient=knowledge_path.author,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='comentó en tu ruta de conocimiento',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'comment_id': comment.id,
                'knowledge_path_id': knowledge_path.id,
            })
            return
        
        # Create the notification directly
        notification = Notification.objects.create(
            recipient=knowledge_path.author,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='comentó en tu ruta de conocimiento',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id,
            description=f'{comment.author.username} comentó en tu ruta de conocimiento "{knowledge_path.title}": {comment.body[:50]}...'
        )
        logger.info("Knowledge path comment notification created successfully", extra={
            'notification_id': notification.id,
            'comment_id': comment.id,
            'knowledge_path_id': knowledge_path.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target_content_type': str(notification.target_content_type),
                'target_object_id': notification.target_object_id,
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'comment_id': comment.id,
                'knowledge_path_id': knowledge_path.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating knowledge path comment notification: {str(e)}", extra={
            'comment_id': comment.id,
            'knowledge_path_id': knowledge_path.id if 'knowledge_path' in locals() else None,
            'author_id': comment.author.id,
        }, exc_info=True)

def notify_content_comment(comment):
    """
    Create a notification when someone comments on a content.
    Only notifies the content owner if the comment is not a reply.
    
    Args:
        comment: The Comment instance that was created
    """
    logger.info("Creating content comment notification", extra={
        'comment_id': comment.id,
        'author_id': comment.author.id,
        'author_username': comment.author.username,
        'parent_comment_id': comment.parent.id if comment.parent else None,
    })
    
    # Only notify for top-level comments (not replies)
    if comment.parent:
        logger.info("Comment is a reply - skipping notification", extra={
            'comment_id': comment.id,
            'parent_comment_id': comment.parent.id,
        })
        return
        
    try:
        # Verify this is a content comment
        if not isinstance(comment.content_object, ContentProfile):
            logger.info("Comment is not on a content - skipping notification", extra={
                'comment_id': comment.id,
                'content_object_type': type(comment.content_object).__name__,
            })
            return
            
        content_profile = comment.content_object
        logger.debug(f"Content profile details - ID: {content_profile.id}, Title: {content_profile.display_title}, Owner: {content_profile.user.username}")
        
        # Don't notify if user comments on their own content
        if comment.author == content_profile.user:
            logger.info("User is commenting on their own content - skipping notification", extra={
                'comment_id': comment.id,
                'content_profile_id': content_profile.id,
                'author_id': comment.author.id,
            })
            return
            
        # Get content types for debugging
        comment_ct = ContentType.objects.get_for_model(comment)
        content_profile_ct = ContentType.objects.get_for_model(content_profile)
        logger.debug(f"Content types - Comment: {comment_ct}, Content Profile: {content_profile_ct}")
        
        # Check if notification already exists
        existing_notifications = Notification.objects.filter(
            recipient=content_profile.user,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='comentó en tu contenido',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=content_profile_ct,
            target_object_id=content_profile.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'comment_id': comment.id,
                'content_profile_id': content_profile.id,
            })
            return
        
        # Create the notification directly
        notification = Notification.objects.create(
            recipient=content_profile.user,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='comentó en tu contenido',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=content_profile_ct,
            target_object_id=content_profile.id,
            description=f'{comment.author.username} comentó en tu contenido "{content_profile.display_title}": {comment.body[:50]}...'
        )
        logger.info("Content comment notification created successfully", extra={
            'notification_id': notification.id,
            'comment_id': comment.id,
            'content_profile_id': content_profile.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target_content_type': str(notification.target_content_type),
                'target_object_id': notification.target_object_id,
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'comment_id': comment.id,
                'content_profile_id': content_profile.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating content comment notification: {str(e)}", extra={
            'comment_id': comment.id,
            'content_profile_id': content_profile.id if 'content_profile' in locals() else None,
            'author_id': comment.author.id,
        }, exc_info=True)

def notify_knowledge_path_completion(user, knowledge_path):
    """
    Create a notification when someone completes a knowledge path.
    Notifies the knowledge path author.
    
    Args:
        user: The User instance who completed the path
        knowledge_path: The KnowledgePath instance that was completed
    """
    logger.info("Creating knowledge path completion notification", extra={
        'user_id': user.id,
        'user_username': user.username,
        'knowledge_path_id': knowledge_path.id,
        'knowledge_path_title': knowledge_path.title,
        'knowledge_path_author_id': knowledge_path.author.id,
        'knowledge_path_author_username': knowledge_path.author.username,
    })
    
    # Don't notify if user is the author
    if user == knowledge_path.author:
        logger.info("User is the author - skipping notification", extra={
            'user_id': user.id,
            'knowledge_path_id': knowledge_path.id,
        })
        return
        
    # Get content types
    user_ct = ContentType.objects.get_for_model(user)
    knowledge_path_ct = ContentType.objects.get_for_model(knowledge_path)
    logger.debug(f"Content types - User: {user_ct}, Knowledge Path: {knowledge_path_ct}")
    
    # Check if notification already exists
    existing_notifications = Notification.objects.filter(
        recipient=knowledge_path.author,
        actor_content_type=user_ct,
        actor_object_id=user.id,
        verb='completó tu ruta de conocimiento',
        target_content_type=knowledge_path_ct,
        target_object_id=knowledge_path.id
    )
    logger.debug(f"Existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        logger.info("Notification already exists - skipping creation", extra={
            'user_id': user.id,
            'knowledge_path_id': knowledge_path.id,
        })
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=knowledge_path.author,
        actor_content_type=user_ct,
        actor_object_id=user.id,
        verb='completó tu ruta de conocimiento',
        target_content_type=knowledge_path_ct,
        target_object_id=knowledge_path.id,
        description=f'{user.username} completó tu ruta de conocimiento "{knowledge_path.title}"'
    )
    logger.info("Knowledge path completion notification created successfully", extra={
        'notification_id': notification.id,
        'user_id': user.id,
        'knowledge_path_id': knowledge_path.id,
        'recipient_id': notification.recipient.id,
        'actor_id': notification.actor.id,
    })
    
    # Verify the notification was created
    if notification:
        logger.debug("Notification verification successful", extra={
            'notification_id': notification.id,
            'recipient': notification.recipient.username,
            'actor': notification.actor.username,
            'verb': notification.verb,
            'timestamp': notification.timestamp.isoformat(),
            'unread': notification.unread,
            'target_content_type': str(notification.target_content_type),
            'target_object_id': notification.target_object_id,
        })
    else:
        logger.warning("Notification not found in database after creation", extra={
            'user_id': user.id,
            'knowledge_path_id': knowledge_path.id,
        })

def notify_certificate_request(certificate_request):
    """
    Create a notification when someone requests a certificate for a knowledge path.
    Notifies the knowledge path author.
    
    Args:
        certificate_request: The CertificateRequest instance that was created
    """
    logger.info("Creating certificate request notification", extra={
        'requester_id': certificate_request.requester.id,
        'requester_username': certificate_request.requester.username,
        'knowledge_path_id': certificate_request.knowledge_path.id,
        'knowledge_path_title': certificate_request.knowledge_path.title,
        'knowledge_path_author_id': certificate_request.knowledge_path.author.id,
        'knowledge_path_author_username': certificate_request.knowledge_path.author.username,
    })
    
    # Don't notify if requester is the author
    if certificate_request.requester == certificate_request.knowledge_path.author:
        logger.info("Requester is the author - skipping notification", extra={
            'requester_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })
        return
        
    # Get content types
    requester_ct = ContentType.objects.get_for_model(certificate_request.requester)
    knowledge_path_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path)
    logger.debug(f"Content types - Requester: {requester_ct}, Knowledge Path: {knowledge_path_ct}")
    
    # Check if notification already exists for this specific request
    # We'll check for recent notifications (within the last hour) to avoid spam
    from django.utils import timezone
    from datetime import timedelta
    
    recent_cutoff = timezone.now() - timedelta(hours=1)
    existing_notifications = Notification.objects.filter(
        recipient=certificate_request.knowledge_path.author,
        actor_content_type=requester_ct,
        actor_object_id=certificate_request.requester.id,
        verb='solicitó un certificado para tu ruta de conocimiento',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        timestamp__gte=recent_cutoff
    )
    logger.debug(f"Recent existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        logger.info("Recent notification already exists - skipping creation", extra={
            'requester_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=certificate_request.knowledge_path.author,
        actor_content_type=requester_ct,
        actor_object_id=certificate_request.requester.id,
        verb='solicitó un certificado para tu ruta de conocimiento',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.requester.username} solicitó un certificado para tu ruta de conocimiento "{certificate_request.knowledge_path.title}"'
    )
    logger.info("Certificate request notification created successfully", extra={
        'notification_id': notification.id,
        'requester_id': certificate_request.requester.id,
        'knowledge_path_id': certificate_request.knowledge_path.id,
        'recipient_id': notification.recipient.id,
        'actor_id': notification.actor.id,
    })
    
    # Verify the notification was created
    if notification:
        logger.debug("Notification verification successful", extra={
            'notification_id': notification.id,
            'recipient': notification.recipient.username,
            'actor': notification.actor.username,
            'verb': notification.verb,
            'timestamp': notification.timestamp.isoformat(),
            'unread': notification.unread,
            'target_content_type': str(notification.target_content_type),
            'target_object_id': notification.target_object_id,
        })
    else:
        logger.warning("Notification not found in database after creation", extra={
            'requester_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })

def notify_certificate_approval(certificate_request):
    """
    Create a notification when a certificate request is approved.
    Notifies the student who requested the certificate.
    
    Args:
        certificate_request: The CertificateRequest instance that was approved
    """
    logger.info("Creating certificate approval notification", extra={
        'student_id': certificate_request.requester.id,
        'student_username': certificate_request.requester.username,
        'knowledge_path_id': certificate_request.knowledge_path.id,
        'knowledge_path_title': certificate_request.knowledge_path.title,
        'approver_id': certificate_request.knowledge_path.author.id,
        'approver_username': certificate_request.knowledge_path.author.username,
    })
    
    # Get content types
    approver_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path.author)
    knowledge_path_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path)
    logger.debug(f"Content types - Approver: {approver_ct}, Knowledge Path: {knowledge_path_ct}")
    
    # Check if notification already exists
    existing_notifications = Notification.objects.filter(
        recipient=certificate_request.requester,
        actor_content_type=approver_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='aprobó tu solicitud de certificado para',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id
    )
    logger.debug(f"Existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        logger.info("Notification already exists - skipping creation", extra={
            'student_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=certificate_request.requester,
        actor_content_type=approver_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='aprobó tu solicitud de certificado para',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.knowledge_path.author.username} aprobó tu solicitud de certificado para "{certificate_request.knowledge_path.title}"'
    )
    logger.info("Certificate approval notification created successfully", extra={
        'notification_id': notification.id,
        'student_id': certificate_request.requester.id,
        'knowledge_path_id': certificate_request.knowledge_path.id,
        'recipient_id': notification.recipient.id,
        'actor_id': notification.actor.id,
    })
    
    # Verify the notification was created
    if notification:
        logger.debug("Notification verification successful", extra={
            'notification_id': notification.id,
            'recipient': notification.recipient.username,
            'actor': notification.actor.username,
            'verb': notification.verb,
            'timestamp': notification.timestamp.isoformat(),
            'unread': notification.unread,
            'target_content_type': str(notification.target_content_type),
            'target_object_id': notification.target_object_id,
        })
    else:
        logger.warning("Notification not found in database after creation", extra={
            'student_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })

def notify_certificate_rejection(certificate_request):
    """
    Create a notification when a certificate request is rejected.
    Notifies the student who requested the certificate.
    
    Args:
        certificate_request: The CertificateRequest instance that was rejected
    """
    logger.info("Creating certificate rejection notification", extra={
        'student_id': certificate_request.requester.id,
        'student_username': certificate_request.requester.username,
        'knowledge_path_id': certificate_request.knowledge_path.id,
        'knowledge_path_title': certificate_request.knowledge_path.title,
        'rejector_id': certificate_request.knowledge_path.author.id,
        'rejector_username': certificate_request.knowledge_path.author.username,
    })
    
    # Get content types
    rejector_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path.author)
    knowledge_path_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path)
    logger.debug(f"Content types - Rejector: {rejector_ct}, Knowledge Path: {knowledge_path_ct}")
    
    # Check if notification already exists
    existing_notifications = Notification.objects.filter(
        recipient=certificate_request.requester,
        actor_content_type=rejector_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='rechazó tu solicitud de certificado para',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id
    )
    logger.debug(f"Existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        logger.info("Notification already exists - skipping creation", extra={
            'student_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=certificate_request.requester,
        actor_content_type=rejector_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='rechazó tu solicitud de certificado para',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.knowledge_path.author.username} rechazó tu solicitud de certificado para "{certificate_request.knowledge_path.title}"'
    )
    logger.info("Certificate rejection notification created successfully", extra={
        'notification_id': notification.id,
        'student_id': certificate_request.requester.id,
        'knowledge_path_id': certificate_request.knowledge_path.id,
        'recipient_id': notification.recipient.id,
        'actor_id': notification.actor.id,
    })
    
    # Verify the notification was created
    if notification:
        logger.debug("Notification verification successful", extra={
            'notification_id': notification.id,
            'recipient': notification.recipient.username,
            'actor': notification.actor.username,
            'verb': notification.verb,
            'timestamp': notification.timestamp.isoformat(),
            'unread': notification.unread,
            'target_content_type': str(notification.target_content_type),
            'target_object_id': notification.target_object_id,
        })
    else:
        logger.warning("Notification not found in database after creation", extra={
            'student_id': certificate_request.requester.id,
            'knowledge_path_id': certificate_request.knowledge_path.id,
        })

def notify_content_upvote(vote):
    """
    Create a notification when someone upvotes content.
    Notifies the content owner (uploaded_by user).
    
    Args:
        vote: The Vote instance that was created/updated
    """
    logger.info("Creating content upvote notification", extra={
        'vote_id': vote.id,
        'voter_id': vote.user.id,
        'voter_username': vote.user.username,
        'content_type': vote.content_type.model,
        'object_id': vote.object_id,
    })
    
    try:
        # Get the content object
        content = vote.content_object
        if not content:
            logger.info("Content object not found - skipping notification", extra={
                'vote_id': vote.id,
            })
            return
            
        logger.debug(f"Content details - ID: {content.id}, Title: {content.original_title}, Owner: {content.uploaded_by.username if content.uploaded_by else 'None'}")
        
        # Don't notify if user upvotes their own content
        if vote.user == content.uploaded_by:
            logger.info("User is upvoting their own content - skipping notification", extra={
                'vote_id': vote.id,
                'content_id': content.id,
                'voter_id': vote.user.id,
            })
            return
            
        # Don't notify if content has no owner
        if not content.uploaded_by:
            logger.info("Content has no owner - skipping notification", extra={
                'vote_id': vote.id,
                'content_id': content.id,
            })
            return
            
        # Get content types for debugging
        voter_ct = ContentType.objects.get_for_model(vote.user)
        content_ct = ContentType.objects.get_for_model(content)
        logger.debug(f"Content types - Voter: {voter_ct}, Content: {content_ct}")
        
        # Check if notification already exists for this specific vote
        existing_notifications = Notification.objects.filter(
            recipient=content.uploaded_by,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='votó positivamente tu contenido',
            target_content_type=content_ct,
            target_object_id=content.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'vote_id': vote.id,
                'content_id': content.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=content.uploaded_by,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='votó positivamente tu contenido',
            target_content_type=content_ct,
            target_object_id=content.id,
            description=f'{vote.user.username} votó positivamente tu contenido "{content.original_title}"'
        )
        logger.info("Content upvote notification created successfully", extra={
            'notification_id': notification.id,
            'vote_id': vote.id,
            'content_id': content.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target': str(notification.target),
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'vote_id': vote.id,
                'content_id': content.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating content upvote notification: {str(e)}", extra={
            'vote_id': vote.id,
            'content_id': content.id if 'content' in locals() else None,
            'voter_id': vote.user.id,
        }, exc_info=True)

def notify_knowledge_path_upvote(vote):
    """
    Create a notification when someone upvotes a knowledge path.
    Notifies the knowledge path author.
    
    Args:
        vote: The Vote instance that was created/updated
    """
    logger.info("Creating knowledge path upvote notification", extra={
        'vote_id': vote.id,
        'voter_id': vote.user.id,
        'voter_username': vote.user.username,
        'content_type': vote.content_type.model,
        'object_id': vote.object_id,
    })
    
    try:
        # Get the knowledge path object
        knowledge_path = vote.content_object
        if not knowledge_path:
            logger.info("Knowledge path object not found - skipping notification", extra={
                'vote_id': vote.id,
            })
            return
            
        logger.debug(f"Knowledge path details - ID: {knowledge_path.id}, Title: {knowledge_path.title}, Author: {knowledge_path.author.username if knowledge_path.author else 'None'}")
        
        # Don't notify if user upvotes their own knowledge path
        if vote.user == knowledge_path.author:
            logger.info("User is upvoting their own knowledge path - skipping notification", extra={
                'vote_id': vote.id,
                'knowledge_path_id': knowledge_path.id,
                'voter_id': vote.user.id,
            })
            return
            
        # Don't notify if knowledge path has no author
        if not knowledge_path.author:
            logger.info("Knowledge path has no author - skipping notification", extra={
                'vote_id': vote.id,
                'knowledge_path_id': knowledge_path.id,
            })
            return
            
        # Get content types for debugging
        voter_ct = ContentType.objects.get_for_model(vote.user)
        knowledge_path_ct = ContentType.objects.get_for_model(knowledge_path)
        logger.debug(f"Content types - Voter: {voter_ct}, Knowledge Path: {knowledge_path_ct}")
        
        # Check if notification already exists for this specific vote
        existing_notifications = Notification.objects.filter(
            recipient=knowledge_path.author,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='votó positivamente tu ruta de conocimiento',
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'vote_id': vote.id,
                'knowledge_path_id': knowledge_path.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=knowledge_path.author,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='votó positivamente tu ruta de conocimiento',
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id,
            description=f'{vote.user.username} votó positivamente tu ruta de conocimiento "{knowledge_path.title}"'
        )
        logger.info("Knowledge path upvote notification created successfully", extra={
            'notification_id': notification.id,
            'vote_id': vote.id,
            'knowledge_path_id': knowledge_path.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target': str(notification.target),
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'vote_id': vote.id,
                'knowledge_path_id': knowledge_path.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating knowledge path upvote notification: {str(e)}", extra={
            'vote_id': vote.id,
            'knowledge_path_id': knowledge_path.id if 'knowledge_path' in locals() else None,
            'voter_id': vote.user.id,
        }, exc_info=True)

def notify_event_registration(registration):
    """
    Create a notification when someone registers for an event.
    Notifies the event creator.
    
    Args:
        registration: The EventRegistration instance that was created
    """
    logger.info("Creating event registration notification", extra={
        'registration_id': registration.id,
        'registrant_id': registration.user.id,
        'registrant_username': registration.user.username,
        'event_id': registration.event.id,
        'event_title': registration.event.title,
        'event_creator_id': registration.event.owner.id if registration.event.owner else None,
        'event_creator_username': registration.event.owner.username if registration.event.owner else None,
    })
    
    # Don't notify if registrant is the event creator
    if registration.user == registration.event.owner:
        logger.info("User is registering for their own event - skipping notification", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'registrant_id': registration.user.id,
        })
        return
        
    # Don't notify if event has no owner
    if not registration.event.owner:
        logger.info("Event has no owner - skipping notification", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
        })
        return
        
    try:
        # Get content types for debugging
        registrant_ct = ContentType.objects.get_for_model(registration.user)
        event_ct = ContentType.objects.get_for_model(registration.event)
        logger.debug(f"Content types - Registrant: {registrant_ct}, Event: {event_ct}")
        
        # Check if notification already exists for this specific registration
        existing_notifications = Notification.objects.filter(
            recipient=registration.event.owner,
            actor_content_type=registrant_ct,
            actor_object_id=registration.user.id,
            verb='se registró en tu evento',
            target_content_type=event_ct,
            target_object_id=registration.event.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'registration_id': registration.id,
                'event_id': registration.event.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=registration.event.owner,
            actor_content_type=registrant_ct,
            actor_object_id=registration.user.id,
            verb='se registró en tu evento',
            target_content_type=event_ct,
            target_object_id=registration.event.id,
            description=f'{registration.user.username} se registró en tu evento "{registration.event.title}"'
        )
        logger.info("Event registration notification created successfully", extra={
            'notification_id': notification.id,
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target_content_type': str(notification.target_content_type),
                'target_object_id': notification.target_object_id,
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'registration_id': registration.id,
                'event_id': registration.event.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating event registration notification: {str(e)}", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'registrant_id': registration.user.id,
        }, exc_info=True)

def notify_payment_accepted(registration):
    """
    Create a notification when a teacher accepts payment for an event registration.
    Notifies the student who registered.
    
    Args:
        registration: The EventRegistration instance that was updated
    """
    logger.info("Creating payment accepted notification", extra={
        'registration_id': registration.id,
        'student_id': registration.user.id,
        'student_username': registration.user.username,
        'event_id': registration.event.id,
        'event_title': registration.event.title,
        'teacher_id': registration.event.owner.id if registration.event.owner else None,
        'teacher_username': registration.event.owner.username if registration.event.owner else None,
    })
    
    # Don't notify if student is the event creator
    if registration.user == registration.event.owner:
        logger.info("Student is the event creator - skipping notification", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'student_id': registration.user.id,
        })
        return
        
    # Don't notify if event has no owner
    if not registration.event.owner:
        logger.info("Event has no owner - skipping notification", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
        })
        return
        
    try:
        # Get content types for debugging
        teacher_ct = ContentType.objects.get_for_model(registration.event.owner)
        event_ct = ContentType.objects.get_for_model(registration.event)
        logger.debug(f"Content types - Teacher: {teacher_ct}, Event: {event_ct}")
        
        # Check if notification already exists for this specific payment acceptance
        existing_notifications = Notification.objects.filter(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='aceptó tu pago para',
            target_content_type=event_ct,
            target_object_id=registration.event.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'registration_id': registration.id,
                'event_id': registration.event.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='aceptó tu pago para',
            target_content_type=event_ct,
            target_object_id=registration.event.id,
            description=f'{registration.event.owner.username} aceptó tu pago para "{registration.event.title}"'
        )
        logger.info("Payment accepted notification created successfully", extra={
            'notification_id': notification.id,
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target_content_type': str(notification.target_content_type),
                'target_object_id': notification.target_object_id,
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'registration_id': registration.id,
                'event_id': registration.event.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating payment accepted notification: {str(e)}", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'student_id': registration.user.id,
        }, exc_info=True)

def notify_certificate_sent(registration):
    """
    Create a notification when a teacher sends a certificate for an event.
    Notifies the student who registered.
    
    Args:
        registration: The EventRegistration instance that was updated
    """
    logger.info("Creating certificate sent notification", extra={
        'registration_id': registration.id,
        'student_id': registration.user.id,
        'student_username': registration.user.username,
        'event_id': registration.event.id,
        'event_title': registration.event.title,
        'teacher_id': registration.event.owner.id if registration.event.owner else None,
        'teacher_username': registration.event.owner.username if registration.event.owner else None,
    })
    
    # Don't notify if student is the event creator
    if registration.user == registration.event.owner:
        logger.info("Student is the event creator - skipping notification", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'student_id': registration.user.id,
        })
        return
        
    # Don't notify if event has no owner
    if not registration.event.owner:
        logger.info("Event has no owner - skipping notification", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
        })
        return
        
    try:
        # Get content types for debugging
        teacher_ct = ContentType.objects.get_for_model(registration.event.owner)
        event_ct = ContentType.objects.get_for_model(registration.event)
        logger.debug(f"Content types - Teacher: {teacher_ct}, Event: {event_ct}")
        
        # Check if notification already exists for this specific certificate sending
        existing_notifications = Notification.objects.filter(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='te envió un certificado para',
            target_content_type=event_ct,
            target_object_id=registration.event.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'registration_id': registration.id,
                'event_id': registration.event.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='te envió un certificado para',
            target_content_type=event_ct,
            target_object_id=registration.event.id,
            description=f'{registration.event.owner.username} te envió un certificado para "{registration.event.title}"'
        )
        logger.info("Certificate sent notification created successfully", extra={
            'notification_id': notification.id,
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
        
        # Verify the notification was created
        if notification:
            logger.debug("Notification verification successful", extra={
                'notification_id': notification.id,
                'recipient': notification.recipient.username,
                'actor': notification.actor.username,
                'verb': notification.verb,
                'timestamp': notification.timestamp.isoformat(),
                'unread': notification.unread,
                'target_content_type': str(notification.target_content_type),
                'target_object_id': notification.target_object_id,
            })
        else:
            logger.warning("Notification not found in database after creation", extra={
                'registration_id': registration.id,
                'event_id': registration.event.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating certificate sent notification: {str(e)}", extra={
            'registration_id': registration.id,
            'event_id': registration.event.id,
            'student_id': registration.user.id,
        }, exc_info=True) 