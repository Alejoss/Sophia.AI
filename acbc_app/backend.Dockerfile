### Use stable Python base on Debian Bookworm
FROM python:3.12-slim-bookworm

# Update and install system dependencies
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
     gettext \
     libpq-dev \
     postgresql-client \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files into the Docker image
COPY . /app

# Create logs directory
RUN mkdir -p /app/logs

# Set Python path
ENV PYTHONPATH=/app

# Expose the port Django runs on
EXPOSE 8000

# Environment settings
ENV PYTHONUNBUFFERED=1

# Default to Gunicorn for production, can be overridden in docker-compose
# For development, docker-compose will override this with runserver
CMD ["gunicorn", "academia_blockchain.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]
