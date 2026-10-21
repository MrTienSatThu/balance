// Trang dẫn đường trên đồng hồ. Bản thử M1: GPS, tuyến Valhalla, vẽ tuyến hướng Bắc lên trên,
// chỉ dẫn kế tiếp, rung báo, và các số đo rủi ro (GPS, Bluetooth, Side Service khi khoá máy).

import * as hmUI from '@zos/ui'
import { Geolocation, Vibrator, VIBRATOR_SCENE_DURATION, VIBRATOR_SCENE_STRONG_REMINDER } from '@zos/sensor'
import {
  setPageBrightTime,
  resetPageBrightTime,
  pauseDropWristScreenOff,
  resetDropWristScreenOff,
  setWakeUpRelaunch
} from '@zos/display'
import { log as Logger } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'

import { METHOD } from '../../shared/protocol.js'
import { haversine, bearing, cumulativeDistances, locateOnRoute } from '../../shared/geo.js'
import { maneuverText, formatDistance, isArrival } from '../../shared/maneuver.js'
import { SCREEN, drawFrame } from './render.js'

const logger = Logger.getLogger('balance-nav')

const ZOOM_LEVELS = [1, 2, 4, 8] // mét trên mỗi pixel
const DEFAULT_ZOOM_INDEX = 1
const PING_INTERVAL_MS = 15000
const GPS_WAIT_POLL_MS = 1000
const BRIGHT_TIME_MS = 10 * 60 * 1000
const MIN_MOVE_FOR_HEADING_M = 5
const OFF_ROUTE_M = 50
const OFF_ROUTE_FIXES = 3
const REROUTE_COOLDOWN_MS = 30000
const ROUTE_RETRY_MS = 30000
const LOCATE_WINDOW = 200
const VIBRATE_AT_M = [300, 50]
const BENCH_SIZES = [1000, 10000, 50000]

