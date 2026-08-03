#!/usr/bin/env node
/** Thin executable wrapper — all logic (and the tests) live in run.ts. */
import { run } from './run.js';

process.exitCode = await run(process.argv.slice(2));
