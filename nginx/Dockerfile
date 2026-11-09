FROM nginx:alpine

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
