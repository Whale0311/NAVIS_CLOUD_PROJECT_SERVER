import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Hàm giải mã và set user
    const processToken = (jwtToken) => {
        try {
            const decoded = jwtDecode(jwtToken);
            // Kiểm tra token hết hạn chưa (exp tính bằng giây)
            if (decoded.exp * 1000 < Date.now()) {
                throw new Error("Token expired");
            }
            setToken(jwtToken);
            setUser({
                email: decoded.sub,
                role: decoded.role,                     // "admin" hoặc "user"
                tenant_id: decoded.tenant_id,           // ID của công ty
                role_in_tenant: decoded.role_in_tenant  // "tenant_admin", "operator", "viewer"
            });
            localStorage.setItem("navis_token", jwtToken);
        } catch (error) {
            console.error("Token không hợp lệ hoặc đã hết hạn", error);
            logout();
        }
    };

    // Tự động chạy 1 lần khi load lại trang (F5)
    useEffect(() => {
        const savedToken = localStorage.getItem("navis_token");
        if (savedToken) {
            processToken(savedToken);
        }
        setLoading(false);
    }, []);

    const login = (jwtToken) => {
        processToken(jwtToken);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("navis_token");
        navigate('/login');
    };

    if (loading) return <div>Đang tải hệ thống...</div>; // Tránh chớp nhoáng UI

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);