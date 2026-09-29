# 制作你自己的影片

用六个步骤讲一个新故事。
智能体借助[技能](../../skills/focal-plane/SKILL.md)也能跑同样的循环。

## 1. 写镜头清单

每个镜头一句话，每句都有一个因和一个果：

```
1. 定场：页面和它的核心数字
2. 光标打开“零钱凑整”，预计余额滚动上涨
3. ...
```

五到八个镜头，组成一部 12 到 20 秒的影片。

## 2. 把所有数字放进一个模块

创建 `src/<film>/data.ts`。
任何随机性都要设定种子；不要调用 `Math.random()`，也不要读取时钟。
镜头中显示的每个数字都从这个模块推导出来（[诚实的数据](honest-data.md)）。

## 3. 写镜头

对每个镜头，
把 `skills/focal-plane/templates/shot.ts` 复制为 `src/<film>/shots/<id>.ts`，然后：

- 设定页面尺寸，并在 `draw()` 中绘制页面；
- 在 `state(t)` 中驱动光标、控件和数值，
  并返回 `focus: [x, y]`；
- 设定两个相机关键帧；
- 给镜头一个状态类型，
  让 `bun run typecheck` 核对 `state()` 返回的内容与 `draw()` 读取的内容是否一致。

## 4. 组装剪辑

把 `templates/edit.ts` 复制为 `src/<film>/edit.ts`，并列出所有镜头。
把 `templates/main.ts` 复制为 `src/<film>/main.ts`。
现在，播放器可以在 `index.html?film=<film>` 播放这部影片了。
在渲染第一帧之前，先运行 `bun run typecheck`。

## 5. 在静帧上构图

```bash
bun run shoot --film=<film> --shot=<id> --lt=0.3,0.8,1.6,2.2 --sheet
```

逐帧查看。
把 `look` 沿页面往下移，内容在画面中就会往上移，
改 `azimuth` 和 `elevation` 调整角度，
然后再拍一次。
渲染之前，在一张联系表上检查整个剪辑。

## 6. 渲染并验证

```bash
bun run render --film=<film>
bun run verify out/<film>-2160p60.mp4 --at=1,5,9
```

在宣布完成之前，先看一看解码出来的帧。
然后制作封面：复制 `tools/media.ts`，把其中的 `CUT` 和 `STILLS` 改成你的镜头。

返回[文档](README.md)。
