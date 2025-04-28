import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          // varsIgnorePattern: '^_'
        },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/require-default-props': 'off', // Setting default value when destructuring parameters as recommended by Firefox browser
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': 'off',
      'react/function-component-definition': 'off',
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: ['state'],
        },
      ],
    },
    ignores: [
      'dist',
      '.eslintrc.cjs',
      'postcss.config.js',
      './storybook/**/*.ts',
    ],
  },
];

export default eslintConfig;
