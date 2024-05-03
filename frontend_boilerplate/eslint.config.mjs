import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";


export default [
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        browser: true,
      },
      parserOptions: {
        jsx: true,
      },
    }
  },
  pluginJs.configs.recommended,
  pluginReactConfig,
];