import logging
from rest_framework_simplejwt.tokens import RefreshToken

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, PasswordResetView, PasswordResetDoneView, \
    PasswordResetConfirmView, PasswordResetCompleteView
from django.contrib.auth import login
from django.urls import reverse_lazy
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.conf import settings

from profiles.utils import AcademiaUserCreationForm, AcademiaLoginForm, ProfilePictureForm, \
    academia_blockchain_timezones, AcademiaPasswordResetForm, \
    AcademiaSetPasswordForm, send_confirmation_email, get_user_diamonds

from profiles.models import Profile, AcceptedCrypto, ContactMethod, CryptoCurrency
from events.models import Event, Bookmark, CertificateRequest, Certificate

logger = logging.getLogger('app_logger')


# Account management
def register_profile(request):
    """
    Handles user registration by displaying a registration form and processing the form data to create
    a new user and their associated profile. Upon successful registration, the user is logged in and sent an
    email confirmation.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Rendered HTML response of either the registration form or the user's profile page, depending on
        the form's validation status and the request method.
    """
    if request.method == "GET":
        # Render the registration form
        template = "profiles/register.html"
        form = AcademiaUserCreationForm()
        context = {"form": form}
        return render(request, template, context)

    elif request.method == "POST":
        # Process the registration form
        form = AcademiaUserCreationForm(request.POST)
        if form.is_valid():
            new_user = form.save()
            logger.debug(f"new_user: {new_user.username}")

            # Create user profile
            new_profile = Profile.objects.create(user=new_user)
            new_profile.email_confirmed = True  # TODO: Remove this, should be activated by email
            new_profile.save()
            logger.debug(f"new_profile: {new_profile}")

            # Create default Accepted Cryptos
            bitcoin, _ = CryptoCurrency.objects.get_or_create(name="Bitcoin", code="BTC")
            ether, _ = CryptoCurrency.objects.get_or_create(name="Ethereum", code="ETH")

            # TODO should create wallets for users by default
            user_bitcoin = AcceptedCrypto.objects.create(user=new_user, crypto=bitcoin)
            user_ether = AcceptedCrypto.objects.create(user=new_user, crypto=ether)

            logger.debug(f"user_bitcoin: {user_bitcoin}")
            logger.debug(f"user_ether: {user_ether}")

            login(request, new_user)
            email = form.cleaned_data['email']

            # Send confirmation email
            if settings.SEND_EMAILS:
                send_confirmation_email(request, new_user, email)

            template = "profiles/profile_data.html"
            context = {'new_profile': new_profile}
            return render(request, template, context)
        else:
            # If form is not valid, re-render the registration form with errors
            template = "profiles/register.html"
            context = {"form": form}
            return render(request, template, context)


def activate_account(request, uid, token):
    """
    Activates a user account if the provided token is valid. This function is typically used in the context of
    email verification after registration.

    Args:
        request: HttpRequest object containing metadata about the request.
        uid: URL-safe base64-encoded user ID.
        token: Token for verifying the user's email address.

    Returns:
        Rendered HTML response indicating whether the activation was successful or not.
    """
    try:
        # Decode the user ID from base64 encoding
        uid = force_str(urlsafe_base64_decode(uid))
        logger.debug(f"uid: {uid}")

        # Retrieve the user by decoded ID
        user = User.objects.get(pk=uid)

        # Check if the token is valid for the given user
        check_token = PasswordResetTokenGenerator().check_token(user, token)
        logger.debug(f"check_token: {check_token}")
    except(TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
        check_token = False

    if user is not None and check_token:
        # If token is valid, confirm the user's email and log them in
        profile = get_object_or_404(Profile, user=user)
        profile.email_confirmed = True
        profile.save()
        login(request, user)

        # Render the activation complete template
        template = "profiles/account_activate_complete.html"
        context = {}
        return render(request, template, context)
    else:
        # If the token is not valid, inform the user
        return HttpResponse('Activation link is invalid!')


class AcademiaLogin(LoginView):
    template_name = "profiles/login.html"
    authentication_form = AcademiaLoginForm


def set_jwt_token(request):
    user = request.user

    # Debug: Check if user is authenticated
    print('User authenticated:', user.is_authenticated)

    if not user.is_authenticated:
        print('User not authenticated, returning error.')
        return JsonResponse({'error': 'User not authenticated'}, status=401)

    # Debug: Log that the tokens are being created
    print('Creating refresh and access tokens for user:', user)
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)

    # Debug: Log the setting of the JWT cookie
    # Define the cookie attributes
    cookie_attributes = {
        'key': 'jwt',
        'value': access_token,
        'httponly': True,
        'secure': False,  # Set to False if testing locally over HTTP
        'samesite': 'Lax',
        'path': '/',
        'max_age': None,  # Can specify max_age if needed
    }

    # Print all the cookie attributes
    print("Cookie attributes:", cookie_attributes)

    # Set the cookie with the specified attributes
    redirect_url = "http://localhost:5173/profiles/login_successful"
    response = HttpResponseRedirect(redirect_url)
    print(f'Redirecting to {redirect_url} with JWT token cookie.')

    response.set_cookie(
        cookie_attributes['key'],
        cookie_attributes['value'],
        httponly=cookie_attributes['httponly'],
        secure=cookie_attributes['secure'],
        samesite=cookie_attributes['samesite'],
        path=cookie_attributes['path'],
        max_age=cookie_attributes['max_age'],
    )

    return response


