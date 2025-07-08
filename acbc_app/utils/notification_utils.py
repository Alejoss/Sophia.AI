"""
Utility functions for handling notifications across the application.
"""
from django.contrib.contenttypes.models import ContentType
from notifications.models import Notification
from knowledge_paths.models import KnowledgePath
from content.models import ContentProfile
import traceback

def notify_comment_reply(comment):
    """
    Create a notification when someone replies to a comment.
    """
    print("\n=== Creating Comment Reply Notification ===")
    print(f"Comment ID: {comment.id}")
    print(f"Author: {comment.author.username}")
    print(f"Parent Comment ID: {comment.parent.id if comment.parent else 'None'}")
    print(f"Parent Comment Author: {comment.parent.author.username if comment.parent else 'None'}")
    
    if comment.parent:
        try:
            # Get content types for debugging
            comment_ct = ContentType.objects.get_for_model(comment)
            parent_ct = ContentType.objects.get_for_model(comment.parent)
            print(f"Comment Content Type: {comment_ct}")
            print(f"Parent Comment Content Type: {parent_ct}")
            
            # Check if notification already exists
            existing_notifications = Notification.objects.filter(
                recipient=comment.parent.author,
                actor_content_type=ContentType.objects.get_for_model(comment.author),
                actor_object_id=comment.author.id,
                verb='replied to',
                action_object_content_type=comment_ct,
                action_object_object_id=comment.id,
                target_content_type=parent_ct,
                target_object_id=comment.parent.id
            )
            print(f"Existing notifications count: {existing_notifications.count()}")
            
            if existing_notifications.exists():
                print("Notification already exists - skipping creation")
                return
            
            # Create the notification directly
            notification = Notification.objects.create(
                recipient=comment.parent.author,
                actor_content_type=ContentType.objects.get_for_model(comment.author),
                actor_object_id=comment.author.id,
                verb='replied to',
                action_object_content_type=comment_ct,
                action_object_object_id=comment.id,
                target_content_type=parent_ct,
                target_object_id=comment.parent.id,
                description=f'{comment.author.username} replied to your comment'
            )
            print("Notification created successfully")
            
            # Verify the notification was created
            if notification:
                print(f"Verified notification exists with ID: {notification.id}")
                print(f"Notification details:")
                print(f"- Recipient: {notification.recipient.username}")
                print(f"- Actor: {notification.actor.username}")
                print(f"- Verb: {notification.verb}")
                print(f"- Timestamp: {notification.timestamp}")
                print(f"- Unread: {notification.unread}")
                print(f"- Target: {notification.target}")
                print(f"- Target Content Type: {notification.target_content_type}")
                print(f"- Target Object ID: {notification.target_object_id}")
            else:
                print("WARNING: Notification not found in database after creation!")
                
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
            print("Full traceback:")
            print(traceback.format_exc())
    else:
        print("No parent comment found - skipping notification")
    
    print("=== End Notification Creation ===\n")

