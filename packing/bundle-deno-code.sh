#!/bin/bash

bundle() {
	local src="$1"
	deno eval --no-lock "
	import { bundle } from 'https://deno.land/x/emit/mod.ts';
	console.log(
		(await bundle('$src')).code
	);
	" || return $?
}

bundle src-background-instance/background-instance.ts > app/background-instance.js || exit $?
