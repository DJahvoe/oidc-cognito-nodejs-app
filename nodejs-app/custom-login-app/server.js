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
            { href: '/programmatic-demo', label: 'Programmatic Demo', current: req.path === '/programmatic-demo' },
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

    if (['/login', '/login/direct', '/login/authorize', '/programmatic-demo', '/logout', '/callback', '/session-sync'].includes(req.path)) {
        return false;
    }

    const lastSessionSyncAt = req.session.lastSessionSyncAt || 0;
    return Date.now() - lastSessionSyncAt > SESSION_SYNC_MAX_AGE_MS;
}

function buildNewAuthRequest() {
    const nonce = generators.nonce();
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    return {
        nonce,
        state,
        codeVerifier,
        codeChallenge,
    };
}

function createAuthRequest(req) {
    const authRequest = buildNewAuthRequest();

    req.session.nonce = authRequest.nonce;
    req.session.state = authRequest.state;
    req.session.codeVerifier = authRequest.codeVerifier;

    return authRequest;
}

function buildAuthorizationParams(authRequest, options = {}) {
    return {
        scope: config.scopes,
        state: authRequest.state,
        nonce: authRequest.nonce,
        code_challenge: authRequest.codeChallenge,
        code_challenge_method: 'S256',
        ...options,
    };
}

function buildManagedLoginUrl(authRequest, options = {}) {
    const loginParams = buildAuthorizationParams(authRequest, {
        response_type: 'code',
        client_id: config.cognitoClientId,
        redirect_uri: config.redirectUri,
        ...options,
    });
    const loginUrl = new URL(`https://${config.cognitoDomain.replace(/^https?:\/\//, '')}/login`);

    Object.entries(loginParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            loginUrl.searchParams.set(key, value);
        }
    });

    return loginUrl;
}

function summarizeSetCookieHeader(setCookieHeader = []) {
    return setCookieHeader.map((cookieEntry) => {
        const segments = cookieEntry.split(';').map((segment) => segment.trim()).filter(Boolean);
        const [nameValue, ...attributes] = segments;
        const cookieName = nameValue.split('=')[0];
        const visibleAttributes = attributes.filter((attribute) => (
            /^domain=/i.test(attribute) ||
            /^path=/i.test(attribute) ||
            /^samesite=/i.test(attribute) ||
            /^secure$/i.test(attribute) ||
            /^httponly$/i.test(attribute)
        ));

        return [`${cookieName}=<redacted>`, ...visibleAttributes].join('; ');
    });
}

function getSetCookieHeaders(headers) {
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie();
    }

    const setCookieHeader = headers.get('set-cookie');
    return setCookieHeader ? [setCookieHeader] : [];
}

function buildCookieHeader(setCookieHeader = []) {
    return setCookieHeader
        .map((cookieEntry) => cookieEntry.split(';')[0])
        .filter(Boolean)
        .join('; ');
}

async function summarizeFetchResponse(response) {
    const body = await response.text();
    const setCookieHeaders = getSetCookieHeaders(response.headers);

    return {
        statusCode: response.status,
        location: response.headers.get('location'),
        contentType: response.headers.get('content-type') || 'unknown',
        setCookie: summarizeSetCookieHeader(setCookieHeaders),
        bodyPreview: body.replace(/\s+/g, ' ').trim().slice(0, 500),
    };
}

async function runImpossibleFetchLoginDemo() {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this Node runtime.');
    }

    const authRequest = buildNewAuthRequest();
    const loginUrl = buildManagedLoginUrl(authRequest);
    const tokenUrl = new URL(`https://${config.cognitoDomain.replace(/^https?:\/\//, '')}/oauth2/token`);

    const loginPageResponse = await fetch(loginUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': 'nodejs-app-custom-login-fetch-demo',
        },
    });
    const loginPageCookies = getSetCookieHeaders(loginPageResponse.headers);
    const loginPageResult = await summarizeFetchResponse(loginPageResponse);

    // This intentionally skips the browser-managed form and CSRF/device workflow.
    // The goal is to demonstrate the failure mode, not to build a supported login.
    const loginSubmitBody = new URLSearchParams({
        username: 'demo@example.com',
        password: 'not-a-real-password',
        deviceFingerprint: 'codex-fetch-demo',
    });
    const loginSubmitResponse = await fetch(loginUrl, {
        method: 'POST',
        redirect: 'manual',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: buildCookieHeader(loginPageCookies),
            'user-agent': 'nodejs-app-custom-login-fetch-demo',
        },
        body: loginSubmitBody.toString(),
    });
    const loginSubmitResult = await summarizeFetchResponse(loginSubmitResponse);

    const callbackLocation = loginSubmitResponse.headers.get('location');
    const callbackUrl = callbackLocation ? new URL(callbackLocation, loginUrl) : null;
    const authorizationCode = callbackUrl
        ? callbackUrl.searchParams.get('code')
        : null;
    const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.cognitoClientId,
        redirect_uri: config.redirectUri,
        code: authorizationCode || 'missing-code-from-browser-login',
    });

    if (config.cognitoClientSecret) {
        tokenBody.set('client_secret', config.cognitoClientSecret);
    }

    const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            'user-agent': 'nodejs-app-custom-login-fetch-demo',
        },
        body: tokenBody.toString(),
    });
    const tokenResult = await summarizeFetchResponse(tokenResponse);

    return {
        loginUrl: loginUrl.toString(),
        tokenUrl: tokenUrl.toString(),
        callbackLocation: callbackUrl ? callbackUrl.toString() : callbackLocation || null,
        derivedAuthorizationCode: authorizationCode || null,
        steps: [
            {
                name: 'Step 1: fetch GET /login',
                request: {
                    method: 'GET',
                    url: loginUrl.toString(),
                },
                result: loginPageResult,
            },
            {
                name: 'Step 2: fetch POST /login',
                request: {
                    method: 'POST',
                    url: loginUrl.toString(),
                    body: loginSubmitBody.toString(),
                },
                result: loginSubmitResult,
            },
            {
                name: 'Step 3: fetch POST /oauth2/token',
                request: {
                    method: 'POST',
                    url: tokenUrl.toString(),
                    body: tokenBody.toString(),
                },
                result: tokenResult,
            },
        ],
    };
}

function beginAuthorization(req, res, client, options = {}) {
    const authRequest = createAuthRequest(req);
    const authorizationParams = buildAuthorizationParams(authRequest, options);

    res.redirect(client.authorizationUrl(authorizationParams));
}

// AWS recommends starting sessions at /oauth2/authorize, but /login accepts the
// same parameters and is useful here to demonstrate a direct managed-login entry.
function beginManagedLogin(req, res, options = {}) {
    const authRequest = createAuthRequest(req);
    res.redirect(buildManagedLoginUrl(authRequest, options).toString());
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
    try {
        req.session.authIntent = 'login';
        beginManagedLogin(req, res);
    } catch (error) {
        next(error);
    }
});

app.get('/login/authorize', (req, res, next) => {
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

    try {
        req.session.authIntent = 'login';
        beginManagedLogin(req, res, {
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

app.get('/programmatic-demo', async (req, res, next) => {
    try {
        const fetchDemo = await runImpossibleFetchLoginDemo();

        res.render('programmatic-demo', buildViewModel(req, {
            fetchDemo,
        }));
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