def notify_knowledge_path_comment(comment):
    """
    Create a notification when someone comments on a knowledge path.
    Only notifies the knowledge path author if the comment is not a reply.
    
    Args:
        comment: The Comment instance that was created
    """
    print("\n=== Creating Knowledge Path Comment Notification ===")
    print(f"Comment ID: {comment.id}")
    print(f"Author: {comment.author.username}")
    
    # Only notify for top-level comments (not replies)
    if comment.parent:
        print("Comment is a reply - skipping notification")
        return
        
    try:
        # Verify this is a knowledge path comment
        if not isinstance(comment.content_object, KnowledgePath):
            print("Comment is not on a knowledge path - skipping notification")
            return
            
        knowledge_path = comment.content_object
        print(f"Knowledge Path ID: {knowledge_path.id}")
        print(f"Knowledge Path Title: {knowledge_path.title}")
        print(f"Knowledge Path Author: {knowledge_path.author.username}")
        
        # Don't notify if user comments on their own knowledge path
        if comment.author == knowledge_path.author:
            print("User is commenting on their own knowledge path - skipping notification")
            return
            
        # Get content types for debugging
        comment_ct = ContentType.objects.get_for_model(comment)
        knowledge_path_ct = ContentType.objects.get_for_model(knowledge_path)
        print(f"Comment Content Type: {comment_ct}")
        print(f"Knowledge Path Content Type: {knowledge_path_ct}")
        
        # Check if notification already exists
        existing_notifications = Notification.objects.filter(
            recipient=knowledge_path.author,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='commented on your knowledge path',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification directly
        notification = Notification.objects.create(
            recipient=knowledge_path.author,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='commented on your knowledge path',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id,
            description=f'{comment.author.username} commented on your knowledge path "{knowledge_path.title}": {comment.body[:50]}...'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
            print(f"- Target Content Type: {notification.target_content_type}")
            print(f"- Target Object ID: {notification.target_object_id}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n")

def notify_content_comment(comment):
    """
    Create a notification when someone comments on a content.
    Only notifies the content owner if the comment is not a reply.
    
    Args:
        comment: The Comment instance that was created
    """
    print("\n=== Creating Content Comment Notification ===")
    print(f"Comment ID: {comment.id}")
    print(f"Author: {comment.author.username}")
    
    # Only notify for top-level comments (not replies)
    if comment.parent:
        print("Comment is a reply - skipping notification")
        return
        
    try:
        # Verify this is a content comment
        if not isinstance(comment.content_object, ContentProfile):
            print("Comment is not on a content - skipping notification")
            return
            
        content_profile = comment.content_object
        print(f"Content Profile ID: {content_profile.id}")
        print(f"Content Title: {content_profile.display_title}")
        print(f"Content Owner: {content_profile.user.username}")
        
        # Don't notify if user comments on their own content
        if comment.author == content_profile.user:
            print("User is commenting on their own content - skipping notification")
            return
            
        # Get content types for debugging
        comment_ct = ContentType.objects.get_for_model(comment)
        content_profile_ct = ContentType.objects.get_for_model(content_profile)
        print(f"Comment Content Type: {comment_ct}")
        print(f"Content Profile Content Type: {content_profile_ct}")
        
        # Check if notification already exists
        existing_notifications = Notification.objects.filter(
            recipient=content_profile.user,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='commented on your content',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=content_profile_ct,
            target_object_id=content_profile.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification directly
        notification = Notification.objects.create(
            recipient=content_profile.user,
            actor_content_type=ContentType.objects.get_for_model(comment.author),
            actor_object_id=comment.author.id,
            verb='commented on your content',
            action_object_content_type=comment_ct,
            action_object_object_id=comment.id,
            target_content_type=content_profile_ct,
            target_object_id=content_profile.id,
            description=f'{comment.author.username} commented on your content "{content_profile.display_title}": {comment.body[:50]}...'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
            print(f"- Target Content Type: {notification.target_content_type}")
            print(f"- Target Object ID: {notification.target_object_id}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n")

def notify_knowledge_path_completion(user, knowledge_path):
    """
    Create a notification when someone completes a knowledge path.
    Notifies the knowledge path author.
    
    Args:
        user: The User instance who completed the path
        knowledge_path: The KnowledgePath instance that was completed
    """
    print("\n=== Creating Knowledge Path Completion Notification ===")
    print(f"User: {user.username}")
    print(f"Knowledge Path ID: {knowledge_path.id}")
    print(f"Knowledge Path Title: {knowledge_path.title}")
    print(f"Knowledge Path Author: {knowledge_path.author.username}")
    
    # Don't notify if user is the author
    if user == knowledge_path.author:
        print("User is the author - skipping notification")
        return
        
    # Get content types
    user_ct = ContentType.objects.get_for_model(user)
    knowledge_path_ct = ContentType.objects.get_for_model(knowledge_path)
    print(f"User Content Type: {user_ct}")
    print(f"Knowledge Path Content Type: {knowledge_path_ct}")
    
    # Check if notification already exists
    existing_notifications = Notification.objects.filter(
        recipient=knowledge_path.author,
        actor_content_type=user_ct,
        actor_object_id=user.id,
        verb='completed your knowledge path',
        target_content_type=knowledge_path_ct,
        target_object_id=knowledge_path.id
    )
    print(f"Existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        print("Notification already exists - skipping creation")
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=knowledge_path.author,
        actor_content_type=user_ct,
        actor_object_id=user.id,
        verb='completed your knowledge path',
        target_content_type=knowledge_path_ct,
        target_object_id=knowledge_path.id,
        description=f'{user.username} completed your knowledge path "{knowledge_path.title}"'
    )
    print("Notification created successfully")
    
    # Verify the notification was created
    if notification:
        print(f"Verified notification exists with ID: {notification.id}")
        print(f"Notification details:")
        print(f"- Recipient: {notification.recipient.username}")
        print(f"- Actor: {notification.actor.username}")
        print(f"- Verb: {notification.verb}")
        print(f"- Timestamp: {notification.timestamp}")
        print(f"- Unread: {notification.unread}")
        print(f"- Target: {notification.target}")
        print(f"- Target Content Type: {notification.target_content_type}")
        print(f"- Target Object ID: {notification.target_object_id}")
    else:
        print("WARNING: Notification not found in database after creation!")
    
    print("=== End Notification Creation ===\n")

def notify_certificate_request(certificate_request):
    """
    Create a notification when someone requests a certificate for a knowledge path.
    Notifies the knowledge path author.
    
    Args:
        certificate_request: The CertificateRequest instance that was created
    """
    print("\n=== Creating Certificate Request Notification ===")
    print(f"Requester: {certificate_request.requester.username}")
    print(f"Knowledge Path ID: {certificate_request.knowledge_path.id}")
    print(f"Knowledge Path Title: {certificate_request.knowledge_path.title}")
    print(f"Knowledge Path Author: {certificate_request.knowledge_path.author.username}")
    
    # Don't notify if requester is the author
    if certificate_request.requester == certificate_request.knowledge_path.author:
        print("Requester is the author - skipping notification")
        return
        
    # Get content types
    requester_ct = ContentType.objects.get_for_model(certificate_request.requester)
    knowledge_path_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path)
    print(f"Requester Content Type: {requester_ct}")
    print(f"Knowledge Path Content Type: {knowledge_path_ct}")
    
    # Check if notification already exists for this specific request
    # We'll check for recent notifications (within the last hour) to avoid spam
    from django.utils import timezone
    from datetime import timedelta
    
    recent_cutoff = timezone.now() - timedelta(hours=1)
    existing_notifications = Notification.objects.filter(
        recipient=certificate_request.knowledge_path.author,
        actor_content_type=requester_ct,
        actor_object_id=certificate_request.requester.id,
        verb='requested a certificate for your knowledge path',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        timestamp__gte=recent_cutoff
    )
    print(f"Recent existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        print("Recent notification already exists - skipping creation")
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=certificate_request.knowledge_path.author,
        actor_content_type=requester_ct,
        actor_object_id=certificate_request.requester.id,
        verb='requested a certificate for your knowledge path',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.requester.username} requested a certificate for your knowledge path "{certificate_request.knowledge_path.title}"'
    )
    print("Notification created successfully")
    
    # Verify the notification was created
    if notification:
        print(f"Verified notification exists with ID: {notification.id}")
        print(f"Notification details:")
        print(f"- Recipient: {notification.recipient.username}")
        print(f"- Actor: {notification.actor.username}")
        print(f"- Verb: {notification.verb}")
        print(f"- Timestamp: {notification.timestamp}")
        print(f"- Unread: {notification.unread}")
        print(f"- Target: {notification.target}")
        print(f"- Target Content Type: {notification.target_content_type}")
        print(f"- Target Object ID: {notification.target_object_id}")
    else:
        print("WARNING: Notification not found in database after creation!")
    
    print("=== End Notification Creation ===\n")

def notify_certificate_approval(certificate_request):
    """
    Create a notification when a certificate request is approved.
    Notifies the student who requested the certificate.
    
    Args:
        certificate_request: The CertificateRequest instance that was approved
    """
    print("\n=== Creating Certificate Approval Notification ===")
    print(f"Student: {certificate_request.requester.username}")
    print(f"Knowledge Path ID: {certificate_request.knowledge_path.id}")
    print(f"Knowledge Path Title: {certificate_request.knowledge_path.title}")
    print(f"Approver: {certificate_request.knowledge_path.author.username}")
    
    # Get content types
    approver_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path.author)
    knowledge_path_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path)
    print(f"Approver Content Type: {approver_ct}")
    print(f"Knowledge Path Content Type: {knowledge_path_ct}")
    
    # Check if notification already exists
    existing_notifications = Notification.objects.filter(
        recipient=certificate_request.requester,
        actor_content_type=approver_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='approved your certificate request for',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id
    )
    print(f"Existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        print("Notification already exists - skipping creation")
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=certificate_request.requester,
        actor_content_type=approver_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='approved your certificate request for',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.knowledge_path.author.username} approved your certificate request for "{certificate_request.knowledge_path.title}"'
    )
    print("Notification created successfully")
    
    # Verify the notification was created
    if notification:
        print(f"Verified notification exists with ID: {notification.id}")
        print(f"Notification details:")
        print(f"- Recipient: {notification.recipient.username}")
        print(f"- Actor: {notification.actor.username}")
        print(f"- Verb: {notification.verb}")
        print(f"- Timestamp: {notification.timestamp}")
        print(f"- Unread: {notification.unread}")
        print(f"- Target: {notification.target}")
        print(f"- Target Content Type: {notification.target_content_type}")
        print(f"- Target Object ID: {notification.target_object_id}")
    else:
        print("WARNING: Notification not found in database after creation!")
    
    print("=== End Notification Creation ===\n")

