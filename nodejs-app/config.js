const fs = require('fs');
const path = require('path');

function createConfig({
    appId,
    appName,
    appTagline,
    appDir,
    defaultPort,
    apps,
    theme,
}) {
    loadEnvFile(path.join(appDir, '.env'));

    const port = Number(process.env.PORT || defaultPort);
    const baseUrl = normalizeUrl(process.env.BASE_URL || `http://localhost:${port}`);
    const config = {
        appId,
        appName,
        appTagline,
        appDir,
        port,
        baseUrl,
        redirectUri: `${baseUrl}/callback`,
        sessionSecret: process.env.SESSION_SECRET || `dev-only-change-me-${appId}`,
        cognitoIssuer: process.env.COGNITO_ISSUER,
        cognitoClientId: process.env.COGNITO_CLIENT_ID,
        cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET,
        cognitoDomain: process.env.COGNITO_DOMAIN,
        scopes: process.env.COGNITO_SCOPES || 'openid email profile',
        navigationApps: apps.map((app) => ({
            id: app.id,
            name: app.name,
            url: normalizeUrl(process.env[`${app.id.toUpperCase()}_URL`] || app.defaultUrl),
            isCurrent: app.id === appId,
        })),
        theme,
    };

    validateConfig(config);
    return config;
}

module.exports = {
    createConfig,
};

function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf('=');

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
        const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '');

        if (key && process.env[key] === undefined) {
            process.env[key] = unquotedValue;
        }
    }
}

function normalizeUrl(url) {
    return url.replace(/\/$/, '');
}

function validateConfig(config) {
    if (!Number.isFinite(config.port) || config.port <= 0) {
        console.error(`Invalid PORT value for ${config.appName}: ${config.port}`);
        process.exit(1);
    }

    const requiredSettings = [
        ['COGNITO_ISSUER', config.cognitoIssuer],
        ['COGNITO_CLIENT_ID', config.cognitoClientId],
        ['COGNITO_DOMAIN', config.cognitoDomain],
    ];

    const missingSettings = requiredSettings
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missingSettings.length > 0) {
        console.error(
            `Missing required environment variables for ${config.appName}: ${missingSettings.join(', ')}`
        );
        console.error(`Create ${path.join(config.appDir, '.env')} before starting the app.`);
        process.exit(1);
    }
}