class AcademiaPasswordResetView(PasswordResetView):
    email_template_name = "profiles/password_reset_email.html"
    template_name = 'profiles/password_reset_form.html'
    form_class = AcademiaPasswordResetForm


class AcademiaPasswordResetDoneView(PasswordResetDoneView):
    template_name = "profiles/email_sent.html"


class AcademiaPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = "profiles/password_reset_confirm.html"
    form_class = AcademiaSetPasswordForm
    success_url = reverse_lazy('password_reset_complete')


class AcademiaPasswordResetCompleteView(PasswordResetCompleteView):
    template_name = "profiles/password_reset_complete.html"


def resend_activation_email(request):
    # TODO Error Anonymous user doesnt have email
    user_email = request.user.email
    if user_email:
        logger.debug("user_email: %s" % user_email)
        send_confirmation_email(request, request.user, user_email)
        template = "profiles/email_sent.html"
        context = {}
        return render(request, template, context)
    else:
        return HttpResponse("email not found")


def content(request):
    # TODO this view should go in app 'content'
    template = "profiles/content.html"
    context = {"content_index_active": "active"}
    return render(request, template, context)


@login_required
def profile_data(request):
    """
    Manages the display and update of user profile data. If the request is a POST, it updates the user's
    profile information with the submitted data. Otherwise, it displays the current profile data.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        If POST, redirects to the profile data page to show updated information.
        If GET, renders the profile data page with the current profile information.
    """
    if request.method == "POST":
        # Retrieve data from POST request
        email = request.POST.get("email")
        first_name = request.POST.get("first_name")
        last_name = request.POST.get("last_name")
        time_zone = request.POST.get("time_zone")
        interests = request.POST.get("interests")
        profile_description = request.POST.get("profile_description")

        # Log the received data
        logger.debug(f"Email: {email}")
        logger.debug(f"First name: {first_name}")
        logger.debug(f"Last name: {last_name}")
        logger.debug(f"Time zone: {time_zone}")
        logger.debug(f"Interests: {interests}")
        logger.debug(f"Profile description: {profile_description}")

        # Update user basic information
        request.user.email = email
        request.user.first_name = first_name
        request.user.last_name = last_name
        request.user.save()

        # Retrieve and update profile specific information
        profile = Profile.objects.get(user=request.user)
        profile.timezone = time_zone
        profile.interests = interests
        profile.profile_description = profile_description
        profile.save()

        # Redirect to the profile data page to display updated information
        return redirect("profile_data")

    else:
        # Prepare to display the profile data page
        template = "profiles/profile_data.html"
        profile, created = Profile.objects.get_or_create(user=request.user)
        if created:
            logger.debug(f"Profile created: {created}")
        logger.debug(f"Profile: {profile}")

        # Additional data for the profile page
        contact_methods = ContactMethod.objects.filter(user=request.user, deleted=False)
        profile_picture_form = ProfilePictureForm()

        context = {
            "profile_index_active": "active", "underline_data": "text-underline",
            "profile": profile, "academia_blockchain_timezones": academia_blockchain_timezones(),
            "contact_methods": contact_methods,
            "profile_picture_form": profile_picture_form
        }

        # Render and return the profile data page
        return render(request, template, context)