def notify_certificate_rejection(certificate_request):
    """
    Create a notification when a certificate request is rejected.
    Notifies the student who requested the certificate.
    
    Args:
        certificate_request: The CertificateRequest instance that was rejected
    """
    print("\n=== Creating Certificate Rejection Notification ===")
    print(f"Student: {certificate_request.requester.username}")
    print(f"Knowledge Path ID: {certificate_request.knowledge_path.id}")
    print(f"Knowledge Path Title: {certificate_request.knowledge_path.title}")
    print(f"Rejector: {certificate_request.knowledge_path.author.username}")
    
    # Get content types
    rejector_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path.author)
    knowledge_path_ct = ContentType.objects.get_for_model(certificate_request.knowledge_path)
    print(f"Rejector Content Type: {rejector_ct}")
    print(f"Knowledge Path Content Type: {knowledge_path_ct}")
    
    # Check if notification already exists
    existing_notifications = Notification.objects.filter(
        recipient=certificate_request.requester,
        actor_content_type=rejector_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='rejected your certificate request for',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id
    )
    print(f"Existing notifications count: {existing_notifications.count()}")
    
    if existing_notifications.exists():
        print("Notification already exists - skipping creation")
        return
    
    # Create the notification
    notification = Notification.objects.create(
        recipient=certificate_request.requester,
        actor_content_type=rejector_ct,
        actor_object_id=certificate_request.knowledge_path.author.id,
        verb='rejected your certificate request for',
        target_content_type=knowledge_path_ct,
        target_object_id=certificate_request.knowledge_path.id,
        description=f'{certificate_request.knowledge_path.author.username} rejected your certificate request for "{certificate_request.knowledge_path.title}"'
    )
    print("Notification created successfully")
    
    # Verify the notification was created
    if notification:
        print(f"Verified notification exists with ID: {notification.id}")
        print(f"Notification details:")
        print(f"- Recipient: {notification.recipient.username}")
        print(f"- Actor: {notification.actor.username}")
        print(f"- Verb: {notification.verb}")
        print(f"- Timestamp: {notification.timestamp}")
        print(f"- Unread: {notification.unread}")
        print(f"- Target: {notification.target}")
        print(f"- Target Content Type: {notification.target_content_type}")
        print(f"- Target Object ID: {notification.target_object_id}")
    else:
        print("WARNING: Notification not found in database after creation!")
    
    print("=== End Notification Creation ===\n")

