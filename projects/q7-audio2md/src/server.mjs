import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Command } from 'commander';

// ─── Formatos soportados ───────────────────────────────────────────
const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg', '.opus', '.aac', '.aiff', '.alac', '.m4a', '.mp4'];
const AUDIO_EXT = new RegExp(`\\.(${SUPPORTED_EXTENSIONS.map(e => e.replace('.','')).join('|')})$`, 'i');
const MIN_WAV_SIZE = 44; // header mínimo de un WAV válido

const program = new Command();
program
  .option('-p, --port <n>', 'puerto del servidor', '3030')
  .option('--root <dir>', 'raíz del proyecto', process.cwd())
  .parse();

const opts = program.opts();
const PORT = Number(opts.port);
const ROOT = path.resolve(String(opts.root));
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const EXPORTS = path.join(DATA, 'exports');
const LOGS = path.join(DATA, 'logs');
const TEMP = path.join(DATA, 'tmp');
const WHISPER_CLI = path.join(ROOT, 'tools', 'whisper.cpp', 'build', 'bin', 'whisper-cli');
const WHISPER_MODEL = path.join(ROOT, 'tools', 'whisper.cpp', 'ggml-small.bin');
const FFMPEG = path.join(ROOT, 'tools', 'ffmpeg');
const JOBS_FILE = path.join(LOGS, 'jobs.json');
const JOB_STAGES = { queued: 'en cola', uploading: 'subido', converting: 'convirtiendo audio', transcribing: 'transcribiendo', exporting: 'exportando', done: 'completado', error: 'error' };
const JOB_STAGE_LABELS = JOB_STAGES;

await Promise.all([
  fs.mkdir(UPLOADS, { recursive: true }),
  fs.mkdir(EXPORTS, { recursive: true }),
  fs.mkdir(LOGS, { recursive: true }),
  fs.mkdir(TEMP, { recursive: true }),
]);
if (!await exists(JOBS_FILE)) await fs.writeFile(JOBS_FILE, '[]\n', 'utf8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/') return html(res, renderPage(await loadJobs(), ROOT));
  if (method === 'GET' && url.pathname === '/api/jobs') return json(res, 200, { jobs: await loadJobs() });
  if (method === 'GET' && url.pathname === '/api/formats') return json(res, 200, { supported: SUPPORTED_EXTENSIONS });

  if (method === 'POST' && url.pathname === '/api/upload') {
    const { fields, files } = await readMultipart(req);
    if (!files.length) return json(res, 400, { ok: false, error: 'Falta archivo' });
    const saved = [];
    for (const f of files) saved.push({ name: f.filename, path: await saveUpload(f.filename, f.buffer), status: 'subido' });
    const job = await createJob('upload', fields.comment ?? '', saved);
    return json(res, 200, { ok: true, job });
  }

  if (method === 'POST' && url.pathname === '/api/folder') {
    const body = await readJson(req);
    const folder = String(body.folder ?? '').trim() || ROOT;
    const comment = String(body.comment ?? '');
    const files = await collectFiles([folder]);
    if (!files.length) return json(res, 400, { ok: false, error: 'No hay audios compatibles' });
    const job = await createJob('folder', comment, files.map((p) => ({ name: path.basename(p), path: p, status: 'en cola' })), folder);
    return json(res, 200, { ok: true, job });
  }

  if (method === 'POST' && url.pathname === '/api/process') {
    const body = await readJson(req);
    const jobId = String(body.jobId ?? '');
    const jobs = await loadJobs();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return json(res, 404, { ok: false, error: 'Job no encontrado' });
    job.status = 'processing';
    job.stage = 'en cola';
    await saveJobs(jobs);
    try {
      await processJob(job);
      return json(res, 200, { ok: true, job });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.status = 'error';
      job.stage = 'error';
      await saveJobs(jobs);
      await fs.appendFile(path.join(LOGS, 'q7-audio2md.log'), `${new Date().toISOString()} ${job.id} api/process error ${message}\n`, 'utf8');
      return json(res, 500, { ok: false, error: message });
    }
  }

  if (method === 'POST' && url.pathname === '/api/delete') {
    const body = await readJson(req);
    const jobId = String(body.jobId ?? '');
    const removeFiles = Boolean(body.removeFiles);
    const jobs = await loadJobs();
    const idx = jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return json(res, 404, { ok: false, error: 'Job no encontrado' });
    const [job] = jobs.splice(idx, 1);
    await saveJobs(jobs);
    if (removeFiles) {
      const removed = [];
      const missing = [];
      for (const f of job.files || []) {
        try { await fs.unlink(f.path); removed.push(f.path); } catch { missing.push(f.path); }
      }
      const outDir = path.join(EXPORTS, jobId);
      try { await fs.rm(outDir, { recursive: true, force: true }); removed.push(outDir); } catch { missing.push(outDir); }
      const tmpDir = path.join(TEMP, jobId);
      try { await fs.rm(tmpDir, { recursive: true, force: true }); removed.push(tmpDir); } catch { missing.push(tmpDir); }
      await fs.appendFile(path.join(LOGS, 'q7-audio2md.log'), `${new Date().toISOString()} ${jobId} delete removed=${removed.join('|') || 'none'} missing=${missing.join('|') || 'none'}\n`, 'utf8');
    }
    return json(res, 200, { ok: true });
  }

  return text(res, 404, 'Not found');
});

