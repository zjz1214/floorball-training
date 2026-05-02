import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'

// All H1 sections and their H2 children
const sidebar = {
  '/个人技术基础/': [
    { text: '概述', link: '/个人技术基础/' },
    { text: '控球训练', link: '/个人技术基础/控球训练' },
    { text: '传球训练', link: '/个人技术基础/传球训练' },
    { text: '射门训练', link: '/个人技术基础/射门训练' },
    { text: '带球训练', link: '/个人技术基础/1.4 带球训练' },
    { text: '防守动作', link: '/个人技术基础/1.5 防守动作' },
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
    { text: '进攻的局部技术', link: '/团队训练/进攻的局部技术' },
    { text: '5打4战术', link: '/团队训练/5打4战术' },
    { text: '任意球战术', link: '/团队训练/任意球战术' },
  ],
  '/发力原理解析/': [
    { text: '概述', link: '/发力原理解析/' },
    { text: '体能训练', link: '/发力原理解析/体能训练' },
  ],
  '/热身及小游戏/': [
    { text: '概述', link: '/热身及小游戏/' },
  ],
  '/其他/': [
    { text: '概述', link: '/其他/' },
    { text: '换人', link: '/其他/换人' },
    { text: '比赛经验', link: '/其他/比赛经验' },
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
      {
        text: '个人技术基础',
        items: [
          { text: '控球训练', link: '/个人技术基础/控球训练' },
          { text: '传球训练', link: '/个人技术基础/传球训练' },
          { text: '射门训练', link: '/个人技术基础/射门训练' },
          { text: '带球训练', link: '/个人技术基础/1.4 带球训练' },
          { text: '防守动作', link: '/个人技术基础/1.5 防守动作' },
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
          { text: '进攻的局部技术', link: '/团队训练/进攻的局部技术' },
          { text: '5打4战术', link: '/团队训练/5打4战术' },
          { text: '任意球战术', link: '/团队训练/任意球战术' },
        ],
      },
      { text: '发力原理解析', link: '/发力原理解析/' },
      { text: '热身及小游戏', link: '/热身及小游戏/' },
      { text: '其他', link: '/其他/' },
    ],

    sidebar,
  },
})
