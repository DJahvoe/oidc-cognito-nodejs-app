const fs = require('fs');
const path = require('path');

loadEnvFile();

const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const config = {
    port,
    baseUrl,
    redirectUri: `${baseUrl}/callback`,
    sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
    cognitoIssuer: process.env.COGNITO_ISSUER,
    cognitoClientId: process.env.COGNITO_CLIENT_ID,
    cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET,
    cognitoDomain: process.env.COGNITO_DOMAIN,
    scopes: process.env.COGNITO_SCOPES || 'openid email profile',
};

validateConfig(config);

module.exports = config;

function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');

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

function validateConfig(currentConfig) {
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
        console.error('Set them before starting the app.');
        process.exit(1);
    }
}
