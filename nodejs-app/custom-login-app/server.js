const path = require('path');
const express = require('express');
const session = require('express-session');
const { generators } = require('openid-client');
const config = require('./config');
const { createOidcClient, buildLogoutUrl } = require('../oidc-client');

const SESSION_SYNC_MAX_AGE_MS = 15000;

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.baseUrl.startsWith('https://'),
    },
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function buildViewModel(req, overrides = {}) {
    const isAuthenticated = Boolean(req.session.userInfo);

    return {
        appInfo: {
            name: config.appName,
            baseUrl: config.baseUrl,
            redirectUri: config.redirectUri,
            issuer: config.cognitoIssuer,
            clientId: config.cognitoClientId,
            domain: config.cognitoDomain,
            scopes: config.scopes,
        },
        pageLinks: [
            { href: '/', label: 'Home', current: req.path === '/' },
            { href: '/public-page', label: 'Public Page', current: req.path === '/public-page' },
            { href: '/protected-page', label: 'Protected Page', current: req.path === '/protected-page' },
            { href: '/login', label: 'Login', current: req.path === '/login' },
        ],
        isAuthenticated,
        userInfo: req.session.userInfo || null,
        error: null,
        ...overrides,
    };
}

function requireAuthentication(req, res, next) {
    if (req.session.userInfo) {
        next();
        return;
    }

    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
}

function synchronizeManagedLoginSession(req, res, next) {
    if (!shouldAttemptSessionSync(req)) {
        next();
        return;
    }

    req.session.returnTo = req.originalUrl;
    res.redirect('/session-sync');
}

function shouldAttemptSessionSync(req) {
    if (req.method !== 'GET') {
        return false;
    }

    if (['/login', '/login/direct', '/logout', '/callback', '/session-sync'].includes(req.path)) {
        return false;
    }

    const lastSessionSyncAt = req.session.lastSessionSyncAt || 0;
    return Date.now() - lastSessionSyncAt > SESSION_SYNC_MAX_AGE_MS;
}

function beginAuthorization(req, res, client, options = {}) {
    const nonce = generators.nonce();
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.nonce = nonce;
    req.session.state = state;
    req.session.codeVerifier = codeVerifier;

    const authorizationParams = {
        scope: config.scopes,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        ...options,
    };

    res.redirect(client.authorizationUrl(authorizationParams));
}

function clearTransientAuthState(req) {
    delete req.session.nonce;
    delete req.session.state;
    delete req.session.codeVerifier;
    delete req.session.returnTo;
    delete req.session.authIntent;
}

app.use(synchronizeManagedLoginSession);

app.get('/', (req, res) => {
    res.render('home', buildViewModel(req));
});

app.get('/login', (req, res) => {
    res.render('login', buildViewModel(req, {
        formValues: {
            username: '',
        },
    }));
});

app.get('/login/direct', (req, res, next) => {
    if (!req.app.locals.client) {
        next(new Error('OIDC client is not initialized yet.'));
        return;
    }

    try {
        req.session.authIntent = 'login';
        beginAuthorization(req, res, req.app.locals.client);
    } catch (error) {
        next(error);
    }
});

