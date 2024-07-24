import pytz
import logging
import json
from hashlib import sha256
import requests
from PIL import Image, ImageDraw, ImageFont
import base64
from io import BytesIO
from urllib.request import urlopen

from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from star_ratings.models import Rating
from taggit.models import Tag

from .models import Event
from courses.serializers import EventSerializer
from courses.models import Event, ConnectionPlatform, Bookmark, CertificateRequest, Certificate, Comment
from profiles.models import ContactMethod, AcceptedCrypto, Profile
from courses.utils import get_event_data_request


logger = logging.getLogger('app_logger')

"""
HTML RENDERS
"""


# Display a list of all non-deleted events along with their associated tags

# Display about page
def about(request):
    template = "courses/about.html"
    context = {"info_index_active": "active"}
    return render(request, template, context)


# Display a page with extra info on descentralized education
def descentralize_education(request):
    template = "courses/descentralize_education.html"
    context = {"info_index_active": "active"}
    return render(request, template, context)


# Display events associated with a specific tag
def events_tag(request, tag_id):
    template = "courses/events_tag.html"
    tag = get_object_or_404(Tag, id=tag_id)
    tags = Tag.objects.all()
    events = Event.objects.filter(tags__name__in=[tag.name])
    context = {"events": events, "event_index_active": "active", "tags": tags, "tag": tag}
    return render(request, template, context)


# Display all events
def events_all(request):
    template = "courses/events_all.html"
    events = Event.objects.all()
    tags = Tag.objects.all()
    context = {"events": events, "event_index_active": "active", "tags": tags}
    return render(request, template, context)


# Handle search functionality for events
def event_search(request):
    template = "courses/events_result.html"
    if request.method == "POST":
        query = request.POST.get("q")
        logger.debug("query: %s" % query)

        events = Event.objects.filter(title__icontains=query)

        logger.debug("events: %s" % events)
        context = {"events": events, "query": query}
        return render(request, template, context)
    else:
        return HttpResponse(status=400)


def event_detail(request, event_id):
    """
    Displays detailed information about a specific event. This view provides information including
    contact methods, accepted cryptocurrencies, user profile, event comments, and ratings.
    It also checks the user's status (authenticated or not) to display personalized information.

    Args:
        request: HttpRequest object containing metadata about the request.
        event_id: The ID of the event to be displayed.

    Returns:
        Rendered HTML response with detailed information about the specified event.
    """
    template = "courses/event_detail.html"

    # Retrieve the event or return a 404 error if not found
    event = get_object_or_404(Event, id=event_id)
    logger.debug(f"event: {event}")

    # Fetch contact methods and cryptocurrencies of the event's owner
    contact_methods = ContactMethod.objects.filter(user=event.owner, deleted=False)
    accepted_cryptos = AcceptedCrypto.objects.filter(user=event.owner, deleted=False)
    owner_profile = Profile.objects.get(user=event.owner)

    logger.debug(f"contact_methods: {contact_methods}")

    # Initialize variables for additional user-related data
    event_user_timezone = None
    logged_user_profile = None
    event_is_bookmarked = False
    user_certificate_request = None

    # Check if the request user is authenticated
    if request.user.is_authenticated:
        # Retrieve the logged-in user's profile
        logged_user_profile = Profile.objects.get(user=request.user)
        try:
            # Convert event start time to the user's timezone
            user_timezone = pytz.timezone("America/Guayaquil")
            event_user_timezone = event.date_start.astimezone(user_timezone)
        except Exception as e:
            pass

        # Check if the event is bookmarked by the user
        event_is_bookmarked = Bookmark.objects.filter(event=event, user=request.user, deleted=False).exists()

        # Check if the user has a pending certificate request for the event
        if CertificateRequest.objects.filter(event=event, user=request.user).exists():
            user_certificate_request = CertificateRequest.objects.get(event=event, user=request.user)

    logger.debug(f"event_user_timezone: {event_user_timezone}")
    logger.debug(f"logged_user_profile: {logged_user_profile}")
    logger.debug(f"event_is_bookmarked: {event_is_bookmarked}")

    # Check if the request user is the event owner
    is_event_owner = (event.owner == request.user)
    certificate_requests = CertificateRequest.objects.none()

    logger.debug(f"is_event_owner: {is_event_owner}")
    if is_event_owner:
        # Retrieve pending certificate requests if the user owns the event
        certificate_requests = CertificateRequest.objects.filter(event=event, state="PENDING")
        logger.debug(f"certificate_requests: {certificate_requests}")

    # Retrieve non-deleted comments and ratings for the event
    comments = Comment.objects.filter(event=event, deleted=False)
    rating = Rating.objects.for_instance(event)

    # Check if the user has a certificate for the event
    has_certificate = False
    if request.user.is_authenticated:
        has_certificate = Certificate.objects.filter(event=event, user=request.user).exists()
    logger.debug(f"has_certificate: {has_certificate}")
    logger.debug(f"user_certificate_request: {user_certificate_request}")

    # Prepare context data for rendering the event detail page
    context = {
        "event": event,
        "contact_methods": contact_methods,
        "accepted_cryptos": accepted_cryptos,
        "owner_profile": owner_profile,
        "event_user_timezone": event_user_timezone,
        "logged_user_profile": logged_user_profile,
        "event_is_bookmarked": event_is_bookmarked,
        "is_event_owner": is_event_owner,
        "user_certificate_request": user_certificate_request,
        "certificate_requests": certificate_requests,
        "comments": comments,
        'rating': rating,
        'lack_certificate': not has_certificate,
    }

    # Render and return the event detail page
    return render(request, template, context)


