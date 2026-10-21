import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'

import { METHOD, SETTINGS_KEY, MODES, DEFAULT_MODE } from '../shared/protocol.js'
import { parseDestination } from '../shared/destination.js'
import { VALHALLA_URL, buildRouteRequest, parseRouteResponse } from './valhalla.js'

const USER_AGENT = 'BalanceNav/0.1 (personal, non-commercial Zepp OS mini program)'

function readSettings() {
  const destination = parseDestination(settingsLib.getItem(SETTINGS_KEY.DESTINATION) || '')
  const modeKey = settingsLib.getItem(SETTINGS_KEY.MODE) || DEFAULT_MODE
  const mode = MODES[modeKey] ? modeKey : DEFAULT_MODE
  return { destination, mode }
}

// Phản hồi fetch của Side Service có thể trả body dạng chuỗi hoặc đã là object.
function parseBody(body) {
  return typeof body === 'string' ? JSON.parse(body) : body
}

AppSideService(
  BaseSideService({
    state: {
      startedAt: 0,
      requestCount: 0
    },

    onInit() {
      this.state.startedAt = Date.now()
      this.log('side service onInit')
    },

    onRun() {},

    onRequest(req, res) {
      this.state.requestCount++
      switch (req.method) {
        case METHOD.PING:
          // Dùng để kiểm tra Side Service còn chạy khi điện thoại khoá màn hình.
          res(null, {
            now: Date.now(),
            uptimeS: Math.round((Date.now() - this.state.startedAt) / 1000),
            requestCount: this.state.requestCount
          })
          break

        case METHOD.BENCH: {
          // Trả về chuỗi có kích thước yêu cầu để đo tốc độ truyền qua Bluetooth.
          const size = Math.max(0, Math.min(200000, (req.params && req.params.size) | 0))
          res(null, { size, data: 'x'.repeat(size) })
          break
        }

        case METHOD.ROUTE:
          this.getRoute(req.params)
            .then((result) => res(null, result))
            .catch((e) => {
              this.error('route error', e && e.message)
              res({ message: (e && e.message) || 'Lỗi tính tuyến' })
            })
          break

        default:
          res({ message: 'Phương thức không hỗ trợ: ' + req.method })
      }
    },

    getRoute(params) {
      const from = params && params.from
      if (!from) return Promise.reject(new Error('Chưa có vị trí hiện tại'))

      const { destination, mode } = readSettings()
      if (!destination) {
        return Promise.reject(new Error('Chưa nhập điểm đến trong app Zepp'))
      }

      const startedAt = Date.now()
      return this.fetch({
        url: VALHALLA_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify(buildRouteRequest(from, destination, MODES[mode].costing)),
        timeout: 20000
      }).then((response) => {
        const fetchMs = Date.now() - startedAt
        const json = parseBody(response.body)
        if (response.status !== 200) {
          const reason = (json && (json.error || json.status)) || 'HTTP ' + response.status
          throw new Error('Valhalla: ' + reason)
        }
        const route = parseRouteResponse(json)
        this.log(
          'route ok points=' + route.points.length +
            ' raw=' + route.rawPoints +
            ' maneuvers=' + route.maneuvers.length +
            ' fetchMs=' + fetchMs
        )
        return { ...route, destination, mode, fetchMs }
      })
    },

    onSettingsChange({ key }) {
      if (key === SETTINGS_KEY.DESTINATION || key === SETTINGS_KEY.MODE) {
        this.call({ method: METHOD.DESTINATION_CHANGED })
      }
    },

    onDestroy() {
      this.log('side service onDestroy')
    }
  })
)
