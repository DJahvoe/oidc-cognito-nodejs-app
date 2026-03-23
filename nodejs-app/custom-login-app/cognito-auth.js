const crypto = require('crypto');

async function loginWithPassword(config, username, password) {
    const authParameters = {
        USERNAME: username,
        PASSWORD: password,
    };

    if (config.clientSecret) {
        authParameters.SECRET_HASH = createSecretHash(username, config.clientId, config.clientSecret);
    }

    const response = await callCognito(config.region, 'AWSCognitoIdentityProviderService.InitiateAuth', {
        AuthFlow: config.authFlow,
        ClientId: config.clientId,
        AuthParameters: authParameters,
    });

    if (response.ChallengeName) {
        const challengeError = new Error(
            `Unsupported Cognito challenge returned: ${response.ChallengeName}. This demo currently supports direct username/password sign-in only.`
        );
        challengeError.code = response.ChallengeName;
        throw challengeError;
    }

    return response.AuthenticationResult;
}

async function getCurrentUser(config, accessToken) {
    const response = await callCognito(config.region, 'AWSCognitoIdentityProviderService.GetUser', {
        AccessToken: accessToken,
    });

    const attributes = Object.fromEntries(
        (response.UserAttributes || []).map((attribute) => [attribute.Name, attribute.Value])
    );

    return {
        username: response.Username,
        ...attributes,
    };
}

async function globalSignOut(config, accessToken) {
    if (!accessToken) {
        return;
    }

    try {
        await callCognito(config.region, 'AWSCognitoIdentityProviderService.GlobalSignOut', {
            AccessToken: accessToken,
        });
    } catch (error) {
        console.warn('GlobalSignOut failed:', error.message);
    }
}

module.exports = {
    loginWithPassword,
    getCurrentUser,
    globalSignOut,
};

function createSecretHash(username, clientId, clientSecret) {
    return crypto
        .createHmac('sha256', clientSecret)
        .update(`${username}${clientId}`)
        .digest('base64');
}

async function callCognito(region, target, body) {
    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': target,
        },
        body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
        const error = new Error(payload.message || 'Cognito request failed.');
        error.code = payload.__type || response.status;
        throw error;
    }

    return payload;
}
