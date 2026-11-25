FROM node:20-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
COPY views ./views
COPY public ./public
COPY data/catalogo.json ./data/catalogo.json
COPY data/raw/condiciones-de-venta.md data/raw/historial-ventas.csv ./data/raw/
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
