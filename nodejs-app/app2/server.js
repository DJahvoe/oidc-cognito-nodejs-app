const { createConfig } = require('../config');
const { startServer } = require('../server-factory');

const apps = [
    { id: 'app1', name: 'App 1', defaultUrl: 'http://localhost:3000' },
    { id: 'app2', name: 'App 2', defaultUrl: 'http://localhost:4000' },
];

const config = createConfig({
    appId: 'app2',
    appName: 'App 2',
    appTagline: 'Back-office sample using the same Cognito SSO session',
    appDir: __dirname,
    defaultPort: 4000,
    apps,
    theme: {
        shellBackground: 'linear-gradient(135deg, #f5e9e2 0%, #f4f1c9 100%)',
        panelBackground: '#fffaf7',
        panelBorder: '#d8b59d',
        accent: '#b45309',
        accentSoft: '#fde5cc',
        text: '#34251d',
        muted: '#6b625d',
    },
});

startServer(config);
