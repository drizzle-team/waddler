import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig, globalIgnores } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default defineConfig([
	{
		ignores: ['eslint.config.mjs'],

		extends: compat.extends(
			'eslint:recommended',
			'plugin:@typescript-eslint/recommended',
			'plugin:unicorn/recommended',
		),

		plugins: {
			import: fixupPluginRules(_import),
			'unused-imports': unusedImports,
		},

		languageOptions: {
			parser: tsParser,
			ecmaVersion: 5,
			sourceType: 'script',

			parserOptions: {
				project: './tsconfig.json',
			},
		},

		rules: {
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					disallowTypeAnnotations: false,
					fixStyle: 'separate-type-imports',
				},
			],

			'@typescript-eslint/no-import-type-side-effects': 'error',
			'import/no-cycle': 'error',
			'import/no-self-import': 'error',
			'import/no-empty-named-blocks': 'error',
			'unused-imports/no-unused-imports': 'error',
			'import/no-useless-path-segments': 'error',
			'import/newline-after-import': 'error',
			'import/no-duplicates': 'error',

			'import/extensions': [
				'error',
				'always',
				{
					ignorePackages: true,
				},
			],

			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-namespace': 'off',

			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-this-alias': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'unicorn/prefer-node-protocol': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/prefer-switch': 'off',
			'unicorn/catch-error-name': 'off',
			'unicorn/no-null': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/explicit-length-check': 'off',
			'unicorn/filename-case': 'off',
			'unicorn/prefer-module': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/no-nested-ternary': 'off',

			'unicorn/no-useless-undefined': [
				'error',
				{
					checkArguments: false,
				},
			],

			'unicorn/no-this-assignment': 'off',
			'unicorn/empty-brace-spaces': 'off',
			'unicorn/no-thenable': 'off',
			'unicorn/consistent-function-scoping': 'off',
			'unicorn/prefer-type-error': 'off',
			'unicorn/relative-url-style': 'off',
			eqeqeq: 'error',
			'unicorn/prefer-string-replace-all': 'off',
			'unicorn/no-process-exit': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-empty-interface': 'off',
			'@typescript-eslint/no-unsafe-declaration-merging': 'off',
			'no-inner-declarations': 'off',
		},
	},
	{
		files: ['**/tests/**/*.ts'],
		rules: {
			'import/extensions': 'off',
		},
	},
	globalIgnores(['node_modules', 'waddler/dist', 'waddler/src/dev', 'waddler/tsup.config.ts']),
]);
