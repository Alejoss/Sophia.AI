# profiles/api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from django.urls import reverse_lazy


class ApiRoot(APIView):
    def get(self, request, format=None):
        # TODO regresar al router pero mantener la declaracion de urls en las carpetas api/urls
        return Response({
            'profiles': request.build_absolute_uri(reverse_lazy('profile-list')),
            'courses': request.build_absolute_uri(reverse_lazy('course-list')),
        })
