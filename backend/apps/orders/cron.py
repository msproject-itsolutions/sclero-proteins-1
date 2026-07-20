"""Plumbing for scheduled jobs.

Scheduled work fails silently — nobody is watching at 03:00. Every job runs
through `job_run()`, which records what ran, how long it took, how much it did
and what broke, so a failure is visible in the admin instead of surfacing a
week later as missing emails.
"""
import logging
import time
from contextlib import contextmanager

from django.utils import timezone

from .models import CronJobRun

logger = logging.getLogger(__name__)


class JobResult:
    """Counters a job fills in as it works."""

    def __init__(self):
        self.processed = 0
        self.failed = 0
        self.message = ''


@contextmanager
def job_run(job_name):
    """Record one execution of `job_name`.

    Yields a JobResult. An exception marks the run FAILED, stores the error and
    re-raises, so a crashed job is visible rather than lost to stderr.
    """
    run = CronJobRun.objects.create(job_name=job_name, status='RUNNING')
    started = time.monotonic()
    result = JobResult()
    try:
        yield result
    except Exception as exc:
        run.status = 'FAILED'
        run.error = f'{type(exc).__name__}: {exc}'[:4000]
        logger.exception('Cron job %s failed', job_name)
        raise
    else:
        # A run that hit per-item errors still completed; surface it as FAILED
        # so it stands out in the admin and can be retried.
        run.status = 'FAILED' if result.failed else 'SUCCESS'
    finally:
        run.finished_at = timezone.now()
        run.duration_ms = int((time.monotonic() - started) * 1000)
        run.processed = result.processed
        run.failed = result.failed
        run.message = (result.message or '')[:4000]
        run.save()
        logger.info(
            'Cron job %s -> %s (processed=%s failed=%s in %sms)',
            job_name, run.status, run.processed, run.failed, run.duration_ms,
        )
