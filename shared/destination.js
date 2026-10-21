// Đọc điểm đến từ chuỗi người dùng dán vào trang cài đặt.
// Hỗ trợ: "21.0285, 105.8542", và link Google Maps dạng dài có toạ độ trong URL
// ("@lat,lon", "!3dlat!4dlon", "q=lat,lon", "query=lat,lon", "destination=lat,lon").
// Link rút gọn (maps.app.goo.gl) không chứa toạ độ nên chưa hỗ trợ.

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)'

const PATTERNS = [
  new RegExp('!3d' + NUM + '!4d' + NUM),
  new RegExp('[?&](?:q|query|destination|daddr|ll)=' + NUM + '(?:,|%2C)\\s*' + NUM, 'i'),
  new RegExp('@' + NUM + ',' + NUM),
  new RegExp('^\\s*' + NUM + '\\s*[,;\\s]\\s*' + NUM + '\\s*$')
]

export function parseDestination(text) {
  if (typeof text !== 'string') return null
  for (const re of PATTERNS) {
    const m = text.match(re)
    if (!m) continue
    const lat = parseFloat(m[1])
    const lon = parseFloat(m[2])
    if (isValidLatLon(lat, lon)) return { lat, lon }
  }
  return null
}

export function isValidLatLon(lat, lon) {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  )
}