def notify_content_upvote(vote):
    """
    Create a notification when someone upvotes content.
    Notifies the content owner (uploaded_by user).
    
    Args:
        vote: The Vote instance that was created/updated
    """
    print("\n=== Creating Content Upvote Notification ===")
    print(f"Vote ID: {vote.id}")
    print(f"Voter: {vote.user.username}")
    print(f"Content Type: {vote.content_type.model}")
    print(f"Object ID: {vote.object_id}")
    
    try:
        # Get the content object
        content = vote.content_object
        if not content:
            print("Content object not found - skipping notification")
            return
            
        print(f"Content ID: {content.id}")
        print(f"Content Title: {content.original_title}")
        print(f"Content Owner: {content.uploaded_by.username if content.uploaded_by else 'None'}")
        
        # Don't notify if user upvotes their own content
        if vote.user == content.uploaded_by:
            print("User is upvoting their own content - skipping notification")
            return
            
        # Don't notify if content has no owner
        if not content.uploaded_by:
            print("Content has no owner - skipping notification")
            return
            
        # Get content types for debugging
        voter_ct = ContentType.objects.get_for_model(vote.user)
        content_ct = ContentType.objects.get_for_model(content)
        print(f"Voter Content Type: {voter_ct}")
        print(f"Content Content Type: {content_ct}")
        
        # Check if notification already exists for this specific vote
        existing_notifications = Notification.objects.filter(
            recipient=content.uploaded_by,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='upvoted your content',
            target_content_type=content_ct,
            target_object_id=content.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=content.uploaded_by,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='upvoted your content',
            target_content_type=content_ct,
            target_object_id=content.id,
            description=f'{vote.user.username} upvoted your content "{content.original_title}"'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n")

def notify_knowledge_path_upvote(vote):
    """
    Create a notification when someone upvotes a knowledge path.
    Notifies the knowledge path author.
    
    Args:
        vote: The Vote instance that was created/updated
    """
    print("\n=== Creating Knowledge Path Upvote Notification ===")
    print(f"Vote ID: {vote.id}")
    print(f"Voter: {vote.user.username}")
    print(f"Content Type: {vote.content_type.model}")
    print(f"Object ID: {vote.object_id}")
    
    try:
        # Get the knowledge path object
        knowledge_path = vote.content_object
        if not knowledge_path:
            print("Knowledge path object not found - skipping notification")
            return
            
        print(f"Knowledge Path ID: {knowledge_path.id}")
        print(f"Knowledge Path Title: {knowledge_path.title}")
        print(f"Knowledge Path Author: {knowledge_path.author.username if knowledge_path.author else 'None'}")
        
        # Don't notify if user upvotes their own knowledge path
        if vote.user == knowledge_path.author:
            print("User is upvoting their own knowledge path - skipping notification")
            return
            
        # Don't notify if knowledge path has no author
        if not knowledge_path.author:
            print("Knowledge path has no author - skipping notification")
            return
            
        # Get content types for debugging
        voter_ct = ContentType.objects.get_for_model(vote.user)
        knowledge_path_ct = ContentType.objects.get_for_model(knowledge_path)
        print(f"Voter Content Type: {voter_ct}")
        print(f"Knowledge Path Content Type: {knowledge_path_ct}")
        
        # Check if notification already exists for this specific vote
        existing_notifications = Notification.objects.filter(
            recipient=knowledge_path.author,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='upvoted your knowledge path',
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=knowledge_path.author,
            actor_content_type=voter_ct,
            actor_object_id=vote.user.id,
            verb='upvoted your knowledge path',
            target_content_type=knowledge_path_ct,
            target_object_id=knowledge_path.id,
            description=f'{vote.user.username} upvoted your knowledge path "{knowledge_path.title}"'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n")

def notify_event_registration(registration):
    """
    Create a notification when someone registers for an event.
    Notifies the event creator.
    
    Args:
        registration: The EventRegistration instance that was created
    """
    print("\n=== Creating Event Registration Notification ===")
    print(f"Registration ID: {registration.id}")
    print(f"Registrant: {registration.user.username}")
    print(f"Event ID: {registration.event.id}")
    print(f"Event Title: {registration.event.title}")
    print(f"Event Creator: {registration.event.owner.username if registration.event.owner else 'None'}")
    
    # Don't notify if registrant is the event creator
    if registration.user == registration.event.owner:
        print("User is registering for their own event - skipping notification")
        return
        
    # Don't notify if event has no owner
    if not registration.event.owner:
        print("Event has no owner - skipping notification")
        return
        
    try:
        # Get content types for debugging
        registrant_ct = ContentType.objects.get_for_model(registration.user)
        event_ct = ContentType.objects.get_for_model(registration.event)
        print(f"Registrant Content Type: {registrant_ct}")
        print(f"Event Content Type: {event_ct}")
        
        # Check if notification already exists for this specific registration
        existing_notifications = Notification.objects.filter(
            recipient=registration.event.owner,
            actor_content_type=registrant_ct,
            actor_object_id=registration.user.id,
            verb='registered for your event',
            target_content_type=event_ct,
            target_object_id=registration.event.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=registration.event.owner,
            actor_content_type=registrant_ct,
            actor_object_id=registration.user.id,
            verb='registered for your event',
            target_content_type=event_ct,
            target_object_id=registration.event.id,
            description=f'{registration.user.username} registered for your event "{registration.event.title}"'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
            print(f"- Target Content Type: {notification.target_content_type}")
            print(f"- Target Object ID: {notification.target_object_id}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n")

def notify_payment_accepted(registration):
    """
    Create a notification when a teacher accepts payment for an event registration.
    Notifies the student who registered.
    
    Args:
        registration: The EventRegistration instance that was updated
    """
    print("\n=== Creating Payment Accepted Notification ===")
    print(f"Registration ID: {registration.id}")
    print(f"Student: {registration.user.username}")
    print(f"Event ID: {registration.event.id}")
    print(f"Event Title: {registration.event.title}")
    print(f"Event Creator: {registration.event.owner.username if registration.event.owner else 'None'}")
    
    # Don't notify if student is the event creator
    if registration.user == registration.event.owner:
        print("Student is the event creator - skipping notification")
        return
        
    # Don't notify if event has no owner
    if not registration.event.owner:
        print("Event has no owner - skipping notification")
        return
        
    try:
        # Get content types for debugging
        teacher_ct = ContentType.objects.get_for_model(registration.event.owner)
        event_ct = ContentType.objects.get_for_model(registration.event)
        print(f"Teacher Content Type: {teacher_ct}")
        print(f"Event Content Type: {event_ct}")
        
        # Check if notification already exists for this specific payment acceptance
        existing_notifications = Notification.objects.filter(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='accepted your payment for',
            target_content_type=event_ct,
            target_object_id=registration.event.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='accepted your payment for',
            target_content_type=event_ct,
            target_object_id=registration.event.id,
            description=f'{registration.event.owner.username} accepted your payment for "{registration.event.title}"'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
            print(f"- Target Content Type: {notification.target_content_type}")
            print(f"- Target Object ID: {notification.target_object_id}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n")

def notify_certificate_sent(registration):
    """
    Create a notification when a teacher sends a certificate for an event.
    Notifies the student who registered.
    
    Args:
        registration: The EventRegistration instance that was updated
    """
    print("\n=== Creating Certificate Sent Notification ===")
    print(f"Registration ID: {registration.id}")
    print(f"Student: {registration.user.username}")
    print(f"Event ID: {registration.event.id}")
    print(f"Event Title: {registration.event.title}")
    print(f"Event Creator: {registration.event.owner.username if registration.event.owner else 'None'}")
    
    # Don't notify if student is the event creator
    if registration.user == registration.event.owner:
        print("Student is the event creator - skipping notification")
        return
        
    # Don't notify if event has no owner
    if not registration.event.owner:
        print("Event has no owner - skipping notification")
        return
        
    try:
        # Get content types for debugging
        teacher_ct = ContentType.objects.get_for_model(registration.event.owner)
        event_ct = ContentType.objects.get_for_model(registration.event)
        print(f"Teacher Content Type: {teacher_ct}")
        print(f"Event Content Type: {event_ct}")
        
        # Check if notification already exists for this specific certificate sending
        existing_notifications = Notification.objects.filter(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='sent you a certificate for',
            target_content_type=event_ct,
            target_object_id=registration.event.id
        )
        print(f"Existing notifications count: {existing_notifications.count()}")
        
        if existing_notifications.exists():
            print("Notification already exists - skipping creation")
            return
        
        # Create the notification
        notification = Notification.objects.create(
            recipient=registration.user,
            actor_content_type=teacher_ct,
            actor_object_id=registration.event.owner.id,
            verb='sent you a certificate for',
            target_content_type=event_ct,
            target_object_id=registration.event.id,
            description=f'{registration.event.owner.username} sent you a certificate for "{registration.event.title}"'
        )
        print("Notification created successfully")
        
        # Verify the notification was created
        if notification:
            print(f"Verified notification exists with ID: {notification.id}")
            print(f"Notification details:")
            print(f"- Recipient: {notification.recipient.username}")
            print(f"- Actor: {notification.actor.username}")
            print(f"- Verb: {notification.verb}")
            print(f"- Timestamp: {notification.timestamp}")
            print(f"- Unread: {notification.unread}")
            print(f"- Target: {notification.target}")
            print(f"- Target Content Type: {notification.target_content_type}")
            print(f"- Target Object ID: {notification.target_object_id}")
        else:
            print("WARNING: Notification not found in database after creation!")
            
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
    
    print("=== End Notification Creation ===\n") 