import logging

from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.utils.decorators import method_decorator

from profiles.serializers import UserSerializer, ProfileSerializer
from profiles.models import Profile


logger = logging.getLogger('app_logger')


class UserProfileView(APIView):
    def get(self, request, format=None):
        # Fetch the profile of the authenticated user
        user_profile = Profile.objects.filter(user=request.user).first()
        if not user_profile:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProfileSerializer(user_profile)
        return Response(serializer.data)

    def post(self, request, format=None):
        # Update or create a profile for the authenticated user
        serializer = ProfileSerializer(data=request.data, instance=request.user.profile)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileList(APIView):
    def get(self, request, format=None):
        profiles = Profile.objects.all()
        serializer = ProfileSerializer(profiles, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = ProfileSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    def get(self, request, pk, format=None):
        # Obtén un usuario específico por su pk (ID)
        user = get_object_or_404(User, pk=pk)
        # Serializa los datos del usuario
        serializer = UserSerializer(user)
        # Devuelve los datos serializados
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk, format=None):
        # Obtén un usuario específico por su pk (ID)
        user = get_object_or_404(User, pk=pk)
        # Serializa los datos del usuario con los datos actualizados
        serializer = UserSerializer(user, data=request.data,
                                    partial=True)  # `partial=True` para permitir actualizaciones parciales
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileDetail(APIView):
    def get(self, request, pk, format=None):
        profile = get_object_or_404(Profile, pk=pk)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        profile = get_object_or_404(Profile, pk=pk)
        serializer = ProfileSerializer(profile, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        profile = get_object_or_404(Profile, pk=pk)
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GetCsrfToken(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Ensure a CSRF cookie is set and return a simple JSON message.
        """
        get_token(request)  # This will set the CSRF cookie if it is not already set
        return Response({'message': 'CSRF cookie set'})


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
    """
    Endpoint to set a JWT token as a cookie for an authenticated user.

    This view checks if the user is authenticated, and if so, generates a JWT access token. The token is then set as a cookie in the response. If the user is not authenticated, an error response with a status code of 401 is returned.

    Redirects the user to the specified URL after setting the JWT token as a cookie.

    Args:
        request: The HTTP request object, containing user authentication details.

    Returns:
        HttpResponseRedirect: A response that redirects to a success URL with the JWT token set as a cookie.
        JsonResponse: An error response if the user is not authenticated.
    """
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
