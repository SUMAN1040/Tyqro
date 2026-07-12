import React, { useEffect, useState } from 'react';

export default function Landing({ onNavigate }) {
    const [istTime, setIstTime] = useState('00:00:00');

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const ist = new Date(utc + (3600000 * 5.5));
            
            const hours = String(ist.getHours()).padStart(2, '0');
            const minutes = String(ist.getMinutes()).padStart(2, '0');
            const seconds = String(ist.getSeconds()).padStart(2, '0');
            
            setIstTime(`${hours}:${minutes}:${seconds}`);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ backgroundColor: '#f8f9fa', color: '#212529', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            {/* Header / Navbar */}
            <header>
                <nav className="navbar navbar-expand-lg py-2 px-4 px-lg-5 position-fixed top-0 start-50 translate-middle-x mt-4 rounded-pill shadow-sm" style={{ width: '90%', maxWidth: '800px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.05)', zIndex: 1030 }}>
                    <div className="container-fluid px-0">
                        <a className="navbar-brand fs-5 fw-bold text-dark d-flex align-items-center gap-2" href="#" onClick={(e) => { e.preventDefault(); onNavigate('landing'); }}>
                            <img src="/favicon.png" alt="Tyqro Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.src = 'https://raw.githubusercontent.com/SUMAN1040/Tyqro/main/static/img/favicon.png'; }} /> Tyqro
                        </a>
                        <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#publicNav" aria-label="Toggle navigation">
                            <span className="navbar-toggler-icon"></span>
                        </button>
                        <div className="collapse navbar-collapse" id="publicNav">
                            <div className="ms-auto d-flex flex-column flex-lg-row align-items-center gap-2 gap-lg-4">
                                <ul className="navbar-nav mb-2 mb-lg-0 gap-2 gap-lg-3">
                                    <li className="nav-item"><a className="nav-link text-secondary fw-medium px-2" href="#features">Features</a></li>
                                    <li className="nav-item"><a className="nav-link text-secondary fw-medium px-2" href="#how-it-works">How It Works</a></li>
                                    <li className="nav-item"><a className="nav-link text-secondary fw-medium px-2" href="#benefits">Benefits</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </nav>
            </header>

            {/* Main content */}
            <main style={{ paddingTop: '100px' }}>
                {/* 1. HERO SECTION */}
                <section className="hero-section position-relative overflow-hidden pt-5 pb-5 pb-lg-0 text-center text-lg-start">
                    <div className="position-absolute top-0 start-0 w-100 h-100 overflow-hidden" style={{ zIndex: -1, pointerEvents: 'none' }}>
                        <div className="position-absolute" style={{ top: '-10%', left: '-5%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(79,172,254,0.15) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
                        <div className="position-absolute" style={{ bottom: '10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(0,242,254,0.15) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
                    </div>

                    <div className="container position-relative z-1 pt-4 pt-lg-5">
                        <div className="row align-items-center mb-5">
                            {/* Hero Text */}
                            <div className="col-lg-6 mb-5 mb-lg-0 pe-lg-5">
                                <div className="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill mb-4 border border-dark border-opacity-10 bg-white shadow-sm" style={{ backdropFilter: 'blur(10px)' }}>
                                    <span className="badge bg-primary rounded-pill">New</span>
                                    <span className="small text-dark fw-medium">The all-in-one productivity suite</span>
                                </div>
                                
                                <h1 className="display-3 fw-bold mb-4 lh-tight text-dark" style={{ letterSpacing: '-0.04em' }}>
                                    Master your time.<br/>
                                    <span style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Elevate your work.</span>
                                </h1>
                                
                                <p className="lead text-secondary mb-5 fs-5 lh-base">
                                    Tyqro is the ultimate productivity dashboard. Combine precision time tracking, intuitive task management, and powerful analytics into one seamless, beautifully designed platform.
                                </p>
                                
                                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center justify-content-lg-start">
                                    <button onClick={() => onNavigate('signup')} className="btn btn-primary btn-lg rounded-pill px-5 py-3 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2">
                                        Start for free <i className="bi bi-arrow-right"></i>
                                    </button>
                                    <a href="#features" className="btn btn-outline-dark border-opacity-25 btn-lg rounded-pill px-5 py-3 fw-medium shadow-sm">
                                        Explore Features
                                    </a>
                                </div>
                                <div className="mt-4 text-muted small d-flex align-items-center justify-content-center justify-content-lg-start gap-3">
                                    <span><i className="bi bi-check-circle-fill text-success me-1"></i> No credit card required</span>
                                    <span><i className="bi bi-check-circle-fill text-success me-1"></i> Free forever</span>
                                </div>
                            </div>
                            
                            {/* Dashboard Mockup */}
                            <div className="col-lg-6">
                                <div className="position-relative hero-image-container" style={{ transform: 'perspective(1000px) rotateY(-5deg) rotateX(2deg)', transition: 'transform 0.5s ease' }}>
                                    <div className="position-absolute top-50 start-50 translate-middle w-100 h-100 bg-primary opacity-20 rounded-circle" style={{ filter: 'blur(100px)', zIndex: -1 }}></div>
                                    
                                    <div className="border border-dark border-opacity-25 rounded-4 shadow-lg p-4 w-100" style={{ backdropFilter: 'blur(20px)', background: 'rgba(33, 37, 41, 0.9)' }}>
                                        <div className="d-flex align-items-center mb-4 pb-3 border-bottom border-light border-opacity-10">
                                            <div className="d-flex gap-2">
                                                <div className="rounded-circle bg-danger opacity-75" style={{ width: '12px', height: '12px' }}></div>
                                                <div className="rounded-circle bg-warning opacity-75" style={{ width: '12px', height: '12px' }}></div>
                                                <div className="rounded-circle bg-success opacity-75" style={{ width: '12px', height: '12px' }}></div>
                                            </div>
                                            <div className="ms-auto text-secondary small fw-medium" style={{ letterSpacing: '1px' }}>tyqro.app</div>
                                        </div>
                                        
                                        <div className="row g-3 text-start">
                                            {/* Sidebar Mockup */}
                                            <div className="col-4">
                                                <div className="d-flex flex-column gap-3">
                                                    <div className="bg-primary bg-opacity-25 rounded p-2 w-100" style={{ height: '24px' }}></div>
                                                    <div className="bg-white bg-opacity-10 rounded p-2 w-75" style={{ height: '20px' }}></div>
                                                    <div className="bg-white bg-opacity-10 rounded p-2 w-50" style={{ height: '20px' }}></div>
                                                    <div className="bg-white bg-opacity-10 rounded p-2 w-75" style={{ height: '20px' }}></div>
                                                </div>
                                                <div className="mt-4 pt-4 border-top border-light border-opacity-10">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="rounded-circle bg-primary bg-opacity-50" style={{ width: '32px', height: '32px' }}></div>
                                                        <div className="bg-light rounded p-2 w-50" style={{ height: '16px' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Main Content Mockup */}
                                            <div className="col-8">
                                                <div className="bg-light rounded-3 p-4 mb-4 border border-dark border-opacity-10 text-center shadow-sm">
                                                    <div className="text-primary fw-bold small mb-2" style={{ letterSpacing: '0.1em' }}>ACTIVE SESSION</div>
                                                    <div className="display-4 fw-bold text-dark font-monospace" style={{ letterSpacing: '-2px' }}>{istTime}</div>
                                                    <div className="mt-3 bg-gradient rounded-pill mx-auto" style={{ height: '6px', width: '60%', background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)' }}></div>
                                                </div>
                                                
                                                <div className="d-flex flex-column gap-3">
                                                    <div className="d-flex align-items-center gap-3 bg-white bg-opacity-10 p-3 rounded-3 border border-light border-opacity-10">
                                                        <div className="rounded-circle bg-success opacity-75" style={{ width: '16px', height: '16px' }}></div>
                                                        <div className="bg-light bg-opacity-20 rounded w-75" style={{ height: '14px' }}></div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-3 bg-primary bg-opacity-10 p-3 rounded-3 border border-primary border-opacity-25">
                                                        <div className="rounded-circle bg-transparent border border-primary border-2" style={{ width: '16px', height: '16px' }}></div>
                                                        <div className="bg-primary bg-opacity-25 rounded w-50" style={{ height: '14px' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. LOGO CLOUD */}
                <section className="py-4 border-top border-bottom border-dark border-opacity-10 bg-light">
                    <div className="container text-center">
                        <p className="text-uppercase text-muted small fw-bold mb-4" style={{ letterSpacing: '0.1em' }}>Trusted by remote workers & freelancers worldwide</p>
                        <div className="d-flex justify-content-center flex-wrap gap-4 gap-md-5 opacity-50 text-dark">
                            <i className="bi bi-stripe fs-2"></i>
                            <i className="bi bi-github fs-2"></i>
                            <i className="bi bi-slack fs-2"></i>
                            <i className="bi bi-discord fs-2"></i>
                            <i className="bi bi-spotify fs-2"></i>
                        </div>
                    </div>
                </section>

                {/* 3. CORE FEATURES */}
                <section id="features" className="py-5 position-relative">
                    <div className="container py-5">
                        <div className="text-center mb-5">
                            <span className="text-primary fw-bold text-uppercase small" style={{ letterSpacing: '0.1em' }}>Features</span>
                            <h2 className="display-5 fw-bold mb-3 mt-2 text-dark">Everything you need. <br className="d-none d-md-block"/>Nothing you don't.</h2>
                            <p className="lead text-secondary mx-auto" style={{ maxWidth: '700px' }}>We've carefully crafted Tyqro to provide the essential tools for maximum productivity, completely eliminating the clutter found in enterprise software.</p>
                        </div>
                        
                        <div className="row g-4 g-lg-5">
                            <div className="col-md-4">
                                <article className="card h-100 bg-white shadow-sm border-dark border-opacity-10 p-4 p-xl-5 rounded-4 glass-card">
                                    <div className="bg-primary bg-opacity-10 text-primary rounded-4 p-3 mb-4 d-inline-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                                        <i className="bi bi-clock-history fs-3"></i>
                                    </div>
                                    <h3 className="h4 fw-bold mb-3 text-dark">Precision Time Tracking</h3>
                                    <p className="text-secondary lh-lg mb-0">Clock in and clock out with a single click. Keep a detailed log of your working hours, breaks, and daily attendance history with our highly reliable built-in timer mechanism.</p>
                                </article>
                            </div>
                            <div className="col-md-4">
                                <article className="card h-100 bg-white shadow-sm border-dark border-opacity-10 p-4 p-xl-5 rounded-4 glass-card">
                                    <div className="bg-success bg-opacity-10 text-success rounded-4 p-3 mb-4 d-inline-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                                        <i className="bi bi-check2-square fs-3"></i>
                                    </div>
                                    <h3 className="h4 fw-bold mb-3 text-dark">Task Management</h3>
                                    <p className="text-secondary lh-lg mb-0">Organize your day with a lightning-fast todo list. Add tasks instantly, mark them complete, and feel the satisfaction of clearing your daily queue without context switching.</p>
                                </article>
                            </div>
                            <div className="col-md-4">
                                <article className="card h-100 bg-white shadow-sm border-dark border-opacity-10 p-4 p-xl-5 rounded-4 glass-card">
                                    <div className="bg-info bg-opacity-10 text-info rounded-4 p-3 mb-4 d-inline-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                                        <i className="bi bi-graph-up-arrow fs-3"></i>
                                    </div>
                                    <h3 className="h4 fw-bold mb-3 text-dark">Performance Analytics</h3>
                                    <p className="text-secondary lh-lg mb-0">Visualize your productivity trends instantly. Our dashboard generates beautiful heatmaps and statistics showing your tasks completed and hours worked over time.</p>
                                </article>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. HOW IT WORKS */}
                <section id="how-it-works" className="py-5 bg-light border-top border-bottom border-dark border-opacity-10">
                    <div className="container py-5">
                        <div className="text-center mb-5">
                            <h2 className="display-5 fw-bold mb-3 text-dark">Focus on work, not the tool.</h2>
                            <p className="lead text-secondary mx-auto" style={{ maxWidth: '600px' }}>Tyqro is designed to get out of your way so you can get into the flow state faster.</p>
                        </div>

                        {/* Step 1 */}
                        <div className="row align-items-center mb-5 pb-5">
                            <div className="col-lg-6 order-2 order-lg-1 pe-lg-5 text-start">
                                <div className="d-flex align-items-center gap-3 mb-3">
                                    <span className="fs-1 fw-bold text-primary opacity-50">01</span>
                                    <h3 className="h2 fw-bold mb-0 text-dark">Start your session</h3>
                                </div>
                                <p className="text-secondary fs-5 lh-lg mb-4">Hit the "Start Work" button the moment you sit down. Tyqro instantly begins tracking your active session in the background, giving you a clear visual of your daily commitment.</p>
                                <ul className="list-unstyled text-secondary lh-lg">
                                    <li><i className="bi bi-check-lg text-primary me-2"></i> Millisecond precision tracking</li>
                                    <li><i className="bi bi-check-lg text-primary me-2"></i> Beautiful, distraction-free UI</li>
                                    <li><i className="bi bi-check-lg text-primary me-2"></i> Automatic daily archiving</li>
                                </ul>
                            </div>
                            <div className="col-lg-6 order-1 order-lg-2 mb-5 mb-lg-0">
                                <div className="p-4 bg-white border border-dark border-opacity-25 rounded-4 shadow-lg text-center">
                                    <div className="display-1 fw-bold text-primary mb-3" style={{ fontFamily: 'monospace' }}>02:45:12</div>
                                    <button className="btn btn-danger rounded-pill px-4 py-2" disabled>End Work</button>
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="row align-items-center">
                            <div className="col-lg-6 mb-5 mb-lg-0">
                                <div className="p-4 bg-white border border-dark border-opacity-25 rounded-4 shadow-lg text-start">
                                    <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom border-dark border-opacity-10">
                                        <input type="checkbox" className="form-check-input mt-0 fs-4 bg-transparent border-secondary" checked readOnly />
                                        <span className="fs-5 text-secondary text-decoration-line-through">Review pull requests</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                        <input type="checkbox" className="form-check-input mt-0 fs-4 bg-transparent border-secondary" readOnly />
                                        <span className="fs-5 text-dark">Write implementation plan</span>
                                    </div>
                                </div>
                            </div>
                            <div className="col-lg-6 ps-lg-5 text-start">
                                <div className="d-flex align-items-center gap-3 mb-3">
                                    <span className="fs-1 fw-bold text-success opacity-50">02</span>
                                    <h3 className="h2 fw-bold mb-0 text-dark">Knock out tasks</h3>
                                </div>
                                <p className="text-secondary fs-5 lh-lg mb-4">Add your daily objectives to the built-in Todo list. Check them off as you complete them to build momentum and maintain a clear picture of what's left for the day.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. BENEFITS */}
                <section id="benefits" className="py-5 bg-white border-top border-dark border-opacity-10">
                    <div className="container py-5">
                        <div className="text-center mb-5">
                            <span className="text-success fw-bold text-uppercase small" style={{ letterSpacing: '0.1em' }}>Benefits</span>
                            <h2 className="display-5 fw-bold mb-3 mt-2 text-dark">Why choose Tyqro?</h2>
                            <p className="lead text-secondary mx-auto" style={{ maxWidth: '600px' }}>Experience a paradigm shift in how you manage your daily workflow and boost your productivity.</p>
                        </div>
                        <div className="row g-4">
                            <div className="col-md-4">
                                <div className="p-4 p-xl-5 bg-light rounded-4 h-100 border border-dark border-opacity-10 text-center">
                                    <div className="display-4 text-primary mb-3"><i class="bi bi-lightning-charge-fill"></i></div>
                                    <h3 className="h4 fw-bold text-dark mb-3">Built for Speed</h3>
                                    <p className="text-secondary mb-0">Navigate tasks and logs instantly with keyboard shortcuts and a highly optimized interface.</p>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="p-4 p-xl-5 bg-light rounded-4 h-100 border border-dark border-opacity-10 text-center">
                                    <div className="display-4 text-success mb-3"><i class="bi bi-shield-lock-fill"></i></div>
                                    <h3 className="h4 fw-bold text-dark mb-3">Privacy First</h3>
                                    <p className="text-secondary mb-0">Your data belongs to you. We don't sell it, share it, or use it for targeted advertising.</p>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="p-4 p-xl-5 bg-light rounded-4 h-100 border border-dark border-opacity-10 text-center">
                                    <div className="display-4 text-info mb-3"><i class="bi bi-palette-fill"></i></div>
                                    <h3 className="h4 fw-bold text-dark mb-3">Beautiful Design</h3>
                                    <p className="text-secondary mb-0">A minimal, distraction-free environment that actually makes you want to get work done.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. FINAL CTA */}
                <section className="py-5 text-center" style={{ background: 'linear-gradient(180deg, rgba(33, 37, 41, 0) 0%, rgba(0, 242, 254, 0.05) 100%)' }}>
                    <div className="container py-5 my-5">
                        <h2 className="display-4 fw-bold text-dark mb-4">Ready to boost your productivity?</h2>
                        <p className="lead text-secondary mb-5 mx-auto" style={{ maxWidth: '600px' }}>Join thousands of professionals who have simplified their workflow and taken control of their time.</p>
                        <button onClick={() => onNavigate('signup')} className="btn btn-primary btn-lg rounded-pill px-5 py-3 fw-bold shadow-lg fs-5">
                            Create Your Free Account
                        </button>
                        <p className="text-muted mt-3 small">Takes less than 30 seconds to sign up.</p>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-dark border-top border-dark border-opacity-10 pt-5 pb-4 mt-auto text-start">
                <div className="container pt-3">
                    <div className="row gy-5 mb-5 text-white">
                        <div className="col-lg-4 pe-lg-5">
                            <a className="navbar-brand fs-4 fw-bold text-white mb-3 d-inline-flex align-items-center gap-2" href="#" onClick={(e) => { e.preventDefault(); onNavigate('landing'); }}>
                                <img src="/favicon.png" alt="Tyqro Logo" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.src = 'https://raw.githubusercontent.com/SUMAN1040/Tyqro/main/static/img/favicon.png'; }} /> Tyqro.
                            </a>
                            <p className="text-secondary lh-lg mb-4">The ultimate time tracking and productivity platform for freelancers, remote workers, and professionals who want to master their workflow.</p>
                        </div>
                        
                        <div className="col-6 col-lg-2 offset-lg-2">
                            <h5 className="text-white mb-4 fs-6 fw-bold text-uppercase" style={{ letterSpacing: '0.1em' }}>Product</h5>
                            <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                <li><a href="#features" className="text-secondary text-decoration-none">Features</a></li>
                                <li><a href="#how-it-works" className="text-secondary text-decoration-none">How it Works</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} className="text-secondary text-decoration-none">Log in</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('signup'); }} className="text-secondary text-decoration-none">Sign up</a></li>
                            </ul>
                        </div>
                        
                        <div className="col-6 col-lg-2">
                            <h5 className="text-white mb-4 fs-6 fw-bold text-uppercase" style={{ letterSpacing: '0.1em' }}>Resources</h5>
                            <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                <li><a href="#" className="text-secondary text-decoration-none">Blog</a></li>
                                <li><a href="#" className="text-secondary text-decoration-none">Help Center</a></li>
                                <li><a href="#" className="text-secondary text-decoration-none">Contact</a></li>
                            </ul>
                        </div>
                        
                        <div className="col-6 col-lg-2">
                            <h5 className="text-white mb-4 fs-6 fw-bold text-uppercase" style={{ letterSpacing: '0.1em' }}>Legal</h5>
                            <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                <li><a href="#" className="text-secondary text-decoration-none">Privacy Policy</a></li>
                                <li><a href="#" className="text-secondary text-decoration-none">Terms of Service</a></li>
                            </ul>
                        </div>
                    </div>
                    
                    <hr className="border-dark border-opacity-10 mb-4" />
                    
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 text-secondary">
                        <div className="small">
                            &copy; 2026 Tyqro. All rights reserved.
                        </div>
                        <div className="small d-flex align-items-center gap-1">
                            Made with <i className="bi bi-heart-fill text-danger mx-1"></i> for productivity.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
