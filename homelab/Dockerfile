# Built from the REPO ROOT, not from this folder, because the page it serves is the
# one index.html at the root - there is no homelab copy of it to drift out of step.
#   docker build -f homelab/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY homelab/server.js ./
COPY index.html ./public/index.html
# No npm install - server.js has zero dependencies (Node's built-in http/fs only).
ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "server.js"]
