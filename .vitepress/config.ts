import { defineConfig } from 'vitepress'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { relative } from 'node:path'
import container from 'markdown-it-container'
import editorPages from '../.local-editor/pages.json'
import pageOrder from '../.local-editor/order.json'
import { sortByOrder, sidebarPage } from '../.local-editor/order.mjs'
import directoryNames from '../.local-editor/names.json'
import { applyNavigationNames, pageTitle } from '../.local-editor/names.mjs'
import directoryGroups from '../.local-editor/groups.json'
import { groupSidebar } from '../.local-editor/groups.mjs'
import { syncNavigation } from '../.local-editor/navigation.mjs'

// All H1 sections and their H2 children
const sidebar = {
  '/软曲简介/': [
    { text: '概述', link: '/软曲简介/' },
    { text: '校内 3v3 规则', link: '/软曲简介/校内3v3规则' },
    { text: '3v3 世锦赛规则', link: '/软曲简介/3v3规则' },
  ],
  '/个人技术基础/': [
    { text: '概述', link: '/个人技术基础/' },
    { text: '控球训练', link: '/个人技术基础/控球训练' },
    { text: '运球', link: '/个人技术基础/运球' },
    { text: '传球训练', link: '/个人技术基础/传球训练' },
    { text: '射门训练', link: '/个人技术基础/射门训练' },
    { text: '防守动作', link: '/个人技术基础/防守动作' },
  ],
  '/个人技术进阶/': [
    { text: '概述', link: '/个人技术进阶/' },
    { text: '控球', link: '/个人技术进阶/控球' },
    { text: '传球', link: '/个人技术进阶/传球' },
    { text: '射门', link: '/个人技术进阶/射门' },
  ],
  '/专项练习/': [
    { text: '概述', link: '/专项练习/' },
    { text: '前锋专项', link: '/专项练习/前锋专项' },
    { text: '后卫专项', link: '/专项练习/后卫专项' },
  ],
  '/团队训练/': [
    { text: '概述', link: '/团队训练/' },
    { text: '防守战术', link: '/团队训练/防守战术' },
    { text: '进攻战术', link: '/团队训练/进攻战术' },
    { text: '进攻的局部技术', link: '/团队训练/进攻的局部技术（积累默契）' },
    { text: '5打4战术', link: '/团队训练/5打4战术' },
    { text: '任意球战术', link: '/团队训练/任意球战术' },
  ],
  '/校队训练记录/': [
    { text: '概述', link: '/校队训练记录/' },
    { text: '总纲', link: '/校队训练记录/总纲' },
    { text: '第一周周六', link: '/校队训练记录/第一周周六' },
    { text: '第一周周日', link: '/校队训练记录/第一周周日' },
    { text: '第三周', link: '/校队训练记录/第三周' },
    { text: '第四周', link: '/校队训练记录/第四周' },
    { text: '第六周', link: '/校队训练记录/第六周' },
    { text: '第七周', link: '/校队训练记录/第七周' },
    { text: '第八周', link: '/校队训练记录/第八周' },
    { text: '第十一周', link: '/校队训练记录/第十一周' },
  ],
  '/训练计划/': [
    { text: '概述', link: '/训练计划/' },
    { text: '教学框架', link: '/训练计划/教学框架' },
    { text: '传球与接球', link: '/训练计划/传球与接球' },
    { text: '射门', link: '/训练计划/射门' },
    { text: '带球与控制', link: '/训练计划/带球与控制' },
    { text: '个人战术', link: '/训练计划/个人战术' },
    { text: '附录', link: '/训练计划/附录' },
  ],
  '/装备器材/': [
    { text: '概述', link: '/装备器材/' },
    { text: '球杆选择', link: '/装备器材/球杆选择' },
    { text: '拍头选择', link: '/装备器材/拍头选择' },
    { text: '品牌选择', link: '/装备器材/品牌选择' },
  ],
  '/比赛经验/': [{ text: '比赛经验', link: '/比赛经验/' }],
  '/发力原理解析/': [{ text: '发力原理解析', link: '/发力原理解析/' }],
  '/热身及小游戏/': [{ text: '热身及小游戏', link: '/热身及小游戏/' }],
}

