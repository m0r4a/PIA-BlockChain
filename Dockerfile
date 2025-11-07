# Stage 1: Construir los smart contract
FROM node:20-alpine AS contracts-builder
WORKDIR /contracts

COPY src/contract/package*.json ./
RUN npm install

COPY src/contract/hardhat.config.js src/contract/deploy.js ./
RUN mkdir ./contracts
COPY src/contract/contract.sol ./contracts/

RUN npx hardhat compile

# Stage 2: Construir el backend
FROM golang:1.21-alpine AS backend-builder
WORKDIR /backend

RUN apk add --no-cache git

COPY src/backend/go.mod ./
COPY src/backend/main.go ./

RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

# Stage 3: Construir el frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

COPY src/frontend/package*.json ./
RUN npm install

COPY src/frontend/index.html src/frontend/app.js src/frontend/styles.css ./

# Stage 4: Runtime
FROM node:20-alpine

RUN apk add --no-cache \
	bash \
	curl \
	ca-certificates \
	netcat-openbsd

WORKDIR /app
RUN mkdir -p /app/contracts /app/backend /app/frontend /app/data /app/deployments

# copiar artifacts de contracts
COPY --from=contracts-builder /contracts/node_modules /app/contracts/node_modules
COPY --from=contracts-builder /contracts/artifacts /app/contracts/artifacts
COPY --from=contracts-builder /contracts/cache /app/contracts/cache

# configurar estructura que hardhat espera
RUN mkdir -p /app/contracts/contracts
COPY --from=contracts-builder /contracts/contracts/contract.sol /app/contracts/contracts/
COPY --from=contracts-builder /contracts/hardhat.config.js /app/contracts/
COPY --from=contracts-builder /contracts/deploy.js /app/contracts/
COPY --from=contracts-builder /contracts/package.json /app/contracts/

# copiar binario de Go
COPY --from=backend-builder /backend/app /app/backend/app

# copiar archivos de frontend
COPY --from=frontend-builder /frontend/ /app/frontend/

# script de inicio
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080 8545 3000

ENV NODE_ENV=production
ENV BLOCKCHAIN_URL=http://localhost:8545
ENV PORT=8080
ENV FRONTEND_PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
	CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
