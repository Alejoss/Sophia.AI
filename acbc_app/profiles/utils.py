import pytz
import logging

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.sites.shortcuts import get_current_site
from django.utils.http import urlsafe_base64_encode
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes

from profiles.email_service import EmailService, EmailServiceError

logger = logging.getLogger('app_logger')


def send_email_message(receiver_email, subject, message):
    """
    Legacy function for sending plain text emails.
    
    This function is maintained for backward compatibility.
    For new code, use EmailService directly.
    
    Args:
        receiver_email: Recipient email address
        subject: Email subject
        message: Plain text message content
        
    Returns:
        Response object from Mailgun API (for backward compatibility)
        
    Note:
        This function now uses EmailService internally.
        Returns None if email sending is disabled or fails.
    """
    try:
        success = EmailService.send_email(
            receiver_email=receiver_email,
            subject=subject,
            text_message=message
        )
        # Return a mock response object for backward compatibility
        if success:
            class MockResponse:
                status_code = 200
            return MockResponse()
        return None
    except EmailServiceError as e:
        logger.error(f"Error in send_email_message: {str(e)}")
        # Return None on error for backward compatibility
        return None


def academia_blockchain_timezones():
    # Timezones for the user to select in profile edit form
    tz_list = []
    for tz in pytz.all_timezones:
        if tz.startswith("America"):
            tz_list.append(tz)
        elif tz.startswith("Europe"):
            tz_list.append(tz)
    return tz_list


def send_confirmation_email(request, user, user_email):
    """
    Sends an account confirmation email to the newly registered user. The email includes
    a unique token and user ID for account activation.

    Args:
        request: HttpRequest object containing metadata about the request.
        user: The user object representing the newly registered user.
        user_email: The email address to which the confirmation email will be sent.
    """
    # Generate an activation token for the user
    activation_token = PasswordResetTokenGenerator().make_token(user)
    logger.debug(f"activation_token: {activation_token}")

    # Get the current site's domain for building activation URLs
    current_site = get_current_site(request)

    # Encode the user's primary key in a URL-safe base64 format
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    logger.debug(f"uid: {uid}")

    # Render the email message template with the necessary context
    message = render_to_string('profiles/email_confirm_account.html', {
        'username': user.username,
        'uid': uid,
        'token': activation_token,
        'domain': current_site
    })

    # Send the email using EmailService
    try:
        EmailService.send_email(
            receiver_email=user_email,
            subject="Activate your account",  # Translated from "Activa tu cuenta"
            html_message=message,  # The template already renders HTML
            text_message=None  # Will be auto-generated from HTML if needed
        )
    except EmailServiceError as e:
        logger.error(f"Error sending confirmation email to {user_email}: {str(e)}", exc_info=True)
        # Fallback to legacy method for backward compatibility
        from profiles.utils import send_email_message
        send_email_message(
            subject="Activate your account",
            message=message,
            receiver_email=user_email
        )

    # Log information for debugging purposes
    logger.warning(f"current_site: {current_site}")
    logger.warning(f"uid: {uid}")
    logger.warning(f"activation_token: {activation_token}")
