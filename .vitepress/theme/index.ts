import DefaultTheme from 'vitepress/theme'
import Layout from './components/Layout.vue'
import TreeTOC from './components/TreeTOC.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('TreeTOC', TreeTOC)
  },
}
