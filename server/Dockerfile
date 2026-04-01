FROM node:20-slim
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm prune --omit=dev
RUN mkdir -p /app/data /app/uploads /app/avatars && chown -R node:node /app/data /app/uploads /app/avatars
USER node
EXPOSE 3001
# Migrations are handled by index.js on startup (await dbReady)
CMD ["node", "index.js"]
