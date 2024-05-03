import pytz
import logging
import requests

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.sites.shortcuts import get_current_site
from django.utils.http import urlsafe_base64_encode
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm, UsernameField, \
    PasswordResetForm, SetPasswordForm
from django.contrib.auth.models import User
from django.contrib.auth import password_validation
from django import forms
from django.conf import settings
from django.template import loader

from profiles.models import Profile
from courses.models import Certificate

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


class AcademiaUserCreationForm(UserCreationForm):
    """
    A custom form for creating new users that modifies the Django UserCreationForm to change field labels
    and placeholders to the desired language and style.
    """

    class Meta:
        model = User
        fields = ('username', 'email')
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'form-control border',
                'id': 'username',
                'name': 'username',
                'placeholder': "Username"  # Placeholder text in Spanish: "Username"
            }),
            'email': forms.TextInput(attrs={
                'class': 'form-control border',
                'id': 'email',
                'name': 'email',
                'placeholder': "Email"  # Placeholder text in Spanish: "Email"
            })
        }


class AcademiaLoginForm(AuthenticationForm):
    """
    A custom login form that modifies the Django AuthenticationForm to adjust field labels and
    placeholders for the desired language and style.
    """

    # Field for username with a custom widget for autofocus and styling
    username = UsernameField(widget=forms.TextInput(attrs={
        'autofocus': True,
        'class': 'form-control border',
        'id': 'username',
        'name': 'username',
        'placeholder': "Username"  # Placeholder text in Spanish: "Username"
    }))

    # Field for password with a custom widget for styling and label translation
    password = forms.CharField(
        label="Password",  # Label text in Spanish: "Password"
        strip=False,
        widget=forms.PasswordInput(attrs={
            'autocomplete': 'current-password',
            'class': 'form-control border',
            'id': 'email',
            'name': 'email',
            'placeholder': "Password"  # Placeholder text in Spanish: "Password"
        }),
    )


# Custom ModelForm for Profile Picture management
class ProfilePictureForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ["profile_picture"]
        labels = {
            'profile_picture': "Imagen de Perfil"
        }


class AcademiaPasswordResetForm(PasswordResetForm):
    """
    Custom password reset form that overrides the send_mail method to integrate with the Mailgun configuration.
    """

    def send_mail(self, subject_template_name, email_template_name,
                  context, from_email, to_email, html_email_template_name=None):
        """
        Sends an email using a custom email sending function integrated with Mailgun.

        Args:
            subject_template_name: Template for the email subject (not used in this version).
            email_template_name: Template for the email body.
            context: Context data for rendering the email templates.
            from_email: The sender's email address (not used in this version).
            to_email: The recipient's email address.
            html_email_template_name: Optional template for HTML email content.
        """

        # Render the email body template with the provided context
        body = loader.render_to_string(email_template_name, context)

        # Log that the email is being sent (for debugging purposes)
        logger.warning("EMAIL SENT")

        # Send the email using the custom email sending function
        send_email_message(
            receiver_email=to_email,
            subject="RESET YOUR PASSWORD - Blockchain Academy",
            message=body
        )


class AcademiaSetPasswordForm(SetPasswordForm):
    """
    A custom form for setting a new password that modifies the Django SetPasswordForm
    to include translated labels and custom widget attributes for password fields.
    """

    # First new password field with a label and help text in English
    new_password1 = forms.CharField(
        label="New Password",
        widget=forms.PasswordInput(attrs={
            'autocomplete': 'new-password',
            'class': 'form-control'
        }),
        strip=False,
        help_text=password_validation.password_validators_help_text_html(),
    )

    # Second password confirmation field
    new_password2 = forms.CharField(
        label="Confirm Password",
        strip=False,
        widget=forms.PasswordInput(attrs={
            'autocomplete': 'new-password',
            'class': 'form-control'
        }),
    )


def academia_blockchain_timezones():
    # Timezones for the user to select in profile edit form
    tz_list = []
    for tz in pytz.all_timezones:
        if tz.startswith("America"):
            tz_list.append(tz)
        elif tz.startswith("Europe"):
            tz_list.append(tz)
    return tz_list


def get_cryptos_string(profile):
    # This logic could go on the frontend. Creates a string with the accepted cryptos of a user
    c_list = profile.cryptos_list()
    logger.debug("c_list: %s" % c_list)
    cryptos_string = ""
    for c in c_list:
        cryptos_string += (c.crypto.code + ", ")
    if len(cryptos_string) > 2:
        cryptos_string = cryptos_string[:-2]

    return cryptos_string


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


def get_user_diamonds(user, certificates=None):
    """
    Calculates the number of diamonds (points or rewards) a user has based on their certificates.
    The certificates are filtered by event type to determine different categories of diamonds.

    Args:
        user: The user whose diamonds are to be calculated.
        certificates: An optional queryset of Certificate objects to consider for calculation. If not provided,
                      it defaults to fetching all non-deleted certificates for the user.

    Returns:
        A dictionary with the count of diamonds for each category:
        - 'green_diamonds': Diamonds for 'EVENT' type certificates
        - 'yellow_diamonds': Diamonds for 'LIVE_COURSE' type certificates
        - 'magenta_diamonds': Diamonds for 'PRE_RECORDED' type certificates
        - 'blue_diamonds': Diamonds for 'EXAM' type certificates
    """
    if not certificates:
        certificates = Certificate.objects.filter(user=user, deleted=False)

    # Count diamonds based on event type
    green_diamonds = certificates.filter(event__event_type="EVENT").count()
    yellow_diamonds = certificates.filter(event__event_type="LIVE_COURSE").count()
    magenta_diamonds = certificates.filter(event__event_type="PRE_RECORDED").count()
    blue_diamonds = certificates.filter(event__event_type="EXAM").count()

    # Log the counts for debugging and monitoring
    logger.debug(f"certificates: {certificates}")
    logger.debug(f"green_diamonds: {green_diamonds}")
    logger.debug(f"yellow_diamonds: {yellow_diamonds}")
    logger.debug(f"magenta_diamonds: {magenta_diamonds}")
    logger.debug(f"blue_diamonds: {blue_diamonds}")

    # Return the diamond counts in a structured dictionary
    return {
        "green_diamonds": green_diamonds,
        "yellow_diamonds": yellow_diamonds,
        "magenta_diamonds": magenta_diamonds,
        "blue_diamonds": blue_diamonds
    }
