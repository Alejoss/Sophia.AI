from datetime import datetime
import logging

from courses.models import ConnectionPlatform

logger = logging.getLogger('app_logger')


def get_event_data_request(request):
    """
    Processes form data from a Django request to extract and log information about an event,
    returning a dictionary with the processed data.

    Args:
        request: HttpRequest object containing the form data.

    Returns:
        A dictionary containing processed event data.
    """
    # Extract data from the request object
    event_type_description = request.POST.get("event_type_description")
    event_recurrent = bool(request.POST.get("event_recurrent"))
    title = request.POST.get("title")
    description = request.POST.get("description")
    platform_name = request.POST.get("platform_name")
    other_platform = request.POST.get("other_platform")
    date_start = request.POST.get("date_start")
    date_end = request.POST.get("date_end")
    time_day = request.POST.get("time_day")
    record_date = request.POST.get("record_date")
    schedule_description = request.POST.get("schedule_description")
    tags = request.POST.getlist("tags[]")

    # Log extracted data for debugging purposes
    logger.info(f"event_type_description: {event_type_description}")
    logger.info(f"event_recurrent: {event_recurrent}")
    logger.info(f"title: {title}")
    logger.info(f"description: {description}")
    logger.info(f"platform_name: {platform_name}")
    logger.info(f"other_platform: {other_platform}")
    logger.info(f"date_start: {date_start}")
    logger.info(f"date_end: {date_end}")
    logger.info(f"time_day: {time_day}")
    logger.info(f"record_date: {record_date}")
    logger.info(f"schedule_description: {schedule_description}")

    # Determine event type based on description
    if event_type_description == "pre_recorded":
        event_type = "PRE_RECORDED"
    elif event_type_description == "live_course":
        event_type = "COURSE"
    elif event_type_description == "event_single":
        event_type = "EVENT"
    elif event_type_description == "exam":
        event_type = "EXAM"
    else:
        logger.warning(f"EVENT TYPE NOT RECOGNIZED: {event_type_description}")
        event_type = "COURSE"  # Default event type

    # Convert date and time strings to datetime objects
    if date_start:
        date_start = datetime.strptime(date_start, "%d/%m/%Y")
    else:
        date_start = None

    if date_end:
        date_end = datetime.strptime(date_end, "%d/%m/%Y")
    else:
        date_end = None

    if time_day and date_start:
        time_day = datetime.strptime(time_day, "%I:%M %p")
        date_start = date_start.replace(hour=time_day.hour, minute=time_day.minute)

    if record_date:
        record_date = datetime.strptime(record_date, "%d/%m/%Y")
    else:
        record_date = None

    # Retrieve the platform object based on the platform name
    try:
        platform_obj = ConnectionPlatform.objects.get(name=platform_name)
    except Exception as e:
        logger.warning("ERROR saving platform name")
        logger.warning(e)
        platform_obj = None

    # Return the processed data as a dictionary
    return {
        "event_type": event_type,
        "event_recurrent": event_recurrent,
        "title": title,
        "description": description,
        "platform": platform_obj,
        "other_platform": other_platform,
        "date_start": date_start,
        "date_end": date_end,
        "time_day": time_day,
        "record_date": record_date,
        "schedule_description": schedule_description,
        "tags": tags
    }
