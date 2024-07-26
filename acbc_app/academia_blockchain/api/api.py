# profiles/api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from django.urls import reverse_lazy


class ApiRoot(APIView):
    def get(self, request, format=None):
        return Response({
            'profiles': request.build_absolute_uri(reverse_lazy('profile-list')),
            'courses': request.build_absolute_uri(reverse_lazy('course-list')),
            'content': request.build_absolute_uri(reverse_lazy('library-list')),
            'group': request.build_absolute_uri(reverse_lazy('group-list')),
            'users': request.build_absolute_uri(reverse_lazy('user-detail')),
        })
