# syntax=docker/dockerfile:1
# One image serves the whole site: the ASP.NET Core API plus the built React app (in wwwroot).
# Same origin on purpose: the refresh-token cookie is SameSite=Strict, so the SPA and API must share an address.
# Build from the repo root:  docker build -t electriccenter .

# ---------- 1. Build the React client ----------
FROM node:24-slim AS client
WORKDIR /src/electriccenter.client
COPY electriccenter.client/package.json electriccenter.client/package-lock.json ./
RUN npm ci
COPY electriccenter.client/ ./
# VITE_* values are baked into the JS bundle at build time (they are public by nature, so never put a secret here).
# Render passes a service's environment variables to the build as build args with the same names.
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_API_BASE_URL="/api"
ARG VITE_WHATSAPP_STRATEGY="click-to-chat"
RUN npm run build

# ---------- 2. Publish the server, with the built client as wwwroot ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src
# SkipClientProject: the SDK image has no npm, and the client was already built above (see the csproj).
COPY ElectricCenter.Server/ElectricCenter.Server.csproj ElectricCenter.Server/
RUN dotnet restore ElectricCenter.Server/ElectricCenter.Server.csproj -p:SkipClientProject=true
COPY ElectricCenter.Server/ ElectricCenter.Server/
COPY --from=client /src/electriccenter.client/dist ElectricCenter.Server/wwwroot
RUN dotnet publish ElectricCenter.Server/ElectricCenter.Server.csproj \
    -c Release -o /app --no-restore -p:SkipClientProject=true -p:UseAppHost=false

# ---------- 3. Runtime image ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=server /app ./

# Render routes traffic to the port in PORT (10000 by default) and terminates HTTPS in front of the container.
# Trusting X-Forwarded-* makes rate limiting see real client IPs and request.Scheme report https.
ENV ASPNETCORE_HTTP_PORTS=10000 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0
EXPOSE 10000

USER $APP_UID
ENTRYPOINT ["dotnet", "ElectricCenter.Server.dll"]