@login_required
def event_create(request):
    """
    Handle the creation of a new event. This view supports both GET and POST requests.
    GET requests return a form for creating a new event, pre-populated with necessary data.
    POST requests process the submitted form to create an event and redirect to the event detail page.
    Requires the user to be logged in.
    """

    if request.method == "GET":
        # Prepare the template and context data for event creation form
        template = "courses/event_create_english.html"
        platforms = ConnectionPlatform.objects.filter(deleted=False)  # Retrieve available platforms
        profile = Profile.objects.get(user=request.user)  # Get the profile of the logged-in user
        user_contact_methods = ContactMethod.objects.filter(user=request.user)  # User's contact methods

        # Log data to help in debugging or monitoring
        logger.debug(f"Platforms: {platforms}")
        logger.debug(f"Profile email confirmed: {profile.email_confirmed}")

        context = {
            "event_index_active": "active",  # Context variable to indicate active page
            "platforms": platforms,
            "profile": profile,
            "user_contact_methods": user_contact_methods
        }

        return render(request, template, context)

    elif request.method == "POST":
        # Process form data to create a new event
        event_data = get_event_data_request(request)

        # Create event instance
        created_event = Event.objects.create(
            event_type=event_data['event_type'],
            is_recurrent=event_data['event_recurrent'],
            owner=request.user,
            title=event_data['title'],
            description=event_data['description'],
            platform=event_data['platform'],
            other_platform=event_data['other_platform'],
            date_start=event_data['date_start'],
            date_end=event_data['date_end'],
            date_recorded=event_data['record_date'],
            schedule_description=event_data['schedule_description']
        )

        # Update profile to reflect user as a teacher
        # TODO this should check if the user actually created a course
        profile = Profile.objects.get(user=request.user)
        profile.is_teacher = True
        profile.save()

        # Save the uploaded event picture, if available
        if "event_picture" in request.FILES:
            event_picture = request.FILES['event_picture']
            logger.debug(f"Event picture: {event_picture}")
            created_event.image.save(event_picture.name, event_picture)

        # Add tags to the created event
        for tag in event_data['tags']:
            logger.debug(f"Tag added: {tag}")
            created_event.tags.add(tag)

        # Redirect to the detail view of the newly created event
        return redirect("event_detail", event_id=created_event.id)


