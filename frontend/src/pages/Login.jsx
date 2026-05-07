import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const navigate = useNavigate();
    // State quản lý việc hiển thị Form nào
    const [currentForm, setCurrentForm] = useState('login'); // 'login' | 'register' | 'forgot'
    
    // State quản lý dữ liệu người dùng nhập
    const [formData, setFormData] = useState({
        email: '', password: '', confirmPass: '', code: ''
    });

    // Tự động chuyển hướng nếu đã có token
    useEffect(() => {
        const token = localStorage.getItem("navis_token");
        if (token) navigate('/dashboard');
    }, [navigate]);

    // Hàm xử lý khi gõ vào ô input
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleLogin = async () => {
        if (!formData.email || !formData.password) return alert("Vui lòng nhập đầy đủ thông tin!");
        if (!validateEmail(formData.email)) return alert("Định dạng email không hợp lệ!");
        
        try {
            const response = await fetch("http://127.0.0.1:8000/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email, password: formData.password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("navis_token", data.access_token);
                navigate('/dashboard'); // Chuyển trang bằng React Router
            } else {
                alert("Lỗi: " + data.detail);
            }
        } catch (error) { alert("Lỗi kết nối Server!"); }
    };

    const handleRegister = async () => {
        const { email, password, confirmPass, code } = formData;
        if(!email || !password || !confirmPass || !code) return alert("Vui lòng điền đủ thông tin!");
        if(!validateEmail(email)) return alert("Định dạng email không hợp lệ!");
        if(password !== confirmPass) return alert("Mật khẩu xác nhận không khớp!");
        
        try {
            const response = await fetch("http://127.0.0.1:8000/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, invitation_code: code })
            });
            const data = await response.json();
            if (response.ok) {
                alert("Tạo tài khoản thành công! Xin mời đăng nhập.");
                setCurrentForm('login');
            } else {
                alert("Lỗi: " + data.detail); 
            }
        } catch (error) { alert("Lỗi kết nối Server!"); }
    };

    const handleForgot = async () => {
        if(!formData.email) return alert("Vui lòng nhập Email!");
        if(!validateEmail(formData.email)) return alert("Định dạng email không hợp lệ!");
        
        try {
            const response = await fetch("http://127.0.0.1:8000/api/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setCurrentForm('login');
            } else { alert("Lỗi: " + data.detail); }
        } catch (error) { alert("Lỗi kết nối Server!"); }
    };

    return (
        <>
            <div className="login-container">
            <div className="hero-section">
                <h1 className="brand-title">Navis-Cloud</h1>
                <h2 className="brand-subtitle">Real-time GNSS interference detection, classification & localization.</h2>
                <p className="brand-desc">Application for anomaly detection in raw GNSS observations. Supports RTCM, NMEA, SBF data formats.</p>
                <p className="brand-desc" style={{ fontStyle: 'italic', color: '#10b981' }}>Access to the service is limited to invitation-only at this stage.</p>
                <div className="brand-footer">© Vũ Đức Anh. All rights reserved.</div>
            </div>

            <div className="auth-card">
                {currentForm === 'login' && (
                    <div className="animate-form">
                        <div className="auth-header">
                            <h2>WELCOME BACK</h2>
                            <p>Sign in to access your GNSS analysis dashboard</p>
                        </div>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter your password" />
                        </div>
                        <button className="btn-submit" onClick={handleLogin}>LOGIN</button>
                        <div className="auth-switch">
                            <span>Chưa có tài khoản? <span className="auth-link" onClick={() => setCurrentForm('register')}>Đăng ký</span></span>
                        </div>
                    </div>
                )}

                {currentForm === 'register' && (
                    <div className="animate-form">
                        <div className="auth-header">
                            <h2>CREATE ACCOUNT</h2>
                            <p>Join the Navis-Cloud platform</p>
                        </div>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Create a password" />
                        </div>
                        <div className="input-group">
                            <label>Confirm Password</label>
                            <input type="password" name="confirmPass" value={formData.confirmPass} onChange={handleChange} placeholder="Confirm your password" />
                        </div>
                        <div className="input-group">
                            <label>Invitation Code</label>
                            <input type="text" name="code" value={formData.code} onChange={handleChange} placeholder="Nhập mã xác nhận" />
                        </div>
                        <button className="btn-submit" onClick={handleRegister}>REGISTER</button>
                        <div className="auth-switch">
                            <span>Đã có tài khoản? <span className="auth-link" onClick={() => setCurrentForm('login')}>Đăng nhập</span></span>
                        </div>
                    </div>
                )}

                {currentForm === 'forgot' && (
                    <div className="animate-form">
                        <div className="auth-header">
                            <h2>RESET PASSWORD</h2>
                            <p>We will send a recovery link to your email</p>
                        </div>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your registered email" />
                        </div>
                        <button className="btn-submit" onClick={handleForgot}>SEND RECOVERY LINK</button>
                        <div className="auth-switch">
                            <span className="auth-link" onClick={() => setCurrentForm('login')}>← Quay lại Đăng nhập</span>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </>
    );
};

export default Login;