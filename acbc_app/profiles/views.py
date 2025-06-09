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
from django.core.files.base import ContentFile
import requests
from datetime import datetime
import jwt
import json

from profiles.serializers import UserSerializer, ProfileSerializer, UserRegistrationSerializer
from profiles.models import Profile
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from allauth.socialaccount.providers.google.provider import GoogleProvider
from allauth.socialaccount.models import SocialApp, SocialToken
from allauth.socialaccount.models import SocialAccount

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
    """
    Handles user authentication and JWT token generation.
    
    Flow:
    1. Receives username/password credentials
    2. Validates credentials using Django's authenticate
    3. Generates JWT tokens (access and refresh)
    4. Sets refresh token in HTTP-only cookie
    5. Returns user data and access token in response
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_client_ip(self, request):
        """Extracts client IP for rate limiting purposes."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def post(self, request):
        """
        Authenticates user and generates JWT tokens.
        
        Args:
            request: Contains username and password in request.data
            
        Returns:
            Response with:
            - User data (id, username, email, etc.)
            - Access token in response body
            - Refresh token in HTTP-only cookie
        """
        username = request.data.get('username')
        password = request.data.get('password')
        client_ip = self.get_client_ip(request)

        # Rate limiting check
        cache_key = f'login_attempts_{client_ip}'
        attempts = cache.get(cache_key, 0)
        
        if attempts >= 5:
            return Response(
                {'error': 'Too many login attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        user = authenticate(request, username=username, password=password)

        if user:
            login(request, user)
            cache.delete(cache_key)  # Reset rate limiting on success

            try:
                # Generate JWT tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)

                # Prepare response data
                response_data = {
                    **UserSerializer(user).data,
                    'access_token': access_token
                }

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

                return response
            except Exception as e:
                return Response(
                    {'error': 'Failed to generate tokens'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Increment failed attempts
            cache.set(cache_key, attempts + 1, timeout=300)  # 5 minutes timeout
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_403_FORBIDDEN
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
    """
    Handles JWT token refresh.
    
    Flow:
    1. Gets refresh token from HTTP-only cookie
    2. Validates refresh token
    3. Generates new access token
    4. Returns new access token in response
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Refreshes the access token using the refresh token from cookie.
        
        Returns:
            Response with new access token
        """
        try:
            print("\n=== Token Refresh Attempt ===")
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['REFRESH_COOKIE'])
            
            if not refresh_token:
                print("❌ No refresh token found in cookies")
                return Response(
                    {'error': 'No refresh token found'},
                    status=status.HTTP_403_FORBIDDEN
                )

            print("✅ Found refresh token in cookies")
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            print("✅ Generated new access token")

            return Response({
                'access_token': access_token
            })

        except Exception as e:
            print(f"❌ Token refresh failed: {str(e)}")
            return Response(
                {'error': 'Invalid refresh token'},
                status=status.HTTP_403_FORBIDDEN
            )


class GoogleLoginView(SocialLoginView):
    """
    Handles Google OAuth authentication and JWT token generation.
    """
    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    callback_url = None

    def post(self, request, *args, **kwargs):
        logger.info("Starting Google login process")
        
        # Check for access token
        id_token = request.data.get('access_token')
        if not id_token:
            logger.error("No access token provided in request")
            return Response(
                {'error': 'No access token provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get Google's public keys
        try:
            logger.info("Fetching Google public keys")
            response = requests.get('https://www.googleapis.com/oauth2/v3/certs')
            if response.status_code != 200:
                logger.error(f"Failed to fetch Google public keys. Status code: {response.status_code}")
                return Response(
                    {'error': 'Failed to fetch Google public keys'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            public_keys = response.json()
        except requests.RequestException as e:
            logger.error(f"Request error while fetching Google public keys: {str(e)}")
            return Response(
                {'error': 'Failed to connect to Google services'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Verify and decode the ID token
        try:
            logger.info("Verifying ID token")
            unverified_header = jwt.get_unverified_header(id_token)
            key_id = unverified_header['kid']
            
            # Find matching public key
            public_key = None
            for key in public_keys['keys']:
                if key['kid'] == key_id:
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    break
            
            if not public_key:
                logger.error("No matching public key found for token")
                return Response(
                    {'error': 'No matching public key found for token'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get Google OAuth client ID from settings
            client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
            if not client_id:
                logger.error("Google OAuth client ID not configured in settings")
                return Response(
                    {'error': 'Google OAuth client ID not configured'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Verify token
            try:
                decoded_token = jwt.decode(
                    id_token,
                    public_key,
                    algorithms=['RS256'],
                    audience=client_id,
                    issuer='https://accounts.google.com',
                    options={
                        'verify_iat': False,  # Don't verify issued at time
                        'verify_exp': True,   # Still verify expiration
                        'leeway': 10          # Allow 10 seconds of clock skew
                    }
                )
                logger.info("Successfully decoded and verified ID token")
            except jwt.ExpiredSignatureError:
                logger.error("Token has expired")
                return Response(
                    {'error': 'Token has expired. Please try logging in again.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid token error: {str(e)}")
                return Response(
                    {'error': f'Invalid ID token: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                logger.error(f"Unexpected error during token verification: {str(e)}")
                return Response(
                    {'error': 'Failed to verify token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Error during token verification: {str(e)}")
            return Response(
                {'error': 'Failed to verify token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user
        try:
            logger.info("Looking up social account")
            social_account = SocialAccount.objects.get(
                provider=GoogleProvider.id, 
                uid=decoded_token['sub']
            )
            user = social_account.user
            logger.info(f"Found existing user: {user.username}")
        except SocialAccount.DoesNotExist:
            logger.info("No existing social account found, creating new user")
            # Create new user
            email = decoded_token.get('email')
            if not email:
                logger.error("No email provided in Google token")
                return Response(
                    {'error': 'Email not provided by Google'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                user = User.objects.get(email=email)
                logger.info(f"Found existing user with email: {email}")
            except User.DoesNotExist:
                logger.info(f"Creating new user with email: {email}")
                username = email.split('@')[0]
                # Ensure unique username
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=decoded_token.get('given_name', ''),
                    last_name=decoded_token.get('family_name', '')
                )
                logger.info(f"Created new user: {username}")
            
            # Create social account
            social_account = SocialAccount.objects.create(
                user=user,
                provider=GoogleProvider.id,
                uid=decoded_token['sub'],
                extra_data=decoded_token
            )
            logger.info(f"Created social account for user: {user.username}")

        # Handle profile picture
        try:
            # Get profile picture URL from Google token
            picture_url = decoded_token.get('picture')
            logger.info(f"Profile picture URL from token: {picture_url}")
            
            if picture_url:
                # Download the image
                logger.info("Downloading profile picture")
                picture_response = requests.get(picture_url)
                if picture_response.status_code == 200:
                    # Get or create profile
                    profile, created = Profile.objects.get_or_create(user=user)
                    logger.info(f"{'Created' if created else 'Found'} profile for user: {user.username}")
                    
                    # Save the profile picture
                    filename = f"{user.username}_{datetime.today().strftime('%h-%d-%y')}.jpeg"
                    logger.info(f"Saving profile picture as: {filename}")
                    profile.profile_picture.save(
                        filename,
                        ContentFile(picture_response.content),
                        save=True
                    )
                    logger.info(f"Successfully saved profile picture for user {user.username}")
                else:
                    logger.error(f"Failed to download profile picture. Status code: {picture_response.status_code}")
        except requests.RequestException as e:
            logger.error(f"Request error while downloading profile picture: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing profile picture for user {user.username}: {str(e)}")
            # Continue with login process even if picture fails

        try:
            # Generate JWT tokens
            logger.info("Generating JWT tokens")
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            # Prepare response
            response_data = {
                **UserSerializer(user).data,
                'access_token': access_token
            }

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
            logger.info("Successfully completed Google login process")
            return response
        except Exception as e:
            logger.error(f"Error generating tokens or creating response: {str(e)}")
            return Response(
                {'error': 'Failed to complete login process'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