@login_required
def event_edit(request, event_id):
    """
    Handle the editing of an existing event. This view supports both GET and POST requests.
    GET requests provide a form prefilled with the event's current details.
    POST requests process the submitted form to update the event and redirect to its detail page.
    Requires the user to be logged in.

    Args:
        request: HttpRequest object.
        event_id: The ID of the event to be edited.

    Returns:
        HttpResponse object with the rendered edit form on GET.
        HttpResponse redirecting to the event detail page on successful POST, or back to the form on error.
    """

    if request.method == "GET":
        # Fetch the event or return 404 if not found
        event = get_object_or_404(Event, id=event_id)
        # Log event retrieval
        logger.debug(f"Event: {event}")

        # Retrieve data necessary for the form
        platforms = ConnectionPlatform.objects.filter(deleted=False)  # Available platforms for the event
        user_contact_methods = ContactMethod.objects.filter(user=event.owner)  # Contact methods of the event's owner
        event_tags = [e.name for e in event.tags.all()]  # Current tags of the event

        # Log the fetched data
        logger.debug(f"Platforms: {platforms}")
        logger.debug(f"User contact methods: {user_contact_methods}")

        # Prepare the context with the event data and supporting information
        context = {
            "event": event,
            "platforms": platforms,
            "user_contact_methods": user_contact_methods,
            "event_tags": json.dumps(event_tags)  # Serialize tags for JSON transport
        }

        # Render and return the event editing form
        template = "courses/event_edit.html"
        return render(request, template, context)

    elif request.method == "POST":
        # Fetch the event or return 404 if not found
        event = get_object_or_404(Event, id=event_id)
        # Get data from the form submission
        event_data = get_event_data_request(request)

        # Update the event details based on form data
        event.event_type = event_data['event_type']
        event.is_recurrent = event_data['event_recurrent']
        event.owner = request.user
        event.title = event_data['title']
        event.description = event_data['description']
        event.platform = event_data['platform']
        event.other_platform = event_data['other_platform']
        event.date_start = event_data['date_start']
        event.date_end = event_data['date_end']
        event.date_recorded = event_data['record_date']
        event.schedule_description = event_data['schedule_description']
        event.save()  # Save the updated event details

        # Handle event picture upload
        if "event_picture" in request.FILES:
            event_picture = request.FILES['event_picture']
            logger.debug(f"Event picture: {event_picture}")
            event.image.save(event_picture.name, event_picture)

        # Update tags based on changes in the form
        event_tags = [e.name for e in event.tags.all()]
        for tag in event_data['tags']:
            if tag not in event_tags:
                event.tags.add(tag.strip())
                logger.debug(f"New tag added: {tag}")
        for existing_tag in event_tags:
            if existing_tag not in event_data['tags']:
                event.tags.remove(existing_tag)
                logger.debug(f"Removed tag: {existing_tag}")

        # Redirect to the detail view of the event after successful update
        return redirect("event_detail", event_id=event.id)


@login_required
def event_delete(request, event_id):
    """
    Deletes an event by setting its 'deleted' attribute to True, effectively soft deleting the event.
    Only the owner of the event is allowed to delete it.

    Args:
        request: HttpRequest object containing metadata about the request.
        event_id: The ID of the event to be deleted.

    Returns:
        Redirects to the profile events page if successful, or an HTTP 403 response if the user is not the owner.
    """
    # Retrieve the event or return 404 if not found
    deleted_event = get_object_or_404(Event, id=event_id)
    logger.debug(f"Deleted event: {deleted_event}")

    # Ensure that only the owner can delete the event
    if request.user != deleted_event.owner:
        return HttpResponse(status=403)  # Forbidden response if not the owner

    # Soft delete the event
    deleted_event.deleted = True
    deleted_event.save()

    # Redirect to the user's profile events page after deletion
    return redirect("profile_events")


@login_required
def event_comment(request, event_id):
    """
    Handles the creation of comments for an event. Only supports POST requests.
    Adds a comment to an event if valid text is provided.

    Args:
        request: HttpRequest object containing metadata and the POST data.
        event_id: The ID of the event to which the comment is to be added.

    Returns:
        Redirects to the event detail page after adding the comment or an HTTP 400 response for bad requests.
    """
    if request.method == "POST":
        # Fetch the event or return 404 if not found
        event = get_object_or_404(Event, id=event_id)
        comment_text = request.POST.get("comment_text", None)

        # Log the event and the text of the comment
        logger.debug(f"Event: {event}")
        logger.debug(f"Comment text: {comment_text}")

        # Create a comment if there's text provided
        if comment_text:
            comment = Comment.objects.create(
                event=event,
                user=request.user,
                text=comment_text
            )
            logger.debug(f"Comment created: {comment}")

        # Redirect to the detail page of the event after commenting
        return redirect("event_detail", event_id=event.id)
    else:
        # Return a 400 Bad Request response if the request method is not POST
        return HttpResponse(status=400)