server.listen(PORT, () => console.log(`q7-audio2md en http://127.0.0.1:${PORT}`));

// ─── Procesamiento de job ──────────────────────────────────────────
async function processJob(job) {
  try {
    const outDir = path.join(EXPORTS, job.id);
    await fs.mkdir(outDir, { recursive: true });
    job.stage = 'convirtiendo audio';
    await persistJobStage(job.id, 'convirtiendo audio');
    const parts = [];
    for (const file of job.files) {
      job.stage = 'transcribiendo';
      await persistJobStage(job.id, 'transcribiendo');
      const text = await transcribe(file.path);
      parts.push({ file: file.name, text });
    }
    job.stage = 'exportando';
    await persistJobStage(job.id, 'exportando');
    const txt = parts.map((p) => p.text).join('\n\n') || '(sin contenido)';
    const md = buildMd(job.comment || job.id, parts.length ? parts : [{ file: 'sin-archivos', text: '(sin contenido)' }], true);
    await fs.writeFile(path.join(outDir, `${job.id}.txt`), txt, 'utf8');
    await fs.writeFile(path.join(outDir, `${job.id}.md`), md, 'utf8');
    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ jobId: job.id, createdAt: new Date().toISOString(), files: job.files, status: 'done' }, null, 2), 'utf8');
    await fs.appendFile(path.join(LOGS, 'q7-audio2md.log'), `${new Date().toISOString()} ${job.id} process done\n`, 'utf8');
    const jobs = await loadJobs();
    const item = jobs.find((j) => j.id === job.id);
    if (item) { item.status = 'done'; item.stage = 'completado'; await saveJobs(jobs); }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await fs.appendFile(path.join(LOGS, 'q7-audio2md.log'), `${new Date().toISOString()} ${job.id} process error ${message}\n`, 'utf8');
    const jobs = await loadJobs();
    const item = jobs.find((j) => j.id === job.id);
    if (item) { item.status = 'error'; item.stage = 'error'; await saveJobs(jobs); }
    throw err;
  }
}

