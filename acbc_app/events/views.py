import logging

from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
from events.models import Event


logger = logging.getLogger('app_logger')

"""
API CALLS
"""