def certificate_preview(request, cert_id):
    """
    Generates a preview of a certificate by rendering text on a base certificate image.
    The text includes the event title, the event owner's username, the certificate holder's username, and the date created.

    Args:
        request: HttpRequest object containing metadata about the request.
        cert_id: The ID of the certificate to preview.

    Returns:
        HttpResponse object with the rendered certificate preview.
    """
    template = "courses/certificate_preview.html"

    # Retrieve the certificate or return 404 if not found
    certificate = get_object_or_404(Certificate, id=cert_id)

    # Fetch the base image for the certificate
    certificate_image_base = requests.get("https://criptolibertad.s3.us-west-2.amazonaws.com/img/base_cert.jpg")
    img = Image.open(BytesIO(certificate_image_base.content))

    # Define fonts for the text to be drawn on the certificate
    font_title_event = ImageFont.truetype(
        urlopen("https://criptolibertad.s3.us-west-2.amazonaws.com/img/fonts/Roboto-Medium.ttf"), size=70)
    font_title_event_medium = ImageFont.truetype(
        urlopen("https://criptolibertad.s3.us-west-2.amazonaws.com/img/fonts/Roboto-Medium.ttf"), size=38)
    font_owner_event = ImageFont.truetype(
        urlopen("https://criptolibertad.s3.us-west-2.amazonaws.com/img/fonts/Roboto-LightItalic.ttf"), size=38)
    font_owner_certificate = ImageFont.truetype(
        urlopen("https://criptolibertad.s3.us-west-2.amazonaws.com/img/fonts/Roboto-Black.ttf"), size=40)
    font_date = ImageFont.truetype(
        urlopen("https://criptolibertad.s3.us-west-2.amazonaws.com/img/fonts/Roboto-LightItalic.ttf"), size=24)

    img_draw = ImageDraw.Draw(img)

    # Draw event title on the certificate
    if len(certificate.event.title) < 33:
        img_draw.multiline_text((450, 350), certificate.event.title, font=font_title_event, fill=(96, 96, 96))
    else:
        img_draw.multiline_text((450, 350), certificate.event.title, font=font_title_event_medium, fill=(96, 96, 96))

    # Draw the event owner's username
    img_draw.multiline_text((545, 505), certificate.event.owner.username, font=font_owner_event, fill=(96, 96, 96))

    # Draw the certificate holder's username
    img_draw.multiline_text((310, 800), certificate.user.username, font=font_owner_certificate, fill=(96, 96, 96))

    # Draw the creation date of the certificate
    img_draw.multiline_text((310, 935), certificate.date_created.strftime("%d %b %Y"), font=font_date,
                            fill=(96, 96, 96))

    # Save the modified image to a buffer and encode it to base64 for HTML display
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    img_bytes = buffered.getvalue()  # bytes
    img_base64 = base64.b64encode(img_bytes)  # Base64-encoded bytes
    img_str = img_base64.decode('utf-8')  # Decode for use in HTML

    context = {"img_str": img_str}
    return render(request, template, context)


def send_cert_blockchain(request, cert_id):
    """
    Renders a page that allows users to send a certificate's hash to the blockchain.
    The certificate details are hashed to create a unique identifier which can be stored on the blockchain,
    ensuring the authenticity and non-repudiation of the certificate.

    Args:
        request: HttpRequest object containing metadata about the request.
        cert_id: The ID of the certificate to be sent to the blockchain.

    Returns:
        HttpResponse object with the rendered page including certificate details and hash.
    """
    template = "courses/send_cert_blockchain.html"

    # Retrieve the certificate or return 404 if not found
    certificate = get_object_or_404(Certificate, id=cert_id)

    # Concatenate certificate details to form a string and encode it in UTF-8
    cert_text = (certificate.user.username + certificate.user.first_name + certificate.user.last_name +
                 certificate.event.title + certificate.event.owner.username).encode("utf8")
    logger.debug(f"Certificate text for hashing: {cert_text}")

    # Compute SHA-256 hash of the certificate text
    cert_hash = sha256(cert_text).hexdigest()  # Convert hash object to hexadecimal string
    logger.debug(f"Certificate hash: {cert_hash}")

    # Prepare context with certificate details and its hash
    context = {"certificate": certificate, "cert_text": cert_text, "cert_hash": cert_hash}

    # Render and return the page with the certificate hash
    return render(request, template, context)


