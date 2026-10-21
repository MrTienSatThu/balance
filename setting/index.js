// Trang cài đặt trong app Zepp trên điện thoại: tìm điểm đi, điểm đến theo tên, chọn phương tiện.
// Trang này không tự gọi mạng: nó ghi chuỗi tìm vào Settings Storage, Side Service tìm rồi ghi
// kết quả lại, và trang được dựng lại mỗi khi Settings Storage thay đổi.

import { SETTINGS_KEY, MODES, DEFAULT_MODE } from '../shared/protocol.js'
import { readPlace } from '../shared/destination.js'

const COLOR = {
  primary: '#1E88E5',
  muted: '#666',
  ok: '#2E7D32',
  error: '#C62828',
  chip: '#E0E0E0'
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || 'null')
  } catch (e) {
    return null
  }
}

function placeSection(storage, { title, placeKey, queryKey, resultsKey, allowCurrentLocation }) {
  const place = readPlace(storage.getItem(placeKey))
  const results = readJson(storage, resultsKey)

  const chosenText = place
    ? 'Đã chọn: ' + (place.name || place.lat.toFixed(5) + ', ' + place.lon.toFixed(5))
    : allowCurrentLocation
      ? 'Đang dùng: vị trí hiện tại của đồng hồ (GPS)'
      : 'Chưa chọn'

  const children = [
    Text({ bold: true, paragraph: true, style: { marginTop: '16px' } }, title),
    Text({ paragraph: true, style: { color: place ? COLOR.ok : COLOR.muted } }, chosenText),
    TextInput({
      label: 'Tìm theo tên địa điểm',
      placeholder: 'VD: Hồ Gươm, Hà Nội',
      value: storage.getItem(queryKey) || '',
      onChange: (val) => {
        storage.setItem(queryKey, (val || '').trim())
      }
    })
  ]

  if (results) {
    if (results.status === 'loading') {
      children.push(Text({ paragraph: true, style: { color: COLOR.muted } }, 'Đang tìm...'))
    } else if (results.status === 'empty') {
      children.push(
        Text(
          { paragraph: true, style: { color: COLOR.error } },
          'Không tìm thấy "' + results.query + '". Thử thêm tên quận, thành phố.'
        )
      )
    } else if (results.status === 'error') {
      children.push(
        Text({ paragraph: true, style: { color: COLOR.error } }, 'Lỗi tìm kiếm: ' + results.error)
      )
    } else if (results.items && results.items.length) {
      children.push(Text({ paragraph: true, style: { color: COLOR.muted } }, 'Chạm để chọn:'))
      results.items.forEach((item) => {
        children.push(
          Button({
            label: item.name,
            style: {
              fontSize: '13px',
              borderRadius: '8px',
              margin: '0 0 6px 0',
              background: COLOR.chip,
              color: '#222',
              textAlign: 'left'
            },
            onClick: () => {
              storage.setItem(placeKey, JSON.stringify(item))
              storage.removeItem(resultsKey)
              storage.removeItem(queryKey)
            }
          })
        )
      })
    }
  }

  if (allowCurrentLocation && place) {
    children.push(
      Button({
        label: 'Dùng vị trí hiện tại (GPS)',
        style: {
          fontSize: '13px',
          borderRadius: '20px',
          marginTop: '4px',
          background: COLOR.primary,
          color: 'white'
        },
        onClick: () => {
          storage.removeItem(placeKey)
        }
      })
    )
  }

  return View({}, children)
}

AppSettingsPage({
  build(props) {
    const storage = props.settingsStorage
    const currentMode = storage.getItem(SETTINGS_KEY.MODE) || DEFAULT_MODE

    const modeButtons = Object.keys(MODES).map((key) =>
      Button({
        label: MODES[key].label,
        style: {
          fontSize: '14px',
          borderRadius: '20px',
          margin: '0 6px 6px 0',
          background: key === currentMode ? COLOR.primary : COLOR.chip,
          color: key === currentMode ? 'white' : '#333'
        },
        onClick: () => {
          storage.setItem(SETTINGS_KEY.MODE, key)
        }
      })
    )

    return View({ style: { padding: '12px 20px' } }, [
      placeSection(storage, {
        title: 'Điểm đi',
        placeKey: SETTINGS_KEY.ORIGIN,
        queryKey: SETTINGS_KEY.ORIGIN_QUERY,
        resultsKey: SETTINGS_KEY.ORIGIN_RESULTS,
        allowCurrentLocation: true
      }),
      placeSection(storage, {
        title: 'Điểm đến',
        placeKey: SETTINGS_KEY.DESTINATION,
        queryKey: SETTINGS_KEY.DESTINATION_QUERY,
        resultsKey: SETTINGS_KEY.DESTINATION_RESULTS,
        allowCurrentLocation: false
      }),
      Text({ bold: true, paragraph: true, style: { marginTop: '16px' } }, 'Phương tiện'),
      View({ style: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' } }, modeButtons),
      Text(
        { paragraph: true, style: { marginTop: '16px', fontSize: '12px', color: COLOR.muted } },
        'Có thể gõ tên địa điểm, toạ độ, hoặc dán link Google Maps dạng dài. ' +
          'Tìm địa điểm: Nominatim. Tính tuyến: Valhalla (FOSSGIS). ' +
          'Dữ liệu bản đồ © OpenStreetMap contributors.'
      )
    ])
  }
})
