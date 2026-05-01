import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';

const program = new Command();
program.name('q7-audio2md').description('Transcribe audios grandes y exportarlos a TXT/MD').argument('[inputs...]', 'archivos o carpetas de audio').option('-o, --out <dir>', 'directorio de salida', 'output').option('--timestamps', 'incluir timestamps', false).option('--segment-minutes <n>', 'duración de segmento en minutos', '10').parse();

const opts = program.opts();
const inputs = program.args;
const dataDir = process.env.Q7_AUDIO_DATA_DIR ?? process.cwd();
if (!inputs.length) { console.error('Pasa archivos o carpetas.'); process.exit(1); }

const files = await collectFiles(inputs);
await fs.mkdir(opts.out, { recursive: true });
await fs.mkdir(path.join(dataDir, 'logs'), { recursive: true });
await fs.mkdir(path.join(dataDir, 'exports'), { recursive: true });
await fs.mkdir(path.join(opts.out, 'jobs'), { recursive: true });

const jobId = `job-${Date.now()}`;
await fs.writeFile(path.join(opts.out, 'jobs', `${jobId}.json`), JSON.stringify({ id: jobId, createdAt: new Date().toISOString(), inputs, files }, null, 2), 'utf8');

for (const file of files) {
  const base = path.basename(file, path.extname(file));
  const workDir = path.join(dataDir, 'work', base);
  const segmentsDir = path.join(workDir, 'segments');
  await fs.mkdir(segmentsDir, { recursive: true });
  const normalized = path.join(workDir, `${base}.wav`);
  await runCmd('ffmpeg', ['-y', '-i', file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', normalized]);
  await runCmd('ffmpeg', ['-y', '-i', normalized, '-f', 'segment', '-segment_time', String(Number(opts.segmentMinutes) * 60), '-reset_timestamps', '1', path.join(segmentsDir, '%03d.wav')]);
  const segments = (await fs.readdir(segmentsDir)).filter((f) => f.endsWith('.wav')).sort();
  const transcriptParts = [];
  for (const seg of segments) transcriptParts.push({ file: seg, text: await whisperTranscribe(path.join(segmentsDir, seg)) });
  const txt = transcriptParts.map((p) => p.text).join('\n\n');
  const md = buildMd(base, transcriptParts, opts.timestamps);
  await fs.writeFile(path.join(opts.out, `${base}.txt`), txt, 'utf8');
  await fs.writeFile(path.join(opts.out, `${base}.md`), md, 'utf8');
}

console.log(`Procesados ${files.length} archivo(s). Salida en ${opts.out}`);

async function collectFiles(items) { const out=[]; for (const item of items) { const stat = await fs.stat(item); if (stat.isDirectory()) { const entries = await fs.readdir(item, { withFileTypes: true }); for (const e of entries) if (e.isFile() && /\.(m4a|mp3|wav|ogg|opus|aac|flac|aiff|alac|mp4)$/i.test(e.name)) out.push(path.join(item, e.name)); } else out.push(item); } return out; }
function buildMd(name, parts, timestamps) { const body = parts.map((p, i) => { const header = `## Segmento ${String(i + 1).padStart(3, '0')} (${p.file})`; const text = timestamps ? p.text.split(/\n+/).map((line, idx) => `[${String(idx).padStart(2, '0')}:00] ${line}`).join('\n') : p.text; return `${header}\n\n${text}`; }).join('\n\n---\n\n'); return `# ${name}\n\n${body}\n`; }
async function whisperTranscribe(file) { const data = await fs.readFile(file); return `Transcripción pendiente para ${path.basename(file)} (${data.length} bytes).`; }
function runCmd(cmd, args) { return new Promise((resolve, reject) => { const p = spawn(cmd, args, { stdio: 'inherit' }); p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))); }); }
