import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ValidationError, Field


class SignalData(BaseModel):
    """Mô tả tín hiệu từ một vệ tinh"""
    prn: str
    cno: float
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
        """
        Parse JSON payload từ MQTT message
        
        Args:
            payload: JSON string từ MQTT
            
        Returns:
            MQTTGNSSMessage object hoặc None nếu parse thất bại
        """
        try:
            data = json.loads(payload)
            message = MQTTGNSSMessage(**data)
            return message
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"[Parser Error] Lỗi parse MQTT message: {e}")
            return None
    
    @staticmethod
    def extract_telemetry_data(message: MQTTGNSSMessage) -> Optional[Dict[str, Any]]:
        """
        Trích xuất dữ liệu telemetry từ detect/epoch message
        
        Args:
            message: Parsed MQTT message
            
        Returns:
            Dict chứa telemetry data hoặc None
        """
        if "detect.epoch" not in message.schema:
            return None
        
        try:
            data = message.data
            
            # Trích xuất tín hiệu chi tiết nếu có
            signals_data = []
            if "signals" in data:
                for sig in data["signals"]:
                    signals_data.append(SignalData(
                        prn=sig.get("prn", ""),
                        cno=sig.get("cno", 0),
                        ele=sig.get("ele"),
                        azi=sig.get("azi")
                    ).dict())
            
            return {
                "device_id": message.device_id,
                "site_id": message.site_id,
                "avg_cno": data.get("avg_cno", 0),
                "sat_count": data.get("sat_count", 0),
                "pdop": data.get("pdop"),
                "signals_data": signals_data,
                "event_time": message.event_time,
                "seq": message.seq,
                "event_id": message.event_id,
            }
        except Exception as e:
            print(f"[Extract Error] Lỗi trích xuất telemetry: {e}")
            return None
    
    @staticmethod
    def extract_health_data(message: MQTTGNSSMessage) -> Optional[Dict[str, Any]]:
        """
        Trích xuất dữ liệu health từ health message
        
        Args:
            message: Parsed MQTT message
            
        Returns:
            Dict chứa health data hoặc None
        """
        if "health" not in message.schema:
            return None
        
        try:
            data = message.data
            return {
                "device_id": message.device_id,
                "site_id": message.site_id,
                "backlog": data.get("backlog"),
                "dropped_count": data.get("dropped_count"),
                "process_status": data.get("process_status"),
                "event_time": message.event_time,
            }
        except Exception as e:
            print(f"[Health Extract Error] Lỗi trích xuất health data: {e}")
            return None
