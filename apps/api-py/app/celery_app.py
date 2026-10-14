# Celery = the system that runs slow jobs in the background, so a web request never has to wait
# for them. Redis is the waiting room: the API drops a job in, a separate "worker" program picks
# it up. Start a worker (from apps/api-py, venv active; --pool=solo is needed on Windows):
#   celery -A app.celery_app worker --pool=solo --loglevel=info
from celery import Celery

from app.config import settings

celery_app = Celery(
    "replay",
    broker=settings.redis_url,
    include=["app.jobs"],  # the files that define our tasks
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,  # we keep results in Postgres, not in Redis
    # Only take a job off the queue as "done" after it finished, so a crashed worker's job is
    # handed out again. Safe because our jobs are idempotent (running twice changes nothing).
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # one job at a time per worker; they are slow and costly
    broker_connection_retry_on_startup=True,
)
