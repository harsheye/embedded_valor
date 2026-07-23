FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache ffmpeg
RUN npm install
COPY . .
RUN npm run build
EXPOSE 49998
CMD ["node", "start-app.js"]
