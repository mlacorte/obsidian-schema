module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  plugins: ["unused-imports", "simple-import-sort"],
  extends: ["standard-with-typescript", "prettier"],
  overrides: [
    {
      env: {
        node: true
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script"
      }
    }
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    // unused-imports
    "no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_"
      }
    ],
    // simple-import-sort
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    // custom
    "@typescript-eslint/consistent-type-assertions": "off",
    "@typescript-eslint/no-non-null-assertion": "off"
  },
  ignorePatterns: [
    "**/dist/**/*.js",
    "node_modules/**/*.js",
    "**/*.parser.js",
    "**/*.terms.js"
  ]
};
