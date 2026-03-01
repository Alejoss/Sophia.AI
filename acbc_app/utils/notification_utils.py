"""
Utility functions for handling notifications across the application.
"""
from django.contrib.contenttypes.models import ContentType
from notifications.models import Notification
from knowledge_paths.models import KnowledgePath
from content.models import ContentProfile, TopicModeratorInvitation, Topic, ContentSuggestion
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
            verb='comentó en tu camino de conocimiento',
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
            verb='comentó en tu camino de conocimiento',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id,
            description=f'{comment.author.username} comentó en tu camino de conocimiento "{knowledge_path.title}": {comment.body[:50]}...'
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
    if not knowledge_path.author:
        logger.debug("Knowledge path has no author - skipping completion notification", extra={
            'knowledge_path_id': knowledge_path.id,
        })
        return

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
        verb='completó tu camino de conocimiento',
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
        verb='completó tu camino de conocimiento',
        target_content_type=knowledge_path_ct,
        target_object_id=knowledge_path.id,
        description=f'{user.username} completó tu camino de conocimiento "{knowledge_path.title}"'
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
        verb='solicitó un certificado para tu camino de conocimiento',
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
        verb='solicitó un certificado para tu camino de conocimiento',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.requester.username} solicitó un certificado para tu camino de conocimiento "{certificate_request.knowledge_path.title}"'
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
            verb='votó positivamente tu camino de conocimiento',
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
            verb='votó positivamente tu camino de conocimiento',
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id,
            description=f'{vote.user.username} votó positivamente tu camino de conocimiento "{knowledge_path.title}"'
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

def notify_topic_moderator_invitation(invitation):
    """
    Create a notification when a topic creator invites a user to be a moderator.
    Notifies the invited user.
    
    Args:
        invitation: The TopicModeratorInvitation instance that was created/updated
    """
    logger.info("Creating topic moderator invitation notification", extra={
        'invitation_id': invitation.id,
        'topic_id': invitation.topic.id,
        'topic_title': invitation.topic.title,
        'invited_user_id': invitation.invited_user.id,
        'invited_user_username': invitation.invited_user.username,
        'invited_by_id': invitation.invited_by.id,
        'invited_by_username': invitation.invited_by.username,
    })
    
    # Don't notify if user invites themselves
    if invitation.invited_user == invitation.invited_by:
        logger.info("User is inviting themselves - skipping notification", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
        })
        return
    
    try:
        # Get content types
        invited_by_ct = ContentType.objects.get_for_model(invitation.invited_by)
        topic_ct = ContentType.objects.get_for_model(invitation.topic)
        logger.debug(f"Content types - Invited By: {invited_by_ct}, Topic: {topic_ct}")
        
        # Check if notification already exists for this invitation
        existing_notifications = Notification.objects.filter(
            recipient=invitation.invited_user,
            actor_content_type=invited_by_ct,
            actor_object_id=invitation.invited_by.id,
            verb='te invitó a moderar',
            target_content_type=topic_ct,
            target_object_id=invitation.topic.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'invitation_id': invitation.id,
                'topic_id': invitation.topic.id,
            })
            return
        
        # Build description with optional message
        description = f'{invitation.invited_by.username} te invitó a moderar el tema "{invitation.topic.title}"'
        if invitation.message:
            description += f': {invitation.message}'
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=invitation.invited_user,
            actor_content_type=invited_by_ct,
            actor_object_id=invitation.invited_by.id,
            verb='te invitó a moderar',
            target_content_type=topic_ct,
            target_object_id=invitation.topic.id,
            description=description
        )
        logger.info("Topic moderator invitation notification created successfully", extra={
            'notification_id': notification.id,
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
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
                'invitation_id': invitation.id,
                'topic_id': invitation.topic.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating topic moderator invitation notification: {str(e)}", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id if invitation else None,
            'invited_user_id': invitation.invited_user.id if invitation else None,
        }, exc_info=True)

