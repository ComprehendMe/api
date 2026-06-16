await Bun.build({
	entrypoints: ['src/app.ts'],
	target: 'bun',
	outdir: './dist',
	format: 'esm',
	external: ['request', 'yamlparser'],
	compile: {
		target: 'bun-linux-x64',
		outfile: 'app',
	},
});
