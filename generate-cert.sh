#!/bin/bash

# Create certificates directory if it doesn't exist
mkdir -p certificates

# Generate SSL certificate and key
openssl req -nodes -new -x509 -keyout certificates/server.key -out certificates/server.cert -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificates generated in the certificates directory" 