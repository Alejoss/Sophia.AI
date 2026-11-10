"""Copy Gunicorn logs onto the persisted log volume.

The process settings (bind, workers, timeout, stdout/stderr) stay on the
command line in ``entrypoint.sh``. This module only adds file handlers.

Hooks must not share one RotatingFileHandler across ``fork``. The master
opens ``gunicorn-master.log`` in ``on_starting``. Each worker closes that
inherited descriptor in ``post_fork`` and opens its own access and error
files in ``post_worker_init`` (after Django's logging config). Workers still
share those two files with each other, the same way Django's own rotating
handlers do.
"""

import logging
import os
from logging.handlers import RotatingFileHandler

_FORMAT = "[%(asctime)s] %(levelname)s [%(process)d] [%(name)s] %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"
_MAX_BYTES = 10 * 1024 * 1024
_BACKUP_COUNT = 5
_MARKER = "_acbc_persisted_log"
MASTER_LOG = "gunicorn-master.log"
WORKER_LOGS = {
    "gunicorn.error": "gunicorn-error.log",
    "gunicorn.access": "gunicorn-access.log",
}


def _rotating_handler(path):
    handler = RotatingFileHandler(
        path,
        maxBytes=_MAX_BYTES,
        backupCount=_BACKUP_COUNT,
    )
    handler.setFormatter(logging.Formatter(_FORMAT, _DATEFMT))
    setattr(handler, _MARKER, True)
    return handler


def _already_attached(logger, path):
    return any(
        getattr(handler, _MARKER, False)
        and getattr(handler, "baseFilename", None) == path
        for handler in logger.handlers
    )


def attach_master_log(log_dir):
    """Arbiter-only file. Timeouts and boot messages are logged by the master."""
    os.makedirs(log_dir, exist_ok=True)
    path = os.path.abspath(os.path.join(log_dir, MASTER_LOG))
    logger = logging.getLogger("gunicorn.error")
    if not _already_attached(logger, path):
        logger.addHandler(_rotating_handler(path))
    return path


def detach_inherited_persisted_handlers():
    """Close persisted handlers in the child process only.

    ``close()`` drops the worker's copy of the descriptor. The master keeps
    its own descriptor in the parent process.
    """
    for name in ("gunicorn.error", "gunicorn.access"):
        logger = logging.getLogger(name)
        for handler in list(logger.handlers):
            if getattr(handler, _MARKER, False):
                logger.removeHandler(handler)
                handler.close()


def attach_worker_logs(log_dir):
    """Per-worker access and error files. Existing stdout/stderr handlers stay."""
    os.makedirs(log_dir, exist_ok=True)
    attached = []
    for name, filename in WORKER_LOGS.items():
        path = os.path.abspath(os.path.join(log_dir, filename))
        logger = logging.getLogger(name)
        if _already_attached(logger, path):
            continue
        logger.addHandler(_rotating_handler(path))
        attached.append(path)
    return attached
