# Build stage: compile TypeScript with dev dependencies present.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: production dependencies and compiled output only.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# App Runner health checks hit /health on this port.
ENV PORT=8080
EXPOSE 8080

# Never run as root in a container that handles customer documents.
USER node

CMD ["node", "dist/index.js"]