// ─── Transcripción con Whisper ─────────────────────────────────────
async function transcribe(file) {
  try { await fs.access(WHISPER_CLI); } catch { throw new Error(`whisper-cli no encontrado en ${WHISPER_CLI}`); }
  try { await fs.access(WHISPER_MODEL); } catch { throw new Error(`Modelo no encontrado en ${WHISPER_MODEL}`); }

  const ext = path.extname(file).toLowerCase();
  const isWav = ext === '.wav';
  let audioToProcess = file;
  let tmpWav = null;

  // Convertir a WAV si no viene en ese formato
  if (!isWav && AUDIO_EXT.test(ext)) {
    tmpWav = path.join(TEMP, `${crypto.randomUUID()}.wav`);
    
    // Para formatos problemáticos, usar conversión robusta con fallback
    const isProblematic = ['.m4a', '.aac', '.alac', '.mp4'].includes(ext);
    
    if (isProblematic) {
      await convertRobust(file, tmpWav, ext);
    } else {
      const ffmpegArgs = ['-y', '-i', file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', tmpWav];
      const exitCode = await runFfmpeg(ffmpegArgs);
      
      if (exitCode !== 0) {
        await cleanupTmp(tmpWav);
        throw new DecodificationError(ext, 0);
      }
      
      const valid = await isValidWav(tmpWav);
      if (!valid) {
        await cleanupTmp(tmpWav);
        throw new DecodificationError(ext, 0);
      }
    }

    audioToProcess = tmpWav;
  }

  try {
    return await whisperTranscribe(audioToProcess);
  } finally {
    if (tmpWav) await cleanupTmp(tmpWav);
  }
}

// ─── Conversión robusta con múltiples estrategias de fallback ──────
async function convertRobust(input, output, ext) {
  const strategies = [
    // Estrategia 1: ffmpeg normal
    ['-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output],
    
    // Estrategia 2: ignorar streams desconocidos, solo audio
    ['-y', '-ignore_unknown_streams', '-dn', '-sn', '-vn', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output],
    
    // Estrategia 3: ignorar errores de decodificación + descartar corrupto
    ['-y', '-fflags', '+discardcorrupt', '-err_detect', 'ignore_err', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output],
    
    // Estrategia 4: extraer audio raw primero, luego convertir
    null, // manejado especialmente abajo
    
    // Estrategia 5: forzar formato de entrada (para m4a problemáticos)
    ['-y', '-f', 'mp4', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output],
    
    // Estrategia 6: sin metadata, sin edl, constricto
    ['-y', '-i', input, '-map', '0:a:0', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-fflags', '+discardcorrupt', output],
  ];
  
  let lastError = '';
  
  for (let i = 0; i < strategies.length; i++) {
    // Limpiar output previo si existe
    try { await fs.unlink(output); } catch {}
    
    try {
      if (i === 3) {
        // Estrategia 4 especial: extraer AAC raw → convertir a WAV
        const rawAac = output + '.aac';
        const extractArgs = ['-y', '-i', input, '-vn', '-sn', '-dn', '-c:a', 'copy', rawAac];
        const extractCode = await runFfmpeg(extractArgs);
        
        if (extractCode === 0) {
          const convertArgs = ['-y', '-i', rawAac, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output];
          const convertCode = await runFfmpeg(convertArgs);
          try { await fs.unlink(rawAac); } catch {}
          
          if (convertCode === 0 && await isValidWav(output)) {
            return; // Éxito
          }
        }
        continue;
      }
      
      const args = strategies[i];
      const exitCode = await runFfmpeg(args);
      
      if (exitCode === 0) {
        const valid = await isValidWav(output);
        if (valid) return; // Éxito
      }
      
      // Registrar error de esta estrategia para diagnóstico
      lastError = `estrategia ${i + 1} falló (exit=${exitCode})`;
    } catch (err) {
      lastError = `estrategia ${i + 1} error: ${err.message}`;
    }
  }
  
  // Si llegamos acá, ninguna estrategia funcionó
  throw new DecodificationError(ext, 0, lastError);
}

// ─── Wrapper de ffmpeg con captura de stderr ──────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve(code));
    proc.on('error', (err) => reject(new Error(`ffmpeg no pudo ejecutarse: ${err.message}`)));
  });
}

// ─── Validar que un WAV sea real y no un archivo truncado/header ────
async function isValidWav(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size < MIN_WAV_SIZE) return false;
    // Verificar que sea realmente un WAV leyendo el header
    const header = await fs.readFile(filePath, { length: 12 });
    const riff = header.slice(0, 4).toString('ascii');
    const wave = header.slice(8, 12).toString('ascii');
    return riff === 'RIFF' && wave === 'WAVE';
  } catch {
    return false;
  }
}

