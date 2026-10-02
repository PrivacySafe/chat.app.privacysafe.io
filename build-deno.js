import * as esbuild from 'esbuild';
import { denoPlugin } from 'jsr:@deno/esbuild-plugin';

const envMock = `
Deno.env = {
  get: function() {
    return undefined;
  }
};
`;

// A development bundle keeps console output; a production one has none at all.
// Diagnostics that are worth keeping go through shared-libs/logger.ts, which
// writes to w3n.log and is switched on at runtime - so dropping console costs
// no information and removes per-signal string building from hot paths.
const isDev = Deno.args.includes('--dev');

try {
  // Building the main code using esbuild with the Deno plugin
  const result = await esbuild.build({
    entryPoints: ['src-deno/index.ts'],
    bundle: true,
    platform: 'node', // esbuild will understand the structure of module calls
    format: 'esm',
    target: 'esnext',
    write: false, // We intercept the result into RAM
    ...(isDev ? {} : { drop: ['console'] }),
    // Leave node:path and node:fs external, Deno will automatically insert polyfills at startup
    external: ['path', 'fs', 'node:path', 'node:fs'],
    plugins: [
      // The plugin takes care of all the work with JSR, NPM and HTTP imports inside TS files.
      denoPlugin(),
    ],
  });

  const bundledCode = result.outputFiles[0].text;

  // Combine the mock environment and the compiled code, saving it as .mjs
  await Deno.writeTextFile('app/background-instance.mjs', envMock + bundledCode);

  console.log(
    `✅ The bundle has been successfully compiled into app/background-instance.mjs` +
      `${isDev ? ' (development: console kept)' : ''}`,
  );
  Deno.exit(0);
} catch (error) {
  console.error('❌ Build error:', error);
  Deno.exit(1);
}
