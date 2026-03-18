const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');

loadEnvFile();

const app = express();

const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const redirectUri = `${baseUrl}/callback`;
const sessionSecret = process.env.SESSION_SECRET || 'dev-only-change-me';

const requiredEnvVars = [
    'COGNITO_ISSUER',
    'COGNITO_CLIENT_ID',
    'COGNITO_DOMAIN',
];

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.error('Set them before starting the app.');
    process.exit(1);
}

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

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: baseUrl.startsWith('https://'),
    },
}));

app.set('view engine', 'ejs');

let client;

async function initializeClient() {
    const issuer = await Issuer.discover(process.env.COGNITO_ISSUER);
    const clientConfig = {
        client_id: process.env.COGNITO_CLIENT_ID,
        redirect_uris: [redirectUri],
        response_types: ['code'],
    };

    if (process.env.COGNITO_CLIENT_SECRET) {
        clientConfig.client_secret = process.env.COGNITO_CLIENT_SECRET;
    } else {
        clientConfig.token_endpoint_auth_method = 'none';
    }

    client = new issuer.Client(clientConfig);
    console.log(client);
}

function checkAuth(req, res, next) {
    req.isAuthenticated = Boolean(req.session.userInfo);
    next();
}

app.get('/', checkAuth, (req, res) => {
    res.render('home', {
        isAuthenticated: req.isAuthenticated,
        userInfo: req.session.userInfo,
        error: null,
        baseUrl,
        redirectUri,
    });
});

app.get('/login', (req, res, next) => {
    try {
        if (!client) {
            throw new Error('OIDC client is not initialized yet.');
        }

        const nonce = generators.nonce();
        const state = generators.state();
        const codeVerifier = generators.codeVerifier();
        const codeChallenge = generators.codeChallenge(codeVerifier);

        req.session.nonce = nonce;
        req.session.state = state;
        req.session.codeVerifier = codeVerifier;

        const authUrl = client.authorizationUrl({
            scope: 'openid email phone',
            state,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        res.redirect(authUrl);
    } catch (error) {
        next(error);
    }
});

app.get('/callback', async (req, res, next) => {
    try {
        if (!client) {
            throw new Error('OIDC client is not initialized yet.');
        }

        const params = client.callbackParams(req);
        const tokenSet = await client.callback(
            redirectUri,
            params,
            {
                nonce: req.session.nonce,
                state: req.session.state,
                code_verifier: req.session.codeVerifier,
            }
        );

        const userInfo = await client.userinfo(tokenSet.access_token);

        req.session.userInfo = userInfo;
        req.session.tokenSet = tokenSet;
        delete req.session.nonce;
        delete req.session.state;
        delete req.session.codeVerifier;

        res.redirect('/');
    } catch (error) {
        next(error);
    }
});

app.get('/logout', (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            next(error);
            return;
        }

        const logoutUrl = new URL(`https://${process.env.COGNITO_DOMAIN.replace(/^https?:\/\//, '')}/logout`);
        logoutUrl.searchParams.set('client_id', process.env.COGNITO_CLIENT_ID);
        logoutUrl.searchParams.set('logout_uri', baseUrl);
        res.redirect(logoutUrl.toString());
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        next(error);
        return;
    }

    res.status(500).render('home', {
        isAuthenticated: false,
        userInfo: null,
        error: error.message,
        baseUrl,
        redirectUri,
    });
});

async function start() {
    try {
        await initializeClient();
        app.listen(port, () => {
            console.log(`App listening on ${baseUrl}`);
            console.log(`OIDC callback URL: ${redirectUri}`);
        });
    } catch (error) {
        console.error('Failed to start app:', error);
        process.exit(1);
    }
}

start();
