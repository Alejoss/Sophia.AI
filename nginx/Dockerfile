# Stable 1.30.8 fixes CVE-2026-123007 and CVE-2026-123633 (HTTP/2 RCE)
# and CVE-2026-132779. Pin the manifest list so a floating tag cannot roll back.
FROM nginx:1.30.8-alpine@sha256:6437a63b5c529f0e06162b3f593c0154cff6fa2ea0f94fd7c27928cb399e022d

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY persisted-logs.conf /etc/nginx/conf.d/00-persisted-logs.conf
COPY acbc-nginx-entrypoint.sh /opt/acbc-nginx-entrypoint.sh

# Persisted access/error logs are mounted here in compose. Create the
# directory so the image can boot before the volume is attached.
RUN mkdir -p /var/www/certbot /var/log/nginx/persisted \
    && chmod +x /opt/acbc-nginx-entrypoint.sh

# Expose ports
EXPOSE 80 443

ENTRYPOINT ["/opt/acbc-nginx-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
