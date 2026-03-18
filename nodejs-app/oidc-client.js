const { Issuer } = require('openid-client');

async function createOidcClient(config) {
    const issuer = await Issuer.discover(config.cognitoIssuer);
    const clientConfig = {
        client_id: config.cognitoClientId,
        redirect_uris: [config.redirectUri],
        response_types: ['code'],
    };

    if (config.cognitoClientSecret) {
        clientConfig.client_secret = config.cognitoClientSecret;
    } else {
        clientConfig.token_endpoint_auth_method = 'none';
    }

    return new issuer.Client(clientConfig);
}

function buildLogoutUrl(config) {
    const logoutUrl = new URL(`https://${config.cognitoDomain.replace(/^https?:\/\//, '')}/logout`);
    logoutUrl.searchParams.set('client_id', config.cognitoClientId);
    logoutUrl.searchParams.set('logout_uri', config.baseUrl);
    return logoutUrl.toString();
}

module.exports = {
    createOidcClient,
    buildLogoutUrl,
};
