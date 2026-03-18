const express = require('express');
const { generators } = require('openid-client');
const { buildLogoutUrl } = require('./oidc-client');

function createAuthRouter({ client, config }) {
    const router = express.Router();

    router.get('/login', (req, res, next) => {
        try {
            const nonce = generators.nonce();
            const state = generators.state();
            const codeVerifier = generators.codeVerifier();
            const codeChallenge = generators.codeChallenge(codeVerifier);

            // Save the transient values so the callback can validate the response.
            req.session.nonce = nonce;
            req.session.state = state;
            req.session.codeVerifier = codeVerifier;

            const authUrl = client.authorizationUrl({
                scope: config.scopes,
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

    router.get('/callback', async (req, res, next) => {
        try {
            const params = client.callbackParams(req);
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
            delete req.session.nonce;
            delete req.session.state;
            delete req.session.codeVerifier;

            res.redirect('/');
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
