const staticConfig = require('./app.json');

const googleServicesFile = process.env.GOOGLE_SERVICES_INFO_PLIST;

if (!googleServicesFile) {
  throw new Error(
    'GOOGLE_SERVICES_INFO_PLIST is required. Copy .env.example to .env.local and point it at your ignored Firebase plist.',
  );
}

module.exports = {
  ...staticConfig.expo,
  ios: {
    ...staticConfig.expo.ios,
    googleServicesFile,
  },
};
