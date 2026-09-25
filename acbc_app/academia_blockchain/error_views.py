from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render


def page_not_found(request, exception):
    """Branded HTML 404 for browsers; JSON for API clients."""
    accept = request.headers.get('Accept', '')
    if request.path.startswith('/api/') and 'text/html' not in accept:
        return JsonResponse({'detail': 'Not found.'}, status=404)

    frontend_url = getattr(settings, 'FRONTEND_PUBLIC_URL', 'https://www.academiablockchain.com')
    return render(
        request,
        '404.html',
        {
            'frontend_url': frontend_url.rstrip('/'),
            'request_path': request.path,
        },
        status=404,
    )
