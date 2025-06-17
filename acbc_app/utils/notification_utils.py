"""
Utility functions for handling notifications across the application.
"""
from notifications.signals import notify
from django.contrib.contenttypes.models import ContentType
from notifications.models import Notification
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
                actor=comment.author,
                verb='replied to',
                action_object_content_type=comment_ct,
                action_object_object_id=comment.id
            )
            print(f"Existing notifications count: {existing_notifications.count()}")
            
            # Send the notification
            notify.send(
                sender=comment.author,
                recipient=comment.parent.author,
                verb='replied to',
                action_object=comment,
                target=comment.parent
            )
            print("Notification created successfully")
            
            # Verify the notification was created
            notification = Notification.objects.filter(
                recipient=comment.parent.author,
                actor=comment.author,
                verb='replied to',
                action_object_content_type=comment_ct,
                action_object_object_id=comment.id
            ).first()
            
            if notification:
                print(f"Verified notification exists with ID: {notification.id}")
                print(f"Notification details:")
                print(f"- Recipient: {notification.recipient.username}")
                print(f"- Actor: {notification.actor.username}")
                print(f"- Verb: {notification.verb}")
                print(f"- Timestamp: {notification.timestamp}")
                print(f"- Unread: {notification.unread}")
            else:
                print("WARNING: Notification not found in database after creation!")
                
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
            print("Full traceback:")
            print(traceback.format_exc())
    else:
        print("No parent comment found - skipping notification")
    
    print("=== End Notification Creation ===\n")

def notify_comment_reply(reply_comment):
    """
    Send notification to parent comment author when someone replies to their comment.
    
    Args:
        reply_comment: The Comment instance that is the reply
    """
    if not reply_comment.parent:
        return
        
    # Don't notify if user replies to their own comment
    if reply_comment.author == reply_comment.parent.author:
        return
        
    notify.send(
        sender=reply_comment.author,
        recipient=reply_comment.parent.author,
        verb='replied to',
        action_object=reply_comment,
        target=reply_comment.parent,
        description=f'{reply_comment.author.username} replied to your comment'
    ) 