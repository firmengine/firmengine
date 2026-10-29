import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import './motion.css';

const App = React.lazy(() => import('./App'));
function Loading() { return <div className="app-loading" role="status" aria-live="polite"><div className="loading-forest"/><div className="loading-content"><span className="loading-mark">✓</span><h1>빚오프</h1><p>오늘의 업무 공간을 준비하고 있습니다.</p><div className="loading-track"><span/></div><small>A NEW BEGINNING</small></div></div>; }
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<Loading />}><App /></React.Suspense></React.StrictMode>);
