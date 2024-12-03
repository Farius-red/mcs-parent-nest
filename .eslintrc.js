module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    "max-lines-per-function": ["error", { "max": 22, "skipComments": true, "skipBlankLines": true }],
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      // Se aplica solo a archivos dentro de la carpeta 'controllers'
      files: ['apps/**/controllers/**/*.ts'], // Cambia la ruta según la ubicación de tus controladores
      rules: {
        "max-lines-per-function": "off", // Deshabilitar la regla solo en los controladores
      },
    },
  ],
};
