import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'

import { METHOD, SETTINGS_KEY, MODES, DEFAULT_MODE } from '../shared/protocol.js'
import { parseDestination, readPlace } from '../shared/destination.js'
import { VALHALLA_URL, buildRouteRequest, parseRouteResponse } from './valhalla.js'
import { buildSearchUrl, parseSearchResponse } from './nominatim.js'

const USER_AGENT = 'BalanceNav/0.1 (personal, non-commercial Zepp OS mini program)'

// Nominatim cho phép tối đa 1 yêu cầu/giây.
const SEARCH_MIN_INTERVAL_MS = 1100

// Mỗi ô tìm kiếm trong trang cài đặt: chuỗi tìm, nơi ghi kết quả.
const SEARCH_FIELDS = {
  [SETTINGS_KEY.ORIGIN_QUERY]: SETTINGS_KEY.ORIGIN_RESULTS,
  [SETTINGS_KEY.DESTINATION_QUERY]: SETTINGS_KEY.DESTINATION_RESULTS
}

function readSettings() {
  const origin = readPlace(settingsLib.getItem(SETTINGS_KEY.ORIGIN))
  const destination = readPlace(settingsLib.getItem(SETTINGS_KEY.DESTINATION))
  const modeKey = settingsLib.getItem(SETTINGS_KEY.MODE) || DEFAULT_MODE
  const mode = MODES[modeKey] ? modeKey : DEFAULT_MODE
  return { origin, destination, mode }
}

// Phản hồi fetch của Side Service có thể trả body dạng chuỗi hoặc đã là object.
function parseBody(body) {
  return typeof body === 'string' ? JSON.parse(body) : body
}

function writeResults(key, value) {
  settingsLib.setItem(key, JSON.stringify(value))
}

AppSideService(
  BaseSideService({
    state: {
      startedAt: 0,
      requestCount: 0,
      lastSearchAt: 0,
      searchCache: {}
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
      const here = params && params.from
      if (here) settingsLib.setItem(SETTINGS_KEY.LAST_POSITION, JSON.stringify(here))

      const { origin, destination, mode } = readSettings()
      if (!destination) {
        return Promise.reject(new Error('Chưa chọn điểm đến trong app Zepp'))
      }
      // Điểm đi để trống, hoặc đang tính lại vì lệch tuyến, thì dùng vị trí GPS hiện tại.
      const from = origin && !(params && params.reroute) ? origin : here
      if (!from) return Promise.reject(new Error('Chưa có vị trí hiện tại'))

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
        return {
          ...route,
          origin: origin ? origin.name : '',
          destination: destination.name,
          mode,
          fetchMs
        }
      })
    },

    // Tìm địa điểm theo tên rồi ghi kết quả vào Settings Storage để trang cài đặt hiển thị.
    searchPlace(queryKey) {
      const resultsKey = SEARCH_FIELDS[queryKey]
      const query = (settingsLib.getItem(queryKey) || '').trim()
      if (!query) {
        settingsLib.removeItem(resultsKey)
        return
      }

      // Toạ độ hoặc link Google Maps dạng dài thì dùng luôn, không cần tìm.
      const coords = parseDestination(query)
      if (coords) {
        writeResults(resultsKey, {
          query,
          status: 'ok',
          items: [{ name: coords.lat.toFixed(5) + ', ' + coords.lon.toFixed(5), ...coords }]
        })
        return
      }

      const cached = this.state.searchCache[query]
      if (cached) {
        writeResults(resultsKey, cached)
        return
      }

      writeResults(resultsKey, { query, status: 'loading', items: [] })
      let near = null
      try {
        near = JSON.parse(settingsLib.getItem(SETTINGS_KEY.LAST_POSITION) || 'null')
      } catch (e) {
        near = null
      }

      const wait = Math.max(0, this.state.lastSearchAt + SEARCH_MIN_INTERVAL_MS - Date.now())
      setTimeout(() => {
        this.state.lastSearchAt = Date.now()
        this.fetch({
          url: buildSearchUrl(query, near),
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT },
          timeout: 15000
        })
          .then((response) => {
            if (response.status !== 200) throw new Error('HTTP ' + response.status)
            const items = parseSearchResponse(parseBody(response.body))
            const result = { query, status: items.length ? 'ok' : 'empty', items }
            this.state.searchCache[query] = result
            // Chỉ ghi nếu người dùng chưa gõ chuỗi tìm khác trong lúc chờ.
            if ((settingsLib.getItem(queryKey) || '').trim() === query) writeResults(resultsKey, result)
          })
          .catch((e) => {
            this.error('search error', e && e.message)
            writeResults(resultsKey, {
              query,
              status: 'error',
              items: [],
              error: (e && e.message) || 'Lỗi tìm kiếm'
            })
          })
      }, wait)
    },

    onSettingsChange({ key }) {
      if (SEARCH_FIELDS[key]) {
        this.searchPlace(key)
      } else if (
        key === SETTINGS_KEY.ORIGIN ||
        key === SETTINGS_KEY.DESTINATION ||
        key === SETTINGS_KEY.MODE
      ) {
        // Đồng hồ có thể chưa mở app; khi đó bỏ qua, app sẽ tự lấy tuyến lúc mở.
        try {
          const sent = this.call({ method: METHOD.DESTINATION_CHANGED })
          sent && sent.catch && sent.catch(() => {})
        } catch (e) {
          this.log('notify device skipped')
        }
      }
    },

    onDestroy() {
      this.log('side service onDestroy')
    }
  })
)
