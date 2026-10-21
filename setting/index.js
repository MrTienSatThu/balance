// Trang cài đặt trong app Zepp trên điện thoại: nhập điểm đến và chọn phương tiện.

import { SETTINGS_KEY, MODES, DEFAULT_MODE } from '../shared/protocol.js'
import { parseDestination } from '../shared/destination.js'

AppSettingsPage({
  build(props) {
    const storage = props.settingsStorage
    const destinationText = storage.getItem(SETTINGS_KEY.DESTINATION) || ''
    const parsed = parseDestination(destinationText)
    const currentMode = storage.getItem(SETTINGS_KEY.MODE) || DEFAULT_MODE

    const status = destinationText
      ? parsed
        ? 'Điểm đến: ' + parsed.lat.toFixed(5) + ', ' + parsed.lon.toFixed(5)
        : 'Không đọc được toạ độ. Hãy dán dạng "21.0285, 105.8542" hoặc link Google Maps dạng dài.'
      : 'Chưa có điểm đến.'

    const modeButtons = Object.keys(MODES).map((key) =>
      Button({
        label: MODES[key].label,
        style: {
          fontSize: '14px',
          borderRadius: '20px',
          margin: '0 6px 6px 0',
          background: key === currentMode ? '#1E88E5' : '#E0E0E0',
          color: key === currentMode ? 'white' : '#333'
        },
        onClick: () => {
          storage.setItem(SETTINGS_KEY.MODE, key)
        }
      })
    )

    return View({ style: { padding: '12px 20px' } }, [
      Text({ bold: true, paragraph: true }, 'Điểm đến'),
      TextInput({
        label: 'Toạ độ hoặc link Google Maps',
        placeholder: '21.0285, 105.8542',
        value: destinationText,
        multiline: true,
        rows: 3,
        onChange: (val) => {
          storage.setItem(SETTINGS_KEY.DESTINATION, (val || '').trim())
        }
      }),
      Text({ paragraph: true, style: { color: parsed ? '#2E7D32' : '#C62828' } }, status),
      Text({ bold: true, paragraph: true, style: { marginTop: '16px' } }, 'Phương tiện'),
      View({ style: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' } }, modeButtons),
      Text(
        { paragraph: true, style: { marginTop: '16px', fontSize: '12px', color: '#666' } },
        'Dữ liệu bản đồ © OpenStreetMap contributors. Tính tuyến: Valhalla (FOSSGIS).'
      )
    ])
  }
})
