# ---- Build stage: install all deps and build the static frontend bundle ----
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: slim image with only what's needed to run the server ----
FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server.ts database.ts ./
COPY src ./src
COPY scripts ./scripts

EXPOSE 5189
CMD ["node", "server.ts"]
