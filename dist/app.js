const get = id => document.getElementById(id);
const form = get('job-form');
const source = get('source-file');
const dropZone = get('drop-zone');
const sourcePreview = get('source-preview');
const sourceTitle = get('source-title');
const watermarkText = get('mark-text');
const runButton = get('run');
const errorPanel = get('error');
const resultImage = get('result-image');
const resultText = get('result-text');
const resultFormat = get('result-format');
const resultMeta = get('result-meta');
const resultActions = get('result-actions');
const resultHint = get('result-hint');
const status = get('status');
const downloadImage = get('download-image');
const downloadText = get('download-text');
const downloadParams = get('download-params');
const operationButtons = [...form.querySelectorAll('[data-operation]')];
const fields = [...form.querySelectorAll('[data-fields]')];
const maxFileBytes = 30 * 1024 * 1024;
const textEncoder = new TextEncoder();

let operation = 'embed';
let sourceFile;
let sourceURL;
let resultURLs = [];
let worker;
let activeJob;

function showError(message = '') {
  errorPanel.textContent = message;
  errorPanel.hidden = !message;
}

function kind() {
  return form.elements.kind.value;
}

function resetResult() {
  for (const url of resultURLs) URL.revokeObjectURL(url);
  resultURLs = [];
  resultImage.removeAttribute('src');
  resultText.textContent = '';
  for (const item of [resultImage, resultText, resultMeta, resultActions, resultHint, resultFormat]) {
    item.hidden = true;
  }
  get('result-placeholder').hidden = false;
  status.textContent = operation === 'embed' ? '嵌入后的图片会显示在这里' : '提取出的水印会显示在这里';
}

function updateForm() {
  for (const button of operationButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.operation === operation));
  }
  for (const group of fields) group.hidden = group.dataset.fields !== `${operation}-${kind()}`;
  sourceTitle.textContent = operation === 'embed' ? '原始图片' : '含水印的图片';
  runButton.textContent = operation === 'embed' ? '嵌入水印' : '提取水印';
  showError();
  resetResult();
}

for (const button of operationButtons) {
  button.addEventListener('click', () => {
    if (button.dataset.operation === operation) return;
    operation = button.dataset.operation;
    updateForm();
  });
}

form.querySelectorAll('input[name="kind"]').forEach(input => input.addEventListener('change', updateForm));

function validateUpload(file, label) {
  if (!file) throw new Error(`请选择${label}。`);
  if (!file.size) throw new Error(`${label}是空文件。`);
  if (file.size > maxFileBytes) throw new Error(`${label}超过 30 MB。`);
}

function selectSource(file) {
  if (!file || activeJob) return;
  try {
    validateUpload(file, '图片');
  } catch (error) {
    showError(error.message);
    source.value = '';
    return;
  }
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  sourceFile = file;
  sourceURL = URL.createObjectURL(file);
  sourcePreview.src = sourceURL;
  sourcePreview.hidden = false;
  dropZone.querySelector('.upload-icon').hidden = true;
  get('drop-label').textContent = file.name;
  get('file-hint').textContent = '点击或拖放以更换图片';
  showError();
  resetResult();
}

sourcePreview.addEventListener('error', () => { sourcePreview.hidden = true; });
dropZone.addEventListener('click', () => source.click());
source.addEventListener('change', () => selectSource(source.files[0]));
for (const name of ['dragover', 'dragleave', 'drop']) {
  dropZone.addEventListener(name, event => {
    event.preventDefault();
    dropZone.classList.toggle('dragging', name === 'dragover' && !activeJob);
    if (name === 'drop') selectSource(event.dataTransfer.files[0]);
  });
}

watermarkText.addEventListener('input', () => {
  const bytes = textEncoder.encode(watermarkText.value);
  const exact = bytes.length && bytes[0] !== 0;
  const bitLength = exact ? bytes.length * 8 - (Math.clz32(bytes[0]) - 24) : 0;
  get('text-length').textContent = bitLength ? `水印长度 ${bitLength.toLocaleString('zh-CN')} 位` : '嵌入后请保存提取参数。';
});

const passwordWm = get('password-wm');
const passwordImg = get('password-img');
const fastMode = get('fast-mode');
for (const input of [passwordWm, passwordImg, fastMode]) {
  input.addEventListener('input', () => {
    const mode = fastMode.checked ? '快速' : '常规';
    get('settings-summary').textContent = `${mode} · 密码 ${passwordWm.value || '—'} / ${passwordImg.value || '—'}`;
  });
}

function readInteger(input, label) {
  const number = input.valueAsNumber;
  if (!Number.isInteger(number) || number < Number(input.min) || number > Number(input.max)) {
    const details = input.closest('details');
    if (details) details.open = true;
    input.focus();
    throw new Error(`${label}需要填写 ${input.min} 到 ${input.max} 之间的整数。`);
  }
  return number;
}

function setBusy(busy) {
  for (const element of form.querySelectorAll('button, input, textarea')) element.disabled = busy;
  get('result-stage').setAttribute('aria-busy', String(busy));
  runButton.textContent = busy ? '处理中…' : operation === 'embed' ? '嵌入水印' : '提取水印';
}

