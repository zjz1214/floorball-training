<template>
  <div ref="el" class="live2d-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const el = ref<HTMLDivElement>()
let app: any = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('empty src'))
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

onMounted(async () => {
  if (typeof window === 'undefined') return

  try {
    const base = import.meta.env.BASE_URL || '/'

    // Load Cubism 4 SDK Core dynamically
    await loadScript(`${base}live2d/live2dcubismcore.min.js`)

    const PIXI = await import('pixi.js')
    ;(window as any).PIXI = PIXI

    const { Live2DModel } = await import('pixi-live2d-display/cubism4')

    if (!el.value) return

    app = new PIXI.Application({
      width: 280,
      height: 380,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    el.value.appendChild(app.view as HTMLCanvasElement)

    // Enable event system on stage
    app.stage.eventMode = 'static'

    const model = await Live2DModel.from(
      `${base}live2d/luoxiaohei/罗小黑2023/model0.json`,
      { autoHitTest: true, autoFocus: true }
    )

    // Position at bottom-center of canvas
    model.anchor.set(0.5, 1)
    model.x = app.screen.width / 2
    model.y = app.screen.height

    // Auto-scale to fit within canvas
    const maxW = app.screen.width * 0.9
    const maxH = app.screen.height * 0.95
    const s = Math.min(
      maxW / (model.width || 1),
      maxH / (model.height || 1),
      0.5
    )
    model.scale.set(s)

    // Build hit area → (group, index) mapping from model settings
    // Each HitArea.Motion is "group:motion/name.motion3.json" or just "group"
    type HitTarget = { group: string; index?: number }
    const hitMap = new Map<string, HitTarget>()
    try {
      const settings = (model as any).internalModel?.settings
      const hitAreas: any[] = settings?.hitAreas
      const motions: Record<string, any[]> = settings?.motions || {}
      if (hitAreas) {
        for (const ha of hitAreas) {
          if (!ha.Motion) continue
          const colon = ha.Motion.indexOf(':')
          let group: string
          let motionName: string | undefined
          if (colon >= 0) {
            group = ha.Motion.slice(0, colon)
            motionName = ha.Motion.slice(colon + 1)
          } else {
            group = ha.Motion
          }
          // Find motion index by name within the group
          let index: number | undefined
          if (motionName) {
            const groupMotions = motions[group]
            if (groupMotions) {
              index = groupMotions.findIndex((m: any) => m.Name === motionName)
            }
          }
          hitMap.set(ha.Name, { group, index: index >= 0 ? index : undefined })
        }
      }
    } catch (e) {
      console.warn('[Live2D] Failed to read hit/motion mapping:', e)
    }

    // On hit, play the mapped motion (clean, no manual state reset)
    model.on('hit', (hitAreas: string[]) => {
      const target = hitMap.get(hitAreas[0])
      if (!target) return
      model.motion(target.group, target.index, 3)
    })

    app.stage.addChild(model)
  } catch (e) {
    console.warn('[Live2D] Failed to load:', e)
  }
})

onUnmounted(() => {
  if (app) {
    app.destroy(true, { children: true })
    app = null
  }
})
</script>

<style scoped>
.live2d-canvas {
  position: fixed;
  bottom: 0;
  right: 0;
  z-index: 1000;
}
.live2d-canvas :deep(canvas) {
  pointer-events: auto;
}

/* Smaller on mobile */
@media (max-width: 768px) {
  .live2d-canvas {
    transform: scale(0.55);
    transform-origin: bottom right;
  }
}
</style>
