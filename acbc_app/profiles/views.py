import logging

from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.middleware.csrf import get_token
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth import authenticate, login
from django.conf import settings
from django.core.cache import cache
from datetime import timedelta

from profiles.serializers import UserSerializer, ProfileSerializer, UserRegistrationSerializer
from profiles.models import Profile

logger = logging.getLogger('app_logger')


class CheckAuth(APIView):
    permission_classes = [AllowAny]

    @method_decorator(csrf_exempt)
    def get(self, request):
        is_authenticated = request.user.is_authenticated
        print(f"User authenticated: {is_authenticated}")
        return Response({'is_authenticated': is_authenticated}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request, format=None):
        # Fetch the profile of the authenticated user
        user_profile = Profile.objects.filter(user=request.user).first()
        if not user_profile:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProfileSerializer(user_profile, context={'request': request})
        return Response(serializer.data)

    def put(self, request, format=None):
        # Get the profile of the authenticated user
        user_profile = Profile.objects.filter(user=request.user).first()
        if not user_profile:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        # Handle profile picture upload if present
        if 'profile_picture' in request.FILES:
            profile_picture = request.FILES.get('profile_picture')
            user_profile.profile_picture = profile_picture

        # Handle text fields update from request.data
        # This will work for JSON and FormParser/MultiPartParser for non-file fields
        profile_description = request.data.get('profile_description')
        if profile_description is not None:
            user_profile.profile_description = profile_description
        
        interests = request.data.get('interests')
        if interests is not None:
            user_profile.interests = interests

        try:
            user_profile.save()
            serializer = ProfileSerializer(user_profile, context={'request': request})
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Failed to update profile: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        # Look up profile by user_id instead of profile_id
        profile = get_object_or_404(Profile, user_id=pk)
        serializer = ProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        # Update to also use user_id
        profile = get_object_or_404(Profile, user_id=pk)
        serializer = ProfileSerializer(profile, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        # Update to also use user_id
        profile = get_object_or_404(Profile, user_id=pk)
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def set_jwt_token(user):
    """
    Generate a JWT token for an authenticated user and return it in a JsonResponse.

    Args:
        user: The authenticated user object.

    Returns:
        JsonResponse: A response containing the JWT token.
    """
    try:
        # Debug: Check if user is authenticated
        print('User authenticated:', user.is_authenticated)

        if not user.is_authenticated:
            print('User not authenticated, returning error.')
            return JsonResponse({'error': 'User not authenticated'}, status=401)

        # Debug: Log that the tokens are being created
        print('Creating refresh and access tokens for user:', user)
        access_token = str(AccessToken.for_user(user))

        # Debug: Log the setting of the JWT cookie
        print('Setting JWT cookie with access token:', access_token)
        response = JsonResponse({'token': access_token})
        response.set_cookie(
            'jwt',
            access_token,
            httponly=True,
            secure=False,  # Set to False if testing locally over HTTP
            samesite='Lax',
            path='/',
            max_age=None,
        )

        return response
    except Exception as e:
        print('Error in set_jwt_token:', str(e))
        return JsonResponse({'error': str(e)}, status=500)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def post(self, request):
        """
        Log in a user with the provided credentials and set both access and refresh tokens.
        """
        username = request.data.get('username')
        password = request.data.get('password')
        client_ip = self.get_client_ip(request)

        print('Login attempt with username:', username, 'from IP:', client_ip)

        # Check rate limiting
        cache_key = f'login_attempts_{client_ip}'
        attempts = cache.get(cache_key, 0)
        
        if attempts >= 5:  # Maximum 5 attempts
            print(f'Too many login attempts from IP: {client_ip}')
            return Response(
                {'error': 'Too many login attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        user = authenticate(request, username=username, password=password)

        if user:
            print('User authenticated successfully:', user)
            login(request, user)
            
            # Reset rate limiting on successful login
            cache.delete(cache_key)

            try:
                # Generate both tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)

                # Create response data
                response_data = {
                    **UserSerializer(user).data,
                    'access_token': access_token
                }

                # Create response with data
                response = Response(response_data)

                # Set refresh token in HTTP-only cookie
                response.set_cookie(
                    settings.SIMPLE_JWT['REFRESH_COOKIE'],
                    refresh_token,
                    httponly=True,
                    secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                    samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
                    path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                )

                print('Tokens set successfully')
                return response
            except Exception as e:
                print('Error while generating tokens:', str(e))
                return Response(
                    {'error': 'Failed to generate tokens'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Increment failed attempts
            cache.set(cache_key, attempts + 1, timeout=300)  # 5 minutes timeout
            
            print('Invalid credentials for username:', username)
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED,
                content_type='application/json',
            )


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


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            print("Processing logout request")
            response = Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
            
            # Get the refresh token cookie name from settings
            refresh_cookie_name = settings.SIMPLE_JWT['REFRESH_COOKIE']
            print(f"Attempting to delete cookie: {refresh_cookie_name}")
            
            # Delete the refresh token cookie
            response.delete_cookie(
                refresh_cookie_name,
                path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                domain=None  # Let the browser determine the domain
            )
            
            print("Logout successful")
            return response
        except Exception as e:
            print(f"Logout error: {str(e)}")
            return Response(
                {'error': f'Logout failed: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [] # No auth needed to register

    def post(self, request, format=None):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save() # This calls serializer.create()
            Profile.objects.create(user=user) # Explicitly create profile

            # Log the user in and set JWT token
            try:
                # Generate JWT tokens
                access_token = str(AccessToken.for_user(user))

                # Set the JWT token in an HTTP-only cookie
                response_data = UserSerializer(user).data
                response = Response(response_data, status=status.HTTP_201_CREATED)
                response.set_cookie(
                    'jwt',
                    access_token,
                    httponly=True,
                    secure=False,  # Set to True in production over HTTPS (use settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'])
                    samesite='Lax', # Or settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE']
                    path='/',
                )
                # TODO: Implement email activation sending here if needed
                return response
            except Exception as e:
                # Log this error, as it's a server-side issue during token generation/setting
                logger.error(f"Error generating or setting JWT token during registration for user {user.username}: {str(e)}")
                # Still return a 201 as user was created, but indicate token issue if desired, or just return user data.
                # For simplicity, we'll return the user data, but the client won't be auto-logged in via cookie.
                return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Refresh the access token using the refresh token from the HTTP-only cookie.
        """
        try:
            # Get refresh token from cookie
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['REFRESH_COOKIE'])
            
            if not refresh_token:
                return Response(
                    {'error': 'No refresh token found'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Validate refresh token and get new access token
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)

            # Return new access token
            return Response({
                'access_token': access_token
            })

        except Exception as e:
            logger.error(f"Token refresh failed: {str(e)}")
            return Response(
                {'error': 'Invalid refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )
