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

    function renderHome(req, res, error = null) {
        const otherApps = config.navigationApps.filter((appItem) => !appItem.isCurrent);

        res.render('home', {
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
            isAuthenticated: Boolean(req.session.userInfo),
            userInfo: req.session.userInfo || null,
            error,
            theme: config.theme,
        });
    }

    app.get('/', (req, res) => {
        renderHome(req, res);
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
