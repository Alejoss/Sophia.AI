from datetime import datetime
from django.db import models
from django.contrib.auth.models import User

from star_ratings.models import Rating
from profiles.models import AcceptedCrypto, Profile
from taggit.managers import TaggableManager


def upload_event_picture(instance, filename):
    return "event_pictures/" + instance.title + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"
    # TODO utilizar django timezone module


class Event(models.Model):
    # TODO arreglar este model. Incluir Bookmarks.
    """
    It can be a Recorded Course, a Live Course, a Conference, etc.
    """
    EVENT_TYPES = (("LIVE_COURSE", "Live_Course"),
                   ("EVENT", "Event"),
                   ("EXAM", "Exam"),
                   ("PRE_RECORDED", "Pre_Recorded"))
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, blank=True)
    is_recurrent = models.BooleanField(default=False, null=True)
    image = models.ImageField(upload_to=upload_event_picture, null=True, blank=True)

    owner = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
    title = models.CharField(max_length=150, blank=True)
    description = models.CharField(max_length=10000, blank=True)
    platform = models.ForeignKey('ConnectionPlatform', null=True, on_delete=models.CASCADE, blank=True)
    other_platform = models.CharField(max_length=150, blank=True)
    reference_price = models.FloatField(default=0, blank=True, null=True)

    date_created = models.DateTimeField(auto_now_add=True)
    date_start = models.DateTimeField(null=True, blank=True)

    date_end = models.DateTimeField(null=True, blank=True)
    date_recorded = models.DateTimeField(null=True, blank=True)
    schedule_description = models.CharField(max_length=1000, blank=True)  # da flexibilidad
    deleted = models.BooleanField(default=False, blank=True)
    tags = TaggableManager(blank=True)

    def __str__(self):
        return self.title + " - " + self.owner.username
