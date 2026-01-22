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

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set Python path
ENV PYTHONPATH=/app

# Expose the port Django runs on
EXPOSE 8000

# Environment settings
ENV PYTHONUNBUFFERED=1

# Use entrypoint script that chooses command based on ENVIRONMENT
# Use bash explicitly to ensure it works even if permissions are wrong
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
