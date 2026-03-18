const express = require('express');
const session = require('express-session');
const config = require('./config');
const { createOidcClient } = require('./oidc-client');
const createAuthRouter = require('./auth-routes');

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

function renderHome(req, res, error = null) {
    res.render('home', {
        isAuthenticated: Boolean(req.session.userInfo),
        userInfo: req.session.userInfo || null,
        error,
        baseUrl: config.baseUrl,
        redirectUri: config.redirectUri,
    });
}

app.get('/', (req, res) => {
    renderHome(req, res);
});

async function start() {
    try {
        // Wait for OIDC discovery before serving traffic so /login is always ready.
        const client = await createOidcClient(config);

        app.use(createAuthRouter({ client, config }));

        // Centralized error rendering keeps the example simple while still
        // surfacing the exact Cognito or OIDC error that came back.
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
            console.log(`App listening on ${config.baseUrl}`);
            console.log(`OIDC callback URL: ${config.redirectUri}`);
        });
    } catch (error) {
        console.error('Failed to start app:', error);
        process.exit(1);
    }
}

start();
