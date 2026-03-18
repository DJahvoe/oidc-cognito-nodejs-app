const { createConfig } = require('../config');
const { startServer } = require('../server-factory');

const apps = [
    { id: 'app1', name: 'App 1', defaultUrl: 'http://localhost:3000' },
    { id: 'app2', name: 'App 2', defaultUrl: 'http://localhost:4000' },
];

const config = createConfig({
    appId: 'app1',
    appName: 'App 1',
    appTagline: 'Front-office sample using Cognito Hosted UI',
    appDir: __dirname,
    defaultPort: 3000,
    apps,
    theme: {
        shellBackground: 'linear-gradient(135deg, #f4efe2 0%, #d7efe8 100%)',
        panelBackground: '#fffaf2',
        panelBorder: '#d7c6a5',
        accent: '#0f766e',
        accentSoft: '#d7f3ef',
        text: '#20313a',
        muted: '#5f6b73',
    },
});

startServer(config);
