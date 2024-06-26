from datetime import datetime
from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericRelation

from star_ratings.models import Rating
from profiles.models import AcceptedCrypto, Profile
from taggit.managers import TaggableManager


def upload_event_picture(instance, filename):
    return "event_pictures/" + instance.title + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"


class Event(models.Model):
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
    ratings = GenericRelation(Rating, related_query_name="ratings")
    tags = TaggableManager(blank=True)

    def __str__(self):
        return self.title + " - " + self.owner.username


class Comment(models.Model):
    """
    Comments on Events.
    """
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True)
    created_on = models.DateTimeField(auto_now_add=True)
    deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_on']

    def __str__(self):
        return "Comment by {} in {}".format(self.user.username, self.event.title)


class ConnectionPlatform(models.Model):
    """
    How the students connect with the professor
    """
    name = models.CharField(max_length=150, blank=True)
    url_link = models.URLField(blank=True)
    deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class Certificate(models.Model):
    """
    A certificate is given to students that assist an event. This, ideally, will be
    hashed and sent to a blockchain.
    """
    date_created = models.DateTimeField(auto_now_add=True)
    event = models.ForeignKey(Event, null=True, on_delete=models.CASCADE)
    user = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
    deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.event.title + " - " + self.user.username


class Bookmark(models.Model):
    """
    Users can bookmark events
    """
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    deleted = models.BooleanField(default=False, null=True, blank=True)

    def __str__(self):
        return self.event.title + " - " + self.user.username


class CertificateRequest(models.Model):
    """
    Students can request a certificate after they assist to an event
    """
    CERTIFICATE_STATES = (("ACCEPTED", "accepted"),
                          ("REJECTED", "rejected"),
                          ("DELETED", "deleted"),
                          ("PENDING", "pending"))

    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    state = models.CharField(max_length=50, choices=CERTIFICATE_STATES, blank=True, default="PENDING")
    date = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        unique_together = ["user", "event"]

    def __str__(self):
        return self.user.username + " - " + self.event.title
