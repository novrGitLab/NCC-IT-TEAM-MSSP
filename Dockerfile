# Built from an explicit Dockerfile instead of Nixpacks. Nixpacks keeps node_modules/.cache as a
# persistent mount point, so `npm ci` (which deletes node_modules first) failed with EBUSY on Railway.
# Here npm ci runs in a clean image layer with no cache mounts.
FROM node:20-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
