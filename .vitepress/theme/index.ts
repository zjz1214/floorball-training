import DefaultTheme from 'vitepress/theme'
import Layout from './components/Layout.vue'
import TreeTOC from './components/TreeTOC.vue'
import Live2DCanvas from './components/Live2DCanvas.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('TreeTOC', TreeTOC)
    app.component('Live2DCanvas', Live2DCanvas)
  },
}
