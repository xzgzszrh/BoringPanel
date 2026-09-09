FROM node:22-bookworm-slim AS dependencies

WORKDIR /workspace/agent-service
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /workspace/agent-service
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY --from=dependencies --chown=node:node /workspace/agent-service/dist ./dist
RUN mkdir -p /var/lib/scry-agent && chown node:node /var/lib/scry-agent

USER node
EXPOSE 4111
CMD ["npm", "run", "start"]