"""
API CALLS
"""


@login_required
def event_bookmark(request, event_id):
    """
    API endpoint to bookmark an event. This function handles bookmarking an event by toggling the
    bookmark status depending on whether it was previously bookmarked and then deleted.
    It uses POST requests only and expects the request to be made via AJAX.

    Args:
        request: HttpRequest object containing metadata about the request.
        event_id: The ID of the event to be bookmarked.

    Returns:
        HttpResponse with status code 200 if the bookmark already exists and isn't deleted,
        HttpResponse with status code 201 if a new bookmark is created or a deleted one is restored,
        HttpResponse with status code 403 if the request is not made via AJAX.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the event or return 404 if not found
        event = get_object_or_404(Event, id=event_id)
        logger.debug(f"Event to be bookmarked: {event}")

        # Check if the event is already bookmarked and not marked as deleted
        if Bookmark.objects.filter(event=event, user=request.user, deleted=False).exists():
            # No action needed, just confirm the bookmark exists
            return HttpResponse(status=200)
        else:
            # Check if there is a deleted bookmark for the same event and user
            if Bookmark.objects.filter(event=event, user=request.user, deleted=True).exists():
                # If so, restore the bookmark
                bookmark = Bookmark.objects.get(event=event, user=request.user, deleted=True)
                logger.debug(f"Restoring bookmark: {bookmark}")
                bookmark.deleted = False
                bookmark.save()
            else:
                # If no bookmark exists, create a new one
                Bookmark.objects.create(event=event, user=request.user)
            # Return status code 201 to indicate a new resource was created or restored
            return HttpResponse(status=201)
    else:
        # If the request is not made via AJAX, return forbidden status
        return HttpResponse(status=403)


@login_required
def remove_bookmark(request, event_id):
    """
    API endpoint to remove a bookmark from an event. This function handles unbookmarking by setting
    the 'deleted' attribute of the bookmark to True. It uses POST requests only and expects the request
    to be made via AJAX.

    Args:
        request: HttpRequest object containing metadata about the request.
        event_id: The ID of the event from which the bookmark is to be removed.

    Returns:
        HttpResponse with status code 200 if the bookmark is successfully marked as deleted,
        HttpResponse with status code 404 if no existing bookmark is found,
        HttpResponse with status code 403 if the request is not made via AJAX.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the event or return 404 if not found
        event = get_object_or_404(Event, id=event_id)

        # Check if the bookmark exists and is not already marked as deleted
        if Bookmark.objects.filter(event=event, user=request.user, deleted=False).exists():
            # Retrieve the bookmark and mark it as deleted
            bookmark = Bookmark.objects.get(user=request.user, event=event, deleted=False)
            logger.debug(f"Removing bookmark: {bookmark}")
            bookmark.deleted = True
            bookmark.save()
            # Return status code 200 to indicate successful deletion
            return HttpResponse(status=200)
        else:
            # Return status code 404 if no active bookmark exists
            return HttpResponse(status=404)
    else:
        # Return status code 403 if the request is not made via AJAX
        return HttpResponse(status=403)


def certificate_detail(request, certificate_id):
    """
    Retrieve and return details of a specific certificate as a JSON response. This includes user and event details
    associated with the certificate.

    Args:
        request: HttpRequest object containing metadata about the request.
        certificate_id: The ID of the certificate for which details are requested.

    Returns:
        JsonResponse containing detailed information about the certificate.
    """
    # Retrieve the certificate or return a 404 error if not found
    certificate = get_object_or_404(Certificate, id=certificate_id)

    # Prepare the certificate data for the JsonResponse
    cert_data = {
        "id": certificate.id,
        "username": certificate.user.username,
        "first_name": certificate.user.first_name,
        "last_name": certificate.user.last_name,
        "cert_date": certificate.date_created,
        "event_title": certificate.event.title,
        "event_description": certificate.event.description,
        "event_owner_username": certificate.event.owner.username,
        "event_owner_first_name": certificate.event.owner.first_name,
        "event_owner_last_name": certificate.event.owner.last_name,
    }

    # Return the certificate data as JSON
    return JsonResponse(cert_data)


