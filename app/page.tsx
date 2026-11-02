// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="landing-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .landing-root {
          min-height: 100vh;
          background-color: #090d16;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .landing-root * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Top Navigation Header */
        .site-header {
          border-bottom: 1px solid #22304d;
          background: rgba(9, 13, 22, 0.9);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 0.85rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-icon {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          padding: 0.5rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-title {
          font-weight: 700;
          font-size: 1.1rem;
          letter-spacing: -0.01em;
          color: #ffffff;
        }

        .brand-badge {
          font-size: 0.75rem;
          color: #94a3b8;
          border: 1px solid #22304d;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          margin-left: 0.5rem;
          background: #131b2e;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        /* Action Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.55rem 1rem;
          border-radius: 7px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-primary {
          background: #f59e0b;
          color: #090d16;
        }
        .btn-primary:hover {
          background: #d97706;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
        }

        .btn-secondary {
          background: #131b2e;
          color: #e2e8f0;
          border: 1px solid #22304d;
        }
        .btn-secondary:hover {
          background: #1a253f;
          border-color: #3b507d;
        }

        .btn-install {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .btn-install:hover {
          background: rgba(16, 185, 129, 0.25);
        }

        /* Hero Wrapper */
        .hero-container {
          max-width: 1150px;
          margin: 0 auto;
          padding: 3.5rem 1.5rem 3rem;
          flex: 1;
        }

        .badge-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 0.3rem 0.85rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .pulse-indicator {
          width: 8px;
          height: 8px;
          background: #f59e0b;
          border-radius: 50%;
          box-shadow: 0 0 8px #f59e0b;
        }

        .hero-headline {
          font-size: clamp(2.1rem, 4.5vw, 3.4rem);
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 1.25rem;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .hero-subtext {
          font-size: 1.15rem;
          color: #94a3b8;
          max-width: 760px;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 3rem;
        }

        /* Defect Photo Showcase */
        .road-showcase {
          position: relative;
          width: 100%;
          height: 380px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #22304d;
          margin-bottom: 4rem;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          background-color: #131b2e;
          background-image: url('/road-banner.jpg');
          background-size: cover;
          background-position: center;
        }

        .road-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(9, 13, 22, 0.2) 0%, rgba(9, 13, 22, 0.85) 100%);
          display: flex;
          align-items: flex-end;
          padding: 1.5rem;
        }

        .road-pill-badge {
          background: rgba(19, 27, 46, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid #22304d;
          padding: 0.6rem 1rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .road-pill-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffffff;
        }

        .road-pill-sub {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        /* Feature Cards Grid */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          border-top: 1px solid #22304d;
          padding-top: 3.5rem;
        }

        .card {
          background: #131b2e;
          border: 1px solid #22304d;
          border-radius: 12px;
          padding: 1.75rem;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          border-color: #3b507d;
        }

        .card-icon {
          display: inline-block;
          margin-bottom: 1rem;
        }

        .card-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .card-desc {
          font-size: 0.925rem;
          color: #94a3b8;
          line-height: 1.6;
        }

        /* Footer */
        .page-footer {
          border-top: 1px solid #22304d;
          padding: 2.25rem 1.5rem;
          text-align: center;
          font-size: 0.825rem;
          color: #64748b;
          line-height: 1.7;
          background: #060910;
        }
      `}} />

      {/* Navigation Bar */}
      <header className="site-header">
        <div className="brand-group">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <span className="brand-title">Road Defect Collector</span>
            <span className="brand-badge">Ga Central Municipal</span>
          </div>
        </div>

        <div className="header-actions">
          {isInstallable && (
            <button onClick={handleInstallClick} className="btn btn-install">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Install Web App</span>
            </button>
          )}

          {/* Direct link straight to the original administrator login page */}
          <Link href="/admin/login" className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            <span>Admin Sign-In</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="hero-container">
        <div className="badge-tag">
          <span className="pulse-indicator"></span>
          <span>Municipal Urban Roads Partnership</span>
        </div>

        <h1 className="hero-headline">
          Monitoring Road Infrastructure in Ga Central Municipality
        </h1>

        <p className="hero-subtext">
          A mobile-friendly reporting and quality-review system connecting citizens and municipal engineers in Ga Central (Sowutuom, Santa Maria, Anyaa, and Ablekuma) to monitor road defects, ensure public privacy, and track maintenance lifecycles[cite: 4, 5].
        </p>

        <div className="hero-actions">
          <Link href="/collect" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>Report Road Defect</span>
          </Link>

          <Link href="/reports" className="btn btn-secondary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <span>Public Tracking Map</span>
          </Link>

          <Link href="/drone" className="btn btn-secondary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Drone AI Pilot</span>
          </Link>
        </div>

        {/* Road Visual Showcase */}
        <div className="road-showcase">
          <div className="road-overlay">
            <div className="road-pill-badge">
              <div style={{ color: '#f59e0b' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 0 0-8-8z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <div className="road-pill-title">Ga Central Defect Inspection Corridor</div>
                <div className="road-pill-sub">Automated GPS intake &bull; YOLOS Tiny Privacy Protection &bull; Verification Triage</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="feature-grid">
          <div className="card">
            <div className="card-icon" style={{ color: '#10b981' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3 className="card-title">Privacy-By-Design Blurring</h3>
            <p className="card-desc">
              Complies with Ghana Data Protection Act (Act 843). Automatically detects and blurs human faces, vehicle bodies, and license plates before storage.
            </p>
          </div>

          <div className="card">
            <div className="card-icon" style={{ color: '#f59e0b' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 0 0-8-8z"/>
              </svg>
            </div>
            <h3 className="card-title">GPS &amp; Digital Addresses</h3>
            <p className="card-desc">
              Captures high-precision device GPS coordinates, timestamps, and GhanaPostGPS digital addresses for rapid assembly engineer dispatch[cite: 4, 5].
            </p>
          </div>

          <div className="card">
            <div className="card-icon" style={{ color: '#38bdf8' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h3 className="card-title">Maintenance Lifecycles</h3>
            <p className="card-desc">
              Follow repair progress through transparent before, in-progress, and after inspection photo timelines and verification stages.
            </p>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="page-footer">
        Pentecost University &bull; Faculty of Engineering and Computing &bull; Department of Industrial Software Engineering[cite: 5]
        <br />
        Project Supervisor: Mr. Harry Atieku-Boateng &bull; Ga Central Municipal Assembly (GCMA) Academic Pilot[cite: 5]
      </footer>
    </div>
  );
}