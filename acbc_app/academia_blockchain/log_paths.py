"""Application log directory selection.

Docker deletes a container's writable layer and its json-file logs when the
container is recreated. Log files therefore have to live on a mounted volume,
not under /tmp.
"""

import os
import sys


def ensure_writable_dir(path):
    """Create ``path`` and fail if this process cannot create a file there."""
    os.makedirs(path, exist_ok=True)
    probe = os.path.join(path, ".write-probe")
    fd = os.open(probe, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.close(fd)
    try:
        os.remove(probe)
    except OSError:
        pass
    return path


def resolve_logs_dir(
    base_dir,
    environment,
    configured=None,
    fallback_dir="/tmp/academia_blockchain_logs",
    stderr=None,
):
    """Return a writable directory for application log files.

    Production never falls back to ``/tmp``. That directory is wiped with the
    container, which is how historical logs were lost on each recreate.
    """
    target = configured or os.path.join(base_dir, "logs")
    try:
        return ensure_writable_dir(target)
    except OSError as exc:
        if environment == "PRODUCTION":
            raise OSError(
                "Refusing to write production logs to an ephemeral directory. "
                f"Cannot use {target}: {exc}. Mount a volume at LOGS_DIR."
            ) from exc
        ensure_writable_dir(fallback_dir)
        stream = stderr if stderr is not None else sys.stderr
        stream.write(
            f"WARNING: cannot write logs to {target} ({exc}). "
            f"Using ephemeral {fallback_dir}, which is deleted when the "
            "container is recreated.\n"
        )
        return fallback_dir
