import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ExplorePage from './pages/ExplorePage'
import NewsPage from './pages/NewsPage'
import SavedPage from './pages/SavedPage'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  })
}

export default function App() {
  const [queryClient] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="*" element={<NewsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
