FROM node:20-alpine

WORKDIR /app

COPY examples/merchant-checkout/merchant-server/package.json examples/merchant-checkout/merchant-server/package-lock.json* ./
RUN npm install --production

COPY examples/merchant-checkout/merchant-server/ .

EXPOSE 3002

CMD ["node", "server.js"]
