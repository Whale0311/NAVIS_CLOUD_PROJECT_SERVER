import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ValidationError, Field

class SignalData(BaseModel):
    """Mô tả tín hiệu từ một vệ tinh"""
    prn: str
    cno: float
    svid: Optional[int] = None 
    gnss: Optional[str] = None
    used_in_fix: Optional[bool] = None
    ele: Optional[float] = None
    azi: Optional[float] = None

class MQTTGNSSMessage(BaseModel):
    """Mô hình dữ liệu GNSS từ MQTT envelope"""
    schema: str
    schema_type: str = Field(alias="schema")
    event_id: str
    seq: int
    device_id: str
    site_id: str
    frontend: str
    source: str
    event_time: datetime
    ingest_time: datetime
    data: Dict[str, Any]

class GNSSParser:
    """Parser để xử lý MQTT messages từ GNSS Hub"""
    
    @staticmethod
    def parse_mqtt_message(payload: str) -> Optional[MQTTGNSSMessage]:
        try:
            data = json.loads(payload)
            message = MQTTGNSSMessage(**data)
            return message
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"[Parser Error] Lỗi parse MQTT message: {e}")
            return None
    
    @staticmethod
    def extract_telemetry_data(message: MQTTGNSSMessage) -> Optional[Dict[str, Any]]:
        """Trích xuất dữ liệu telemetry: Hỗ trợ cả Schema phẳng và Schema lồng nhau (v1)"""
        if "detect.epoch" not in message.schema:
            return None
        
        try:
            data = message.data
            
            # 1. TRÍCH XUẤT TÍN HIỆU VỆ TINH (Xử lý tên biến cno_dbhz hoặc cno)
            signals_data = []
            raw_signals = data.get("signals") or data.get("signals_data") or []
            for sig in raw_signals:
                cno_val = sig.get("cno_dbhz") or sig.get("cno", 0)
                signals_data.append({
                    "prn": sig.get("prn", ""),
                    "svid": sig.get("svid"),
                    "cno": cno_val,
                    "gnss": sig.get("gnss", "UNKNOWN"),
                    "used_in_fix": sig.get("used_in_fix", False),
                    "ele": sig.get("ele"),
                    "azi": sig.get("azi")
                })
            
            # 2. TRÍCH XUẤT THÔNG SỐ CHÍNH (Dò tìm thông minh ở các nhánh con)
            return {
                "device_id": message.device_id,
                "site_id": message.site_id,
                "event_time": message.event_time,
                "seq": message.seq,
                "event_id": message.event_id,
                
                # Vị trí (Ưu tiên nhánh position -> nhánh data -> giá trị cũ)
                "latitude": data.get("position", {}).get("lat_deg") or data.get("lat_deg") or data.get("lat"),
                "longitude": data.get("position", {}).get("lon_deg") or data.get("lon_deg") or data.get("lon"),
                "height_m": data.get("position", {}).get("height_m") or data.get("height_m"),
                "pdop": data.get("position", {}).get("pdop") or data.get("pdop"),
                
                # Tín hiệu (Ưu tiên nhánh summary)
                "avg_cno_dbhz": data.get("summary", {}).get("avg_cno_dbhz") or data.get("avg_cno_dbhz") or data.get("avg_cno", 0),
                "sat_count": data.get("summary", {}).get("sat_count") or data.get("sat_count", 0),
                "spoofing": data.get("summary", {}).get("spoofing") or data.get("is_spoofed") or data.get("spoofing"),
                "status": data.get("summary", {}).get("status") or data.get("status", "normal"),
                
                # Dữ liệu phân tích
                "signals_data": signals_data,
                "detectors": data.get("detectors") or data.get("detectors_data", {})
            }
        except Exception as e:
            print(f"[Extract Error] Lỗi trích xuất telemetry: {e}")
            return None
    
    @staticmethod
    def extract_health_data(message: MQTTGNSSMessage) -> Optional[Dict[str, Any]]:
        """Trích xuất dữ liệu health chuẩn MQTT Schema"""
        if "health" not in message.schema:
            return None
        
        try:
            data = message.data
            return {
                "status": data.get("status"),
                "ingress_backlog": data.get("ingress_backlog", 0),
                "detect_backlog": data.get("detect_backlog", 0),
                "raw_backlog": data.get("raw_backlog", 0),
                "ingress_dropped": data.get("ingress_dropped", 0),
                "detect_dropped": data.get("detect_dropped", 0),
                "raw_dropped": data.get("raw_dropped", 0),
                
                # Bắt luôn cả báo động sự cố / Spoofing nếu có
                "event_type": data.get("event_type"),
                "severity": data.get("severity"),
                "message": data.get("message"),
                
                "device_id": message.device_id,
                "site_id": message.site_id,
                "event_time": message.event_time,
            }
        except Exception as e:
            print(f"[Health Extract Error] Lỗi trích xuất health data: {e}")
            return None