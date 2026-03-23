const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const { loginWithPassword, getCurrentUser, globalSignOut } = require('./cognito-auth');

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
            authFlow: config.authFlow,
            clientId: config.clientId,
            region: config.region,
            userPoolId: config.userPoolId || 'not provided',
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

app.get('/', (req, res) => {
    res.render('home', buildViewModel(req));
});

app.get('/login', (req, res) => {
    if (req.session.userInfo) {
        res.redirect('/');
        return;
    }

    res.render('login', buildViewModel(req, {
        formValues: {
            username: '',
        },
    }));
});

app.post('/login', async (req, res) => {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!username || !password) {
        res.status(400).render('login', buildViewModel(req, {
            error: 'Username and password are required.',
            formValues: { username },
        }));
        return;
    }

    try {
        const authResult = await loginWithPassword(config, username, password);
        const userInfo = await getCurrentUser(config, authResult.AccessToken);

        req.session.tokens = authResult;
        req.session.userInfo = userInfo;

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo);
    } catch (error) {
        res.status(401).render('login', buildViewModel(req, {
            error: error.message,
            formValues: { username },
        }));
    }
});

app.get('/public-page', (req, res) => {
    res.render('page', buildViewModel(req, {
        pageTitle: 'Public Page',
        pageEyebrow: 'Open Route',
        pageSummary: 'This page is available without signing in. It is the equivalent of public content in a custom-login app.',
        accessMode: 'Public',
        detailItems: [
            {
                label: 'Authentication required',
                value: 'No',
            },
            {
                label: 'Use case',
                value: 'Landing pages, docs, pricing, or content visible before login.',
            },
            {
                label: 'Suggested test',
                value: 'Open this route first to confirm the app loads before Cognito auth is involved.',
            },
        ],
        bodySections: [
            {
                heading: 'How this differs from Hosted UI',
                paragraphs: [
                    'The page is rendered entirely by your own app. Cognito is not involved until the user submits the custom login form.',
                    'This is useful when you want full control over branding and form layout instead of redirecting users to Cognito Hosted UI.',
                ],
            },
        ],
    }));
});

app.get('/protected-page', requireAuthentication, (req, res) => {
    res.render('page', buildViewModel(req, {
        pageTitle: 'Protected Page',
        pageEyebrow: 'Protected Route',
        pageSummary: 'This page requires a local session created after your custom login form authenticates against Cognito.',
        accessMode: 'Authenticated only',
        detailItems: [
            {
                label: 'Authentication required',
                value: 'Yes',
            },
            {
                label: 'Guard behavior',
                value: 'The app stores the original path and sends the user to the local /login page.',
            },
            {
                label: 'Suggested test',
                value: 'Open this route directly in a new browser session and confirm you return here after login.',
            },
        ],
        bodySections: [
            {
                heading: 'What happens here',
                paragraphs: [
                    'The app checks req.session.userInfo before rendering. If that session object is missing, the route redirects to the local login page instead of Cognito Hosted UI.',
                    'After successful authentication, the app restores the original route from req.session.returnTo and sends the user back to this protected page.',
                ],
            },
        ],
    }));
});

app.get('/logout', async (req, res, next) => {
    try {
        await globalSignOut(config, req.session.tokens && req.session.tokens.AccessToken);

        req.session.destroy((error) => {
            if (error) {
                next(error);
                return;
            }

            res.redirect('/');
        });
    } catch (error) {
        next(error);
    }
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

app.listen(config.port, () => {
    console.log(`${config.appName} listening on ${config.baseUrl}`);
});