function setDownload(link, data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  resultURLs.push(url);
  link.href = url;
  link.download = filename;
  link.hidden = false;
  return url;
}

function renderResult(job, result) {
  const stem = job.name.replace(/\.[^.]+$/, '') || 'image';
  downloadImage.hidden = true;
  downloadParams.hidden = true;
  downloadText.hidden = true;
  get('result-placeholder').hidden = true;
  resultFormat.textContent = result.png ? 'PNG' : '文字';
  resultFormat.hidden = false;
  resultActions.hidden = false;

  if (result.png) {
    const suffix = job.operation === 'embed' ? 'watermarked' : 'watermark';
    resultImage.src = setDownload(downloadImage, result.png, `${stem}-${suffix}.png`, 'image/png');
    resultImage.hidden = false;
  } else {
    resultText.textContent = result.text;
    resultText.hidden = false;
    setDownload(downloadText, result.text, `${stem}-watermark.txt`, 'text/plain;charset=utf-8');
    resultHint.textContent = '算法无法验证密码是否正确。若出现乱码，请核对水印位数、密码和模式。';
    resultHint.hidden = false;
  }

  if (job.operation === 'embed') {
    const mode = job.fast ? '快速' : '常规';
    const rows = job.kind === 'text'
      ? [['水印位数', result.bits]]
      : [['图案宽 × 高', `${result.width} × ${result.height} px`]];
    rows.push(['水印密码', job.passwordWm], ['图片密码', job.passwordImg], ['算法模式', mode]);
    const list = get('result-params');
    list.replaceChildren();
    for (const [name, value] of rows) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = name;
      const definition = document.createElement('dd');
      definition.textContent = value;
      row.append(term, definition);
      list.append(row);
    }
    resultMeta.hidden = false;
    const pythonShape = job.kind === 'text' ? result.bits : `(${result.height}, ${result.width})`;
    const metadata = [
      'Blind Watermark 0.4.4',
      `mode=${job.kind === 'text' ? 'str' : 'img'}`,
      `wm_shape=${pythonShape}`,
      `password_wm=${job.passwordWm}`,
      `password_img=${job.passwordImg}`,
      `fast_mode=${job.fast ? 'True' : 'False'}`,
    ];
    setDownload(downloadParams, `${metadata.join('\n')}\n`, `${stem}-watermark-params.txt`, 'text/plain;charset=utf-8');
    resultHint.textContent = '提取时需要这些参数。建议保留下载的 PNG。';
    resultHint.hidden = false;
  }
}

function releaseWorker() {
  if (worker) worker.terminate();
  worker = undefined;
}

function finishJob(result) {
  const job = activeJob;
  activeJob = undefined;
  setBusy(false);
  if (result.restart) releaseWorker();
  if (result.error) {
    resetResult();
    showError(result.error);
    return;
  }
  renderResult(job, result);
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker('./watermark-worker.js');
  worker.addEventListener('message', ({ data }) => {
    if (!activeJob) return;
    if (data.progress) status.textContent = data.progress;
    if (data.result) finishJob(data.result);
  });
  worker.addEventListener('error', error => {
    console.error(error);
    if (activeJob) finishJob({ error: '后台处理程序意外停止，请重试。', restart: true });
    else releaseWorker();
  });
  return worker;
}

form.noValidate = true;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (activeJob) return;
  showError();
  if (location.protocol === 'file:') {
    showError('请启动本地静态服务器，再从 http://127.0.0.1:8000 打开网页。');
    return;
  }
  const markFile = get('mark-file').files[0];
  const settings = { operation, kind: kind(), fast: fastMode.checked };
  try {
    validateUpload(sourceFile, '待处理图片');
    settings.passwordWm = readInteger(passwordWm, '水印密码');
    settings.passwordImg = readInteger(passwordImg, '图片密码');
    if (operation === 'embed') {
      if (settings.kind === 'text') {
        settings.text = watermarkText.value;
        if (!settings.text) throw new Error('请输入要嵌入的水印文字。');
      } else {
        validateUpload(markFile, '图案水印文件');
      }
    } else if (settings.kind === 'text') {
      settings.bits = readInteger(get('bit-count'), '水印位数');
    } else {
      settings.width = readInteger(get('mark-width'), '图案宽度');
      settings.height = readInteger(get('mark-height'), '图案高度');
    }
  } catch (error) {
    showError(error.message);
    return;
  }
  activeJob = { ...settings, name: sourceFile.name };
  resetResult();
  setBusy(true);
  status.textContent = '正在读取图片…';
  try {
    const image = await sourceFile.arrayBuffer();
    const watermark = operation === 'embed' && settings.kind === 'image' ? await markFile.arrayBuffer() : null;
    const buffers = watermark ? [image, watermark] : [image];
    getWorker().postMessage({ settings, image, watermark }, buffers);
  } catch (error) {
    console.error(error);
    finishJob({ error: '无法读取图片或启动后台处理，请重试。', restart: true });
  }
});

if (location.protocol === 'file:') {
  showError('请启动本地静态服务器，再从 http://127.0.0.1:8000 打开网页。');
}