function clock(ts) {
  const d = new Date(ts)
  const pad = (n) => (n < 10 ? '0' : '') + n
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

Page(
  BasePage({
    state: {
      canvas: null,
      topText: null,
      bottomText: null,
      debugText: null,
      geolocation: null,
      vibrator: null,
      onGeoChange: null,
      onGnssChange: null,
      pingTimer: null,
      gpsWaitTimer: null,
      gpsStartedAt: 0,
      gnss: null,

      me: null,
      lastHeadingPos: null,
      headingDeg: null,

      route: null,
      cum: null,
      maneuverDist: null,
      segment: 0,
      offRouteCount: 0,
      routeRequesting: false,
      lastRouteRequestAt: 0,
      routeError: '',
      vibrated: {},

      zoomIndex: DEFAULT_ZOOM_INDEX,

      // Số đo cho bản thử
      gpsFixes: 0,
      gpsLastAt: 0,
      gpsIntervalSum: 0,
      gpsIntervalMax: 0,
      drawMsLast: 0,
      pingOk: 0,
      pingFail: 0,
      pingRttLast: 0,
      pingLastFailAt: 0,
      sideUptimeS: 0,
      routeStats: '',
      benchStats: '',
      benchDone: false
    },

    onInit() {
      logger.log('page onInit')
      setPageBrightTime({ brightTime: BRIGHT_TIME_MS })
      pauseDropWristScreenOff({ duration: 0 })
      setWakeUpRelaunch({ relaunch: true })
    },

    build() {
      this.state.canvas = hmUI.createWidget(hmUI.widget.CANVAS, {
        x: 0,
        y: 0,
        w: SCREEN,
        h: SCREEN
      })
      this.state.canvas.addEventListener(hmUI.event.CLICK_UP, () => this.cycleZoom())

      this.state.topText = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 70,
        y: 30,
        w: SCREEN - 140,
        h: 120,
        color: 0xffffff,
        text_size: 28,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.WRAP,
        text: 'Đang chờ GPS...'
      })
      this.state.bottomText = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 90,
        y: 330,
        w: SCREEN - 180,
        h: 40,
        color: 0xb0bec5,
        text_size: 24,
        align_h: hmUI.align.CENTER_H,
        text: ''
      })
      this.state.debugText = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 80,
        y: 370,
        w: SCREEN - 160,
        h: 96,
        color: 0x78909c,
        text_size: 16,
        align_h: hmUI.align.CENTER_H,
        text_style: hmUI.text_style.WRAP,
        text: ''
      })

      this.state.vibrator = new Vibrator()
      this.startGps()
      this.startPing()
      this.redraw()
    },

    onDestroy() {
      logger.log('page onDestroy')
      const { geolocation, onGeoChange, onGnssChange, pingTimer, gpsWaitTimer } = this.state
      if (geolocation) {
        onGeoChange && geolocation.offChange(onGeoChange)
        onGnssChange && geolocation.offGnssChange(onGnssChange)
        geolocation.stop()
      }
      pingTimer && clearInterval(pingTimer)
      gpsWaitTimer && clearInterval(gpsWaitTimer)
      resetPageBrightTime()
      resetDropWristScreenOff()
    },

    // Side Service báo điểm đến hoặc phương tiện vừa đổi trong app Zepp.
    onCall(data) {
      if (data && data.method === METHOD.DESTINATION_CHANGED) {
        logger.log('destination changed, reroute')
        this.state.lastRouteRequestAt = 0
        this.requestRoute(true)
      }
    },

    // ---------- GPS ----------

    startGps() {
      const geolocation = new Geolocation()
      const onGeoChange = () => this.onGps()
      const onGnssChange = (info) => {
        this.state.gnss = info
      }
      this.state.gpsStartedAt = Date.now()
      geolocation.start()
      geolocation.onChange(onGeoChange)
      geolocation.onGnssChange(onGnssChange)
      this.state.geolocation = geolocation
      this.state.onGeoChange = onGeoChange
      this.state.onGnssChange = onGnssChange

      // Khi chưa có vị trí: cập nhật dòng trạng thái mỗi giây và tự đọc lại vị trí
      // phòng trường hợp sự kiện onChange không được gọi.
      this.state.gpsWaitTimer = setInterval(() => {
        if (this.state.me) {
          clearInterval(this.state.gpsWaitTimer)
          this.state.gpsWaitTimer = null
          return
        }
        this.onGps()
        this.updateTexts()
      }, GPS_WAIT_POLL_MS)
    },

    gpsWaitText() {
      const s = this.state
      const waitedS = Math.round((Date.now() - s.gpsStartedAt) / 1000)
      let text = 'Đang chờ GPS ' + waitedS + 's'
      const g = s.gnss
      if (g) {
        text += '\nVệ tinh: dùng ' + g.nb_used_satellite + ' / thấy ' + g.nb_valid_satellite
        if (g.agps_inject_time) {
          const ageH = Math.round((Date.now() - g.agps_inject_time) / 3600000)
          text += '\nA-GPS cập nhật ' + ageH + ' giờ trước'
        }
      } else {
        text += '\nChưa có dữ liệu vệ tinh'
      }
      return text
    },

    onGps() {
      const { geolocation } = this.state
      if (geolocation.getStatus() !== 'A') return
      const lat = geolocation.getLatitude()
      const lon = geolocation.getLongitude()
      if (typeof lat !== 'number' || typeof lon !== 'number') return

      const now = Date.now()
      if (this.state.gpsLastAt) {
        const interval = now - this.state.gpsLastAt
        this.state.gpsIntervalSum += interval
        this.state.gpsIntervalMax = Math.max(this.state.gpsIntervalMax, interval)
      }
      this.state.gpsFixes++
      this.state.gpsLastAt = now

      const me = [lat, lon]
      this.state.me = me
      this.updateHeading(me)

      if (!this.state.route) {
        this.requestRoute(false)
      } else {
        this.updateProgress()
      }
      this.redraw()
    },

    // Đồng hồ không trả hướng đi, nên tự tính từ hai vị trí cách nhau đủ xa.
    updateHeading(me) {
      const last = this.state.lastHeadingPos
      if (!last) {
        this.state.lastHeadingPos = me
        return
      }
      if (haversine(last, me) >= MIN_MOVE_FOR_HEADING_M) {
        this.state.headingDeg = bearing(last, me)
        this.state.lastHeadingPos = me
      }
    },

    // ---------- Tuyến đường ----------

    requestRoute(force) {
      const now = Date.now()
      const { me, routeRequesting, lastRouteRequestAt } = this.state
      if (!me || routeRequesting) return
      const cooldown = this.state.route ? REROUTE_COOLDOWN_MS : ROUTE_RETRY_MS
      if (!force && lastRouteRequestAt && now - lastRouteRequestAt < cooldown) return

      this.state.routeRequesting = true
      this.state.lastRouteRequestAt = now
      const startedAt = now

      this.request({ method: METHOD.ROUTE, params: { from: { lat: me[0], lon: me[1] } } })
        .then((route) => {
          const rttMs = Date.now() - startedAt
          const bytes = JSON.stringify(route).length
          this.setRoute(route)
          this.state.routeError = ''
          this.state.routeStats =
            'Tuyến ' + route.points.length + ' điểm, ' + Math.round(bytes / 1024) + ' KB, ' +
            (rttMs / 1000).toFixed(1) + ' s (Valhalla ' + (route.fetchMs / 1000).toFixed(1) + ' s)'
          logger.log(this.state.routeStats)
          this.runBenchOnce()
        })
        .catch((e) => {
          this.state.routeError = (e && e.message) || 'Lỗi tính tuyến'
          logger.log('route error ' + this.state.routeError)
        })
        .finally(() => {
          this.state.routeRequesting = false
          this.redraw()
        })
    },

    setRoute(route) {
      const cum = cumulativeDistances(route.points)
      this.state.route = route
      this.state.cum = cum
      this.state.maneuverDist = route.maneuvers.map((m) => cum[Math.min(m.index, cum.length - 1)])
      this.state.segment = 0
      this.state.offRouteCount = 0
      this.state.vibrated = {}
      this.updateProgress()
    },

    updateProgress() {
      const { route, cum, me } = this.state
      if (!route || !me) return
      const pos = locateOnRoute(route.points, cum, me, Math.max(0, this.state.segment - 5), LOCATE_WINDOW)
      this.state.segment = pos.segment
      this.state.alongM = pos.alongM
      this.state.offRouteM = pos.offRouteM

      if (pos.offRouteM > OFF_ROUTE_M) {
        this.state.offRouteCount++
        if (this.state.offRouteCount === OFF_ROUTE_FIXES) {
          this.state.vibrator.start({ mode: VIBRATOR_SCENE_STRONG_REMINDER })
        }
        if (this.state.offRouteCount >= OFF_ROUTE_FIXES) this.requestRoute(false)
      } else {
        this.state.offRouteCount = 0
      }

      const next = this.nextManeuver()
      if (next) {
        VIBRATE_AT_M.forEach((threshold) => {
          const key = next.i + ':' + threshold
          if (next.distM <= threshold && !this.state.vibrated[key]) {
            this.state.vibrated[key] = true
            this.state.vibrator.start({ mode: VIBRATOR_SCENE_DURATION })
          }
        })
      }
    },

    // Maneuver kế tiếp phía trước vị trí hiện tại (bỏ qua maneuver "Xuất phát").
    nextManeuver() {
      const { route, maneuverDist, alongM } = this.state
      if (!route) return null
      for (let i = 0; i < route.maneuvers.length; i++) {
        const m = route.maneuvers[i]
        if (m.type === 1 || m.type === 2 || m.type === 3) continue
        const distM = maneuverDist[i] - (alongM || 0)
        if (distM > 5 || (isArrival(m.type) && distM > -20)) return { i, m, distM: Math.max(0, distM) }
      }
      return null
    },

    // ---------- Đo Side Service và Bluetooth ----------

    startPing() {
      this.ping()
      this.state.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS)
    },

    ping() {
      const startedAt = Date.now()
      this.request({ method: METHOD.PING }, { timeout: 10000 })
        .then((res) => {
          this.state.pingOk++
          this.state.pingRttLast = Date.now() - startedAt
          this.state.sideUptimeS = res.uptimeS
        })
        .catch(() => {
          this.state.pingFail++
          this.state.pingLastFailAt = Date.now()
        })
        .finally(() => this.updateTexts())
    },

    runBenchOnce() {
      if (this.state.benchDone) return
      this.state.benchDone = true
      const results = []
      const runOne = (i) => {
        if (i >= BENCH_SIZES.length) {
          this.state.benchStats = 'BT: ' + results.join(', ')
          logger.log(this.state.benchStats)
          this.updateTexts()
          return
        }
        const size = BENCH_SIZES[i]
        const startedAt = Date.now()
        this.request({ method: METHOD.BENCH, params: { size } })
          .then(() => {
            const ms = Date.now() - startedAt
            results.push(Math.round(size / 1000) + 'KB ' + (ms / 1000).toFixed(1) + 's')
          })
          .catch(() => results.push(Math.round(size / 1000) + 'KB lỗi'))
          .finally(() => runOne(i + 1))
      }
      runOne(0)
    },

    // ---------- Giao diện ----------

    cycleZoom() {
      this.state.zoomIndex = (this.state.zoomIndex + 1) % ZOOM_LEVELS.length
      this.redraw()
    },

    redraw() {
      const startedAt = Date.now()
      drawFrame(this.state.canvas, {
        me: this.state.me,
        headingDeg: this.state.headingDeg,
        route: this.state.route,
        passedSegment: this.state.segment,
        metersPerPx: ZOOM_LEVELS[this.state.zoomIndex]
      })
      this.state.drawMsLast = Date.now() - startedAt
      this.updateTexts()
    },

    updateTexts() {
      const s = this.state
      let top = this.gpsWaitText()
      let bottom = ''

      if (s.me) {
        if (s.routeError) {
          top = s.routeError
        } else if (!s.route) {
          top = 'Đang tính tuyến...'
        } else if (s.offRouteCount >= OFF_ROUTE_FIXES) {
          top = 'Lệch tuyến ' + formatDistance(s.offRouteM) + ', đang tính lại'
        } else {
          const next = this.nextManeuver()
          if (next) {
            const street = next.m.street ? '\n' + next.m.street : ''
            top = maneuverText(next.m.type) + ' · ' + formatDistance(next.distM) + street
          }
        }
        if (s.route) {
          const remainM = Math.max(0, s.cum[s.cum.length - 1] - (s.alongM || 0))
          bottom = 'Còn ' + formatDistance(remainM) + ' · ' + ZOOM_LEVELS[s.zoomIndex] + ' m/px'
        }
      }

      const fixes = s.gpsFixes
      const avgS = fixes > 1 ? (s.gpsIntervalSum / (fixes - 1) / 1000).toFixed(1) : '-'
      const debug = [
        'GPS ' + fixes + ' lần, TB ' + avgS + 's, max ' + (s.gpsIntervalMax / 1000).toFixed(1) + 's, vẽ ' + s.drawMsLast + 'ms',
        'ĐT ok ' + s.pingOk + ' lỗi ' + s.pingFail +
          (s.pingLastFailAt ? ' (' + clock(s.pingLastFailAt) + ')' : '') +
          ' rtt ' + s.pingRttLast + 'ms, chạy ' + s.sideUptimeS + 's',
        s.routeStats,
        s.benchStats
      ]
        .filter(Boolean)
        .join('\n')

      s.topText && s.topText.setProperty(hmUI.prop.MORE, { text: top })
      s.bottomText && s.bottomText.setProperty(hmUI.prop.MORE, { text: bottom })
      s.debugText && s.debugText.setProperty(hmUI.prop.MORE, { text: debug })
    }
  })
)
