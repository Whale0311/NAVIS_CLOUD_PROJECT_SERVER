import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
// Import thư viện thông báo và style
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Component Icon Con Mắt (Mở) - Neon `#10b981`
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

// Component Icon Con Mắt (Đóng/Gạch chéo) - Neon `#10b981`
const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
);

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth(); // Lấy hàm login từ Context
    const [currentForm, setCurrentForm] = useState('login'); 
    
    const [formData, setFormData] = useState({
        email: '', password: '', confirmPass: '', code: ''
    });

    // States quản lý hiển thị mật khẩu
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [showCode, setShowCode] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("navis_token");
        if (token) navigate('/dashboard');
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleLogin = async (e) => {
        if (e) e.preventDefault(); // Ngăn trình duyệt tải lại trang khi ấn Enter
        
        if (!formData.email || !formData.password) return toast.warning("Vui lòng nhập đầy đủ thông tin!");
        if (!validateEmail(formData.email)) return toast.error("Định dạng email không hợp lệ!");
        
        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email, password: formData.password })
            });
            const data = await response.json();
            if (response.ok) {
                login(data.access_token); 
                toast.success("Đăng nhập thành công!");
                navigate('/dashboard'); 
            } else {
                toast.error("Lỗi: " + data.detail);
            }
        } catch (error) { toast.error("Lỗi kết nối Server!"); }
    };

    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        
        const { email, password, confirmPass, code } = formData;
        if(!email || !password || !confirmPass || !code) return toast.warning("Vui lòng điền đủ thông tin!");
        if(!validateEmail(email)) return toast.error("Định dạng email không hợp lệ!");
        if(password !== confirmPass) return toast.error("Mật khẩu xác nhận không khớp!");
        
        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, invitation_code: code })
            });
            const data = await response.json();
            if (response.ok) {
                toast.success("Tạo tài khoản thành công! Xin mời đăng nhập.");
                setCurrentForm('login');
            } else {
                toast.error("Lỗi: " + data.detail); 
            }
        } catch (error) { toast.error("Lỗi kết nối Server!"); }
    };

    const handleForgot = async (e) => {
        if (e) e.preventDefault();
        
        if(!formData.email) return toast.warning("Vui lòng nhập Email!");
        if(!validateEmail(formData.email)) return toast.error("Định dạng email không hợp lệ!");
        
        try {
            const response = await fetch("/api/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email })
            });
            const data = await response.json();
            if (response.ok) {
                toast.success(data.message);
                setCurrentForm('login');
            } else { toast.error("Lỗi: " + data.detail); }
        } catch (error) { toast.error("Lỗi kết nối Server!"); }
    };

    // Style inline cho wrapper chứa input và icon
    const inputWrapperStyle = {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    };

    const iconStyle = {
        position: 'absolute',
        right: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px' 
    };

    return (
        <>
            
            <div className="login-container">
            <div className="hero-section">
                <h1 className="brand-title">Navis-Cloud</h1>
                <h2 className="brand-subtitle">Real-time GNSS Threat Intelligence & Monitoring.</h2>
                <p className="brand-desc">A comprehensive cloud platform for continuous monitoring and anomaly detection in raw GNSS signals. Seamlessly processing UBX, RTCM, NMEA, and SDR forensic data to secure your positioning infrastructure.</p>
                <p className="brand-desc" style={{ fontStyle: 'italic', color: '#10b981' }}>Access to the service is limited to invitation-only at this stage.</p>
                <div className="brand-footer">© 2026 Navis-Hust. All rights reserved.</div>
            </div>

            <div className="auth-card">
                {/* FORM ĐĂNG NHẬP */}
                {currentForm === 'login' && (
                    <form className="animate-form" onSubmit={handleLogin}>
                        <div className="auth-header">
                            <h2>WELCOME BACK</h2>
                            <p>Sign in to access your GNSS analysis dashboard</p>
                        </div>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" required />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <div style={inputWrapperStyle}>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="password" 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    placeholder="Enter your password" 
                                    style={{ width: '100%', paddingRight: '40px' }}
                                    required
                                />
                                <span style={iconStyle} onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                                </span>
                            </div>
                        </div>
                        <button type="submit" className="btn-submit">LOGIN</button>
                    </form>
                )}

                {/* FORM ĐĂNG KÝ */}
                {currentForm === 'register' && (
                    <form className="animate-form" onSubmit={handleRegister}>
                        <div className="auth-header">
                            <h2>CREATE ACCOUNT</h2>
                            <p>Join the Navis-Cloud platform</p>
                        </div>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" required />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <div style={inputWrapperStyle}>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="password" 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    placeholder="Create a password" 
                                    style={{ width: '100%', paddingRight: '40px' }}
                                    required
                                />
                                <span style={iconStyle} onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                                </span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Confirm Password</label>
                            <div style={inputWrapperStyle}>
                                <input 
                                    type={showConfirmPass ? "text" : "password"} 
                                    name="confirmPass" 
                                    value={formData.confirmPass} 
                                    onChange={handleChange} 
                                    placeholder="Confirm your password" 
                                    style={{ width: '100%', paddingRight: '40px' }}
                                    required
                                />
                                <span style={iconStyle} onClick={() => setShowConfirmPass(!showConfirmPass)}>
                                    {showConfirmPass ? <EyeIcon /> : <EyeOffIcon />}
                                </span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Invitation Code</label>
                            <div style={inputWrapperStyle}>
                                <input 
                                    type={showCode ? "text" : "password"} 
                                    name="code" 
                                    value={formData.code} 
                                    onChange={handleChange} 
                                    placeholder="Nhập mã xác nhận" 
                                    style={{ width: '100%', paddingRight: '40px' }}
                                    required
                                />
                                <span style={iconStyle} onClick={() => setShowCode(!showCode)}>
                                    {showCode ? <EyeIcon /> : <EyeOffIcon />}
                                </span>
                            </div>
                        </div>
                        <button type="submit" className="btn-submit">REGISTER</button>
                        <div className="auth-switch">
                            <span>Đã có tài khoản? <span className="auth-link" onClick={() => setCurrentForm('login')}>Đăng nhập</span></span>
                        </div>
                    </form>
                )}

                {/* FORM QUÊN MẬT KHẨU */}
                {currentForm === 'forgot' && (
                    <form className="animate-form" onSubmit={handleForgot}>
                        <div className="auth-header">
                            <h2>RESET PASSWORD</h2>
                            <p>We will send a recovery link to your email</p>
                        </div>
                        <div className="input-group">
                            <label>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your registered email" required />
                        </div>
                        <button type="submit" className="btn-submit">SEND RECOVERY LINK</button>
                        <div className="auth-switch">
                            <span className="auth-link" onClick={() => setCurrentForm('login')}>← Quay lại Đăng nhập</span>
                        </div>
                    </form>
                )}
                </div>
            </div>
        </>
    );
};

export default Login;