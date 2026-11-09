"""Gunicorn hooks for persisted log files.

Do not set bind, workers, timeout, accesslog, or errorlog here. Those are
flags on the gunicorn command in entrypoint.sh. Gunicorn applies the command
line after this file, but keeping them off this file means a hook edit cannot
change how the server listens or how many workers it starts.

``on_starting`` runs in the master, before workers are forked.
``post_fork`` runs in the child only.
``post_worker_init`` runs in the child after the Django application is loaded.
"""

import os
import sys

_APP_DIR = os.path.dirname(os.path.abspath(__file__))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)

from academia_blockchain.gunicorn_logging import (  # noqa: E402
    attach_master_log,
    attach_worker_logs,
    detach_inherited_persisted_handlers,
)

_log_dir = os.environ.get("LOGS_DIR", "/app/logs")


def on_starting(server):
    path = attach_master_log(_log_dir)
    server.log.info("Persisted gunicorn master log: %s", path)


def post_fork(server, worker):
    detach_inherited_persisted_handlers()


def post_worker_init(worker):
    attach_worker_logs(_log_dir)