@login_required
def user_profile(request, profile_id):
    """
    Displays the profile page for a user, including contact methods, events, and certificates associated with them.
    This view is accessible only to authenticated users.

    Args:
        request: HttpRequest object containing metadata about the request.
        profile_id: The ID of the user whose profile is to be displayed.

    Returns:
        Rendered HTML response of the user's profile page with all associated data.
    """
    template = "profiles/user_profile.html"

    # Retrieve the user's profile or return a 404 error if not found
    profile = get_object_or_404(Profile, user__id=profile_id)

    # Fetch user's contact methods that haven't been deleted
    contact_methods = ContactMethod.objects.filter(user=profile.user, deleted=False)
    logger.debug(f"Contact methods: {contact_methods}")

    # Fetch all events hosted by the user
    events = Event.objects.filter(owner=profile.user)
    logger.debug(f"Events: {events}")

    # Fetch all active certificates owned by the user
    certificates = Certificate.objects.filter(user=profile.user, deleted=False)
    logger.debug(f"Certificates: {certificates}")

    # Compute diamonds or points earned by the user (custom function)
    user_diamonds = get_user_diamonds(request.user, certificates=certificates)

    # Prepare the context with all the necessary data
    context = {
        "profile": profile,
        "events": events,
        "contact_methods": contact_methods,
        "certificates": certificates,
        "user_diamonds": user_diamonds
    }

    # Render and return the user profile page
    return render(request, template, context)


@login_required
def profile_edit_contact_method(request):
    """
    Handles the creation and updating of user contact methods. If accessed via POST, it processes form data
    to update an existing contact method or create a new one. If accessed via GET, it displays the current
    contact methods for editing.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Redirects to the same page to view and manage contact methods after POST.
        Renders the page with contact method details for editing on GET.
    """
    template = "profiles/profile_edit_contact_method.html"

    if request.method == "POST":
        contact_method_id = request.POST.get("contact_method_id")
        contact_method_name = request.POST.get("contact_method_name")
        contact_method_url = request.POST.get("contact_method_url")
        contact_method_description = request.POST.get("contact_method_description")

        logger.debug(f"contact_method_id: {contact_method_id}")
        logger.debug(f"contact_method_name: {contact_method_name}")
        logger.debug(f"contact_method_url: {contact_method_url}")
        logger.debug(f"contact_method_description: {contact_method_description}")

        # frontend sends 0 when the contact method doesnt exist
        if int(contact_method_id) > 0:
            try:
                obj = ContactMethod.objects.get(id=contact_method_id)
            except ContactMethod.DoesNotExist:
                logger.debug(f"contact_method_id not found: {contact_method_id}")
                return HttpResponse("Contact Method not found", status=404)

            obj.name = contact_method_name
            obj.url_link = contact_method_url
            obj.description = contact_method_description
            obj.save()
        else:
            # Otherwise, create a new contact method
            new_contact_method = ContactMethod.objects.create(
                user=request.user,
                name=contact_method_name,
                url_link=contact_method_url,
                description=contact_method_description
            )
            logger.debug(f"new_contact_method: {new_contact_method}")

        return redirect('profile_edit_contact_method')

    else:
        # Retrieve all non-deleted contact methods for the user
        contact_methods = ContactMethod.objects.filter(user=request.user, deleted=False)
        logger.debug(f"contact_methods: {contact_methods}")
        context = {"contact_methods": contact_methods}
        return render(request, template, context)


@login_required
def profile_edit_picture(request):
    """
    Handles the uploading and saving of a user's profile picture. This view expects a POST request with the
    image file included. If the request is not a POST or the form is invalid, it responds with an HTTP 400 status.

    Args:
        request: HttpRequest object containing metadata about the request and user file upload data.

    Returns:
        Redirects to the profile data page if the image is successfully saved.
        Returns HTTP status 400 for any non-POST requests or if form validation fails.
    """
    if request.method == "POST":
        # Retrieve the user's profile
        user_profile = Profile.objects.get(user=request.user)
        logger.debug(f"user_profile: {user_profile}")

        # Create a form instance with the POST data and the uploaded file
        form = ProfilePictureForm(request.POST, request.FILES, instance=user_profile)

        # Check if the form is valid
        if form.is_valid():
            # Save the updated profile with the new picture
            form.save()
        else:
            # Log form errors if the form is invalid
            logger.debug(form.errors)

        # Redirect to the profile data page after processing the form
        return redirect("profile_data")
    else:
        # Return HTTP status 400 for any non-POST requests
        return HttpResponse(status=400)


