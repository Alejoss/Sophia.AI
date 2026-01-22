"""
Email service for sending emails via Mailgun API.
Provides a robust, production-ready email sending service with proper error handling,
validation, and logging.
"""
import logging
import requests
from typing import List, Optional, Dict, Any
from django.core.validators import validate_email, ValidationError
from django.conf import settings
from django.contrib.auth.models import User
from django.template.loader import render_to_string

logger = logging.getLogger('app_logger')


class EmailServiceError(Exception):
    """Custom exception for email service errors."""
    pass


class EmailConfigurationError(EmailServiceError):
    """Raised when email configuration is invalid or missing."""
    pass


class EmailValidationError(EmailServiceError):
    """Raised when email address validation fails."""
    pass


class EmailService:
    """
    Service class for sending emails via Mailgun API.
    
    Features:
    - Configuration validation
    - Email address validation
    - Respects SEND_EMAILS setting
    - Timeout handling
    - Structured logging
    - HTML and plain text support
    - Error handling with specific exceptions
    """
    
    @staticmethod
    def _validate_configuration() -> None:
        """
        Validate that email configuration is properly set up.
        
        Raises:
            EmailConfigurationError: If configuration is invalid
        """
        if not settings.MAILGUN_DOMAIN:
            raise EmailConfigurationError("MAILGUN_DOMAIN is not configured")
        
        if not settings.MAILGUN_API_KEY:
            raise EmailConfigurationError("MAILGUN_API_KEY is not configured")
    
    @staticmethod
    def _validate_email(email: str) -> None:
        """
        Validate email address format.
        
        Args:
            email: Email address to validate
            
        Raises:
            EmailValidationError: If email format is invalid
        """
        try:
            validate_email(email)
        except ValidationError as e:
            raise EmailValidationError(f"Invalid email address: {email}") from e
    
    @staticmethod
    def _is_email_enabled() -> bool:
        """
        Check if email sending is enabled.
        
        Returns:
            bool: True if emails should be sent, False otherwise
        """
        return getattr(settings, 'SEND_EMAILS', False)
    
    @staticmethod
    def send_email(
        receiver_email: str,
        subject: str,
        html_message: Optional[str] = None,
        text_message: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> bool:
        """
        Send an email via Mailgun API.
        
        Args:
            receiver_email: Recipient email address
            subject: Email subject
            html_message: HTML content of the email (optional)
            text_message: Plain text content of the email (optional)
            from_email: Sender email address (defaults to EMAIL_FROM setting)
            from_name: Sender name (defaults to EMAIL_FROM_NAME setting)
            tags: List of tags for Mailgun tracking (optional)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
            
        Raises:
            EmailConfigurationError: If configuration is invalid
            EmailValidationError: If email address is invalid
            EmailServiceError: For other email sending errors
        """
        # Check if email sending is enabled
        if not EmailService._is_email_enabled():
            logger.info(
                f"Email sending is disabled (SEND_EMAILS=False). "
                f"Would send email to {receiver_email} with subject: {subject}"
            )
            return False
        
        # Validate configuration
        try:
            EmailService._validate_configuration()
        except EmailConfigurationError as e:
            logger.error(f"Email configuration error: {str(e)}")
            raise
        
        # Validate email addresses
        try:
            EmailService._validate_email(receiver_email)
            if from_email:
                EmailService._validate_email(from_email)
        except EmailValidationError as e:
            logger.error(f"Email validation error: {str(e)}")
            raise
        
        # Ensure at least one message format is provided
        if not html_message and not text_message:
            raise EmailServiceError("Either html_message or text_message must be provided")
        
        # Set defaults
        from_email = from_email or getattr(settings, 'EMAIL_FROM', 'academiablockchain@no-reply.com')
        from_name = from_name or getattr(settings, 'EMAIL_FROM_NAME', 'Academia Blockchain')
        from_address = f"{from_name} <{from_email}>"
        
        # Prepare Mailgun API request
        domain_name = settings.MAILGUN_DOMAIN
        api_key = settings.MAILGUN_API_KEY
        timeout = getattr(settings, 'EMAIL_TIMEOUT', 10)
        
        url = f"https://api.mailgun.net/v3/{domain_name}/messages"
        
        data = {
            "from": from_address,
            "to": [receiver_email],
            "subject": subject,
        }
        
        if html_message:
            data["html"] = html_message
        if text_message:
            data["text"] = text_message
        if tags:
            data["o:tag"] = tags
        
        # Send email with timeout
        try:
            logger.info(f"Sending email to {receiver_email} with subject: {subject}")
            response = requests.post(
                url,
                auth=("api", api_key),
                data=data,
                timeout=timeout
            )
            
            # Check response status
            if response.status_code == 200:
                logger.info(f"Email sent successfully to {receiver_email}")
                return True
            else:
                error_msg = (
                    f"Mailgun API error: Status {response.status_code}, "
                    f"Response: {response.text}"
                )
                logger.error(error_msg)
                raise EmailServiceError(error_msg)
                
        except requests.exceptions.Timeout:
            error_msg = f"Email sending timeout after {timeout} seconds to {receiver_email}"
            logger.error(error_msg)
            raise EmailServiceError(error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"Email sending request error to {receiver_email}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise EmailServiceError(error_msg) from e
    
    @staticmethod
    def send_template_email(
        receiver_email: str,
        subject: str,
        template_name: str,
        context: Dict[str, Any],
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> bool:
        """
        Send an email using a Django template.
        
        Args:
            receiver_email: Recipient email address
            subject: Email subject
            template_name: Name of the template (without .html extension)
            context: Context dictionary for template rendering
            from_email: Sender email address (optional)
            from_name: Sender name (optional)
            tags: List of tags for Mailgun tracking (optional)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        try:
            # Render HTML template
            html_template = f"profiles/emails/{template_name}.html"
            html_message = render_to_string(html_template, context)
            
            # Render text template if it exists, otherwise use HTML stripped
            text_template = f"profiles/emails/{template_name}.txt"
            try:
                text_message = render_to_string(text_template, context)
            except Exception:
                # If text template doesn't exist, create a simple text version
                import re
                from html import unescape
                # Remove HTML tags and decode entities
                text_message = re.sub(r'<[^>]+>', '', html_message)
                text_message = unescape(text_message).strip()
            
            return EmailService.send_email(
                receiver_email=receiver_email,
                subject=subject,
                html_message=html_message,
                text_message=text_message,
                from_email=from_email,
                from_name=from_name,
                tags=tags,
            )
        except Exception as e:
            logger.error(
                f"Error rendering email template {template_name} for {receiver_email}: {str(e)}",
                exc_info=True
            )
            raise EmailServiceError(f"Template rendering error: {str(e)}") from e
    
    @staticmethod
    def get_admin_emails() -> List[str]:
        """
        Get list of administrator email addresses.
        
        Checks ADMIN_EMAIL setting first, then falls back to staff users.
        
        Returns:
            List[str]: List of admin email addresses
        """
        admin_emails = []
        
        # Check ADMIN_EMAIL setting
        admin_email = getattr(settings, 'ADMIN_EMAIL', '')
        if admin_email:
            try:
                EmailService._validate_email(admin_email)
                admin_emails.append(admin_email)
            except EmailValidationError:
                logger.warning(f"Invalid ADMIN_EMAIL setting: {admin_email}")
        
        # Get emails from staff users
        try:
            staff_users = User.objects.filter(is_staff=True, is_active=True)
            for staff_user in staff_users:
                if staff_user.email:
                    try:
                        EmailService._validate_email(staff_user.email)
                        admin_emails.append(staff_user.email)
                    except EmailValidationError:
                        logger.warning(
                            f"Invalid email for staff user {staff_user.username}: {staff_user.email}"
                        )
        except Exception as e:
            logger.error(f"Error fetching staff user emails: {str(e)}", exc_info=True)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_emails = []
        for email in admin_emails:
            if email.lower() not in seen:
                seen.add(email.lower())
                unique_emails.append(email)
        
        return unique_emails
    
    @staticmethod
    def send_to_admins(
        subject: str,
        html_message: Optional[str] = None,
        text_message: Optional[str] = None,
        template_name: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Send email to all administrators.
        
        Args:
            subject: Email subject
            html_message: HTML content (optional, ignored if template_name is provided)
            text_message: Plain text content (optional, ignored if template_name is provided)
            template_name: Name of template to use (optional, takes precedence over html/text)
            context: Context dictionary for template (required if template_name is provided)
            from_email: Sender email (optional)
            from_name: Sender name (optional)
            tags: List of tags (optional)
            
        Returns:
            Dict with 'sent' (list of successful emails) and 'failed' (list of failed emails)
        """
        admin_emails = EmailService.get_admin_emails()
        
        if not admin_emails:
            logger.warning("No admin emails found to send notification")
            return {'sent': [], 'failed': []}
        
        results = {'sent': [], 'failed': []}
        
        # If template is provided, use it; otherwise use html/text messages
        if template_name and context:
            # Use template for all admins
            for admin_email in admin_emails:
                try:
                    success = EmailService.send_template_email(
                        receiver_email=admin_email,
                        subject=subject,
                        template_name=template_name,
                        context=context,
                        from_email=from_email,
                        from_name=from_name,
                        tags=tags,
                    )
                    if success:
                        results['sent'].append(admin_email)
                    else:
                        results['failed'].append(admin_email)
                except Exception as e:
                    logger.error(
                        f"Failed to send email to admin {admin_email}: {str(e)}",
                        exc_info=True
                    )
                    results['failed'].append(admin_email)
        else:
            # Use direct html/text messages
            for admin_email in admin_emails:
                try:
                    success = EmailService.send_email(
                        receiver_email=admin_email,
                        subject=subject,
                        html_message=html_message,
                        text_message=text_message,
                        from_email=from_email,
                        from_name=from_name,
                        tags=tags,
                    )
                    if success:
                        results['sent'].append(admin_email)
                    else:
                        results['failed'].append(admin_email)
                except Exception as e:
                    logger.error(
                        f"Failed to send email to admin {admin_email}: {str(e)}",
                        exc_info=True
                    )
                    results['failed'].append(admin_email)
        
        logger.info(
            f"Email notification sent to {len(results['sent'])} admins, "
            f"failed for {len(results['failed'])} admins"
        )
        
        return results
