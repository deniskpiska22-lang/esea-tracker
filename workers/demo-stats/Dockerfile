FROM node:24-bookworm-slim
WORKDIR /app/workers/demo-stats
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.js ./
USER node
ENV RAYON_NUM_THREADS=1
CMD ["node", "worker.js"]
