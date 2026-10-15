# Stable Drizzle Kit metadata patch

`drizzle-kit-0.31.11.tgz` is the upstream stable npm archive, repacked with exactly
one dependency declaration removed: `@esbuild-kit/esm-loader`. The published CLI
and API bundles do not reference that loader and already use tsx. No executable
code, schema logic or migration format is changed. All upstream package files
and licensing information are retained.

This removes the abandoned loader and its vulnerable esbuild tree **before npm
installation**. An after-install patch would still install those packages and
emit the deprecation messages.

Reproduce using Node 24 and its npm:

```sh
node scripts/rebuild-drizzle-vendor.mjs
```

The script verifies the original npm SHA-512 integrity, checks every published
JavaScript bundle for loader references and fails if its assumptions change.
The package lock records the patched archive's SHA-512 integrity. Replace this
archive with an official stable package once upstream removes the declaration.
Upstream: https://github.com/drizzle-team/drizzle-orm/issues/5481
