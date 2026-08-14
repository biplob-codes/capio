#!/bin/sh
set -e

PORT="${PORT:-80}"
sed -i "s/PORT_PLACEHOLDER/${PORT}/" /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"