@login_required
def profile_edit_cryptos(request):
    """
    Handles the creation and updating of accepted cryptocurrency details for the user's profile.
    It allows users to either update existing cryptocurrency details or add new cryptocurrencies to their profile.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Redirects to the same page to view and manage cryptocurrencies after POST.
        Renders the page with cryptocurrency details for editing on GET.
    """
    template = "profiles/profile_edit_cryptos.html"

    if request.method == "POST":
        accepted_crypto_id = request.POST.get("crypto_id")
        crypto_name = request.POST.get("crypto_name")
        crypto_code = request.POST.get("crypto_code")
        crypto_address = request.POST.get("crypto_address")

        logger.debug(f"accepted_crypto_id: {accepted_crypto_id}")
        logger.debug(f"crypto_name: {crypto_name}")
        logger.debug(f"crypto_code: {crypto_code}")
        logger.debug(f"crypto_address: {crypto_address}")

        # If a valid crypto ID is provided, update the existing cryptocurrency
        if int(accepted_crypto_id) > 0:
            try:
                obj = AcceptedCrypto.objects.get(id=accepted_crypto_id)
            except AcceptedCrypto.DoesNotExist:
                logger.debug(f"Accepted crypto not found: {accepted_crypto_id}")
                return HttpResponse("Accepted Crypto not found", status=404)

            # Check if the crypto already exists; if so, update, if not, create a new crypto entry
            crypto_obj, created = CryptoCurrency.objects.get_or_create(name=crypto_name, defaults={'code': crypto_code})
            obj.crypto = crypto_obj
            obj.address = crypto_address
            obj.save()
            logger.debug(f"Crypto object (existing or new): {crypto_obj}")
        else:
            # Create a new AcceptedCrypto entry
            crypto_obj, created = CryptoCurrency.objects.get_or_create(name=crypto_name, defaults={'code': crypto_code})
            new_accepted_crypto = AcceptedCrypto.objects.create(
                user=request.user,
                crypto=crypto_obj,
                address=crypto_address
            )
            logger.debug(f"New accepted crypto: {new_accepted_crypto}")

        return redirect("profile_edit_cryptos")

    else:
        # Retrieve all non-deleted accepted cryptos for the user
        accepted_cryptos = AcceptedCrypto.objects.filter(user=request.user, deleted=False)
        logger.debug(f"Accepted cryptos: {accepted_cryptos}")

        context = {"accepted_cryptos": accepted_cryptos}
        return render(request, template, context)


@login_required
def profile_delete_contact_method(request):
    """
    Handles the soft deletion of a user's contact method. This view sets the 'deleted' flag to True
    for the specified contact method, effectively hiding it from active use without physically removing it from the database.
    This operation requires a POST request.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        HttpResponse with status code 201 if the contact method is successfully marked as deleted.
        HttpResponse with status code 400 if the request is not a POST, indicating a bad request.
    """
    if request.method == "POST":
        # Retrieve the contact method ID from the POST request
        contact_method_id = request.POST.get("contact_method_id")

        # Fetch the contact method object or return 404 if not found
        contact_method = get_object_or_404(ContactMethod, id=contact_method_id)

        # Mark the contact method as deleted
        contact_method.deleted = True
        contact_method.save()

        # Return HTTP status 201 to indicate successful deletion
        return HttpResponse(status=201)
    else:
        # Return HTTP status 400 for non-POST requests to indicate a bad request
        return HttpResponse(status=400)


@login_required
def profile_delete_crypto(request):
    """
    Soft deletes an accepted cryptocurrency record for the user. This endpoint is designed to handle
    POST requests only and marks the specified cryptocurrency as deleted without removing it from the database.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        HttpResponse with status code 201 if the cryptocurrency is successfully marked as deleted.
        HttpResponse with status code 400 for any non-POST request, indicating a bad request.
    """
    if request.method == "POST":
        # Retrieve the cryptocurrency ID from the POST request
        crypto_id = request.POST.get("crypto_id")

        # Fetch the cryptocurrency object or return 404 if not found
        accepted_crypto_obj = get_object_or_404(AcceptedCrypto, id=crypto_id)

        # Mark the cryptocurrency as deleted
        accepted_crypto_obj.deleted = True
        accepted_crypto_obj.save()

        # Return HTTP status 201 to indicate successful deletion
        return HttpResponse(status=201)
    else:
        # Return HTTP status 400 for non-POST requests to indicate a bad request
        return HttpResponse(status=400)


