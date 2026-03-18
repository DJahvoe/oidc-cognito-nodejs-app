const path = require('path');
const express = require('express');
const session = require('express-session');
const createAuthRouter = require('./auth-routes');
const { createOidcClient } = require('./oidc-client');

async function startServer(config) {
    const app = express();

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
        const otherApps = config.navigationApps.filter((appItem) => !appItem.isCurrent);

        return {
            appInfo: {
                id: config.appId,
                name: config.appName,
                tagline: config.appTagline,
                baseUrl: config.baseUrl,
                redirectUri: config.redirectUri,
                clientId: config.cognitoClientId,
                scopes: config.scopes,
            },
            navigationApps: config.navigationApps,
            otherApps,
            pageLinks: [
                { href: '/', label: 'Home', current: req.path === '/' },
                { href: '/public-page', label: 'Public Page', current: req.path === '/public-page' },
                { href: '/protected-page', label: 'Protected Page', current: req.path === '/protected-page' },
            ],
            isAuthenticated: Boolean(req.session.userInfo),
            userInfo: req.session.userInfo || null,
            error: null,
            theme: config.theme,
            ...overrides,
        };
    }

    function renderHome(req, res, error = null) {
        res.render('home', buildViewModel(req, { error }));
    }

    function renderPage(req, res, overrides) {
        res.render('page', buildViewModel(req, overrides));
    }

    function requireAuthentication(req, res, next) {
        if (req.session.userInfo) {
            next();
            return;
        }

        req.session.returnTo = req.originalUrl;
        res.redirect('/login');
    }

    app.get('/', (req, res) => {
        renderHome(req, res);
    });

    app.get('/public-page', (req, res) => {
        renderPage(req, res, {
            pageTitle: 'Public Page',
            pageEyebrow: 'Open Route',
            pageSummary: 'This route is available to every visitor. It proves that both apps can expose pages that do not require a Cognito session.',
            accessMode: 'Public',
            detailItems: [
                {
                    label: 'Who can open it',
                    value: 'Anyone with the URL, even before login.',
                },
                {
                    label: 'Why it exists',
                    value: 'To show that an app can mix public content with Cognito-protected content.',
                },
                {
                    label: 'Suggested test',
                    value: 'Open this page in App 1 and App 2 before signing in. It should work immediately.',
                },
            ],
            bodySections: [
                {
                    heading: 'What happens on this route',
                    paragraphs: [
                        'No auth guard runs here. The route renders directly, so the page is available whether the local Express session exists or not.',
                        'If you are already authenticated, the page still shows your current session state so you can compare public access with authenticated access.',
                    ],
                },
            ],
        });
    });

    app.get('/protected-page', requireAuthentication, (req, res) => {
        renderPage(req, res, {
            pageTitle: 'Protected Page',
            pageEyebrow: 'Protected Route',
            pageSummary: 'This route requires a local authenticated session. If the session is missing, the app sends the browser to Cognito and then returns here after login.',
            accessMode: 'Authenticated only',
            detailItems: [
                {
                    label: 'Who can open it',
                    value: 'Only users with an active local session in this app.',
                },
                {
                    label: 'Guard behavior',
                    value: 'Unauthenticated users are redirected to /login and then returned to /protected-page after callback.',
                },
                {
                    label: 'Suggested test',
                    value: 'Open this page in the second app after logging into the first app. Cognito SSO should bring you back here without another credential prompt.',
                },
            ],
            bodySections: [
                {
                    heading: 'What happens on this route',
                    paragraphs: [
                        'The route runs a shared requireAuthentication middleware. That middleware checks req.session.userInfo before rendering the page.',
                        'If the user is not authenticated, the middleware stores req.originalUrl in the session as returnTo. After Cognito finishes the callback, the app redirects back to that original protected route.',
                    ],
                },
            ],
        });
    });

    try {
        const client = await createOidcClient(config);

        app.use(createAuthRouter({ client, config }));

        app.use((error, req, res, next) => {
            console.error(error);

            if (res.headersSent) {
                next(error);
                return;
            }

            res.status(500);
            renderHome(req, res, error.message);
        });

        app.listen(config.port, () => {
            console.log(`${config.appName} listening on ${config.baseUrl}`);
            console.log(`${config.appName} callback URL: ${config.redirectUri}`);
        });
    } catch (error) {
        console.error(`Failed to start ${config.appName}:`, error);
        process.exit(1);
    }
}

module.exports = {
    startServer,
};
