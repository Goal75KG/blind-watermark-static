# 图片盲水印 · 静态版

在浏览器内使用 [Blind Watermark](https://github.com/guofei9987/blind_watermark) 0.4.4 嵌入或提取文字与图案水印。运行环境和算法随压缩包提供，启动本地静态服务器后可断网使用。图片和水印参数由浏览器本地处理。

## 本地启动

- **Windows**：安装 Python 3 后，解压整个压缩包，双击 `start-windows.bat`，在浏览器打开 `http://127.0.0.1:8000/`。
- **Linux / macOS**：在包含 `dist/` 的目录运行下面的命令，然后打开同一地址。

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

## 静态托管

将完整的 `dist/` 目录作为网站根目录，确保 `index.html`、脚本和资源保留原相对路径。静态服务器需能提供 `.wasm`、`.whl` 和 `.zip` 文件，建议将 `.wasm` 的 MIME 类型配置为 `application/wasm`。若使用子路径，请从带末尾 `/` 的目录地址进入。

## 嵌入和提取

1. 嵌入时，选择一张 PNG、JPEG 或 BMP 图片，再填入文字或选择黑白小图。点击「嵌入水印」。网页输出 PNG，并提供「保存提取参数」。
2. 提取时，选择含水印的图片，切换为相同的水印类型，输入原来的水印位数或图案尺寸，并在「算法参数」中设置两个密码和相同的常规或快速模式。
3. 文字长度以算法使用的 `wm_shape` 位数为准。图案以宽 × 高像素输入，Python 接口的 `wm_shape` 顺序是 `(高, 宽)`。

网页设定的图片上限为 30 MB / 1200 万像素。嵌入支持 8 位图片，图案水印会按原版算法转成黑白位图。提取文字时，错误参数可能产生乱码。请保留下载的 PNG 和提取参数，重新缩放、压缩或裁剪后的结果取决于图片与处理方式。

## 用原版 Python 提取网页生成的文字水印

```bash
python -m pip install blind-watermark==0.4.4
```

```python
from blind_watermark import WaterMark

# 用网页导出的相应参数替换这些示例值。
mark = WaterMark(password_wm=731, password_img=982)
mark.bwm_core.fast_mode = False
print(mark.extract('example-watermarked.png', wm_shape=264, mode='str'))
```

图案水印使用 `mode='img'`、`wm_shape=(高, 宽)`，以及 `out_wm_name='extracted.png'`。

## 兼容性验证

原版 Python `blind-watermark==0.4.4` 与浏览器所用的 WebAssembly 运行环境已完成双向提取测试。样本包含带中文和 emoji 的文字、非正方形黑白图案、不同的密码，以及常规和快速模式。文字逐字符一致，图案阈值化后的像素与测试原图一致。另在 Chrome 实测了网页嵌入、下载 PNG 和上传成品提取，并用原版 Python 成功提取了网页下载的 PNG。

## 源码和许可证

`dist/` 内含网页源码。`dist/vendor/engine.zip` 内含 Python 桥接代码和 Blind Watermark 0.4.4 源码，其中 `pool.py` 避免在浏览器里初始化操作系统进程。浏览器通过 Web Worker 调用原版算法。Pyodide 0.28.3 与其 NumPy、OpenCV、PyWavelets 包位于 `dist/runtime/`，许可证见 `dist/licenses/` 和依赖包内的许可证文件。
