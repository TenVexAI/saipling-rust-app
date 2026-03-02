/**
 * Reads the version from tauri.conf.json and patches it into Cargo.toml
 * so they always stay in sync. Run before builds.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tauriConf = resolve(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const cargoToml = resolve(__dirname, '..', 'src-tauri', 'Cargo.toml');

const conf = JSON.parse(readFileSync(tauriConf, 'utf-8'));
const version = conf.version;

let cargo = readFileSync(cargoToml, 'utf-8');
cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoToml, cargo, 'utf-8');

console.log(`[sync-version] Cargo.toml → v${version}`);