def notify_topic_moderator_invitation_accepted(invitation):
    """
    Create a notification when a user accepts a moderator invitation.
    Notifies the topic creator.
    
    Args:
        invitation: The TopicModeratorInvitation instance that was accepted
    """
    logger.info("Creating topic moderator invitation accepted notification", extra={
        'invitation_id': invitation.id,
        'topic_id': invitation.topic.id,
        'topic_title': invitation.topic.title,
        'invited_user_id': invitation.invited_user.id,
        'invited_user_username': invitation.invited_user.username,
        'topic_creator_id': invitation.topic.creator.id if invitation.topic.creator else None,
        'topic_creator_username': invitation.topic.creator.username if invitation.topic.creator else None,
    })
    
    # Don't notify if topic has no creator
    if not invitation.topic.creator:
        logger.info("Topic has no creator - skipping notification", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
        })
        return
    
    # Don't notify if user accepts their own invitation (shouldn't happen, but check anyway)
    if invitation.invited_user == invitation.topic.creator:
        logger.info("User is accepting invitation for their own topic - skipping notification", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
        })
        return
    
    try:
        # Get content types
        invited_user_ct = ContentType.objects.get_for_model(invitation.invited_user)
        topic_ct = ContentType.objects.get_for_model(invitation.topic)
        logger.debug(f"Content types - Invited User: {invited_user_ct}, Topic: {topic_ct}")
        
        # Check if notification already exists for this acceptance
        existing_notifications = Notification.objects.filter(
            recipient=invitation.topic.creator,
            actor_content_type=invited_user_ct,
            actor_object_id=invitation.invited_user.id,
            verb='aceptó tu invitación para moderar',
            target_content_type=topic_ct,
            target_object_id=invitation.topic.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'invitation_id': invitation.id,
                'topic_id': invitation.topic.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=invitation.topic.creator,
            actor_content_type=invited_user_ct,
            actor_object_id=invitation.invited_user.id,
            verb='aceptó tu invitación para moderar',
            target_content_type=topic_ct,
            target_object_id=invitation.topic.id,
            description=f'{invitation.invited_user.username} aceptó tu invitación para moderar el tema "{invitation.topic.title}"'
        )
        logger.info("Topic moderator invitation accepted notification created successfully", extra={
            'notification_id': notification.id,
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
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
                'invitation_id': invitation.id,
                'topic_id': invitation.topic.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating topic moderator invitation accepted notification: {str(e)}", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id if invitation else None,
            'invited_user_id': invitation.invited_user.id if invitation else None,
        }, exc_info=True)

def notify_topic_moderator_invitation_declined(invitation):
    """
    Create a notification when a user declines a moderator invitation.
    Notifies the topic creator.
    
    Args:
        invitation: The TopicModeratorInvitation instance that was declined
    """
    logger.info("Creating topic moderator invitation declined notification", extra={
        'invitation_id': invitation.id,
        'topic_id': invitation.topic.id,
        'topic_title': invitation.topic.title,
        'invited_user_id': invitation.invited_user.id,
        'invited_user_username': invitation.invited_user.username,
        'topic_creator_id': invitation.topic.creator.id if invitation.topic.creator else None,
        'topic_creator_username': invitation.topic.creator.username if invitation.topic.creator else None,
    })
    
    # Don't notify if topic has no creator
    if not invitation.topic.creator:
        logger.info("Topic has no creator - skipping notification", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
        })
        return
    
    # Don't notify if user declines their own invitation (shouldn't happen, but check anyway)
    if invitation.invited_user == invitation.topic.creator:
        logger.info("User is declining invitation for their own topic - skipping notification", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
        })
        return
    
    try:
        # Get content types
        invited_user_ct = ContentType.objects.get_for_model(invitation.invited_user)
        topic_ct = ContentType.objects.get_for_model(invitation.topic)
        logger.debug(f"Content types - Invited User: {invited_user_ct}, Topic: {topic_ct}")
        
        # Check if notification already exists for this decline
        existing_notifications = Notification.objects.filter(
            recipient=invitation.topic.creator,
            actor_content_type=invited_user_ct,
            actor_object_id=invitation.invited_user.id,
            verb='rechazó tu invitación para moderar',
            target_content_type=topic_ct,
            target_object_id=invitation.topic.id
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'invitation_id': invitation.id,
                'topic_id': invitation.topic.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=invitation.topic.creator,
            actor_content_type=invited_user_ct,
            actor_object_id=invitation.invited_user.id,
            verb='rechazó tu invitación para moderar',
            target_content_type=topic_ct,
            target_object_id=invitation.topic.id,
            description=f'{invitation.invited_user.username} rechazó tu invitación para moderar el tema "{invitation.topic.title}"'
        )
        logger.info("Topic moderator invitation declined notification created successfully", extra={
            'notification_id': notification.id,
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id,
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
                'invitation_id': invitation.id,
                'topic_id': invitation.topic.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating topic moderator invitation declined notification: {str(e)}", extra={
            'invitation_id': invitation.id,
            'topic_id': invitation.topic.id if invitation else None,
            'invited_user_id': invitation.invited_user.id if invitation else None,
        }, exc_info=True)

