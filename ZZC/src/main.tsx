import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles.css'
const isCourtyard = /\/qixia\/?$/.test(location.pathname) || new URLSearchParams(location.search).get('scene') === 'qixia'
const isShixiao = /\/shixiao\/?$/.test(location.pathname) || new URLSearchParams(location.search).get('scene') === 'shixiao'
const isLion = /\/shizi\/?$/.test(location.pathname) || new URLSearchParams(location.search).get('scene') === 'shizi'
const isCampus = /\/campus3d\/?$/.test(location.pathname) || new URLSearchParams(location.search).get('scene') === 'campus3d'
const Page = isShixiao ? React.lazy(() => import('./shixiao/Shixiao')) : isLion ? React.lazy(() => import('./shizi/Shizi')) : isCampus ? React.lazy(() => import('./campus3d/Campus3D')) : isCourtyard ? React.lazy(() => import('./qixia/Qixia')) : React.lazy(() => import('./App'))
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={null}><Page/></React.Suspense></React.StrictMode>)