// ─── Error específico para decodificación fallida ───────────────────
class DecodificationError extends Error {
  constructor(ext, size, detail = '') {
    const suggested = ['.wav', '.mp3', '.flac', '.ogg'];
    const recommended = suggested.filter(f => f !== ext).join(', ');
    super(
      `Audio no decodificable: el archivo ${ext} no pudo extraerse correctamente. ` +
      `Tamaño resultante: ${size} bytes (inválido). ` +
      (detail ? `Detalle: ${detail}. ` : '') +
      `Probá con formato ${recommended} en su lugar.`
    );
    this.name = 'DecodificationError';
    this.ext = ext;
    this.size = size;
    this.detail = detail;
  }
}

// ─── Whisper CLI real ────────────────────────────────────────────────
function whisperTranscribe(audioPath) {
  return new Promise((resolve, reject) => {
    const libPath = path.join(ROOT, 'tools', 'whisper.cpp', 'build', 'src');
    const ggmlPath = path.join(ROOT, 'tools', 'whisper.cpp', 'build', 'ggml', 'src');
    const env = { ...process.env, LD_LIBRARY_PATH: `${libPath}:${ggmlPath}` };
    const args = ['-m', WHISPER_MODEL, '-f', audioPath, '-l', 'es', '-otxt', '-np'];
    const proc = spawn(WHISPER_CLI, args, { cwd: path.dirname(audioPath), env });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', async (code) => {
      if (code !== 0 && !stdout.trim()) {
        await fs.appendFile(path.join(LOGS, 'q7-audio2md.log'), `${new Date().toISOString()} whisper error code ${code}: ${stderr}\n`, 'utf8');
        return reject(new Error(`whisper-cli falló con código ${code}`));
      }
      resolve(stdout.trim() || '(sin texto reconocido)');
    });
    proc.on('error', reject);
  });
}

// ─── Limpieza de archivos temporales ────────────────────────────────
async function cleanupTmp(tmpWav) {
  try { await fs.unlink(tmpWav); } catch {}
}

// ─── Construcción del markdown ─────────────────────────────────────
function buildMd(name, parts, timestamps) {
  const body = parts.map((p, i) => {
    const header = `## Segmento ${String(i + 1).padStart(3, '0')} (${p.file})`;
    const text = timestamps ? p.text.split(/\n+/).map((line, idx) => `[${String(idx).padStart(2, '0')}:00] ${line}`).join('\n') : p.text;
    return `${header}\n\n${text}`;
  }).join('\n\n---\n\n');
  return `# ${name}\n\n${body}\n`;
}

// ─── Jobs ───────────────────────────────────────────────────────────
async function createJob(type, comment, files, folder) {
  const job = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), type, status: 'queued', comment, files, folder };
  const jobs = await loadJobs();
  jobs.unshift(job);
  await saveJobs(jobs);
  await fs.appendFile(path.join(LOGS, 'q7-audio2md.log'), `${job.createdAt} ${job.id} ${job.type} ${job.status} ${job.comment || ''}\n`, 'utf8');
  return job;
}

async function saveUpload(filename, buffer) {
  const target = path.join(UPLOADS, `${crypto.randomUUID()}-${sanitize(filename)}`);
  await fs.writeFile(target, buffer);
  return target;
}

async function collectFiles(items) {
  const out = [];
  for (const item of items) {
    const stat = await fs.stat(item);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(item, { withFileTypes: true });
      for (const e of entries) if (e.isFile() && AUDIO_EXT.test(e.name)) out.push(path.join(item, e.name));
    } else if (AUDIO_EXT.test(item)) out.push(item);
  }
  return out;
}

