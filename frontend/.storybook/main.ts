import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../src/**/*.mdx',
  ],

  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
    '@storybook/addon-themes',
  ],

  framework: {
    name: '@storybook/nextjs',
    options: {},
  },

  docs: {
    autodocs: 'tag',
  },

  staticDirs: ['../public'],

  features: {
    experimentalRSC: false,
  },

  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      compilerOptions: {
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },

  webpackFinal: async (config) => {
    // Reset Next.js's aggressive splitChunks config which conflicts with
    // Storybook's internal webpack compilation lifecycle.
    // The next.config.js cacheGroups use Next.js's own webpack instance,
    // but Storybook uses node_modules webpack — causing a compilation
    // instance mismatch at DefinePlugin.getCompilationHooks.
    if (config.optimization) {
      config.optimization.splitChunks = false;
    }
    return config;
  },
};

export default config;
