#!/bin/bash

# DO NOT RUN THIS SCRIPT ON PRODUCTION ENVIRONMENTS!
# See the [Readme](https://github.com/AABoyles/WebMicrobeTrace/sslcert/README.md) For a discussion of why not

openssl genrsa -out key.pem
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
