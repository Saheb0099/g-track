// Signs release builds with G Track's own key instead of the public React Native debug key.
// The keystore and its passwords stay out of the project, in ~/.gradle/gradle.properties:
//   GTRACK_UPLOAD_STORE_FILE, GTRACK_UPLOAD_KEY_ALIAS,
//   GTRACK_UPLOAD_STORE_PASSWORD, GTRACK_UPLOAD_KEY_PASSWORD
// Without them a release build fails rather than quietly using the debug key, since friends
// can only install updates signed with the same key as the copy they already have.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// G Track release signing';

const RELEASE_CONFIG = `
        release { ${MARKER}
            if (project.hasProperty('GTRACK_UPLOAD_STORE_FILE')) {
                storeFile file(GTRACK_UPLOAD_STORE_FILE)
                storePassword GTRACK_UPLOAD_STORE_PASSWORD
                keyAlias GTRACK_UPLOAD_KEY_ALIAS
                keyPassword GTRACK_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes(MARKER)) return config;

    const debugConfig = /(signingConfigs \{\s*debug \{[^}]*\})/;
    const releaseUsesDebug = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!debugConfig.test(gradle) || !releaseUsesDebug.test(gradle)) {
      throw new Error('with-release-signing: android/app/build.gradle no longer has the expected layout.');
    }

    gradle = gradle.replace(debugConfig, `$1${RELEASE_CONFIG}`);
    gradle = gradle.replace(releaseUsesDebug, '$1signingConfig signingConfigs.release');
    config.modResults.contents = gradle;
    return config;
  });
};
