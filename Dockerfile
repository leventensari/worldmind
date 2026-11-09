FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY client ./client
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node","server/server.js"]
