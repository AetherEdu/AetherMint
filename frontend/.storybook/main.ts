import path from 'node:path';
import type { StorybookConfig } from '@storybook/nextjs';

const walletStub = path.resolve(__dirname, '../src/stubs/stellar-wallets-kit.ts');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', '../src/**/*.mdx'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      nextConfigPath: './.storybook/next.config.js',
    },
  },
  docs: { autodocs: 'tag' },
  staticDirs: ['../public'],
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  webpackFinal: async (webpackConfig) => {
    webpackConfig.resolve ??= {};
    const aliases = webpackConfig.resolve.alias;

    if (Array.isArray(aliases)) {
      webpackConfig.resolve.alias = [
        ...aliases,
        { name: '@creit.tech/stellar-wallets-kit', alias: walletStub },
      ];
    } else {
      webpackConfig.resolve.alias = {
        ...aliases,
        '@creit.tech/stellar-wallets-kit': walletStub,
        '@creit.tech/stellar-wallets-kit$': walletStub,
      };
    }

    return webpackConfig;
  },
};

export default config;
