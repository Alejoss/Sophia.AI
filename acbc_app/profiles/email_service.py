"""
Email service for sending emails via Django's email backend (Postmark when enabled).
Uses postmarker.django.EmailBackend when SEND_EMAILS=True and POSTMARK_SERVER_TOKEN is set.
Provides validation, SEND_EMAILS check, and logging.
"""
import logging
from typing import List, Optional, Dict, Any
from django.core.validators import validate_email, ValidationError
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
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
    Service class for sending emails via Django's email backend.
    When SEND_EMAILS=True, the backend is Postmark (postmarker.django.EmailBackend).

    Features:
    - Respects SEND_EMAILS setting
    - Configuration validation (Postmark token when enabled)
    - Email address validation
    - HTML and plain text support
    - Optional Postmark tags via PostmarkEmailMessage when available
    """

    @staticmethod
    def _validate_configuration() -> None:
        """
        Validate that email configuration is properly set up for sending.
        When SEND_EMAILS is True, POSTMARK_SERVER_TOKEN must be set (Django already enforces in production).

        Raises:
            EmailConfigurationError: If configuration is invalid
        """
        if not EmailService._is_email_enabled():
            return
        postmark_config = getattr(settings, 'POSTMARK', {})
        token = postmark_config.get('TOKEN', '') if isinstance(postmark_config, dict) else ''
        if not token:
            raise EmailConfigurationError(
                "POSTMARK_SERVER_TOKEN is not set. Set it in .env when SEND_EMAILS=true."
            )

    @staticmethod
    def _validate_email(email: str) -> None:
        """
        Validate email address format.

        Raises:
            EmailValidationError: If email format is invalid
        """
        try:
            validate_email(email)
        except ValidationError as e:
            raise EmailValidationError(f"Invalid email address: {email}") from e

    @staticmethod
    def _is_email_enabled() -> bool:
        """Return True if email sending is enabled (SEND_EMAILS=true)."""
        return getattr(settings, 'SEND_EMAILS', False)

    @staticmethod
    def _build_from_address(from_email: Optional[str] = None, from_name: Optional[str] = None) -> str:
        """Build 'Name <email>' from address."""
        from_email = from_email or getattr(settings, 'EMAIL_FROM', 'academiablockchain@no-reply.com')
        from_name = from_name or getattr(settings, 'EMAIL_FROM_NAME', 'Academia Blockchain')
        return f"{from_name} <{from_email}>"

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
        Send an email via Django's email backend (Postmark when SEND_EMAILS=true).

        Args:
            receiver_email: Recipient email address
            subject: Email subject
            html_message: HTML content (optional)
            text_message: Plain text content (optional)
            from_email: Sender email (defaults to EMAIL_FROM)
            from_name: Sender name (defaults to EMAIL_FROM_NAME)
            tags: Optional list of tags for Postmark (used if PostmarkEmailMessage available)

        Returns:
            bool: True if sent successfully, False if SEND_EMAILS is False

        Raises:
            EmailConfigurationError: If Postmark token missing when SEND_EMAILS=True
            EmailValidationError: If email address invalid
            EmailServiceError: For other send errors
        """
        if not EmailService._is_email_enabled():
            logger.info(
                "Email sending is disabled (SEND_EMAILS=False). "
                "Would send email to %s with subject: %s",
                receiver_email, subject
            )
            return False

        EmailService._validate_configuration()
        try:
            EmailService._validate_email(receiver_email)
            if from_email:
                EmailService._validate_email(from_email)
        except EmailValidationError as e:
            logger.error("Email validation error: %s", str(e))
            raise

        if not html_message and not text_message:
            raise EmailServiceError("Either html_message or text_message must be provided")

        text_message = text_message or ""
        from_address = EmailService._build_from_address(from_email, from_name)

        try:
            # Use PostmarkEmailMessage for tags when available and tags requested
            if tags:
                try:
                    from postmarker.django import PostmarkEmailMessage
                    msg = PostmarkEmailMessage(
                        subject=subject,
                        body=text_message,
                        from_email=from_address,
                        to=[receiver_email],
                        tag=tags[0] if tags else None,
                    )
                    if html_message:
                        msg.attach_alternative(html_message, "text/html")
                    msg.send(fail_silently=False)
                except ImportError:
                    # Fallback to standard backend without tags
                    msg = EmailMultiAlternatives(
                        subject=subject,
                        body=text_message,
                        from_email=from_address,
                        to=[receiver_email],
                    )
                    if html_message:
                        msg.attach_alternative(html_message, "text/html")
                    msg.send(fail_silently=False)
            else:
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=text_message,
                    from_email=from_address,
                    to=[receiver_email],
                )
                if html_message:
                    msg.attach_alternative(html_message, "text/html")
                msg.send(fail_silently=False)

            logger.info("Email sent successfully to %s", receiver_email)
            return True
        except Exception as e:
            logger.error("Email send failed to %s: %s", receiver_email, str(e), exc_info=True)
            raise EmailServiceError(f"Email sending failed: {str(e)}") from e

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
        Renders profiles/emails/{template_name}.html and optionally .txt.
        """
        import re
        from html import unescape

        html_template = f"profiles/emails/{template_name}.html"
        html_message = render_to_string(html_template, context)

        try:
            text_template = f"profiles/emails/{template_name}.txt"
            text_message = render_to_string(text_template, context)
        except Exception:
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

    @staticmethod
    def get_admin_emails() -> List[str]:
        """
        Get list of administrator email addresses.
        Uses ADMIN_EMAIL setting first, then staff users.
        """
        admin_emails = []
        admin_email = getattr(settings, 'ADMIN_EMAIL', '')
        if admin_email:
            try:
                EmailService._validate_email(admin_email)
                admin_emails.append(admin_email)
            except EmailValidationError:
                logger.warning("Invalid ADMIN_EMAIL setting: %s", admin_email)

        try:
            for staff_user in User.objects.filter(is_staff=True, is_active=True):
                if staff_user.email:
                    try:
                        EmailService._validate_email(staff_user.email)
                        admin_emails.append(staff_user.email)
                    except EmailValidationError:
                        logger.warning(
                            "Invalid email for staff user %s: %s",
                            staff_user.username, staff_user.email
                        )
        except Exception as e:
            logger.error("Error fetching staff user emails: %s", str(e), exc_info=True)

        seen = set()
        unique = []
        for e in admin_emails:
            key = e.lower()
            if key not in seen:
                seen.add(key)
                unique.append(e)
        return unique

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
        Returns dict with 'sent' and 'failed' lists of email addresses.
        """
        admin_emails = EmailService.get_admin_emails()
        if not admin_emails:
            logger.warning("No admin emails found to send notification")
            return {'sent': [], 'failed': []}

        results = {'sent': [], 'failed': []}
        if template_name and context:
            for admin_email in admin_emails:
                try:
                    if EmailService.send_template_email(
                        receiver_email=admin_email,
                        subject=subject,
                        template_name=template_name,
                        context=context,
                        from_email=from_email,
                        from_name=from_name,
                        tags=tags,
                    ):
                        results['sent'].append(admin_email)
                    else:
                        results['failed'].append(admin_email)
                except Exception as e:
                    logger.error("Failed to send email to admin %s: %s", admin_email, str(e), exc_info=True)
                    results['failed'].append(admin_email)
        else:
            for admin_email in admin_emails:
                try:
                    if EmailService.send_email(
                        receiver_email=admin_email,
                        subject=subject,
                        html_message=html_message,
                        text_message=text_message,
                        from_email=from_email,
                        from_name=from_name,
                        tags=tags,
                    ):
                        results['sent'].append(admin_email)
                    else:
                        results['failed'].append(admin_email)
                except Exception as e:
                    logger.error("Failed to send email to admin %s: %s", admin_email, str(e), exc_info=True)
                    results['failed'].append(admin_email)

        logger.info(
            "Email notification sent to %s admins, failed for %s admins",
            len(results['sent']), len(results['failed'])
        )
        return results
