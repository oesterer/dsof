const staticConfig = require('./app.json');

// EAS supplies an absolute temporary path for its secret file variable. During
// EAS's initial local config pass that variable is not available yet, so use
// the ignored local copy as Expo recommends for file-based build secrets.
const googleServicesFile = process.env.GOOGLE_SERVICES_INFO_PLIST
  ?? './secrets/GoogleService-Info.plist';

module.exports = {
  ...staticConfig.expo,
  ios: {
    ...staticConfig.expo.ios,
    googleServicesFile,
  },
};
