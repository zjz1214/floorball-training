import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'

// All H1 sections and their H2 children
const sidebar = {
  '/软曲简介/': [
    { text: '概述', link: '/软曲简介/' },
  ],
  '/个人技术基础/': [
    { text: '概述', link: '/个人技术基础/' },
    { text: '控球训练', link: '/个人技术基础/控球训练' },
    { text: '传球训练', link: '/个人技术基础/传球训练' },
    { text: '射门训练', link: '/个人技术基础/射门训练' },
    { text: '防守动作', link: '/个人技术基础/防守动作' },
  ],
  '/个人技术进阶/': [
    { text: '概述', link: '/个人技术进阶/' },
    { text: '控球', link: '/个人技术进阶/控球' },
    { text: '传球', link: '/个人技术进阶/传球' },
    { text: '射门', link: '/个人技术进阶/射门' },
    { text: '运球', link: '/个人技术进阶/运球' },
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
    { text: '进攻的局部技术', link: '/团队训练/进攻的局部技术' },
    { text: '5打4战术', link: '/团队训练/5打4战术' },
    { text: '任意球战术', link: '/团队训练/任意球战术' },
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
  ],
  '/其他/': [
    { text: '概述', link: '/其他/' },
    { text: '比赛经验', link: '/其他/比赛经验' },
    { text: '发力原理解析', link: '/其他/发力原理解析' },
    { text: '热身及小游戏', link: '/其他/热身及小游戏' },
  ],
}

export default defineConfig({
  title: '软曲教学',
  description: '软式曲棍球（Floorball）校队训练内容',
  lang: 'zh-CN',
  base: '/floorball-training/',
  cleanUrls: true,
  ignoreDeadLinks: true,
  srcExclude: ['**/manual.md', '**/*.py', '**/feishu-export/**', '**/README.md', '**/CLAUDE.md', '**/todo.md'],

  markdown: {
    config: (md) => {
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

    nav: [
      { text: '首页', link: '/' },
      { text: '软曲简介', link: '/软曲简介/' },
      {
        text: '个人技术基础',
        items: [
          { text: '控球训练', link: '/个人技术基础/控球训练' },
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
          { text: '运球', link: '/个人技术进阶/运球' },
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
          { text: '进攻的局部技术', link: '/团队训练/进攻的局部技术' },
          { text: '5打4战术', link: '/团队训练/5打4战术' },
          { text: '任意球战术', link: '/团队训练/任意球战术' },
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
      { text: '装备器材', link: '/装备器材/' },
      { text: '其他', link: '/其他/' },
    ],

    sidebar,
  },
})
