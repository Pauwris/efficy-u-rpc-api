import typescript from '@rollup/plugin-typescript';

export default [
	{
		input: 'src/index.ts',
		output: {
			file: 'dist/efficy-u-rpc-api-bundle.js',
			sourcemap: true
		},
		external: ['node-fetch', 'cookie'],
		plugins: [
			typescript(),
		],
	}
];