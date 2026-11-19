# MicrobeTrace server image (#198).
#
#   docker build -t microbetrace .
#   docker run -p 5000:5000 microbetrace
#
# Set FORCE_HTTPS=1 only behind a proxy that terminates TLS (see README).

# Build the bundles and the published site (exactly the files the app needs, as
# on GitHub Pages) and install the server's production dependencies. The -dev
# image has npm; the runtime image does not need it. dist/, vendor/, fonts/ and
# sw.js aren't committed (#325): they're built here from the dev dependencies,
# with scripts/bundle.sh, which needs bash.
FROM dhi.io/node:26-alpine-dev AS build
WORKDIR /build
RUN apk add --no-cache bash
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && cp -r node_modules /prod_modules && npm ci
COPY . .
RUN npm run bundle && npm run cache
# Optional: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) shows the commit in About
ARG GIT_COMMIT=
RUN GIT_COMMIT=$GIT_COMMIT node scripts/build-site.js _site

# Runtime: the non-dev image, which runs as the unprivileged user "node" (uid 1000)
FROM dhi.io/node:26-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    SITE_DIR=_site
COPY --from=build /prod_modules ./node_modules
COPY --from=build /build/package.json ./
COPY --from=build /build/server.js ./
COPY --from=build /build/_site ./_site
USER node
EXPOSE 5000
# The runtime image has no wget or curl: use node itself
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('http').get({host:'127.0.0.1',port:process.env.PORT||5000,path:'/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "server.js"]
