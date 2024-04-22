import dts from 'rollup-plugin-dts'

export default [
	{
		input: 'dist/dts/index.d.ts',
		output: {
			file: 'dist/efficy-u-rpc-api-bundle.d.ts',
			format: "es"
		},
		plugins: [dts()],
	}
];