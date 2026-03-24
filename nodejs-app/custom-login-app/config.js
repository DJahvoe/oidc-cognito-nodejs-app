const fs = require('fs');
const path = require('path');

loadEnvFile(path.join(__dirname, '.env'));

const port = Number(process.env.PORT || 5000);
const baseUrl = normalizeUrl(process.env.BASE_URL || `http://localhost:${port}`);
const config = {
    appName: 'Custom Login SSO App',
    port,
    baseUrl,
    redirectUri: `${baseUrl}/callback`,
    sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me-custom-login-sso',
    cognitoIssuer: process.env.COGNITO_ISSUER,
    cognitoClientId: process.env.COGNITO_CLIENT_ID,
    cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET,
    cognitoDomain: process.env.COGNITO_DOMAIN,
    scopes: process.env.COGNITO_SCOPES || 'openid email profile',
};

validateConfig(config);

module.exports = config;

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

function validateConfig(currentConfig) {
    if (!Number.isFinite(currentConfig.port) || currentConfig.port <= 0) {
        console.error(`Invalid PORT value for ${currentConfig.appName}: ${currentConfig.port}`);
        process.exit(1);
    }

    const requiredSettings = [
        ['COGNITO_ISSUER', currentConfig.cognitoIssuer],
        ['COGNITO_CLIENT_ID', currentConfig.cognitoClientId],
        ['COGNITO_DOMAIN', currentConfig.cognitoDomain],
    ];

    const missingSettings = requiredSettings
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missingSettings.length > 0) {
        console.error(`Missing required environment variables: ${missingSettings.join(', ')}`);
        console.error(`Create ${path.join(__dirname, '.env')} before starting the app.`);
        process.exit(1);
    }
}
