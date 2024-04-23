import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: "build/efficy-u-rpc-api-bundle.js",
        format: 'cjs',
        exports: 'named',
      },
      {
        file: "build/efficy-u-rpc-api-bundle-es.js",
        format: 'es',
        exports: 'named',
      },
    ],
    plugins: [typescript()],
  },
];
