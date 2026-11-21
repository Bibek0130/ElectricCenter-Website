import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { env } from 'process';

// The dev server's HTTPS certificate comes from `dotnet dev-certs`. Only the dev server needs it, so this is
// skipped for `vite build` (the production Docker image builds the SPA in a Node-only stage, with no dotnet).
function loadDevCertificate() {
    const baseFolder =
        env.APPDATA !== undefined && env.APPDATA !== ''
            ? `${env.APPDATA}/ASP.NET/https`
            : `${env.HOME}/.aspnet/https`;

    const certificateName = "electriccenter.client";
    const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
    const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

    if (!fs.existsSync(baseFolder)) {
        fs.mkdirSync(baseFolder, { recursive: true });
    }

    if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
        if (0 !== child_process.spawnSync('dotnet', [
            'dev-certs',
            'https',
            '--export-path',
            certFilePath,
            '--format',
            'Pem',
            '--no-password',
        ], { stdio: 'inherit', }).status) {
            throw new Error("Could not create certificate.");
        }
    }

    return {
        key: fs.readFileSync(keyFilePath),
        cert: fs.readFileSync(certFilePath),
    };
}

const target = env.ASPNETCORE_HTTPS_PORT ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
    env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'https://localhost:7023';

/**
 * Writes `seo-data.json` next to index.html, generated from src/seo/siteSeo.js: the same module the browser reads for
 * titles and descriptions. The server loads this file so the tags it writes into each page's HTML (for crawlers and
 * link previews, which don't run JavaScript) can never disagree with the ones the browser sets.
 * See Seo/SeoSiteData.cs on the server for the matching shape.
 */
function emitSeoData() {
    return {
        name: 'emit-seo-data',
        apply: 'build',
        async generateBundle() {
            const { toServerData } = await import(new URL('./src/seo/siteSeo.js', import.meta.url).href);
            this.emitFile({ type: 'asset', fileName: 'seo-data.json', source: JSON.stringify(toServerData(), null, 2) });
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    plugins: [plugin(), emitSeoData()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        proxy: {
            '^/weatherforecast': {
                target,
                secure: false
            },
            '^/api': {
                target,
                secure: false
            }
        },
        port: parseInt(env.DEV_SERVER_PORT || '60083'),
        https: command === 'serve' ? loadDevCertificate() : undefined,
    }
}))
