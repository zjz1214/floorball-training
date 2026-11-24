<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, withBase } from 'vitepress'

const route = useRoute()
const cleanups: (() => void)[] = []
let mounted = false

function button(label: string) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  return element
}

function time(seconds: number) {
  const whole = Math.floor(Number.isFinite(seconds) ? seconds : 0)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function videoControls(video: HTMLVideoElement, signal: AbortSignal) {
  const controls = document.createElement('div')
  controls.className = 'media-flip-playback'
  controls.hidden = true
  const play = button('播放')
  const mute = button('静音')
  const seek = document.createElement('input')
  seek.type = 'range'
  seek.min = '0'
  seek.step = 'any'
  seek.setAttribute('aria-label', '播放进度')
  const elapsed = document.createElement('span')
  const speed = document.createElement('select')
  speed.setAttribute('aria-label', '播放速度')
  for (const rate of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]) speed.add(new Option(`${rate}×`, String(rate)))
  const sync = () => {
    const duration = video.duration
    play.textContent = video.paused ? '播放' : '暂停'
    mute.textContent = video.muted ? '取消静音' : '静音'
    seek.disabled = !Number.isFinite(duration) || duration <= 0
    seek.max = seek.disabled ? '0' : String(duration)
    seek.value = String(video.currentTime)
    seek.setAttribute('aria-valuetext', `${time(video.currentTime)} / ${time(duration)}`)
    elapsed.textContent = `${time(video.currentTime)} / ${time(duration)}`
    const rate = String(video.playbackRate)
    if (![...speed.options].some(option => option.value === rate)) speed.add(new Option(`${rate}×`, rate))
    speed.value = rate
  }
  play.onclick = () => video.paused ? void video.play().catch(sync) : video.pause()
  mute.onclick = () => { video.muted = !video.muted }
  seek.oninput = () => { video.currentTime = Number(seek.value) }
  speed.onchange = () => { video.playbackRate = Number(speed.value) }
  for (const event of ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'volumechange', 'ratechange']) {
    video.addEventListener(event, sync, { signal })
  }
  controls.append(play, seek, elapsed, mute, speed)
  return { controls, sync }
}

function attach(media: HTMLImageElement | HTMLVideoElement) {
  const controller = new AbortController()
  const tools = document.createElement('div')
  tools.className = 'media-flip-tools'
  const flip = button('左右翻转')
  const kind = media instanceof HTMLVideoElement ? '视频' : '图片'
  flip.setAttribute('aria-label', `左右翻转${kind}`)
  flip.setAttribute('aria-pressed', 'false')
  tools.append(flip)

  const video = media instanceof HTMLVideoElement ? media : null
  const nativeVideo = video?.controls ? video : null
  const playback = nativeVideo && videoControls(nativeVideo, controller.signal)
  let pending = !!video?.hasAttribute('data-video-pending')
  let mirrored = false
  const updateControls = () => {
    if (!nativeVideo || !playback) return
    nativeVideo.controls = !pending && !mirrored
    playback.controls.hidden = pending || !mirrored
    if (!playback.controls.hidden) playback.sync()
  }
  if (video && pending) {
    const start = button('播放视频')
    const caption = video.getAttribute('aria-label')
    if (caption) start.setAttribute('aria-label', `播放视频：${caption}`)
    tools.prepend(start)
    start.onclick = async () => {
      start.disabled = true
      const sources = [video, ...video.querySelectorAll('source[data-video-src]')]
      for (const source of sources) {
        const src = source.getAttribute('data-video-src')
        if (src) source.setAttribute('src', src.startsWith(import.meta.env.BASE_URL) ? src : withBase(src))
      }
      video.load()
      try {
        await video.play()
        if (controller.signal.aborted) return
        pending = false
        video.removeAttribute('data-video-pending')
        start.remove()
        updateControls()
      } catch {
        if (controller.signal.aborted) return
        start.disabled = false
        start.textContent = '重试播放'
        start.setAttribute('aria-label', caption ? `重试播放：${caption}` : '重试播放')
      }
    }
    updateControls()
  }
  if (playback) tools.append(playback.controls)
  flip.onclick = () => {
    mirrored = !mirrored
    media.classList.toggle('media-flip-mirrored', mirrored)
    flip.setAttribute('aria-pressed', String(mirrored))
    flip.textContent = mirrored ? '恢复原方向' : '左右翻转'
    updateControls()
  }
  // Insert outside image links and picture groups, keeping the original media in its layout.
  const wrapper = media.closest('a') || media.closest('picture') || media
  wrapper.after(tools)
  cleanups.push(() => {
    controller.abort()
    media.classList.remove('media-flip-mirrored')
    if (nativeVideo) nativeVideo.controls = true
    tools.remove()
  })
}

function reset() { for (const cleanup of cleanups.splice(0)) cleanup() }
async function refresh() {
  await nextTick()
  if (!mounted) return
  reset()
  for (const media of document.querySelectorAll<HTMLImageElement | HTMLVideoElement>('.vp-doc img, .vp-doc video')) {
    if (media.closest('.floorball-tactics')) continue
    attach(media)
  }
}
onMounted(() => { mounted = true; void refresh() })
watch(() => route.path, refresh, { flush: 'post' })
onUnmounted(() => { mounted = false; reset() })
</script>

<template><span hidden aria-hidden="true"></span></template>

<style>
.vp-doc .media-flip-mirrored { scale: -1 1; }
.media-flip-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-block: 2px 10px; }
.media-flip-tools button, .media-flip-tools select { position: relative; z-index: 12; padding: 4px 9px; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); font-size: 12px; line-height: 1.5; }
.media-flip-tools button:hover, .media-flip-tools button[aria-pressed='true'] { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.media-flip-playback { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12px; }
.media-flip-playback[hidden] { display: none; }
.media-flip-playback input { position: relative; z-index: 12; width: min(125px, 40vw); accent-color: var(--vp-c-brand-1); }
</style>
