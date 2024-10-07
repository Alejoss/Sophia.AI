from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from django.shortcuts import redirect, get_object_or_404
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.contrib.auth import logout as django_logout
from django.middleware.csrf import get_token

from profiles.api.serializers import UserSerializer
from .serializers import ProfileSerializer
from profiles.models import Profile


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


@method_decorator(csrf_exempt, name='dispatch')
class Logout(APIView):
    def post(self, request):
        print("Logging out")
        django_logout(request)  # This will clear the session
        response = Response({'message': 'Logged out successfully'}, status=200)
        response.delete_cookie('jwt')  # Delete the JWT cookie
        return response


@method_decorator(csrf_exempt, name='dispatch')
class Login(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            # Redirect to set JWT token
            return redirect('profiles:set_jwt_token')
        else:
            return Response({'error': 'Invalid credentials'}, status=401)
