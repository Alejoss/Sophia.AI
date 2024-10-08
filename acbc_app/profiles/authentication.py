from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from rest_framework import exceptions


class CustomAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE']) or None
        print("Raw token from cookie:", raw_token)

        if raw_token is None:
            print("No token found in cookies.")
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            print("Token validated successfully.")
        except exceptions.AuthenticationFailed as e:
            print("Token validation failed:", str(e))
            raise

        user, token = self.get_user(validated_token), validated_token
        print("User obtained from token:", user)
        return user, token
