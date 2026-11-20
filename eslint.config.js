// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge functions run on Deno, not in the app.
    ignores: ['dist/*', 'supabase/functions/*'],
  },
  {
    rules: {
      // Text goes through '@/components/text', which keeps it at the design's sizes.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput'],
              message: "Use '@/components/text': it keeps text at the design's sizes.",
            },
          ],
        },
      ],
    },
  },
]);
