/* global loadPyodide */
let engine;

async function startEngine() {
  importScripts('./runtime/pyodide.js');
  const python = await loadPyodide({ indexURL: new URL('./runtime/', self.location.href).href });
  await python.loadPackage(['numpy', 'opencv-python', 'pywavelets']);

  const bundle = await fetch('./vendor/engine.zip');
  if (!bundle.ok) throw new Error(`Engine archive: HTTP ${bundle.status}`);
  python.unpackArchive(await bundle.arrayBuffer(), 'zip', { extractDir: '/watermark' });
  python.runPython("import sys\nsys.path.insert(0, '/watermark')\nfrom browser_bridge import run_job");
  return python;
}

self.onmessage = async ({ data: { settings, image, watermark } }) => {
  let python;
  try {
    if (!engine) {
      self.postMessage({ progress: '正在加载浏览器运行环境…' });
      engine = startEngine();
    }
    python = await engine;
    self.postMessage({ progress: settings.operation === 'embed' ? '正在嵌入水印…' : '正在提取水印…' });

    python.FS.writeFile('/input.bin', new Uint8Array(image));
    if (watermark) python.FS.writeFile('/mark.bin', new Uint8Array(watermark));
    const run = python.globals.get('run_job');
    try {
      const result = JSON.parse(run(JSON.stringify(settings)));
      if (!result.error && python.FS.analyzePath('/output.png').exists) {
        const bytes = python.FS.readFile('/output.png');
        result.png = bytes.buffer;
        self.postMessage({ result }, [result.png]);
      } else {
        self.postMessage({ result });
      }
    } finally {
      run.destroy();
    }
  } catch (error) {
    console.error(error);
    self.postMessage({ result: {
      error: python ? '图片处理失败。请核对图片和参数后重试。' : '运行环境加载失败。请确认 ZIP 已完整解压，再重试。',
      restart: !python,
    } });
    if (!python) engine = undefined;
  } finally {
    if (python) {
      for (const path of ['/input.bin', '/mark.bin', '/output.png']) {
        if (python.FS.analyzePath(path).exists) python.FS.unlink(path);
      }
    }
  }
};
