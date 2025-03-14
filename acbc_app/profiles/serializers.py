from rest_framework import serializers

from django.contrib.auth.models import User

from profiles.models import CryptoCurrency, AcceptedCrypto, ContactMethod, Profile


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class CryptoCurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = CryptoCurrency
        fields = ['id', 'name', 'code']


class AcceptedCryptoSerializer(serializers.ModelSerializer):
    crypto = CryptoCurrencySerializer(read_only=True)

    class Meta:
        model = AcceptedCrypto
        fields = ['id', 'user', 'crypto', 'address', 'deleted']


class ContactMethodSerializer(serializers.ModelSerializer):
    has_contact_url = serializers.SerializerMethodField()

    class Meta:
        model = ContactMethod
        fields = ['id', 'user', 'name', 'description', 'url_link', 'deleted']

    def get_has_contact_url(self, obj):
        return obj.has_contact_url()


class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    # cryptos_list = serializers.SerializerMethodField()  # TODO manejar en otro endpoint

    class Meta:
        model = Profile
        fields = ['user', 'interests', 'profile_description', 'timezone', 'is_teacher', 'profile_picture']

    def get_cryptos_list(self, obj):
        # Fetch all non-deleted AcceptedCrypto instances related to this profile's user
        cryptos = AcceptedCrypto.objects.filter(user=obj.user, deleted=False)
        # Serialize the data
        return AcceptedCryptoSerializer(cryptos, many=True).data
