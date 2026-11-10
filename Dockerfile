FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node dist ./dist
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8766
EXPOSE 8766
CMD ["node", "server.mjs"]
