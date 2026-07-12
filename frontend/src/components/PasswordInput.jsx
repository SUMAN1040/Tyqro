import React, { useState } from 'react';

export default function PasswordInput({ label, id, name, value, onChange, placeholder, required = true }) {
    const [showPassword, setShowPassword] = useState(false);

    const handlePress = (e) => {
        e.preventDefault();
        setShowPassword(true);
    };

    const handleRelease = () => {
        setShowPassword(false);
    };

    return (
        <div className="mb-3">
            {label && <label className="form-label text-secondary small fw-medium" htmlFor={id}>{label}</label>}
            <div className="input-group">
                <input
                    type={showPassword ? "text" : "password"}
                    id={id}
                    name={name}
                    className="form-control"
                    placeholder={placeholder || "••••••••"}
                    value={value}
                    onChange={onChange}
                    required={required}
                    autoComplete="current-password"
                />
                <button
                    type="button"
                    className="btn toggle-password-btn"
                    onPointerDown={handlePress}
                    onPointerUp={handleRelease}
                    onPointerCancel={handleRelease}
                    onMouseLeave={handleRelease}
                    style={{ touchAction: 'none' }}
                >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
            </div>
        </div>
    );
}
