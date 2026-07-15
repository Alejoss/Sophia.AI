from django.apps import AppConfig


class ContentConfig(AppConfig):
    name = 'content'

    def ready(self):
        from content.signals import connect_topic_activity_signals

        connect_topic_activity_signals()
