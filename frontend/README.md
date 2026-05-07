# Navis Cloud - Frontend

Ứng dụng web dashboard hiện đại được xây dựng với React và Vite, cung cấp giao diện quản lý thiết bị IoT, theo dõi dữ liệu telemetry, và quản lý hệ thống IoT thông qua MQTT.

## 📋 Mục Đích

Frontend của Navis Cloud cung cấp:
- **Dashboard**: Bảng điều khiển tổng quan hệ thống
- **Quản lý Thiết bị**: Theo dõi và quản lý các thiết bị IoT kết nối
- **Biểu đồ Dữ liệu**: Trực quan hóa dữ liệu telemetry theo thời gian thực
- **Bản đồ**: Hiển thị vị trí địa lý của các thiết bị
- **Cảnh báo**: Quản lý và giám sát các sự cố/cảnh báo
- **Quản lý Người dùng**: Kiểm soát truy cập và quản lý tài khoản
- **Xác thực**: Hệ thống đăng nhập bảo mật

## ✨ Tính Năng

- ⚡ **Vite**: Công cụ build nhanh với Hot Module Replacement (HMR)
- ⚛️ **React 18**: Thư viện UI hiện đại
- 🎨 **CSS Modern**: Hỗ trợ CSS3 và responsive design
- 📝 **ESLint**: Kiểm tra chất lượng code tự động
- 🔄 **Real-time Updates**: Kết nối backend qua API REST

## 🛠️ Yêu Cầu

- **Node.js**: Phiên bản 18.0.0 trở lên
- **npm**: Phiên bản 9.0.0 trở lên (hoặc yarn/pnpm)

## 📦 Cài Đặt

### 1. Cài đặt Dependencies

```bash
npm install
```

### 2. Cấu hình Environment (nếu cần)

Tạo file `.env.local` trong thư mục frontend (nếu cần):

```env
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=Navis Cloud
```

## 🚀 Chạy Ứng Dụng

### Development Mode (Phát triển)

```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173` với HMR bật.

### Production Build (Xây dựng Production)

```bash
npm run build
```

Kết quả xây dựng sẽ được lưu trong thư mục `dist/`.

### Preview Production Build

```bash
npm run preview
```

Xem trước bản build production cục bộ.

### Linting

```bash
npm run lint
```

Kiểm tra chất lượng code bằng ESLint.

## 📁 Cấu Trúc Dự Án

```
frontend/
├── public/                 # Tài nguyên tĩnh công khai
├── src/
│   ├── assets/            # Hình ảnh, icon, font
│   ├── components/        # Các component React tái sử dụng
│   │   ├── Layout.jsx     # Layout chính
│   │   └── Sidebar.jsx    # Thanh điều hướng
│   ├── pages/             # Các trang chính của ứng dụng
│   │   ├── Alarms.jsx     # Quản lý cảnh báo
│   │   ├── Charts.jsx     # Biểu đồ dữ liệu
│   │   ├── Dashboard.jsx  # Dashboard chính
│   │   ├── Devices.jsx    # Quản lý thiết bị
│   │   ├── Login.jsx      # Đăng nhập
│   │   ├── Map.jsx        # Bản đồ vị trí thiết bị
│   │   └── Users.jsx      # Quản lý người dùng
│   ├── App.jsx            # Component App chính
│   ├── index.css          # CSS toàn cục
│   └── main.jsx           # Entry point
├── .eslintrc.cjs          # Cấu hình ESLint
├── vite.config.js         # Cấu hình Vite
├── package.json           # Dependencies và scripts
└── README.md              # File này
```

## 🔧 Cấu Hình

### Vite Configuration

File `vite.config.js` chứa các cấu hình chính:
- Plugin React với SWC
- Port mặc định: `5173`
- Source map cho development

### ESLint Configuration

File `.eslintrc.cjs` cung cấp:
- Kiểm tra syntax React
- Quy tắc JSX
- Cảnh báo khi sử dụng dependencies

## 🔗 Kết Nối Backend

Frontend kết nối với backend thông qua:
- **Base URL**: `http://localhost:8000`
- **Endpoints**:
  - `POST /api/auth/login` - Đăng nhập
  - `GET /api/devices` - Lấy danh sách thiết bị
  - `GET /api/telemetry` - Lấy dữ liệu telemetry
  - Xem [MQTT_SETUP.md](../MQTT_SETUP.md) để biết chi tiết

## 📚 Công Nghệ Sử Dụng

- **React 18** - UI Library
- **Vite** - Build tool & dev server
- **ES6+** - Modern JavaScript
- **CSS3** - Styling
- **ESLint** - Code quality

## 🚧 Phát Triển

### Thêm Component Mới

1. Tạo file trong `src/components/`
2. Export component như một default export
3. Import và sử dụng trong Layout hoặc Pages

### Thêm Trang Mới

1. Tạo file JSX trong `src/pages/`
2. Định nghĩa route trong `App.jsx`
3. Thêm menu item trong `Sidebar.jsx`

### Code Style

- Sử dụng functional components với hooks
- Tuân thủ ESLint rules
- Viết comments cho logic phức tạp
- Sử dụng camelCase cho variables/functions
- Sử dụng PascalCase cho component names

## 🐛 Troubleshooting

### Port 5173 đã được sử dụng

```bash
npm run dev -- --port 3000
```

### Hot Module Replacement không hoạt động

- Xóa cache: `rm -rf node_modules/.vite`
- Restart dev server

### ESLint errors

```bash
npm run lint -- --fix
```

## 📞 Liên Hệ & Hỗ Trợ

Để báo cáo lỗi hoặc yêu cầu tính năng, vui lòng tạo issue trong repository.

## 📄 Giấy Phép

Dự án này là một phần của Navis Cloud Project.
