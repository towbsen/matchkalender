FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies (only production deps during final image)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy app sources
COPY . .

# Ensure data directory exists
RUN mkdir -p /app/data

FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only what we need from build stage
COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "src/server.js"]
