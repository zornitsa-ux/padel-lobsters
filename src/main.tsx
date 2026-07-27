import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast'
import { queryClient } from './lib/queryClient'
import { mark } from './lib/perfMarks'
import { prefetchPlayers } from './features/players/usePlayers'
import { prefetchTournaments } from './features/events/useTournaments'
import './index.css'

mark('boot')

// Issue the two requests that gate the most visible home-screen content (the
// greeting name and the next-event card) before React mounts, so they overlap
// with rendering instead of queueing behind it.
prefetchPlayers(queryClient)
prefetchTournaments(queryClient)

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