app.post('/login', (req, res, next) => {
    const username = (req.body.username || '').trim();

    if (!req.app.locals.client) {
        next(new Error('OIDC client is not initialized yet.'));
        return;
    }

    try {
        req.session.authIntent = 'login';
        beginAuthorization(req, res, req.app.locals.client, {
            login_hint: username || undefined,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/session-sync', (req, res, next) => {
    if (!req.app.locals.client) {
        next(new Error('OIDC client is not initialized yet.'));
        return;
    }

    try {
        req.session.authIntent = 'sync';
        beginAuthorization(req, res, req.app.locals.client, {
            prompt: 'none',
        });
    } catch (error) {
        next(error);
    }
});

app.get('/callback', async (req, res, next) => {
    try {
        const client = req.app.locals.client;
        const authIntent = req.session.authIntent || 'login';

        if (!client) {
            throw new Error('OIDC client is not initialized yet.');
        }

        const params = client.callbackParams(req);

        if (params.error) {
            if (authIntent === 'sync' && params.error === 'login_required') {
                delete req.session.userInfo;
                delete req.session.tokenSet;
                req.session.lastSessionSyncAt = Date.now();
                const returnTo = req.session.returnTo || '/';
                clearTransientAuthState(req);
                res.redirect(returnTo);
                return;
            }

            clearTransientAuthState(req);
            throw new Error(params.error_description || params.error || 'Authentication failed.');
        }

        const tokenSet = await client.callback(
            config.redirectUri,
            params,
            {
                nonce: req.session.nonce,
                state: req.session.state,
                code_verifier: req.session.codeVerifier,
            }
        );

        const userInfo = await client.userinfo(tokenSet.access_token);

        req.session.tokenSet = tokenSet;
        req.session.userInfo = userInfo;
        req.session.lastSessionSyncAt = Date.now();

        const returnTo = req.session.returnTo || '/';
        clearTransientAuthState(req);

        res.redirect(returnTo);
    } catch (error) {
        next(error);
    }
});

app.get('/public-page', (req, res) => {
    res.render('page', buildViewModel(req, {
        pageTitle: 'Public Page',
        pageEyebrow: 'Open Route',
        pageSummary: 'This page is available before login. It proves the app can expose public content while still using Cognito Hosted UI for SSO-aware sign-in.',
        accessMode: 'Public',
        detailItems: [
            {
                label: 'Authentication required',
                value: 'No',
            },
            {
                label: 'Use case',
                value: 'Marketing, documentation, pricing, or pre-login explanation pages.',
            },
            {
                label: 'Suggested test',
                value: 'Open this route first. Then use the custom /login page to begin Cognito sign-in.',
            },
        ],
        bodySections: [
            {
                heading: 'How this keeps your own page',
                paragraphs: [
                    'The page and the /login route are both fully yours. Cognito only takes over at the moment you redirect to the authorize endpoint.',
                    'Because the actual sign-in still happens on Cognito managed login, you keep the Cognito browser session and SSO behavior used by App 1 and App 2.',
                ],
            },
        ],
    }));
});

app.get('/protected-page', requireAuthentication, (req, res) => {
    res.render('page', buildViewModel(req, {
        pageTitle: 'Protected Page',
        pageEyebrow: 'Protected Route',
        pageSummary: 'This page requires a local session, but the session is created through Cognito Hosted UI after the custom landing page starts the authorize flow.',
        accessMode: 'Authenticated only',
        detailItems: [
            {
                label: 'Authentication required',
                value: 'Yes',
            },
            {
                label: 'Guard behavior',
                value: 'The app stores the original path, shows the local login page, then sends the browser to Cognito.',
            },
            {
                label: 'Suggested test',
                value: 'Sign in on App 1 first, then open this page here. Cognito should reuse its existing session.',
            },
        ],
        bodySections: [
            {
                heading: 'What happens here',
                paragraphs: [
                    'Unauthenticated users are redirected to the local /login page first, not directly to Cognito.',
                    'After the user continues from your branded page, Cognito either prompts for credentials or silently reuses its existing hosted session and then sends the browser back to this protected page.',
                ],
            },
        ],
    }));
});

app.get('/logout', (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            next(error);
            return;
        }

        res.redirect(buildLogoutUrl(config));
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        next(error);
        return;
    }

    res.status(500).render('home', buildViewModel(req, {
        error: error.message,
    }));
});

async function start() {
    try {
        app.locals.client = await createOidcClient(config);
        app.listen(config.port, () => {
            console.log(`${config.appName} listening on ${config.baseUrl}`);
            console.log(`${config.appName} callback URL: ${config.redirectUri}`);
        });
    } catch (error) {
        console.error(`Failed to start ${config.appName}:`, error);
        process.exit(1);
    }
}

start();
