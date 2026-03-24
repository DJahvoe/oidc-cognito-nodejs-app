const express = require('express');
const { generators } = require('openid-client');
const { buildLogoutUrl } = require('./oidc-client');

function createAuthRouter({ client, config }) {
    const router = express.Router();

    router.get('/login', (req, res, next) => {
        try {
            req.session.authIntent = 'login';
            startAuthorization(req, res, client, config);
        } catch (error) {
            next(error);
        }
    });

    router.get('/session-sync', (req, res, next) => {
        try {
            req.session.authIntent = 'sync';
            startAuthorization(req, res, client, config, { prompt: 'none' });
        } catch (error) {
            next(error);
        }
    });

    router.get('/callback', async (req, res, next) => {
        try {
            const authIntent = req.session.authIntent || 'login';
            const params = client.callbackParams(req);

            if (params.error) {
                handleAuthorizationError(req, params, authIntent, res);
                return;
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

            req.session.userInfo = userInfo;
            req.session.tokenSet = tokenSet;
            req.session.lastSessionSyncAt = Date.now();
            const returnTo = req.session.returnTo || '/';
            clearTransientAuthState(req);

            res.redirect(returnTo);
        } catch (error) {
            next(error);
        }
    });

    router.get('/logout', (req, res, next) => {
        req.session.destroy((error) => {
            if (error) {
                next(error);
                return;
            }

            res.redirect(buildLogoutUrl(config));
        });
    });

    return router;
}

module.exports = createAuthRouter;

function startAuthorization(req, res, client, config, options = {}) {
    const nonce = generators.nonce();
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.nonce = nonce;
    req.session.state = state;
    req.session.codeVerifier = codeVerifier;

    const authUrl = client.authorizationUrl({
        scope: config.scopes,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        ...options,
    });

    res.redirect(authUrl);
}

function handleAuthorizationError(req, params, authIntent, res) {
    const returnTo = req.session.returnTo || '/';

    if (authIntent === 'sync' && params.error === 'login_required') {
        delete req.session.userInfo;
        delete req.session.tokenSet;
        req.session.lastSessionSyncAt = Date.now();
        clearTransientAuthState(req);
        res.redirect(returnTo);
        return;
    }

    clearTransientAuthState(req);
    throw new Error(params.error_description || params.error || 'Authentication failed.');
}

function clearTransientAuthState(req) {
    delete req.session.nonce;
    delete req.session.state;
    delete req.session.codeVerifier;
    delete req.session.returnTo;
    delete req.session.authIntent;
}