// Pages created locally join the existing sidebar; hand-maintained entries keep their order.
for (const entry of editorPages as { category: string; path: string; title: string }[]) {
  const key = `/${entry.category}/`
  const items = (sidebar as Record<string, { text: string; link: string }[]>)[key]
  const link = `/${entry.path.replace(/\.md$/, '')}`
  if (items && !items.some(item => item.link === link)) items.push({ text: entry.title, link })
}
const pageTitles: Record<string,string>={}
function readPageTitle(name:string){try{return pageTitle(readFileSync(new URL(`../${name}`,import.meta.url),'utf8'))}catch{return ''}}
pageTitles['index.md']=readPageTitle('index.md')
for (const [key,items] of Object.entries(sidebar)) {
  const category=key.replace(/^\//,'').replace(/\/$/,'')
  ;(sidebar as Record<string, { text: string; link: string }[]>)[key]=sortByOrder(items,(pageOrder as Record<string,string[]>)[category]||[],item=>sidebarPage(item.link))
  for (const item of items) {
    const file=sidebarPage(item.link)
    pageTitles[file]=readPageTitle(file)
    const name=pageTitles[file]||(directoryNames.pages as Record<string,string>)[file]
    if(name)item.text=name
  }
  ;(sidebar as Record<string, any[]>)[key]=groupSidebar((sidebar as Record<string, any[]>)[key],(directoryGroups as Record<string,any[]>)[category]||[],item=>sidebarPage(item.link))
}

export default defineConfig({
  title: '软曲教学',
  description: '软式曲棍球（Floorball）校队训练内容',
  lang: 'zh-CN',
  base: '/floorball-training/',
  cleanUrls: true,
  ignoreDeadLinks: true,
  srcExclude: ['**/.local-editor/**', '**/manual.md', '**/*.py', '**/feishu-export/**', '**/README.md', '**/AGENTS.md', '**/DESIGN.md', '**/CLAUDE.md', '**/todo.md'],

  head: [
    ['script', { async: '', src: '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js' }],
    ['script', { src: '/floorball-training/live2d/live2dcubismcore.min.js' }],
  ],

  outDir: '.vitepress/dist-site',

  vite: {
    plugins: [{name:'sync-saved-page-titles',async handleHotUpdate(context){
      const name=relative(fileURLToPath(new URL('../',import.meta.url)),context.file).replace(/\\/g,'/')
      if(Object.hasOwn(pageTitles,name)){const title=pageTitle(readFileSync(context.file,'utf8'));if(title!==pageTitles[name]){
        pageTitles[name]=title
        // Use VitePress's configuration reload, which also resets its search and Markdown caches.
        setTimeout(()=>context.server.watcher.emit('change',fileURLToPath(import.meta.url).replace(/\\/g,'/')),0)
        return []
      }}
    }}],
    server: {
      watch: {
        ignored: [
          '**/.vitepress/.temp/**',
          '**/.vitepress/dist-site/**',
          '**/.vitepress/cache/**',
        ],
      },
    },
    build: {
      emptyOutDir: true,
    },
  },

  markdown: {
    config: (md) => {
      md.use(container, 'element', {
        render(tokens, idx) {
          if (tokens[idx].nesting === -1) return '</figure>\n'
          const title = md.utils.escapeHtml(tokens[idx].info.trim().slice('element'.length).trim())
          return `<figure class="element-block">${title ? `<figcaption class="element-title">${title}</figcaption>` : ''}\n`
        },
      })
      // Content links use root-relative paths; VitePress adds the deployment base once.
      // Accept earlier editor links that already included that base without rewriting content.
      md.core.ruler.push('normalize_site_links', state => {
        for (const block of state.tokens) for (const token of block.children || []) {
          if (token.type !== 'link_open') continue
          const href = token.attrGet('href')
          if (href?.startsWith('/floorball-training/')) token.attrSet('href', href.replace(/^(?:\/floorball-training)+(?=\/|$)/, '') || '/')
        }
      })
      md.use(container, 'media-grid', {
        render: (tokens, idx) => {
          return tokens[idx].nesting === 1
            ? '<div class="media-grid">\n'
            : '</div>\n'
        },
      })
      // Wrap h3/h4 sections in card containers
      md.core.ruler.push('heading_cards', (state) => {
        const Token = state.Token
        const newTokens: typeof state.tokens = []
        const cardStack: string[] = []

        function closeCards(upTo: number) {
          while (cardStack.length > upTo) {
            const tag = cardStack.pop()
            newTokens.push(Object.assign(new Token('html_block', '', 0), { content: `</div><!-- close ${tag}-card -->` }))
          }
        }

        for (let i = 0; i < state.tokens.length; i++) {
          const token = state.tokens[i]

          if (token.type === 'heading_open') {
            if (token.tag === 'h2') {
              closeCards(0)
            } else if (token.tag === 'h3') {
              closeCards(0)
              cardStack.push('h3')
              newTokens.push(Object.assign(new Token('html_block', '', 0), { content: '<div class="h3-card">' }))
            } else if (token.tag === 'h4') {
              closeCards(1)
              cardStack.push('h4')
              newTokens.push(Object.assign(new Token('html_block', '', 0), { content: '<div class="h4-card">' }))
            }
          }

          newTokens.push(token)
        }

        closeCards(0)

        state.tokens = newTokens
      })

      const defaultRender = md.render.bind(md)
      md.render = (src, env) => {
        let html = defaultRender(src, env)
        html = html.replace(
          /<div class="media-grid">([\s\S]*?)<\/div>/g,
          (_: string, inner: string) => {
            const wrapped = inner.replace(
              /<p>([\s\S]*?)<\/p>/g,
              '<div class="media-item"><p>$1</p></div>',
            )
            return `<div class="media-grid">${wrapped}</div>`
          },
        )
        return html
      }
    },
  },

  themeConfig: {
    search: { provider: 'local' },

    nav: applyNavigationNames(syncNavigation([
      { text: '首页', link: '/' },
      {
        text: '软曲简介',
        items: [
          { text: '概述', link: '/软曲简介/' },
          { text: '校内 3v3 规则', link: '/软曲简介/校内3v3规则' },
          { text: '3v3 世锦赛规则', link: '/软曲简介/3v3规则' },
        ],
      },
      {
        text: '个人技术基础',
        items: [
          { text: '控球训练', link: '/个人技术基础/控球训练' },
          { text: '运球', link: '/个人技术基础/运球' },
          { text: '传球训练', link: '/个人技术基础/传球训练' },
          { text: '射门训练', link: '/个人技术基础/射门训练' },
          { text: '防守动作', link: '/个人技术基础/防守动作' },
        ],
      },
      {
        text: '个人技术进阶',
        items: [
          { text: '控球', link: '/个人技术进阶/控球' },
          { text: '传球', link: '/个人技术进阶/传球' },
          { text: '射门', link: '/个人技术进阶/射门' },
        ],
      },
      {
        text: '专项练习',
        items: [
          { text: '前锋专项', link: '/专项练习/前锋专项' },
          { text: '后卫专项', link: '/专项练习/后卫专项' },
        ],
      },
      {
        text: '团队训练',
        items: [
          { text: '防守战术', link: '/团队训练/防守战术' },
          { text: '进攻战术', link: '/团队训练/进攻战术' },
          { text: '进攻的局部技术', link: '/团队训练/进攻的局部技术（积累默契）' },
          { text: '5打4战术', link: '/团队训练/5打4战术' },
          { text: '任意球战术', link: '/团队训练/任意球战术' },
        ],
      },
      {
        text: '校队训练记录',
        items: [
          { text: '总纲', link: '/校队训练记录/总纲' },
          { text: '第一周周六', link: '/校队训练记录/第一周周六' },
          { text: '第一周周日', link: '/校队训练记录/第一周周日' },
          { text: '第三周', link: '/校队训练记录/第三周' },
          { text: '第四周', link: '/校队训练记录/第四周' },
          { text: '第六周', link: '/校队训练记录/第六周' },
          { text: '第七周', link: '/校队训练记录/第七周' },
          { text: '第八周', link: '/校队训练记录/第八周' },
          { text: '第十一周', link: '/校队训练记录/第十一周' },
        ],
      },
      {
        text: '训练计划',
        items: [
          { text: '教学框架', link: '/训练计划/教学框架' },
          { text: '传球与接球', link: '/训练计划/传球与接球' },
          { text: '射门', link: '/训练计划/射门' },
          { text: '带球与控制', link: '/训练计划/带球与控制' },
          { text: '个人战术', link: '/训练计划/个人战术' },
        ],
      },
      {
        text: '装备器材',
        items: [
          { text: '球杆选择', link: '/装备器材/球杆选择' },
          { text: '拍头选择', link: '/装备器材/拍头选择' },
          { text: '品牌选择', link: '/装备器材/品牌选择' },
        ],
      },
      { text: '比赛经验', items: [{text:'比赛经验',link:'/比赛经验/'}] },
      { text: '发力原理解析', items: [{text:'发力原理解析',link:'/发力原理解析/'}] },
      { text: '热身及小游戏', items: [{text:'热身及小游戏',link:'/热身及小游戏/'}] },
    ],sidebar,(pageOrder as Record<string,string[]>).$categories||[]),directoryNames,0,pageTitles),

    sidebar,
  },
})
