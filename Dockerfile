## Stage 1: deps and build hypervisor
FROM golang:1.24.2-alpine AS builder

WORKDIR /src
# Install git to clone the repo
RUN apk add --no-cache git \
    && git clone https://gitverse.ru/tvfn/studio-hypervisor.git .

# Build the server binary
WORKDIR /src/cmd/server
RUN go build -o hypervisor


## Stage 2: final image
FROM node:23-alpine AS deps

WORKDIR /app
ENV STUDIO_HV_CONFIG_FILE=/app/repo/.studio/hv.yaml

RUN apk add --no-cache curl

# Copy built hypervisor from builder
COPY --from=builder /src/cmd/server/hypervisor /app/bin/hypervisor
RUN chmod +x /app/bin/hypervisor

# Install Node dependencies
COPY package.json package-lock.json* ./
RUN npm run install-deps

# Expose ports and set entrypoint
EXPOSE 3000
EXPOSE 9090
ENTRYPOINT ["/app/bin/hypervisor"]

HEALTHCHECK --interval=3s --timeout=2m --retries=20 \
    CMD curl -sS --max-time 3 -o /dev/null http://localhost:9090/ || exit 1
