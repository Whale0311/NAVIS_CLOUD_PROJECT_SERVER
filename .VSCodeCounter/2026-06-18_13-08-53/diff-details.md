# Diff Details

Date : 2026-06-18 13:08:53

Directory d:\\Navis-Cloud-Project\\backend

Total : 44 files,  -1367 codes, 39 comments, 77 blanks, all -1251 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/MQTT\_data\_schema.md](/backend/MQTT_data_schema.md) | Markdown | 1,008 | 0 | 220 | 1,228 |
| [backend/README.md](/backend/README.md) | Markdown | 475 | 0 | 113 | 588 |
| [backend/app/api/\_\_init\_\_.py](/backend/app/api/__init__.py) | Python | 0 | 0 | 1 | 1 |
| [backend/app/api/auth.py](/backend/app/api/auth.py) | Python | 199 | 23 | 40 | 262 |
| [backend/app/api/devices.py](/backend/app/api/devices.py) | Python | 468 | 118 | 90 | 676 |
| [backend/app/api/telemetry.py](/backend/app/api/telemetry.py) | Python | 107 | 20 | 28 | 155 |
| [backend/app/core/database.py](/backend/app/core/database.py) | Python | 18 | 5 | 5 | 28 |
| [backend/app/core/mqtt\_config.py](/backend/app/core/mqtt_config.py) | Python | 20 | 2 | 6 | 28 |
| [backend/app/core/security.py](/backend/app/core/security.py) | Python | 23 | 8 | 7 | 38 |
| [backend/app/core/ws\_manager.py](/backend/app/core/ws_manager.py) | Python | 24 | 4 | 5 | 33 |
| [backend/app/main.py](/backend/app/main.py) | Python | 94 | 17 | 20 | 131 |
| [backend/app/models/schema.py](/backend/app/models/schema.py) | Python | 83 | 32 | 36 | 151 |
| [backend/app/schemas.py](/backend/app/schemas.py) | Python | 104 | 17 | 28 | 149 |
| [backend/requirements.txt](/backend/requirements.txt) | pip requirements | 12 | 0 | 0 | 12 |
| [backend/worker/db\_writer.py](/backend/worker/db_writer.py) | Python | 41 | 8 | 12 | 61 |
| [backend/worker/parsers/\_\_init\_\_.py](/backend/worker/parsers/__init__.py) | Python | 2 | 0 | 2 | 4 |
| [backend/worker/parsers/gnss\_parser.py](/backend/worker/parsers/gnss_parser.py) | Python | 97 | 11 | 15 | 123 |
| [backend/worker/worker\_main.py](/backend/worker/worker_main.py) | Python | 397 | 38 | 80 | 515 |
| [frontend/README.md](/frontend/README.md) | Markdown | -802 | 0 | -152 | -954 |
| [frontend/eslint.config.js](/frontend/eslint.config.js) | JavaScript | -28 | 0 | -2 | -30 |
| [frontend/index.html](/frontend/index.html) | HTML | -13 | 0 | -1 | -14 |
| [frontend/package.json](/frontend/package.json) | JSON | -37 | 0 | -1 | -38 |
| [frontend/public/Logo\_Đại\_học\_Bách\_Khoa\_Hà\_Nội.svg](/frontend/public/Logo_%C4%90%E1%BA%A1i_h%E1%BB%8Dc_B%C3%A1ch_Khoa_H%C3%A0_N%E1%BB%99i.svg) | XML | -63 | 0 | -1 | -64 |
| [frontend/public/favicon.svg](/frontend/public/favicon.svg) | XML | -1 | 0 | 0 | -1 |
| [frontend/public/icons.svg](/frontend/public/icons.svg) | XML | -24 | 0 | -1 | -25 |
| [frontend/src/App.jsx](/frontend/src/App.jsx) | JavaScript JSX | -67 | -23 | -19 | -109 |
| [frontend/src/assets/react.svg](/frontend/src/assets/react.svg) | XML | -1 | 0 | 0 | -1 |
| [frontend/src/assets/vite.svg](/frontend/src/assets/vite.svg) | XML | -1 | 0 | -1 | -2 |
| [frontend/src/components/Layout.jsx](/frontend/src/components/Layout.jsx) | JavaScript JSX | -30 | -3 | -4 | -37 |
| [frontend/src/components/Sidebar.jsx](/frontend/src/components/Sidebar.jsx) | JavaScript JSX | -78 | -7 | -15 | -100 |
| [frontend/src/context/AuthContext.jsx](/frontend/src/context/AuthContext.jsx) | JavaScript JSX | -52 | -3 | -9 | -64 |
| [frontend/src/context/SocketContext.jsx](/frontend/src/context/SocketContext.jsx) | JavaScript JSX | -70 | -8 | -22 | -100 |
| [frontend/src/index.css](/frontend/src/index.css) | PostCSS | -571 | -56 | -73 | -700 |
| [frontend/src/main.jsx](/frontend/src/main.jsx) | JavaScript JSX | -9 | 0 | -2 | -11 |
| [frontend/src/pages/Alarms.jsx](/frontend/src/pages/Alarms.jsx) | JavaScript JSX | -227 | -8 | -25 | -260 |
| [frontend/src/pages/Charts.jsx](/frontend/src/pages/Charts.jsx) | JavaScript JSX | -332 | -34 | -49 | -415 |
| [frontend/src/pages/Dashboard.jsx](/frontend/src/pages/Dashboard.jsx) | JavaScript JSX | -239 | -18 | -43 | -300 |
| [frontend/src/pages/DeviceDetail.jsx](/frontend/src/pages/DeviceDetail.jsx) | JavaScript JSX | -429 | -24 | -43 | -496 |
| [frontend/src/pages/Devices.jsx](/frontend/src/pages/Devices.jsx) | JavaScript JSX | -348 | -7 | -30 | -385 |
| [frontend/src/pages/Login.jsx](/frontend/src/pages/Login.jsx) | JavaScript JSX | -240 | -8 | -25 | -273 |
| [frontend/src/pages/Map.jsx](/frontend/src/pages/Map.jsx) | JavaScript JSX | -335 | -33 | -51 | -419 |
| [frontend/src/pages/SuperAdminDashboard.jsx](/frontend/src/pages/SuperAdminDashboard.jsx) | JavaScript JSX | -124 | -9 | -16 | -149 |
| [frontend/src/pages/Users.jsx](/frontend/src/pages/Users.jsx) | JavaScript JSX | -401 | -17 | -45 | -463 |
| [frontend/vite.config.js](/frontend/vite.config.js) | JavaScript | -17 | -6 | -1 | -24 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details