@login_required
def profile_events(request):
    """
    Displays the user's events and any pending certificate requests for those events. This view
    lists only active events and pending certificate requests linked to the logged-in user.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Rendered HTML response of the user's events and pending certificate requests.
    """
    template = "profiles/profile_events.html"
    events = Event.objects.filter(owner=request.user, deleted=False)
    logger.debug(f"events: {events}")

    certificate_requests = CertificateRequest.objects.filter(event__owner=request.user, state="PENDING")
    logger.debug(f"certificate_requests: {certificate_requests}")

    context = {
        "profile_index_active": "active",
        "underline_events": "text-underline",
        "events": events,
        "certificate_requests": certificate_requests
    }
    return render(request, template, context)


@login_required
def profile_certificates(request):
    """
    Displays all the active certificates owned by the user along with any associated rewards or points
    (user diamonds). This view focuses on showing certificates that have not been marked as deleted.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Rendered HTML response of the user's certificates and their diamonds.
    """
    template = "profiles/profile_certificates.html"
    certificates = Certificate.objects.filter(user=request.user, deleted=False)
    user_diamonds = get_user_diamonds(request.user, certificates=certificates)

    context = {
        "profile_index_active": "active",
        "underline_certificates": "text-underline",
        "certificates": certificates,
        "user_diamonds": user_diamonds
    }
    return render(request, template, context)


@login_required
def profile_cert_requests(request):
    """
    Displays certificate requests made by events owned by the user, categorized into pending and rejected
    states. This view allows the user to manage certificate requests effectively.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Rendered HTML response of pending and rejected certificate requests.
    """
    template = "profiles/profile_cert_requests.html"
    cert_requests = CertificateRequest.objects.filter(event__owner=request.user, state="PENDING").order_by("event")
    logger.debug(f"cert_requests: {cert_requests}")

    cert_requests_rejected = CertificateRequest.objects.filter(event__owner=request.user, state="REJECTED").order_by(
        "event")
    logger.debug(f"cert_requests_rejected: {cert_requests_rejected}")

    context = {
        "cert_requests": cert_requests,
        "cert_requests_rejected": cert_requests_rejected
    }
    return render(request, template, context)


@login_required
def profile_bookmarks(request):
    """
    Displays a list of the user's bookmarked events and any associated certificate requests.
    This view gathers information about the events that the user has bookmarked and checks
    if there are any related certificate requests, providing a comprehensive view of the user's interactions.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        Rendered HTML response showing the user's bookmarks and any related certificate requests.
    """
    template = "profiles/profile_bookmarks.html"
    bookmarks = []
    bookmarked_events = Bookmark.objects.filter(user=request.user, deleted=False)
    logger.debug(f"bookmarked_events: {bookmarked_events}")

    # Compile list of bookmarks and associated certificate requests
    for b in bookmarked_events:
        certificate_request = None
        # Check if there is a certificate request for the bookmarked event
        if CertificateRequest.objects.filter(user=request.user, event=b.event).exists():
            certificate_request = CertificateRequest.objects.get(user=request.user, event=b.event)
        bookmarks.append([b, certificate_request])

    logger.debug(f"bookmarks: {bookmarks}")

    context = {
        "profile_index_active": "active",
        "underline_bookmarks": "text-underline",
        "bookmarks": bookmarks
    }
    return render(request, template, context)


@login_required
def profile_content(request):
    # TODO enviar a nueva app "content"
    template = "profiles/profile_content.html"
    context = {"profile_index_active": "active", "underline_content": "text-underline"}
    return render(request, template, context)


@login_required
def profile_security(request):
    """
    Manages user password changes. If accessed via POST, it processes the form data to update the user's password.
    If accessed via GET, it displays the password change form. This view supports both updating the password and
    providing feedback to the user about the status of the password update attempt.

    Args:
        request: HttpRequest object containing metadata about the request.

    Returns:
        If POST and form is valid, redirects to a confirmation page.
        If POST and form is invalid, re-renders the form with errors.
        If GET, renders the form to change the password.
    """
    template = "profiles/profile_security.html"

    if request.method == "POST":
        # Create a form instance with POST data and the current user instance
        form = AcademiaSetPasswordForm(request.user, request.POST)

        # Validate the form
        if form.is_valid():
            # Save the new password
            form.save()
            # Redirect to the password reset completion page
            return redirect("password_reset_complete")
        else:
            # Log form errors and prepare to display them
            logger.debug(f"form.errors: {form.errors}")
            context = {
                "profile_index_active": "active",
                "underline_security": "text-underline",
                "form": form
            }
            return render(request, template, context)

    else:
        # Provide the form for password change
        form = AcademiaSetPasswordForm(request.user)
        context = {
            "profile_index_active": "active",
            "underline_security": "text-underline",
            "form": form
        }
        return render(request, template, context)
