FROM node:20-alpine

# better-sqlite3 requires build tools for native compilation on Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY examples/lottery/package.json ./
RUN npm install --omit=dev

COPY examples/lottery/ .

# SQLite database stored in /app/data for persistent volume mounting
RUN mkdir -p /app/data

EXPOSE 4100

CMD ["node", "server.js"]