def notify_topic_moderator_removed(topic, removed_user, removed_by):
    """
    Create a notification when a topic creator removes a moderator from a topic.
    Notifies the removed moderator.
    
    Args:
        topic: The Topic instance
        removed_user: The User instance who was removed as moderator
        removed_by: The User instance who removed the moderator (should be the topic creator)
    """
    logger.info("Creating topic moderator removed notification", extra={
        'topic_id': topic.id,
        'topic_title': topic.title,
        'removed_user_id': removed_user.id,
        'removed_user_username': removed_user.username,
        'removed_by_id': removed_by.id,
        'removed_by_username': removed_by.username,
        'topic_creator_id': topic.creator.id if topic.creator else None,
        'topic_creator_username': topic.creator.username if topic.creator else None,
    })
    
    # Don't notify if user removes themselves (shouldn't happen, but check anyway)
    if removed_user == removed_by:
        logger.info("User is removing themselves - skipping notification", extra={
            'topic_id': topic.id,
            'removed_user_id': removed_user.id,
        })
        return
    
    # Don't notify if topic has no creator
    if not topic.creator:
        logger.info("Topic has no creator - skipping notification", extra={
            'topic_id': topic.id,
        })
        return
    
    # Verify that removed_by is the creator
    if removed_by != topic.creator:
        logger.warning("User removing moderator is not the creator - still sending notification", extra={
            'topic_id': topic.id,
            'removed_by_id': removed_by.id,
            'creator_id': topic.creator.id,
        })
    
    try:
        # Get content types
        removed_by_ct = ContentType.objects.get_for_model(removed_by)
        topic_ct = ContentType.objects.get_for_model(topic)
        logger.debug(f"Content types - Removed By: {removed_by_ct}, Topic: {topic_ct}")
        
        # Check if notification already exists (within the last hour to avoid spam)
        from django.utils import timezone
        from datetime import timedelta
        
        recent_cutoff = timezone.now() - timedelta(hours=1)
        existing_notifications = Notification.objects.filter(
            recipient=removed_user,
            actor_content_type=removed_by_ct,
            actor_object_id=removed_by.id,
            verb='te removió como moderador de',
            target_content_type=topic_ct,
            target_object_id=topic.id,
            timestamp__gte=recent_cutoff
        )
        logger.debug(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            logger.info("Recent notification already exists - skipping creation", extra={
                'topic_id': topic.id,
                'removed_user_id': removed_user.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=removed_user,
            actor_content_type=removed_by_ct,
            actor_object_id=removed_by.id,
            verb='te removió como moderador de',
            target_content_type=topic_ct,
            target_object_id=topic.id,
            description=f'{removed_by.username} te removió como moderador del tema "{topic.title}"'
        )
        logger.info("Topic moderator removed notification created successfully", extra={
            'notification_id': notification.id,
            'topic_id': topic.id,
            'removed_user_id': removed_user.id,
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
                'topic_id': topic.id,
                'removed_user_id': removed_user.id,
            })
            
    except Exception as e:
        logger.error(f"Error creating topic moderator removed notification: {str(e)}", extra={
            'topic_id': topic.id if topic else None,
            'removed_user_id': removed_user.id if removed_user else None,
            'removed_by_id': removed_by.id if removed_by else None,
        }, exc_info=True)

def notify_content_suggestion_created(suggestion):
    """
    Create notifications when a user suggests content for a topic.
    Notifies all moderators of the topic.
    
    Args:
        suggestion: The ContentSuggestion instance that was created
    """
    logger.info("Creating content suggestion notification", extra={
        'suggestion_id': suggestion.id,
        'topic_id': suggestion.topic.id,
        'topic_title': suggestion.topic.title,
        'content_id': suggestion.content.id,
        'suggested_by_id': suggestion.suggested_by.id,
        'suggested_by_username': suggestion.suggested_by.username,
    })
    
    try:
        # Get all moderators of the topic (including creator)
        moderators = list(suggestion.topic.moderators.all())
        if suggestion.topic.creator and suggestion.topic.creator not in moderators:
            moderators.append(suggestion.topic.creator)
        
        # Get content types
        suggested_by_ct = ContentType.objects.get_for_model(suggestion.suggested_by)
        topic_ct = ContentType.objects.get_for_model(suggestion.topic)
        
        notifications_created = 0
        
        for moderator in moderators:
            # Don't notify the user who made the suggestion
            if moderator.id == suggestion.suggested_by.id:
                continue
            
            # Check if notification already exists
            existing_notifications = Notification.objects.filter(
                recipient=moderator,
                actor_content_type=suggested_by_ct,
                actor_object_id=suggestion.suggested_by.id,
                verb='sugirió contenido para',
                target_content_type=topic_ct,
                target_object_id=suggestion.topic.id
            )
            
            if existing_notifications.exists():
                logger.info("Notification already exists - skipping creation", extra={
                    'suggestion_id': suggestion.id,
                    'moderator_id': moderator.id,
                })
                continue
            
            # Build description
            description = f'{suggestion.suggested_by.username} sugirió contenido para el tema "{suggestion.topic.title}"'
            if suggestion.message:
                description += f': {suggestion.message[:100]}'
            
            # Create the notification
            notification = Notification.objects.create(
                recipient=moderator,
                actor_content_type=suggested_by_ct,
                actor_object_id=suggestion.suggested_by.id,
                verb='sugirió contenido para',
                target_content_type=topic_ct,
                target_object_id=suggestion.topic.id,
                description=description
            )
            notifications_created += 1
            logger.info("Content suggestion notification created successfully", extra={
                'notification_id': notification.id,
                'suggestion_id': suggestion.id,
                'moderator_id': moderator.id,
            })
        
        logger.info(f"Created {notifications_created} notifications for content suggestion", extra={
            'suggestion_id': suggestion.id,
            'total_moderators': len(moderators),
            'notifications_created': notifications_created,
        })
            
    except Exception as e:
        logger.error(f"Error creating content suggestion notification: {str(e)}", extra={
            'suggestion_id': suggestion.id if suggestion else None,
            'topic_id': suggestion.topic.id if suggestion else None,
        }, exc_info=True)

def notify_content_suggestion_accepted(suggestion):
    """
    Create a notification when a content suggestion is accepted.
    Notifies the user who suggested the content.
    
    Args:
        suggestion: The ContentSuggestion instance that was accepted
    """
    logger.info("Creating content suggestion accepted notification", extra={
        'suggestion_id': suggestion.id,
        'topic_id': suggestion.topic.id,
        'topic_title': suggestion.topic.title,
        'suggested_by_id': suggestion.suggested_by.id,
        'reviewed_by_id': suggestion.reviewed_by.id if suggestion.reviewed_by else None,
    })
    
    # Don't notify if reviewer is the suggester
    if suggestion.reviewed_by and suggestion.reviewed_by.id == suggestion.suggested_by.id:
        logger.info("Reviewer is the suggester - skipping notification", extra={
            'suggestion_id': suggestion.id,
        })
        return
    
    try:
        # Get content types
        reviewed_by_ct = ContentType.objects.get_for_model(suggestion.reviewed_by) if suggestion.reviewed_by else None
        topic_ct = ContentType.objects.get_for_model(suggestion.topic)
        
        if not reviewed_by_ct:
            logger.warning("No reviewer found - skipping notification", extra={
                'suggestion_id': suggestion.id,
            })
            return
        
        # Check if notification already exists
        existing_notifications = Notification.objects.filter(
            recipient=suggestion.suggested_by,
            actor_content_type=reviewed_by_ct,
            actor_object_id=suggestion.reviewed_by.id,
            verb='aceptó tu sugerencia de contenido para',
            target_content_type=topic_ct,
            target_object_id=suggestion.topic.id
        )
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'suggestion_id': suggestion.id,
            })
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=suggestion.suggested_by,
            actor_content_type=reviewed_by_ct,
            actor_object_id=suggestion.reviewed_by.id,
            verb='aceptó tu sugerencia de contenido para',
            target_content_type=topic_ct,
            target_object_id=suggestion.topic.id,
            description=f'{suggestion.reviewed_by.username} aceptó tu sugerencia de contenido para el tema "{suggestion.topic.title}"'
        )
        logger.info("Content suggestion accepted notification created successfully", extra={
            'notification_id': notification.id,
            'suggestion_id': suggestion.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
            
    except Exception as e:
        logger.error(f"Error creating content suggestion accepted notification: {str(e)}", extra={
            'suggestion_id': suggestion.id if suggestion else None,
            'topic_id': suggestion.topic.id if suggestion else None,
        }, exc_info=True)

def notify_content_suggestion_rejected(suggestion):
    """
    Create a notification when a content suggestion is rejected.
    Notifies the user who suggested the content.
    
    Args:
        suggestion: The ContentSuggestion instance that was rejected
    """
    logger.info("Creating content suggestion rejected notification", extra={
        'suggestion_id': suggestion.id,
        'topic_id': suggestion.topic.id,
        'topic_title': suggestion.topic.title,
        'suggested_by_id': suggestion.suggested_by.id,
        'reviewed_by_id': suggestion.reviewed_by.id if suggestion.reviewed_by else None,
    })
    
    # Don't notify if reviewer is the suggester
    if suggestion.reviewed_by and suggestion.reviewed_by.id == suggestion.suggested_by.id:
        logger.info("Reviewer is the suggester - skipping notification", extra={
            'suggestion_id': suggestion.id,
        })
        return
    
    try:
        # Get content types
        reviewed_by_ct = ContentType.objects.get_for_model(suggestion.reviewed_by) if suggestion.reviewed_by else None
        topic_ct = ContentType.objects.get_for_model(suggestion.topic)
        
        if not reviewed_by_ct:
            logger.warning("No reviewer found - skipping notification", extra={
                'suggestion_id': suggestion.id,
            })
            return
        
        # Check if notification already exists
        existing_notifications = Notification.objects.filter(
            recipient=suggestion.suggested_by,
            actor_content_type=reviewed_by_ct,
            actor_object_id=suggestion.reviewed_by.id,
            verb='rechazó tu sugerencia de contenido para',
            target_content_type=topic_ct,
            target_object_id=suggestion.topic.id
        )
        
        if existing_notifications.exists():
            logger.info("Notification already exists - skipping creation", extra={
                'suggestion_id': suggestion.id,
            })
            return
        
        # Build description with rejection reason if available
        description = f'{suggestion.reviewed_by.username} rechazó tu sugerencia de contenido para el tema "{suggestion.topic.title}"'
        if suggestion.rejection_reason:
            description += f': {suggestion.rejection_reason[:100]}'
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=suggestion.suggested_by,
            actor_content_type=reviewed_by_ct,
            actor_object_id=suggestion.reviewed_by.id,
            verb='rechazó tu sugerencia de contenido para',
            target_content_type=topic_ct,
            target_object_id=suggestion.topic.id,
            description=description
        )
        logger.info("Content suggestion rejected notification created successfully", extra={
            'notification_id': notification.id,
            'suggestion_id': suggestion.id,
            'recipient_id': notification.recipient.id,
            'actor_id': notification.actor.id,
        })
            
    except Exception as e:
        logger.error(f"Error creating content suggestion rejected notification: {str(e)}", extra={
            'suggestion_id': suggestion.id if suggestion else None,
            'topic_id': suggestion.topic.id if suggestion else None,
        }, exc_info=True) 