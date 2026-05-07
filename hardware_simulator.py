import requests
import json
import time
import random
from datetime import datetime
from typing import List, Dict

class HardwareSimulator:
    """
    Mô phỏng thiết bị phần cứng GNSS gửi dữ liệu lên API /api/telemetry
    """
    
    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        device_id: str = "ducanh_user",
        interval: int = 5,
        max_iterations: int = None
    ):
        """
        Khởi tạo Hardware Simulator
        
        Args:
            api_url: URL của API server (default: http://localhost:8000)
            device_id: Mã định danh thiết bị (default: b1_hust_ubx)
            interval: Khoảng thời gian gửi dữ liệu (giây)
            max_iterations: Số lần gửi tối đa (None = vô hạn)
        """
        self.api_url = api_url
        self.device_id = device_id
        self.interval = interval
        self.max_iterations = max_iterations
        self.telemetry_endpoint = f"{self.api_url}/api/telemetry"
        self.iteration_count = 0
        
    def generate_signal_data(self) -> List[Dict]:
        """
        Sinh dữ liệu tín hiệu cho các vệ tinh
        Mô phỏng từ 8-15 vệ tinh với tín hiệu ngẫu nhiên
        """
        num_satellites = random.randint(8, 15)
        signals = []
        
        # Các hệ thống vệ tinh GNSS (GPS, GLONASS, Galileo, BeiDou)
        systems = ['G', 'R', 'E', 'C']
        
        for i in range(num_satellites):
            system = random.choice(systems)
            prn_number = random.randint(1, 32)
            
            signal = {
                "prn": f"{system}{prn_number:02d}",  # Ví dụ: G01, R05, E12, C24
                "cno": round(random.uniform(25, 55), 1),  # C/N0: 25-55 dB-Hz
                "ele": round(random.uniform(0, 90), 1),   # Elevation: 0-90°
                "azi": round(random.uniform(0, 360), 1)   # Azimuth: 0-360°
            }
            signals.append(signal)
        
        return signals
    
    def generate_telemetry_data(self) -> Dict:
        """
        Sinh dữ liệu telemetry hoàn chỉnh
        """
        signals = self.generate_signal_data()
        
        telemetry = {
            "device_id_str": self.device_id,
            "avg_cno": round(random.uniform(30, 50), 1),  # Trung bình C/N0
            "sat_count": len(signals),                      # Số lượng vệ tinh
            "pdop": round(random.uniform(1.0, 3.0), 2),   # PDOP: 1-3 (tốt)
            "signals_data": signals
        }
        
        return telemetry
    
    def send_telemetry(self, data: Dict) -> bool:
        """
        Gửi dữ liệu telemetry lên server
        
        Args:
            data: Dict chứa dữ liệu telemetry
            
        Returns:
            True nếu gửi thành công, False nếu thất bại
        """
        try:
            response = requests.post(
                self.telemetry_endpoint,
                json=data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                print(f"[{timestamp}] ✓ Gửi thành công | Device: {self.device_id} | "
                      f"Vệ tinh: {data['sat_count']} | PDOP: {data['pdop']}")
                return True
            else:
                print(f"[ERROR] Status code: {response.status_code} | "
                      f"Response: {response.text}")
                return False
                
        except requests.exceptions.ConnectionError:
            print(f"[ERROR] Không thể kết nối tới API ({self.api_url})")
            print("       Hãy đảm bảo server đang chạy...")
            return False
        except requests.exceptions.Timeout:
            print(f"[ERROR] Timeout kết nối tới API ({self.api_url})")
            return False
        except Exception as e:
            print(f"[ERROR] Lỗi khi gửi dữ liệu: {str(e)}")
            return False
    
    def start(self):
        """
        Bắt đầu mô phỏng gửi dữ liệu liên tục
        """
        print(f"\n{'='*70}")
        print(f"GNSS Hardware Simulator - Bắt đầu")
        print(f"{'='*70}")
        print(f"API URL: {self.api_url}")
        print(f"Device ID: {self.device_id}")
        print(f"Khoảng thời gian: {self.interval} giây")
        if self.max_iterations:
            print(f"Số lần gửi tối đa: {self.max_iterations}")
        else:
            print(f"Số lần gửi: Vô hạn (nhấn Ctrl+C để dừng)")
        print(f"{'='*70}\n")
        
        try:
            while True:
                # Kiểm tra giới hạn số lần lặp
                if self.max_iterations and self.iteration_count >= self.max_iterations:
                    print(f"\n[INFO] Đã hoàn thành {self.max_iterations} lần gửi. Dừng...")
                    break
                
                # Sinh và gửi dữ liệu
                telemetry_data = self.generate_telemetry_data()
                self.send_telemetry(telemetry_data)
                
                self.iteration_count += 1
                
                # Chờ trước khi gửi tiếp theo
                time.sleep(self.interval)
                
        except KeyboardInterrupt:
            print(f"\n\n[INFO] Simulator đã dừng (Ctrl+C)")
            print(f"Tổng số lần gửi: {self.iteration_count}")
            print(f"{'='*70}\n")


def main():
    """
    Hàm chính để chạy simulator
    """
    # Cấu hình simulator
    simulator = HardwareSimulator(
        api_url="http://localhost:8000",      # URL của FastAPI server
        device_id="ducanh_user",               # Mã thiết bị
        interval=5,                             # Gửi dữ liệu mỗi 5 giây
        max_iterations=None                     # Gửi vô hạn (hoặc đặt số cụ thể)
    )
    
    # Bắt đầu gửi dữ liệu
    simulator.start()


if __name__ == "__main__":
    main()
