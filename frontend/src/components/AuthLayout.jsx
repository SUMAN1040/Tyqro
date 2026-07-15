import React, { useEffect, useState } from 'react';

const testimonials = [
    {
        quote: `"Tyqro has completely changed how our team tracks time. The daily todo list integrated with precise time logs keeps us focused and productive."`,
        author: "Alex Rivera",
        role: "Product Designer"
    },
    {
        quote: `"The cleanest time tracker I've ever used. The performance heatmaps give me a clear picture of my weekly focus and help me stay on track."`,
        author: "Sarah Jenkins",
        role: "Independent Developer"
    },
    {
        quote: `"No complex workflows or enterprise bloat. Just a lightning-fast todo list and a precise, reliable timer. Absolute perfection."`,
        author: "Marcus Chen",
        role: "Freelance Copywriter"
    }
];

export default function AuthLayout({ children, onNavigate, error, success, onDismissAlerts }) {
    const [index, setIndex] = useState(0);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const interval = setInterval(() => {
            setOpacity(0);
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % testimonials.length);
                setOpacity(1);
            }, 500);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="container-fluid p-0 min-vh-100 d-flex flex-column flex-lg-row" style={{ userSelect: 'none' }}>
            {/* Left panel (Marketing, hidden on mobile) */}
            <div className="col-lg-6 d-none d-lg-flex flex-column justify-content-between p-5 text-white position-relative text-start" style={{ background: 'linear-gradient(135deg, #090e17 0%, #152033 100%)', borderRight: '1px solid rgba(255, 255, 255, 0.05)', minHeight: '100vh' }}>
                {/* Logo */}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('landing'); }} className="d-flex align-items-center gap-2 text-decoration-none text-white w-fit-content">
                    <img src="/favicon.png" alt="Tyqro Logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.src = 'https://raw.githubusercontent.com/SUMAN1040/Tyqro/main/static/img/favicon.png'; }} />
                    <span className="fs-4 fw-bold tracking-tight">Tyqro</span>
                </a>
                
                {/* Center message */}
                <div className="my-auto" style={{ maxWidth: '480px' }}>
                    <h1 className="display-5 fw-bold mb-4 lh-sm">
                        Master your time.<br/>
                        <span style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Elevate your work.</span>
                    </h1>
                    <p className="lead text-white-50 fs-5 mb-4">
                        Join thousands of freelancers and remote workers who track precision hours, manage daily tasks, and analyze productivity trends effortlessly.
                    </p>
                    <div className="d-flex flex-column gap-3 mt-4">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                <i className="bi bi-clock-history fs-5"></i>
                            </div>
                            <span className="text-light fw-medium">Precision time tracking</span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-success bg-opacity-10 text-success rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                <i className="bi bi-check2-square fs-5"></i>
                            </div>
                            <span className="text-light fw-medium">Lightning-fast task management</span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-info bg-opacity-10 text-info rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                <i className="bi bi-graph-up-arrow fs-5"></i>
                            </div>
                            <span className="text-light fw-medium">Performance analytics heatmaps</span>
                        </div>
                    </div>
                </div>
                
                {/* Footer / Testimonial */}
                <div className="border-top border-white border-opacity-10 pt-4 mt-auto">
                    <figure className="mb-0" style={{ transition: 'opacity 0.5s ease-in-out', opacity: opacity }}>
                        <blockquote className="blockquote text-light fs-6">
                            <p>{testimonials[index].quote}</p>
                        </blockquote>
                        <figcaption className="blockquote-footer text-white-50 mb-0 mt-1">
                            {testimonials[index].author}, <cite title="Source Title">{testimonials[index].role}</cite>
                        </figcaption>
                    </figure>
                </div>
            </div>
            
            {/* Right panel (Centered auth form) */}
            <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center p-4 p-sm-5 flex-grow-1" style={{ backgroundColor: '#0b0f19', minHeight: '100vh' }}>
                <div className="w-100" style={{ maxWidth: '440px' }}>
                    {/* Logo for mobile */}
                    <div className="d-lg-none text-center mb-4">
                        <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('landing'); }} className="d-inline-flex align-items-center gap-2 text-decoration-none text-white fw-bold fs-3">
                            <img src="/favicon.png" alt="Tyqro Logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.src = 'https://raw.githubusercontent.com/SUMAN1040/Tyqro/main/static/img/favicon.png'; }} /> Tyqro.
                        </a>
                    </div>
                    
                    {/* Card container */}
                    <div className="card bg-dark bg-opacity-50 border border-secondary border-opacity-25 shadow-lg p-4 p-sm-5 rounded-4 text-start">
                        {error && (
                            <div className="alert alert-danger bg-danger text-white alert-dismissible fade show text-center py-2 px-3 small mb-3 border-0 bg-opacity-25 d-flex align-items-center justify-content-between" role="alert">
                                <span>{error}</span>
                                <button type="button" className="btn-close btn-close-white p-0 position-static" onClick={onDismissAlerts} aria-label="Close"></button>
                            </div>
                        )}
                        {success && (
                            <div className="alert alert-success bg-success text-white alert-dismissible fade show text-center py-2 px-3 small mb-3 border-0 bg-opacity-25 d-flex align-items-center justify-content-between" role="alert">
                                <span>{success}</span>
                                <button type="button" className="btn-close btn-close-white p-0 position-static" onClick={onDismissAlerts} aria-label="Close"></button>
                            </div>
                        )}
                        {children}
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .card label.form-label {
                    color: rgba(255, 255, 255, 0.75) !important;
                }
                .card .form-control {
                    background-color: rgba(255, 255, 255, 0.08) !important;
                    border: 1px solid rgba(255, 255, 255, 0.2) !important;
                    color: #fff !important;
                    border-radius: 8px;
                    padding: 0.65rem 1rem;
                    transition: all 0.2s ease-in-out;
                }
                .card .form-control:focus {
                    background-color: rgba(255, 255, 255, 0.12) !important;
                    border-color: #00f2fe !important;
                    box-shadow: 0 0 0 0.25rem rgba(0, 242, 254, 0.2) !important;
                }
                .card .input-group .toggle-password-btn {
                    background-color: rgba(255, 255, 255, 0.08) !important;
                    border: 1px solid rgba(255, 255, 255, 0.2) !important;
                    border-left: none !important;
                    color: rgba(255, 255, 255, 0.6) !important;
                    border-radius: 0 8px 8px 0;
                    transition: all 0.2s ease-in-out;
                }
                .card .input-group .toggle-password-btn:hover {
                    color: #fff !important;
                    background-color: rgba(255, 255, 255, 0.12) !important;
                }
                .card .input-group:has(.toggle-password-btn) .form-control {
                    border-right: none !important;
                    border-radius: 8px 0 0 8px !important;
                }
            `}} />
        </div>
    );
}