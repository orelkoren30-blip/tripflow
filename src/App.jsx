import { useState, useEffect } from 'react'
import { supabase }   from './lib/supabaseClient'
import DashboardPage  from './pages/DashboardPage'
import MyTripsPage    from './pages/MyTripsPage'
import FlowPage       from './pages/FlowPage'
import BuilderPage    from './pages/BuilderPage'
import DiscoverPage   from './pages/DiscoverPage'
import ProfilePage    from './pages/ProfilePage'

export default function App() {
    const [page,         setPage]         = useState('dashboard')
    const [tripId,       setTripId]       = useState(null)
    const [user,         setUser]         = useState(null)
    const [initialModal, setInitialModal] = useState(null) // { coverImageUrl, name }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            setUser(session?.user ?? null)
        })
        return () => subscription.unsubscribe()
    }, [])

    function navigate(to, id = null, modal = null) {
        setPage(to)
        if (id     !== null) setTripId(id)
        if (modal  !== null) setInitialModal(modal)
        window.scrollTo({ top: 0, behavior: 'instant' })
    }

    if (page === 'flow')     return <FlowPage     tripId={tripId} navigate={navigate} user={user} />
    if (page === 'builder')  return <BuilderPage  tripId={tripId} navigate={navigate} user={user} />
    if (page === 'discover') return <DiscoverPage navigate={navigate} user={user} />
    if (page === 'profile')  return <ProfilePage  navigate={navigate} user={user} />
    if (page === 'trips')    return <MyTripsPage  navigate={navigate} user={user} />
    return (
        <DashboardPage
            navigate={navigate}
            user={user}
            initialModal={initialModal}
            clearInitialModal={() => setInitialModal(null)}
        />
    )
}
