import { defineConfig } from 'vite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { makeBuildMeta } from './scripts/build-meta.mjs';
const build = makeBuildMeta();
const site = JSON.parse(fs.readFileSync('site.config.json'));
const png = fs.readFileSync('public/' + site.image);
export default defineConfig({
  base: './',
  define: { __BUILD_META__: JSON.stringify(build) },
  plugins: [
    {
      name: 'deadzone-release',
      transformIndexHtml(html) {
        const image = new URL(site.image, site.url).href + '?v=' + crypto.createHash('sha256').update(png).digest('hex').slice(0,12);
        const tags = [
          { tag: 'link', attrs: { rel: 'canonical', href: site.url } },
          ...Object.entries({
            'og:type': 'website',
            'og:locale': 'zh_TW',
            'og:site_name': site.title,
            'og:title': site.title,
            'og:description': site.description,
            'og:url': site.url,
            'og:image': image,
            'og:image:secure_url': image,
            'og:image:type': 'image/png',
            'og:image:width': String(png.readUInt32BE(16)),
            'og:image:height': String(png.readUInt32BE(20)),
            'og:image:alt': 'DEADZONE 能量防線：守衛持能量槍、三種防禦塔與殭屍戰場',
          }).map(([property, content]) => ({ tag: 'meta', attrs: { property, content } })),
          ...Object.entries({
            'twitter:card': 'summary_large_image',
            'twitter:title': site.title,
            'twitter:description': site.description,
            'twitter:image': image,
            'twitter:image:alt': 'DEADZONE 能量防線科幻塔防遊戲',
            'app-build': build.id,
          }).map(([name, content]) => ({ tag: 'meta', attrs: { name, content } })),
          {
            tag: 'script',
            children: fs.readFileSync('scripts/recovery-inline.js', 'utf8'),
            injectTo: 'head-prepend',
          },
        ];
        return { html, tags };
      },
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle).filter((p) => /\.(js|css)$/.test(p));
        const sw = fs
          .readFileSync('scripts/sw-template.js', 'utf8')
          .replace('__SW_META__', JSON.stringify(build))
          .replace('__SW_ASSETS__', JSON.stringify(assets));
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(build, null, 2),
        });
        this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
      },
    },
  ],
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules\/three/ }] } },
    },
  },
});
