import logging
from rest_framework_simplejwt.tokens import RefreshToken

from django.shortcuts import render, get_object_or_404
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.models import User
from django.contrib.auth import login

from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str


from profiles.models import Profile


logger = logging.getLogger('app_logger')


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
