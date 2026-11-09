"""Gunicorn settings for the production container.

stdout/stderr stay attached so ``docker compose logs`` shows the running
container. ``on_starting`` also copies access and error logs into LOGS_DIR,
which is a volume mounted at /app/logs.
"""

import os

from academia_blockchain.gunicorn_logging import attach_persisted_gunicorn_handlers

bind = "0.0.0.0:8000"
workers = 3
timeout = 600
accesslog = "-"
errorlog = "-"

_log_dir = os.environ.get("LOGS_DIR", "/app/logs")


def on_starting(server):
    paths = attach_persisted_gunicorn_handlers(_log_dir)
    server.log.info("Persisted gunicorn logs: %s", ", ".join(paths))
