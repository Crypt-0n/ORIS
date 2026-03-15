FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/data /app/uploads
EXPOSE 3001
# Migrations are handled by index.js on startup (await dbReady)
CMD ["node", "index.js"]