@login_required
def request_certificate(request, event_id):
    """
    Handles the creation or reactivation of a certificate request for an event. This endpoint requires
    an AJAX POST request. It either reactivates a previously deleted request or creates a new one.

    Args:
        request: HttpRequest object containing metadata about the request.
        event_id: The ID of the event for which the certificate request is made.

    Returns:
        HttpResponse with status code 201 if the request is successfully processed,
        HttpResponse with status code 403 if the request is not made via AJAX or is not a POST request.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the event or return 404 if not found
        event = get_object_or_404(Event, id=event_id)
        logger.debug(f"Event: {event}")

        # Check if there's a deleted certificate request for this event and user
        if CertificateRequest.objects.filter(event=event, user=request.user, state="DELETED").exists():
            # Reactivate the deleted certificate request
            certificate_request = CertificateRequest.objects.get(event=event, user=request.user, state="DELETED")
            logger.debug(f"Reactivating certificate request: {certificate_request}")
            certificate_request.state = "PENDING"
            certificate_request.save()
        else:
            # Create a new certificate request with a state of 'PENDING'
            CertificateRequest.objects.create(event=event, user=request.user, state="PENDING")

        # Return HTTP 201 to indicate the resource was created or modified successfully
        return HttpResponse(status=201)
    else:
        # Return HTTP 403 for non-AJAX requests or non-POST methods
        return HttpResponse(status=403)


@login_required
def cancel_cert_request(request, cert_request_id):
    """
    Cancels a certificate request if it has not already resulted in an issued certificate. If the certificate
    exists, it adjusts the request state to 'ACCEPTED' instead of canceling it. This endpoint is intended to
    be used with AJAX and POST requests only.

    Args:
        request: HttpRequest object containing metadata about the request.
        cert_request_id: The ID of the certificate request to be cancelled.

    Returns:
        HttpResponse with status code 201 if the operation is successful,
        HttpResponse with status code 403 if the request user does not match the user associated with the certificate request,
        HttpResponse with status code 400 if the request is not made via AJAX or is not a POST request.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the certificate request or return 404 if not found
        certificate_request = get_object_or_404(CertificateRequest, id=cert_request_id)
        logger.debug(f"Processing certificate request: {certificate_request}")

        # Ensure that the user making the request is the same as the user who made the certificate request
        if request.user == certificate_request.user:
            # Check if a certificate has already been issued for this request
            if Certificate.objects.filter(event=certificate_request.event, user=certificate_request.user).exists():
                logger.debug(f"Attempting to cancel an existing certificate: {certificate_request.id}")
                # If a certificate exists, set the state to 'ACCEPTED' to prevent cancellation
                certificate_request.state = "ACCEPTED"
            else:
                # Otherwise, mark the request as 'DELETED'
                certificate_request.state = "DELETED"
            certificate_request.save()
            return HttpResponse(status=201)
        else:
            # Log a warning if the user does not have permission to cancel the request
            logger.debug(f"Unauthorized access attempt by user: {request.user}")
            logger.debug(f"Certificate request event owner: {certificate_request.event.owner}")
            return HttpResponse(status=403)
    else:
        # Return HTTP 400 for non-AJAX requests or non-POST methods
        return HttpResponse(status=400)


