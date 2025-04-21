import baseConfig from "@rtco/eslint-config/base";
import nextjsConfig from "@rtco/eslint-config/nextjs";
import reactConfig from "@rtco/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
];
