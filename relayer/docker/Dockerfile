FROM node:20-alpine AS builder

WORKDIR /app

COPY relayer/package.json ./
RUN npm install

COPY relayer/ .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./dist/src/db/migrations
COPY --from=builder /app/logos ./dist/logos

CMD ["node", "dist/src/index.js"]