@login_required
def accept_cert_request(request, cert_request_id):
    """
    Approves a certificate request if the request user is the event owner. If no certificate has previously been issued,
    it creates a new certificate. This endpoint requires AJAX and POST requests to ensure secure and asynchronous processing.

    Args:
        request: HttpRequest object containing metadata about the request.
        cert_request_id: The ID of the certificate request to be accepted.

    Returns:
        HttpResponse with status code 201 if the operation is successful and the certificate request is accepted,
        HttpResponse with status code 403 if the user making the request is not the event owner,
        HttpResponse with status code 400 if the request is not made via AJAX or is not a POST request.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the certificate request or return 404 if not found
        certificate_request = get_object_or_404(CertificateRequest, id=cert_request_id)
        logger.debug(f"Processing certificate request: {certificate_request}")

        # Check if the user making the request is the event owner
        if request.user == certificate_request.event.owner:
            # Verify if a certificate already exists for the request
            if Certificate.objects.filter(event=certificate_request.event, user=certificate_request.user).exists():
                logger.debug("Certificate already exists.")
            else:
                # Create a new certificate if one does not exist
                new_cert = Certificate.objects.create(event=certificate_request.event, user=certificate_request.user)
                logger.debug(f"New certificate created: {new_cert}")
            # Set the state of the certificate request to 'ACCEPTED'
            certificate_request.state = "ACCEPTED"
            certificate_request.save()
            return HttpResponse(status=201)
        else:
            # Return status code 403 if the user is not authorized to accept the certificate request
            return HttpResponse(status=403)
    else:
        # Return status code 400 for requests that are not AJAX or POST
        return HttpResponse(status=400)


@login_required
def reject_cert_request(request, cert_request_id):
    """
    Rejects a certificate request unless a certificate has already been issued for it. This function is
    accessible only to the event owner and requires an AJAX POST request for security and efficiency.

    Args:
        request: HttpRequest object containing metadata about the request.
        cert_request_id: The ID of the certificate request to be rejected.

    Returns:
        HttpResponse with status code 201 if the operation is successful and the certificate request is rejected,
        HttpResponse with status code 403 if the user making the request is not the event owner,
        HttpResponse with status code 400 if the request is not made via AJAX or is not a POST request.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the certificate request or return 404 if not found
        certificate_request = get_object_or_404(CertificateRequest, id=cert_request_id)
        logger.debug(f"Processing certificate request: {certificate_request}")

        # Verify that the user making the request is the event owner
        if request.user == certificate_request.event.owner:
            # Check if a certificate has already been issued for the request
            if Certificate.objects.filter(event=certificate_request.event, user=certificate_request.user).exists():
                logger.debug(f"Attempt to reject an existing certificate: {certificate_request.id}")
                # If a certificate exists, ensure the request remains accepted
                certificate_request.state = "ACCEPTED"
                certificate_request.save()
            else:
                # Otherwise, set the request state to 'REJECTED' and save the changes
                certificate_request.state = "REJECTED"
                certificate_request.save()
            return HttpResponse(status=201)
        else:
            # Return status code 403 if the user is not authorized to reject the certificate request
            return HttpResponse(status=403)
    else:
        # Return status code 400 for non-AJAX or non-POST requests
        return HttpResponse(status=400)


@login_required
def restore_cert_request(request, cert_request_id):
    """
    Restores a previously rejected or cancelled certificate request, changing its state back to 'PENDING'.
    This function is accessible only to the event owner and requires an AJAX POST request to ensure security and efficiency.
    Restoration is not allowed if a certificate has already been issued.

    Args:
        request: HttpRequest object containing metadata about the request.
        cert_request_id: The ID of the certificate request to be restored.

    Returns:
        HttpResponse with status code 201 if the operation is successful and the certificate request is restored,
        HttpResponse with status code 403 if the user making the request is not the event owner,
        HttpResponse with status code 400 if the request is not made via AJAX or is not a POST request.
    """
    if request.is_ajax() and request.method == "POST":
        # Retrieve the certificate request or return 404 if not found
        certificate_request = get_object_or_404(CertificateRequest, id=cert_request_id)
        logger.debug(f"Processing restoration of certificate request: {certificate_request}")

        # Verify that the user making the request is the event owner
        if request.user == certificate_request.event.owner:
            # Check if a certificate has already been issued for the request
            if Certificate.objects.filter(event=certificate_request.event, user=certificate_request.user).exists():
                logger.debug(
                    f"Attempt to restore a certificate request for which a certificate already exists: {certificate_request.id}")
                # Skip restoration as a certificate exists
            else:
                # If no certificate exists, set the request state back to 'PENDING'
                certificate_request.state = "PENDING"
                certificate_request.save()
            return HttpResponse(status=201)
        else:
            # Return status code 403 if the user is not authorized to restore the certificate request
            return HttpResponse(status=403)
    else:
        # Return status code 400 for non-AJAX or non-POST requests
        return HttpResponse(status=400)
