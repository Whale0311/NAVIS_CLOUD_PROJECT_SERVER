// src/components/Layout.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../index.css'; // Đảm bảo import CSS

const Layout = ({ children }) => {
    const navigate = useNavigate();

    // Bảo vệ Route: Nếu chưa đăng nhập thì đá văng ra ngoài
    useEffect(() => {
        const token = localStorage.getItem("navis_token");
        if (!token) {
            navigate('/');
        }
    }, [navigate]);

    // Cập nhật lại phần return trong src/components/Layout.jsx
    return (
        <div style={{ 
            display: 'flex', 
            height: '100vh', 
            width: '100vw', 
            backgroundColor: '#050505', 
            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)', // THÊM DÒNG NÀY VÀO
            color: '#ffffff', 
            overflow: 'hidden' 
        }}>
            <Sidebar />
            <div className="main-content">
                {children}
            </div>
        </div>
    );
};

export default Layout;