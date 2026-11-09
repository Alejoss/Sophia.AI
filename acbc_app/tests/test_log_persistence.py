"""Logs must survive a container recreate.

Docker deletes json-file logs and the container writable layer on recreate.
These tests cover the directory choice, the Gunicorn file copy, and the
entrypoint scripts that keep nginx and Postgres history on a volume.
"""

import io
import logging
import logging.config
import os
import stat
import subprocess
import tempfile
from logging.handlers import RotatingFileHandler
from pathlib import Path

from django.test import SimpleTestCase

from academia_blockchain.gunicorn_logging import (
    MASTER_LOG,
    attach_master_log,
    attach_worker_logs,
    detach_inherited_persisted_handlers,
)
from academia_blockchain.log_paths import resolve_logs_dir

REPO_ROOT = Path(__file__).resolve().parents[2]


class ResolveLogsDirTests(SimpleTestCase):
    def test_creates_configured_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "logs"
            resolved = resolve_logs_dir(tmp, "PRODUCTION", configured=str(target))
            self.assertEqual(resolved, str(target))
            self.assertTrue(target.is_dir())

    def test_production_refuses_ephemeral_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            blocked = Path(tmp) / "not-a-directory"
            blocked.write_text("file", encoding="utf-8")
            fallback = Path(tmp) / "fallback"
            with self.assertRaises(OSError) as raised:
                resolve_logs_dir(
                    tmp,
                    "PRODUCTION",
                    configured=str(blocked),
                    fallback_dir=str(fallback),
                )
            self.assertIn("ephemeral", str(raised.exception))
            self.assertFalse(fallback.exists())

    def test_development_falls_back_and_warns(self):
        with tempfile.TemporaryDirectory() as tmp:
            blocked = Path(tmp) / "not-a-directory"
            blocked.write_text("file", encoding="utf-8")
            fallback = Path(tmp) / "fallback"
            stderr = Path(tmp) / "stderr.txt"
            with stderr.open("w", encoding="utf-8") as stream:
                resolved = resolve_logs_dir(
                    tmp,
                    "DEVELOPMENT",
                    configured=str(blocked),
                    fallback_dir=str(fallback),
                    stderr=stream,
                )
            self.assertEqual(resolved, str(fallback))
            self.assertTrue(fallback.is_dir())
            warning = stderr.read_text(encoding="utf-8")
            self.assertIn("ephemeral", warning)
            self.assertIn(str(blocked), warning)


class GunicornFileLogTests(SimpleTestCase):
    def tearDown(self):
        for name in ("gunicorn.error", "gunicorn.access"):
            logger = logging.getLogger(name)
            for handler in list(logger.handlers):
                if isinstance(handler, RotatingFileHandler):
                    handler.close()
                    logger.removeHandler(handler)
        super().tearDown()

    def test_master_and_workers_use_different_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            error_logger = logging.getLogger("gunicorn.error")
            access_logger = logging.getLogger("gunicorn.access")
            previous = (error_logger.propagate, access_logger.propagate, access_logger.level)
            error_logger.propagate = False
            access_logger.propagate = False
            access_logger.setLevel(logging.INFO)
            stream = logging.StreamHandler(io.StringIO())
            error_logger.addHandler(stream)
            try:
                master_path = attach_master_log(tmp)
                error_logger.error("master-line")
                # Forked worker: drop the master's descriptor, then open worker files.
                detach_inherited_persisted_handlers()
                self.assertFalse(any(
                    getattr(handler, "_acbc_persisted_log", False)
                    for handler in error_logger.handlers
                ))
                attached = attach_worker_logs(tmp)
                self.assertEqual(len(attached), 2)
                # Stream handler from gunicorn's stdout/stderr setup must remain.
                self.assertIn(stream, error_logger.handlers)
                error_logger.error("worker-line")
                access_logger.info("access-line")
                again = attach_worker_logs(tmp)
                self.assertEqual(again, [])

                master_text = Path(master_path).read_text(encoding="utf-8")
                worker_text = (Path(tmp) / "gunicorn-error.log").read_text(encoding="utf-8")
                access_text = (Path(tmp) / "gunicorn-access.log").read_text(encoding="utf-8")
                self.assertIn("master-line", master_text)
                self.assertNotIn("worker-line", master_text)
                self.assertIn("worker-line", worker_text)
                self.assertNotIn("master-line", worker_text)
                self.assertIn("access-line", access_text)
                self.assertEqual(master_path, str(Path(tmp) / MASTER_LOG))
            finally:
                error_logger.propagate, access_logger.propagate, access_level = previous
                access_logger.setLevel(access_level)
                error_logger.removeHandler(stream)
                stream.close()

    def test_django_logging_config_does_not_drop_gunicorn_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            error_logger = logging.getLogger("gunicorn.error")
            previous_propagate = error_logger.propagate
            error_logger.propagate = False
            try:
                attach_worker_logs(tmp)
                logging.config.dictConfig({
                    "version": 1,
                    "disable_existing_loggers": False,
                    "handlers": {
                        "console": {"class": "logging.StreamHandler"},
                    },
                    "loggers": {
                        "django": {"handlers": ["console"], "level": "INFO"},
                    },
                    "root": {"handlers": ["console"], "level": "WARNING"},
                })
                error_logger.error("after-django-config")
                text = (Path(tmp) / "gunicorn-error.log").read_text(encoding="utf-8")
                self.assertIn("after-django-config", text)
            finally:
                error_logger.propagate = previous_propagate
                detach_inherited_persisted_handlers()

    def test_gunicorn_config_does_not_set_process_options(self):
        config = (REPO_ROOT / "acbc_app" / "gunicorn.conf.py").read_text(encoding="utf-8")
        entrypoint = (REPO_ROOT / "acbc_app" / "entrypoint.sh").read_text(encoding="utf-8")
        for forbidden in ("bind =", "workers =", "timeout =", "accesslog =", "errorlog ="):
            self.assertNotIn(forbidden, config)
        self.assertIn("def on_starting", config)
        self.assertIn("def post_fork", config)
        self.assertIn("def post_worker_init", config)
        self.assertIn("--bind 0.0.0.0:8000", entrypoint)
        self.assertIn("--workers 3", entrypoint)
        self.assertIn("--timeout 600", entrypoint)
        self.assertIn("--access-logfile -", entrypoint)
        self.assertIn("--error-logfile -", entrypoint)
        self.assertIn("--config /app/gunicorn.conf.py", entrypoint)


