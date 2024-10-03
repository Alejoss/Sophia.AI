import pytz
import logging
import requests

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.sites.shortcuts import get_current_site
from django.utils.http import urlsafe_base64_encode
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes

from django.conf import settings


logger = logging.getLogger('app_logger')


def send_email_message(receiver_email, subject, message):
    domain_name = settings.MAILGUN_DOMAIN

    return requests.post(
        "https://api.mailgun.net/v3/" + domain_name + "/messages",
        auth=("api", settings.MAILGUN_API_KEY),
        data={"from": "academiablockchain@no-reply.com",
              "to": [receiver_email],
              "subject": subject,
              "text": message})


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

    # Send the email using the custom email sending function
    send_email_message(
        subject="Activate your account",  # Translated from "Activa tu cuenta"
        message=message,
        receiver_email=user_email
    )

    # Log information for debugging purposes
    logger.warning(f"current_site: {current_site}")
    logger.warning(f"uid: {uid}")
    logger.warning(f"activation_token: {activation_token}")
