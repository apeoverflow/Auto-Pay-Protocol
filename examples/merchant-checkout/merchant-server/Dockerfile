FROM node:20-alpine

WORKDIR /app

COPY examples/merchant-checkout/merchant-server/package.json ./
RUN npm install --omit=dev

COPY examples/merchant-checkout/merchant-server/ .

EXPOSE 3002

CMD ["node", "server.js"]
