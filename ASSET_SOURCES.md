# 開源參考與素材來源

查核日期：2026-09-06。以下分開記錄「實際使用的素材」與「玩法參考」，避免把參考作品誤稱為本專案程式來源。

## 實際使用：背景音樂 Urgent

- 作者 SRG774；[作品與作者授權宣告](https://opengameart.org/content/dark-sci-fi-audio-pack)，[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。並非將 Pixabay 的授權誤記為 CC0。
- 原檔：https://opengameart.org/sites/default/files/urgent_0.mp3 ，2,275,786 bytes；SHA256 `4aba1f1a01f328e0337a3764eb89d8d69e13ea2a86929840c787f4d736565b82`。
- 遊戲檔：`public/audio/urgent-srg774-loop-v1.mp3`，911,194 bytes，約 56.89 秒、44.1 kHz 立體聲 MP3 128 kbps；SHA256 `21a00c69a47dce820001cbd0b19707a27c4f1bbb6ebd1f3c5e45cbd925e3691d`。
- 調整：FFmpeg `loudnorm=I=-19:TP=-2:LRA=9,afade=t=in:d=0.03,afade=t=out:st=56.82:d=0.05`。原檔 mean -44.6／max -24.4 dB；輸出 mean -20.4／max -2.4 dB（volumedetect），遊戲再以獨立 gain 預設 35% 淡入。
- 原生 loop；邊緣淡化減少突變，不宣稱專業無縫重混。授權與修改記錄另存 `public/audio/LICENSE.txt`，設定介面可點回作者作品頁。

## 實際使用：Quaternius Zombie Apocalypse Kit

- 作者：Quaternius。
- 官方來源：https://quaternius.com/packs/zombieapocalypsekit.html
- 授權：CC0 1.0 Universal，官方頁面標示可用於個人與商業專案。
- 下載來源（glTF 鏡像）：https://github.com/agentkaerf/FreeModels
- 授權全文：https://creativecommons.org/publicdomain/zero/1.0/
- 使用模型：`Zombie_Basic.gltf`、`Zombie_Chubby.gltf`、`Zombie_Ribcage.gltf`、`Container_Green.gltf`、`Barrel.gltf`、`WaterTower.gltf`、`TrafficBarrier_1.gltf`。
- 實際整合：普通／快速／重型／巨型殭屍，行走或奔跑骨架動畫，貨櫃、水塔、油桶及路障。
- 修改方式：執行時依遊戲尺寸縮放，巨型殭屍共用 Chubby 模型；角色各自克隆骨架。

## 實際使用：Kenney Blaster Kit 2.1

- 作者：Kenney。
- 官方來源：https://kenney.nl/assets/blaster-kit
- 作者發布頁：https://opengameart.org/content/blaster-kit
- 下載：https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- 授權：CC0；原始授權檔保留在 `public/licenses/Kenney-CC0.txt`。
- 使用模型：`blaster-a.glb`、`blaster-j.glb`、`blaster-o.glb` 及 `Textures/colormap.png`。
- 實際整合：三種玩家武器的 3D 外觀與即時渲染武器卡預覽。切換武器同時切換實體槍械模型。
- 原始完整 ZIP 與解壓內容保留在 `assets-source/`，便於 Blender 後續改模。

## GitHub 玩法／架構參考

- https://github.com/djpav/threejs-tower-defense （MIT）：參考其 README 描述的波次間建造、升級、出售、冰凍與範圍攻擊等設計，以及將戰鬥與渲染分離的結構。本專案程式碼自行實作，未複製其原始程式碼；數值、路線、武器熱量與手動射擊為本專案設計。
- https://github.com/Casmo/tower-defense （MIT）：查閱其 Three.js 塔防專案介紹，作為瀏覽器 3D 塔防可行性參考；未納入其舊版引擎或素材。
- Three.js 官方安裝指引：https://threejs.org/manual/en/installation.html

## 技術與其他素材

- Three.js：MIT，套件版本由 `package-lock.json` 鎖定；授權檔另存 `public/licenses/Three-MIT.txt`。
- Vite：MIT，僅開發／建置工具。
- Noto Sans TC：SIL Open Font License，透過 Google Fonts CSS 載入；字型失敗時有系統字型備援。
- 防禦塔、核心、道路、植被、介面圖形：本專案以 Three.js 幾何及 CSS 製作。
- 射擊音效：Web Audio API 即時合成，無外部音檔。

素材雜湊與檔案大小見 `asset-manifest.json`。本專案未使用未註明授權的商業遊戲角色或武器造型。


## 2026-09-06 A＋B 素材追加

- Quaternius 守衛：`Characters_Sam_SingleWeapon.gltf`，同一 Zombie Apocalypse Kit、CC0；已載入素材庫，尚未接入可走動角色。含 20 段動畫。來源：https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Zombie%20Apocalypse%20Kit%20-%20March%202024/Characters/glTF/Characters_Sam_SingleWeapon.gltf
- `pulse-mk2.glb`：以保留的 Kenney `blaster-a.glb` 在 Blender 加入能源細節與 Muzzle 定位點，貼圖內嵌。原作 CC0，新增幾何細節亦以 CC0 提供。母檔 `assets-source/blender/pulse-mk2.blend`，腳本 `scripts/blender-build-pulse.py`。
- 共 11 個載入模型；磁碟保留原檔及縮圖共 16 個資源檔、6,174,793 bytes；雜湊以 manifest 為準。

## v1.2.0 網站識別與分享插畫

- favicon：專案自繪護盾與閃電，產生腳本 scripts/generate-icons.mjs。
- OG：AI imagegen 生成的宣傳插畫，public/og-deadzone-v1.png，1734×907；非遊戲截圖，沒有額外下載第三方照片。圖片直接隨專案保存。

## v1.4.0 極地偵巡外觀

- 守衛衍生自同一 Quaternius CC0 素材；三把槍衍生自 Kenney Blaster Kit CC0（脈衝沿用本專案 MK2）。新增配色、材質與定位點亦以 CC0 提供，保留原版來源檔。
- 四份 GLB 位於 `public/models/skins/`，合計 1,189,008 bytes；母檔位於 `assets-source/blender/skins/`。批次 Blender 腳本建立灰白裝甲、石墨結構與武器識別色，守衛保留皮膚及原骨架動畫；電漿槍以 Blender MCP 追加橘色發光修整並匯出。
- 八項可選外觀（含原版）的詳細授權、尺寸、貼圖、面數與 SHA256 由 `src/skin-catalog.json` 記錄；下載／生成流程摘要同步於 `asset-manifest.json`。
- 社群開發工具 [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) 為 MIT，安裝在使用者工具目錄，沒有把外掛原始碼或 Python 環境打包進網站；它不是本專案素材的來源授權。
