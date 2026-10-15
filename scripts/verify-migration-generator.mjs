import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Keep the fixture below the project so schema imports resolve its exact ORM.
// No live database is opened and the real migration directory is never written.
const temporary = await mkdtemp(path.resolve('migration-check-'));
try {
	const schema = path.join(temporary, 'schema.ts');
	const migrations = path.join(temporary, 'migrations');
	await writeFile(schema, await readFile('src/lib/db/schema.ts'));
	await cp('src/lib/db/migrations', migrations, { recursive: true });
	const before = (await readdir(migrations)).filter(name => name.endsWith('.sql'));
	const config = path.join(temporary, 'config.ts');
	await writeFile(config, `export default ${JSON.stringify({ dialect: 'sqlite', schema: path.relative(process.cwd(), schema), out: path.relative(process.cwd(), migrations) })};\n`);
	const generate = () => {
		const result = spawnSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'generate', '--config', config], { encoding: 'utf8', timeout: 60_000 });
		const output = `${result.stdout}\n${result.stderr}`;
		assert.equal(result.status, 0, output);
		assert(!/Error:|deprecated|warning/i.test(output), output);
		return output;
	};
	const output = generate();
	assert(!/deprecated|warning/i.test(output), output);
	assert.deepEqual((await readdir(migrations)).filter(name => name.endsWith('.sql')), before, 'Unchanged schema generated a migration');
	await writeFile(schema, (await readFile(schema, 'utf8')) + '\nexport const generatorProbe = sqliteTable("groly_generator_probe", { id: text("id").primaryKey(), amount: integer("amount").notNull() });\n');
	const changedOutput = generate();
	assert(!/deprecated|warning/i.test(changedOutput), changedOutput);
	const added = (await readdir(migrations)).filter(name => name.endsWith('.sql') && !before.includes(name));
	assert.equal(added.length, 1, changedOutput);
	const sql = await readFile(path.join(migrations, added[0]), 'utf8');
	assert(sql.includes('CREATE TABLE `groly_generator_probe`'));
	assert(!/DROP |ALTER /i.test(sql), `Unexpected changes to existing tables: ${sql}`);
	console.log('Stable migration generator verified: unchanged schema is a no-op; isolated new-table fixture generates only its expected SQL.');
} finally {
	await rm(temporary, { recursive: true, force: true });
}