class ComposeLogVolumeTests(SimpleTestCase):
    def test_prod_compose_keeps_log_volumes_outside_the_container(self):
        text = (REPO_ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
        self.assertIn("backend_logs:/app/logs", text)
        self.assertIn("nginx_logs:/var/log/nginx/persisted", text)
        self.assertIn("frontend_logs:/var/log/nginx/persisted", text)
        self.assertIn("postgres_logs:/var/log/postgresql", text)
        self.assertIn("name: acbc_prod_backend_logs", text)
        self.assertIn("00-persisted-logs.conf", text)
        self.assertIn("acbc-nginx-entrypoint.sh", text)
        self.assertIn("postgres-entrypoint.sh", text)

    def test_dev_compose_uses_separate_log_volume_names(self):
        text = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("backend_logs:/app/logs", text)
        self.assertIn("name: acbc_dev_backend_logs", text)
        self.assertNotIn("acbc_prod_backend_logs", text)


class EntrypointPersistenceTests(SimpleTestCase):
    def test_nginx_entrypoint_rotates_oversized_logs_before_start(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            log_dir = tmp_path / "logs"
            log_dir.mkdir()
            access = log_dir / "access.log"
            access.write_text("old-access-line\n", encoding="utf-8")
            marker = tmp_path / "marker"
            stub = tmp_path / "docker-entrypoint.sh"
            stub.write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$MARKER\"\n",
                encoding="utf-8",
            )
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
            env = os.environ.copy()
            env.update(
                {
                    "NGINX_PERSISTED_LOG_DIR": str(log_dir),
                    "NGINX_LOG_MAX_BYTES": "4",
                    "NGINX_LOG_BACKUPS": "3",
                    "NGINX_DOCKER_ENTRYPOINT": str(stub),
                    "MARKER": str(marker),
                }
            )
            completed = subprocess.run(
                [
                    "sh",
                    str(REPO_ROOT / "nginx" / "acbc-nginx-entrypoint.sh"),
                    "nginx",
                    "-g",
                    "daemon off;",
                ],
                env=env,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            rotated = (log_dir / "access.log.1").read_text(encoding="utf-8")
            self.assertIn("old-access-line", rotated)
            self.assertFalse(access.exists())
            self.assertIn("nginx", marker.read_text(encoding="utf-8"))
            self.assertIn(str(log_dir), completed.stdout)

    def test_nginx_entrypoint_leaves_small_logs_in_place(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            log_dir = tmp_path / "logs"
            log_dir.mkdir()
            access = log_dir / "access.log"
            access.write_text("ok\n", encoding="utf-8")
            stub = tmp_path / "docker-entrypoint.sh"
            stub.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
            env = os.environ.copy()
            env.update(
                {
                    "NGINX_PERSISTED_LOG_DIR": str(log_dir),
                    "NGINX_LOG_MAX_BYTES": "1000",
                    "NGINX_DOCKER_ENTRYPOINT": str(stub),
                }
            )
            completed = subprocess.run(
                ["sh", str(REPO_ROOT / "nginx" / "acbc-nginx-entrypoint.sh")],
                env=env,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(access.read_text(encoding="utf-8"), "ok\n")
            self.assertFalse((log_dir / "access.log.1").exists())

    def test_postgres_entrypoint_keeps_logs_across_a_new_process(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            log_dir = tmp_path / "pglogs"
            stub = tmp_path / "docker-entrypoint.sh"
            stub.write_text(
                "#!/bin/bash\necho \"stdout-$STUB_ID\"\necho \"stderr-$STUB_ID\" >&2\n",
                encoding="utf-8",
            )
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
            script = REPO_ROOT / "scripts" / "docker" / "postgres-entrypoint.sh"

            def run_once(stub_id):
                env = os.environ.copy()
                env.update(
                    {
                        "POSTGRES_LOG_DIR": str(log_dir),
                        "POSTGRES_DOCKER_ENTRYPOINT": str(stub),
                        "POSTGRES_LOG_MAX_BYTES": "10485760",
                        "STUB_ID": stub_id,
                    }
                )
                return subprocess.run(
                    ["bash", str(script), "postgres"],
                    env=env,
                    check=False,
                    capture_output=True,
                    text=True,
                )

            first = run_once("one")
            self.assertEqual(first.returncode, 0, first.stderr)
            second = run_once("two")
            self.assertEqual(second.returncode, 0, second.stderr)

            # A recreate is a new process with the same volume directory.
            saved = (log_dir / "postgresql.log").read_text(encoding="utf-8")
            self.assertIn("stdout-one", saved)
            self.assertIn("stderr-one", saved)
            self.assertIn("stdout-two", saved)
            self.assertIn("stderr-two", saved)
            self.assertIn("stdout-one", first.stdout)
            self.assertIn("stdout-two", second.stdout)
