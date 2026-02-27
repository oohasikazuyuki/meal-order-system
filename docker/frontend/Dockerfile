FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./

RUN npm install

EXPOSE 3000
