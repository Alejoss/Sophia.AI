import logging

from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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

from profiles.serializers import UserSerializer, ProfileSerializer, UserRegistrationSerializer, NotificationSerializer, CryptoCurrencySerializer, AcceptedCryptoSerializer
from profiles.models import Profile, CryptoCurrency, AcceptedCrypto
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from allauth.socialaccount.providers.google.provider import GoogleProvider
from allauth.socialaccount.models import SocialApp, SocialToken
from allauth.socialaccount.models import SocialAccount
from notifications.models import Notification
from django.db import connection
from django.db.models import Count

logger = logging.getLogger(__name__)


class CheckAuth(APIView):
    permission_classes = [AllowAny]

    @method_decorator(csrf_exempt)
    def get(self, request):
        logger.debug(f"Authentication check requested - User: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        # Check if user is authenticated via session
        is_authenticated = request.user.is_authenticated
        
        # If not authenticated via session, check for refresh token cookie
        if not is_authenticated:
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['REFRESH_COOKIE'])
            if refresh_token:
                try:
                    # Try to validate the refresh token
                    RefreshToken(refresh_token)
                    is_authenticated = True
                    logger.debug("User authenticated via refresh token")
                except Exception as e:
                    logger.debug(f"Refresh token validation failed: {str(e)}")
        
        logger.info(f"Authentication check completed - User: {request.user.username if request.user.is_authenticated else 'anonymous'}, Is authenticated: {is_authenticated}")
        return Response({'is_authenticated': is_authenticated}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request, format=None):
        logger.info(f"User profile requested - User: {request.user.username}")
        
        try:
            # Fetch the profile of the authenticated user
            user_profile = Profile.objects.filter(user=request.user).first()
            if not user_profile:
                logger.warning(f"Profile not found for user {request.user.username}")
                return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

            serializer = ProfileSerializer(user_profile, context={'request': request})
            logger.debug(f"User profile retrieved successfully for user {request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving user profile for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, format=None):
        logger.info(f"User profile update requested - User: {request.user.username}")
        logger.debug(f"Profile update data: {request.data}")
        
        try:
            # Get the profile of the authenticated user
            user_profile = Profile.objects.filter(user=request.user).first()
            if not user_profile:
                logger.warning(f"Profile not found for user {request.user.username}")
                return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

            # Handle profile picture upload if present
            if 'profile_picture' in request.FILES:
                profile_picture = request.FILES.get('profile_picture')
                user_profile.profile_picture = profile_picture
                logger.debug(f"Profile picture updated for user {request.user.username}")

            # Handle text fields update from request.data
            # This will work for JSON and FormParser/MultiPartParser for non-file fields
            profile_description = request.data.get('profile_description')
            if profile_description is not None:
                user_profile.profile_description = profile_description
                logger.debug(f"Profile description updated for user {request.user.username}")
            
            interests = request.data.get('interests')
            if interests is not None:
                user_profile.interests = interests
                logger.debug(f"Interests updated for user {request.user.username}")

            user_profile.save()
            serializer = ProfileSerializer(user_profile, context={'request': request})
            logger.info(f"User profile updated successfully for user {request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error updating user profile for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to update profile: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def post(self, request, format=None):
        logger.info(f"User profile creation requested - User: {request.user.username}")
        logger.debug(f"Profile creation data: {request.data}")
        
        try:
            # Update or create a profile for the authenticated user
            serializer = ProfileSerializer(data=request.data, instance=request.user.profile)
            if serializer.is_valid():
                profile = serializer.save()
                logger.info(f"User profile created/updated successfully for user {request.user.username}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Profile creation failed - validation errors for user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating user profile for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to create profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProfileList(APIView):
    def get(self, request, format=None):
        logger.info(f"Profile list requested by user {request.user.username}")
        
        try:
            profiles = Profile.objects.all()
            serializer = ProfileSerializer(profiles, many=True)
            logger.info(f"Successfully retrieved {len(serializer.data)} profiles")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving profile list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve profiles'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, format=None):
        logger.info(f"Profile creation requested by user {request.user.username}")
        logger.debug(f"Profile creation data: {request.data}")
        
        try:
            serializer = ProfileSerializer(data=request.data)
            if serializer.is_valid():
                profile = serializer.save()
                logger.info(f"Profile created successfully - ID: {profile.id}, User: {profile.user.username}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Profile creation failed - validation errors from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating profile for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to create profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserDetailView(APIView):
    def get(self, request, pk, format=None):
        logger.info(f"User detail requested - User ID: {pk}, Requested by: {request.user.username}")
        
        try:
            # Obtén un usuario específico por su pk (ID)
            user = get_object_or_404(User, pk=pk)
            # Serializa los datos del usuario
            serializer = UserSerializer(user)
            logger.debug(f"User detail retrieved successfully - User: {user.username}")
            # Devuelve los datos serializados
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving user detail for user ID {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve user'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk, format=None):
        logger.info(f"User update requested - User ID: {pk}, Updated by: {request.user.username}")
        logger.debug(f"User update data: {request.data}")
        
        try:
            # Obtén un usuario específico por su pk (ID)
            user = get_object_or_404(User, pk=pk)
            # Serializa los datos del usuario con los datos actualizados
            serializer = UserSerializer(user, data=request.data,
                                        partial=True)  # `partial=True` para permitir actualizaciones parciales
            if serializer.is_valid():
                updated_user = serializer.save()
                logger.info(f"User updated successfully - User ID: {pk}, Updated by: {request.user.username}")
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                logger.warning(f"User update failed - validation errors for user {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating user {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to update user'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProfileDetail(APIView):
    def get(self, request, pk, format=None):
        logger.info(f"Profile detail requested - User ID: {pk}, Requested by: {request.user.username}")
        
        try:
            # Look up profile by user_id instead of profile_id
            profile = get_object_or_404(Profile, user_id=pk)
            serializer = ProfileSerializer(profile, context={'request': request})
            logger.debug(f"Profile detail retrieved successfully - User: {profile.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving profile detail for user ID {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk, format=None):
        logger.info(f"Profile update requested - User ID: {pk}, Updated by: {request.user.username}")
        logger.debug(f"Profile update data: {request.data}")
        
        try:
            # Update to also use user_id
            profile = get_object_or_404(Profile, user_id=pk)
            serializer = ProfileSerializer(profile, data=request.data, context={'request': request})
            if serializer.is_valid():
                updated_profile = serializer.save()
                logger.info(f"Profile updated successfully - User ID: {pk}, Updated by: {request.user.username}")
                return Response(serializer.data)
            else:
                logger.warning(f"Profile update failed - validation errors for user {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating profile for user {pk} by user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to update profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk, format=None):
        logger.info(f"Profile deletion requested - User ID: {pk}, Deleted by: {request.user.username}")
        
        try:
            # Update to also use user_id
            profile = get_object_or_404(Profile, user_id=pk)
            profile.delete()
            logger.info(f"Profile deleted successfully - User ID: {pk}, Deleted by: {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting profile for user {pk} by user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to delete profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def set_jwt_token(user):
    """
    Generate a JWT token for an authenticated user and return it in a JsonResponse.

    Args:
        user: The authenticated user object.

    Returns:
        JsonResponse: A response containing the JWT token.
    """
    try:
        logger.debug(f'Generating JWT tokens for user: {user.username}')

        if not user.is_authenticated:
            logger.warning(f'JWT token generation failed - user not authenticated: {user.username}')
            return JsonResponse({'error': 'User not authenticated'}, status=401)

        # Debug: Log that the tokens are being created
        logger.debug(f'Creating refresh and access tokens for user: {user.username}')
        access_token = str(AccessToken.for_user(user))

        # Debug: Log the setting of the JWT cookie
        logger.debug(f'Setting JWT cookie with access token: {access_token}')
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
        logger.error(f'Error in set_jwt_token: {str(e)}', exc_info=True)
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
                logger.error(f"Error generating tokens during login for user {user.username}: {str(e)}", exc_info=True)
                return Response(
                    {'error': 'Failed to generate tokens'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Increment failed attempts
            cache.set(cache_key, attempts + 1, timeout=300)  # 5 minutes timeout
            logger.warning(f"Invalid credentials for user {username} from IP {client_ip}")
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
        logger.debug(f"CSRF token requested by user {request.user.username if request.user.is_authenticated else 'anonymous'}")
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
        logger.warning(f"Activation link is invalid for user {user.username if user else 'unknown'} with token {token}")
        return HttpResponse('Activation link is invalid!')


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            logger.info(f"Processing logout request for user {request.user.username}")
            response = Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
            
            # Get the refresh token cookie name from settings
            refresh_cookie_name = settings.SIMPLE_JWT['REFRESH_COOKIE']
            logger.debug(f"Attempting to delete cookie: {refresh_cookie_name}")
            
            # Delete the refresh token cookie
            response.delete_cookie(
                refresh_cookie_name,
                path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                domain=None  # Let the browser determine the domain
            )
            
            logger.info(f"Logout successful for user {request.user.username}")
            return response
        except Exception as e:
            logger.error(f"Logout error for user {request.user.username}: {str(e)}", exc_info=True)
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
                # Generate JWT tokens (same as login endpoint)
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)

                # Prepare response data with access token (same as login endpoint)
                response_data = {
                    **UserSerializer(user).data,
                    'access_token': access_token
                }

                response = Response(response_data, status=status.HTTP_201_CREATED)

                # Set refresh token in HTTP-only cookie (same as login endpoint)
                response.set_cookie(
                    settings.SIMPLE_JWT['REFRESH_COOKIE'],
                    refresh_token,
                    httponly=True,
                    secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                    samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
                    path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                )
                # TODO: Implement email activation sending here if needed
                return response
            except Exception as e:
                # Log this error, as it's a server-side issue during token generation/setting
                logger.error(f"Error generating or setting JWT token during registration for user {user.username}: {str(e)}", exc_info=True)
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
            logger.debug(f"Token refresh attempt for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['REFRESH_COOKIE'])
            
            if not refresh_token:
                logger.warning(f"No refresh token found in cookies for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                return Response(
                    {'error': 'No refresh token found'},
                    status=status.HTTP_403_FORBIDDEN
                )

            logger.debug(f"Found refresh token in cookies for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            logger.debug(f"Generated new access token for user {request.user.username if request.user.is_authenticated else 'anonymous'}")

            return Response({
                'access_token': access_token
            })

        except Exception as e:
            logger.error(f"Token refresh failed for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
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
        logger.info(f"Starting Google login process for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        # Check for access token
        id_token = request.data.get('access_token')
        if not id_token:
            logger.error(f"No access token provided in request for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            return Response(
                {'error': 'No access token provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get Google's public keys
        try:
            logger.info(f"Fetching Google public keys for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            response = requests.get('https://www.googleapis.com/oauth2/v3/certs')
            if response.status_code != 200:
                logger.error(f"Failed to fetch Google public keys. Status code: {response.status_code} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                return Response(
                    {'error': 'Failed to fetch Google public keys'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            public_keys = response.json()
        except requests.RequestException as e:
            logger.error(f"Request error while fetching Google public keys for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to connect to Google services'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Verify and decode the ID token
        try:
            logger.info(f"Verifying ID token for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            unverified_header = jwt.get_unverified_header(id_token)
            key_id = unverified_header['kid']
            
            # Find matching public key
            public_key = None
            for key in public_keys['keys']:
                if key['kid'] == key_id:
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    break
            
            if not public_key:
                logger.error(f"No matching public key found for token for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                return Response(
                    {'error': 'No matching public key found for token'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get Google OAuth client ID from settings
            client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
            if not client_id:
                logger.error(f"Google OAuth client ID not configured in settings for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
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
                logger.info(f"Successfully decoded and verified ID token for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            except jwt.ExpiredSignatureError:
                logger.error(f"Token has expired for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                return Response(
                    {'error': 'Token has expired. Please try logging in again.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid token error for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
                return Response(
                    {'error': f'Invalid ID token: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                logger.error(f"Unexpected error during token verification for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
                return Response(
                    {'error': 'Failed to verify token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Error during token verification for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to verify token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user
        try:
            logger.info(f"Looking up social account for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            social_account = SocialAccount.objects.get(
                provider=GoogleProvider.id, 
                uid=decoded_token['sub']
            )
            user = social_account.user
            logger.info(f"Found existing user: {user.username} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        except SocialAccount.DoesNotExist:
            logger.info(f"No existing social account found for user {request.user.username if request.user.is_authenticated else 'anonymous'}, creating new user")
            # Create new user
            email = decoded_token.get('email')
            if not email:
                logger.error(f"No email provided in Google token for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                return Response(
                    {'error': 'Email not provided by Google'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                user = User.objects.get(email=email)
                logger.info(f"Found existing user with email: {email} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            except User.DoesNotExist:
                logger.info(f"Creating new user with email: {email} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
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
                logger.info(f"Created new user: {username} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            
            # Create social account
            social_account = SocialAccount.objects.create(
                user=user,
                provider=GoogleProvider.id,
                uid=decoded_token['sub'],
                extra_data=decoded_token
            )
            logger.info(f"Created social account for user: {user.username} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")

        # Handle profile picture
        try:
            # Get profile picture URL from Google token
            picture_url = decoded_token.get('picture')
            logger.debug(f"Profile picture URL from token for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {picture_url}")
            
            if picture_url:
                # Download the image
                logger.info(f"Downloading profile picture for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                picture_response = requests.get(picture_url)
                if picture_response.status_code == 200:
                    # Get or create profile
                    profile, created = Profile.objects.get_or_create(user=user)
                    logger.info(f"{'Created' if created else 'Found'} profile for user: {user.username} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                    
                    # Save the profile picture
                    filename = f"{user.username}_{datetime.today().strftime('%h-%d-%y')}.jpeg"
                    logger.info(f"Saving profile picture as: {filename} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                    profile.profile_picture.save(
                        filename,
                        ContentFile(picture_response.content),
                        save=True
                    )
                    logger.info(f"Successfully saved profile picture for user {user.username} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
                else:
                    logger.error(f"Failed to download profile picture. Status code: {picture_response.status_code} for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        except requests.RequestException as e:
            logger.error(f"Request error while downloading profile picture for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
        except Exception as e:
            logger.error(f"Error processing profile picture for user {user.username} for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
            # Continue with login process even if picture fails

        try:
            # Generate JWT tokens
            logger.info(f"Generating JWT tokens for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
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
            logger.info(f"Successfully completed Google login process for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            return response
        except Exception as e:
            logger.error(f"Error generating tokens or creating response for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to complete login process'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserNotificationsView(APIView):
    """
    Custom view for user-specific notification functionality.
    Extends the basic functionality provided by django-notifications.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info(f"Fetching user notifications for user {request.user.username}")
        
        # Get show_all parameter from query string
        show_all = request.query_params.get('show_all', 'false').lower() == 'true'
        
        # Clean up old notifications first
        from django.utils import timezone
        from datetime import timedelta
        
        cutoff_date = timezone.now() - timedelta(days=30)
        deleted_count = Notification.objects.filter(
            recipient=request.user,
            unread=False,
            timestamp__lt=cutoff_date
        ).delete()[0]
        
        logger.debug(f"Cleaned up {deleted_count} old notifications for user {request.user.username}")
        
        # Get notifications for the user
        notifications = Notification.objects.filter(recipient=request.user)
        
        # If not showing all, only get unread notifications
        if not show_all:
            notifications = notifications.filter(unread=True)
        
        # Print the actual SQL query
        logger.debug(f"SQL Query for notifications for user {request.user.username}:")
        logger.debug(notifications.query)
        
        # Print the count
        count = notifications.count()
        logger.info(f"Found {count} notifications for user {request.user.username}")
        
        # Log some details about the notifications
        for notification in notifications:
            logger.debug(f"\nNotification ID: {notification.id} for user {request.user.username}")
            logger.debug(f"Verb: {notification.verb}")
            logger.debug(f"Actor: {notification.actor}")
            logger.debug(f"Action Object: {notification.action_object}")
            logger.debug(f"Target: {notification.target}")
            logger.debug(f"Unread: {notification.unread}")
            logger.debug(f"Timestamp: {notification.timestamp}")
            logger.debug("---")
        
        # Get notification counts by type
        notification_types = notifications.values('verb').annotate(count=Count('id'))
        logger.debug("\nNotification types and counts for user {request.user.username}:")
        for nt in notification_types:
            logger.debug(f"{nt['verb']}: {nt['count']}")
        
        # Serialize the notifications
        notification_data = NotificationSerializer(notifications, many=True).data
        
        logger.debug("\nSerialized data being sent for user {request.user.username}:")
        logger.debug(notification_data)
        
        logger.info("=== End Fetching Notifications ===")
        return Response({
            'notifications': notification_data,
            'cleaned_up_count': deleted_count
        })

    def post(self, request, notification_id=None):
        """
        Mark a notification as read or mark all notifications as read.
        If notification_id is provided, mark that specific notification as read.
        Otherwise, mark all notifications as read.
        """
        logger.info(f"Marking notifications as read for user {request.user.username}")
        
        if notification_id:
            # Mark specific notification as read
            try:
                notification = Notification.objects.get(
                    recipient=request.user,
                    id=notification_id
                )
                logger.debug(f"Found notification: {notification.id} for user {request.user.username}")
                
                notification.mark_as_read()
                logger.debug(f"Successfully marked as read for user {request.user.username}")
                
                logger.info("=== End Marking Notification as Read ===")
                return Response({'status': 'success'})
            except Notification.DoesNotExist:
                logger.warning(f"Notification {notification_id} not found for user {request.user.username}")
                logger.info("=== End Marking Notification as Read ===")
                return Response(
                    {'error': 'Notification not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Mark all notifications as read
            try:
                # Get all unread notifications for the user
                unread_notifications = Notification.objects.filter(
                    recipient=request.user,
                    unread=True
                )
                count = unread_notifications.count()
                logger.debug(f"Found {count} unread notifications for user {request.user.username}")
                
                # Mark all as read
                unread_notifications.mark_all_as_read()
                logger.debug(f"Successfully marked {count} notifications as read for user {request.user.username}")
                
                logger.info("=== End Marking All Notifications as Read ===")
                return Response({
                    'status': 'success',
                    'marked_as_read': count
                })
            except Exception as e:
                logger.error(f"Error marking all notifications as read for user {request.user.username}: {str(e)}", exc_info=True)
                logger.info("=== End Marking All Notifications as Read ===")
                return Response(
                    {'error': 'Failed to mark notifications as read'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    def delete(self, request, notification_id=None):
        """
        Delete a notification or clean up old notifications.
        If notification_id is provided, delete that specific notification.
        Otherwise, delete all read notifications older than 30 days.
        """
        logger.info(f"Deleting notifications for user {request.user.username}")
        
        if notification_id:
            # Delete specific notification
            try:
                notification = Notification.objects.get(
                    recipient=request.user,
                    id=notification_id
                )
                notification.delete()
                logger.debug(f"Deleted notification {notification_id} for user {request.user.username}")
                return Response({'status': 'success'})
            except Notification.DoesNotExist:
                return Response(
                    {'error': 'Notification not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Delete old read notifications
            from django.utils import timezone
            from datetime import timedelta
            
            # Delete notifications that are:
            # 1. Read (unread=False)
            # 2. Older than 30 days
            # 3. Belong to the current user
            cutoff_date = timezone.now() - timedelta(days=30)
            deleted_count = Notification.objects.filter(
                recipient=request.user,
                unread=False,
                timestamp__lt=cutoff_date
            ).delete()[0]
            
            logger.debug(f"Deleted {deleted_count} old notifications for user {request.user.username}")
            return Response({
                'status': 'success',
                'deleted_count': deleted_count
            })


class UnreadNotificationsCountView(APIView):
    """
    Lightweight endpoint that only returns the count of unread notifications.
    Much more efficient than fetching all notifications just to count them.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Simple count query - very lightweight
            unread_count = Notification.objects.filter(
                recipient=request.user,
                unread=True
            ).count()
            
            return Response({
                'unread_count': unread_count
            })
        except Exception as e:
            logger.error(f"Error getting unread notifications count for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to get unread count'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CryptoCurrencyListView(APIView):
    """
    List all available cryptocurrencies for selection in dropdown
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info(f"Fetching cryptocurrency list for user {request.user.username}")
        try:
            cryptocurrencies = CryptoCurrency.objects.all().order_by('name')
            serializer = CryptoCurrencySerializer(cryptocurrencies, many=True, context={'request': request})
            logger.info(f"Successfully retrieved {len(serializer.data)} cryptocurrencies for user {request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching cryptocurrencies for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to fetch cryptocurrencies'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserAcceptedCryptosView(APIView):
    """
    CRUD operations for user's accepted cryptocurrencies
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id=None):
        """
        Get accepted cryptocurrencies for a user
        If user_id is provided, get for that specific user
        Otherwise, get for the authenticated user
        """
        logger.info(f"Fetching accepted cryptocurrencies for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        try:
            target_user_id = user_id if user_id else request.user.id
            
            # If requesting another user's cryptos, only show non-deleted ones
            if user_id and user_id != request.user.id:
                accepted_cryptos = AcceptedCrypto.objects.filter(
                    user_id=target_user_id,
                    deleted=False
                )
            else:
                # For own profile, show all (including deleted for management)
                accepted_cryptos = AcceptedCrypto.objects.filter(user_id=target_user_id)
            
            serializer = AcceptedCryptoSerializer(accepted_cryptos, many=True, context={'request': request})
            logger.info(f"Successfully retrieved {len(serializer.data)} accepted cryptocurrencies for user {request.user.username if request.user.is_authenticated else 'anonymous'}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching accepted cryptocurrencies for user {request.user.username if request.user.is_authenticated else 'anonymous'}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to fetch accepted cryptocurrencies'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """
        Add a new accepted cryptocurrency for the authenticated user
        """
        logger.info(f"Adding accepted cryptocurrency for user {request.user.username}")
        logger.debug(f"Accepted cryptocurrency data: {request.data}")
        
        try:
            crypto_id = request.data.get('crypto_id')
            address = request.data.get('address')
            
            if not crypto_id or not address:
                logger.warning(f"Invalid data for adding accepted cryptocurrency for user {request.user.username}")
                return Response(
                    {'error': 'Both crypto_id and address are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if crypto exists
            try:
                crypto = CryptoCurrency.objects.get(id=crypto_id)
            except CryptoCurrency.DoesNotExist:
                logger.warning(f"Cryptocurrency not found for user {request.user.username}: crypto_id={crypto_id}")
                return Response(
                    {'error': 'Cryptocurrency not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if user already has this crypto (even if deleted)
            existing_crypto, created = AcceptedCrypto.objects.get_or_create(
                user=request.user,
                crypto=crypto,
                defaults={'address': address, 'deleted': False}
            )
            
            if not created:
                # Update existing record
                existing_crypto.address = address
                existing_crypto.deleted = False
                existing_crypto.save()
            
            serializer = AcceptedCryptoSerializer(existing_crypto, context={'request': request})
            logger.info(f"Accepted cryptocurrency added successfully for user {request.user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error adding accepted cryptocurrency for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to add cryptocurrency'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, crypto_id):
        """
        Soft delete an accepted cryptocurrency
        """
        logger.info(f"Soft deleting accepted cryptocurrency for user {request.user.username}")
        try:
            accepted_crypto = get_object_or_404(
                AcceptedCrypto,
                user=request.user,
                crypto_id=crypto_id
            )
            
            accepted_crypto.deleted = True
            accepted_crypto.save()
            
            logger.info(f"Accepted cryptocurrency removed successfully for user {request.user.username}")
            return Response({'message': 'Cryptocurrency removed successfully'})
            
        except Exception as e:
            logger.error(f"Error removing accepted cryptocurrency for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to remove cryptocurrency'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
