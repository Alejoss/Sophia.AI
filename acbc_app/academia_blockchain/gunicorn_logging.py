"""Copy Gunicorn logs onto the persisted log volume.

Gunicorn's default ``-`` log files are stdout and stderr. Docker stores those
streams beside the container and deletes them on recreate. Extra rotating file
handlers keep access and error history on the logs volume.
"""

import logging
import os
from logging.handlers import RotatingFileHandler

_FORMAT = "[%(asctime)s] %(levelname)s [%(name)s] %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"
_MAX_BYTES = 10 * 1024 * 1024
_BACKUP_COUNT = 5
_FILES = {
    "gunicorn.error": "gunicorn-error.log",
    "gunicorn.access": "gunicorn-access.log",
}


def attach_persisted_gunicorn_handlers(log_dir, logger_names=None):
    """Attach rotating file handlers. Existing handlers (stdout/stderr) stay."""
    os.makedirs(log_dir, exist_ok=True)
    names = logger_names if logger_names is not None else tuple(_FILES)
    attached = []
    for name in names:
        filename = _FILES[name]
        path = os.path.abspath(os.path.join(log_dir, filename))
        logger = logging.getLogger(name)
        if any(
            isinstance(handler, RotatingFileHandler)
            and getattr(handler, "baseFilename", None) == path
            for handler in logger.handlers
        ):
            continue
        handler = RotatingFileHandler(
            path,
            maxBytes=_MAX_BYTES,
            backupCount=_BACKUP_COUNT,
        )
        handler.setFormatter(logging.Formatter(_FORMAT, _DATEFMT))
        logger.addHandler(handler)
        attached.append(path)
    return attached