// ─── UI ──────────────────────────────────────────────────────────────
function renderPage(jobs, root) {
  const fmtList = SUPPORTED_EXTENSIONS.join(', ');
  const jobsRows = jobs.map((j) => rowHtml(j)).join('') || '<tr><td colspan="6">Sin tareas aún</td></tr>';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>q7-audio2md</title><style>:root{--bg:#fbf9f7;--panel:#fff;--line:#e8dfd8;--text:#2f2a28;--muted:#7a6f68;--pink:#f7dce4;--blue:#dceaf7;--green:#dff2e1;--yellow:#f7efd5;--btn:#efe7ff;--btn2:#e8f2ff}*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:24px;max-width:1200px;background:var(--bg);color:var(--text)}h1{margin-bottom:8px}.subtle{color:var(--muted)}.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.03)}.formats{font-size:12px;color:var(--muted);margin-top:4px}.tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.tab{border:1px solid var(--line);background:var(--btn);color:var(--text);padding:10px 14px;border-radius:999px;cursor:pointer;font-weight:600}.tab.active{background:var(--green)}.mode{display:none}.mode.active{display:block}input,button,textarea{font:inherit}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}input[type=file],input[type=text],textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;color:var(--text)}textarea{min-height:56px;resize:vertical;overflow:auto}.actions{display:flex;gap:10px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:var(--btn2);color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:600}.btn.primary{background:var(--pink)}.btn.ghost{background:#fff}.jobs-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:800px}th,td{border-top:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.row-actions button{margin-right:8px;margin-bottom:6px}.pill{display:inline-block;padding:4px 10px;border-radius:999px;background:var(--yellow);font-size:12px}.pill.error{background:#f7dce4;color:#a00}.pill.done{background:#dff2e1}.topline{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}</style></head><body><div class="topline"><div><h1>q7-audio2md</h1><div class="subtle">Raíz: <code>${escapeHtml(root)}</code></div></div><span class="pill">v1.1</span></div><div class="card"><div class="tabs"><button class="tab active" data-mode="upload">Subir audios</button><button class="tab" data-mode="folder">Procesar carpeta</button></div><div id="mode-upload" class="mode active"><form id="uploadForm"><div class="field"><input type="file" name="audio" multiple accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.aac,.flac,.aiff,.alac,.mp4" /></div><div class="field"><textarea name="comment" placeholder="Comentario" rows="2"></textarea></div><div class="actions"><button class="btn primary" type="submit">Subir</button></div></form></div><div id="mode-folder" class="mode"><form id="folderForm"><div class="field"><input name="folder" type="text" value="${escapeHtml(root)}" /></div><div class="field"><textarea name="comment" placeholder="Comentario" rows="2"></textarea></div><div class="actions"><button class="btn primary" type="submit">Registrar carpeta</button></div></form></div><div class="formats">Formatos compatibles: ${escapeHtml(fmtList)}</div></div><div class="card"><h2>Jobs</h2><div class="jobs-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Comentario</th><th>Archivos</th><th>Acciones</th></tr></thead><tbody id="jobsBody">${jobsRows}</tbody></table></div></div><script>const e=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); const row=j=>'<tr data-id="'+e(j.id)+'"><td>'+e(j.createdAt)+'</td><td>'+e(j.type)+'</td><td><span class="pill '+(j.status==='error'?'error':j.status==='done'?'done':'')+'">'+e(j.status)+'</span></td><td>'+e(j.comment||'(sin comentario)')+'</td><td>'+(j.files||[]).map(f=>e(f.name)).join(', ')+'</td><td class="row-actions"><button class="btn" data-p="'+e(j.id)+'" '+(j.status==='processing'?'disabled':'')+'>Procesar</button><button class="btn ghost" data-d="'+e(j.id)+'">Eliminar</button></td></tr>'; async function reload(){const r=await fetch('/api/jobs');const d=await r.json();document.getElementById('jobsBody').innerHTML=(d.jobs||[]).map(row).join('')||'<tr><td colspan="6">Sin tareas aún</td></tr>'; bind();} async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json(); if(!d.ok) throw new Error(d.error||'error'); return d;} async function upload(form){const r=await fetch('/api/upload',{method:'POST',body:new FormData(form)});const d=await r.json(); if(!d.ok) throw new Error(d.error||'upload'); form.reset(); await reload();} async function folder(form){const fd=new FormData(form); await post('/api/folder',{folder:fd.get('folder'),comment:fd.get('comment')}); await reload();} async function processJob(id){await post('/api/process',{jobId:id}); await reload();} async function delJob(id){await post('/api/delete',{jobId:id,removeFiles:true}); await reload();} function bind(){document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>processJob(b.dataset.p));document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>delJob(b.dataset.d));} document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.getElementById('mode-'+t.dataset.mode).classList.add('active');}); document.getElementById('uploadForm').addEventListener('submit',e=>{e.preventDefault();upload(e.target).catch(alert);}); document.getElementById('folderForm').addEventListener('submit',e=>{e.preventDefault();folder(e.target).catch(alert);}); bind();</script></body></html>`;
}

function rowHtml(j) {
  const pillClass = j.status === 'error' ? 'error' : j.status === 'done' ? 'done' : '';
  const disabled = j.status === 'processing' ? 'disabled' : '';
  const label = j.stage || JOB_STAGE_LABELS[j.status] || j.status;
  return '<tr data-id="' + escapeHtml(j.id) + '"><td>' + escapeHtml(j.createdAt) + '</td><td>' + escapeHtml(j.type) + '</td><td><span class="pill ' + pillClass + '">' + escapeHtml(label) + '</span></td><td>' + escapeHtml(j.comment || '(sin comentario)') + '</td><td>' + (j.files || []).map((f) => escapeHtml(f.name)).join(', ') + '</td><td class="row-actions"><button class="btn" data-p="' + escapeHtml(j.id) + '" ' + disabled + '>Procesar</button><button class="btn ghost" data-d="' + escapeHtml(j.id) + '">Eliminar</button></td></tr>';
}

function sanitize(name) { return String(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }
function escapeHtml(s) { return String(s).replace(/[&<>\"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function html(res, body) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function text(res, status, body) { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body); }
async function readJson(req) { const raw = await readBody(req); return JSON.parse(raw.toString('utf8') || '{}'); }
async function readBody(req) { return new Promise((resolve, reject) => { const chunks=[]; req.on('data', c=>chunks.push(c)); req.on('end',()=>resolve(Buffer.concat(chunks))); req.on('error', reject); }); }
async function readMultipart(req) { const contentType = req.headers['content-type'] ?? ''; const m = /boundary=(.+)$/.exec(contentType); if (!m) return { fields: {}, files: [] }; const boundary = Buffer.from(`--${m[1]}`); const body = await readBody(req); const parts = splitMultipart(body, boundary); const fields = {}; const files = []; for (const part of parts) { const headerEnd = part.indexOf(Buffer.from('\r\n\r\n')); if (headerEnd === -1) continue; const header = part.subarray(0, headerEnd).toString('utf8'); const content = part.subarray(headerEnd + 4, part.length - 2); const nameMatch = /name="([^"]+)"/.exec(header); if (!nameMatch) continue; const fieldName = nameMatch[1]; const fileMatch = /filename="([^"]*)"/.exec(header); if (fileMatch && fileMatch[1]) files.push({ fieldName, filename: fileMatch[1], buffer: content }); else fields[fieldName] = content.toString('utf8'); } return { fields, files }; }
function splitMultipart(body, boundary) { const parts=[]; let start=body.indexOf(boundary); while (start!==-1) { start += boundary.length + 2; const end = body.indexOf(boundary, start) - 2; if (end < start) break; parts.push(body.subarray(start, end)); start = body.indexOf(boundary, end); } return parts; }
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function loadJobs() { try { return JSON.parse(await fs.readFile(JOBS_FILE, 'utf8')); } catch { return []; } }
async function saveJobs(jobs) { await fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf8'); }
async function persistJobStage(jobId, stage) {
  const jobs = await loadJobs();
  const item = jobs.find((j) => j.id === jobId);
  if (item) { item.stage = stage; await saveJobs(jobs); }
}
