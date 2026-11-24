# syntax=docker/dockerfile:1
# MicrobeTrace server image (#198).
#
#   docker build -t microbetrace .
#   docker run -p 5000:5000 microbetrace
#
# Set FORCE_HTTPS=1 only behind a proxy that terminates TLS (see README).

# Bundle dist/, vendor/ and fonts/ and the service worker (none of them are
# committed, #325), then build the published site (exactly the files the app
# needs, as on GitHub Pages). The bundles need the dev dependencies (esbuild and
# the libraries), so the build stage installs everything once (#344) and prunes
# the dev dependencies at the end, after the bundles and the site are built. The
# cache mount keeps npm's download cache between builds without putting it in the
# image. The build stage runs as root, so npm's cache is /root/.npm (npm config get
# cache). The -dev image has npm; the runtime image does not need it.
FROM dhi.io/node:26-alpine-dev AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run bundle && npm run cache
# Optional: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) shows the commit in About
ARG GIT_COMMIT=
RUN GIT_COMMIT=$GIT_COMMIT node scripts/build-site.js _site && npm prune --omit=dev

# Runtime: the non-dev image, which runs as the unprivileged user "node" (uid 1000)
FROM dhi.io/node:26-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    SITE_DIR=_site
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/package.json ./
COPY --from=build /build/server.js ./
COPY --from=build /build/_site ./_site
USER node
EXPOSE 5000
# The runtime image has no wget or curl: use node itself
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('http').get({host:'127.0.0.1',port:process.env.PORT||5000,path:'/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "server.js"]
